'use strict';

// Headless-Chromium PDF rendering for the server-side templates.
// The browser is launched per render and always closed, so it holds no idle
// memory between exports; serializeRender keeps only one Chromium alive at a
// time to stay within the 512MB instance budget.

const puppeteer = require('puppeteer');

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--disable-gpu',
];

// Serialize renders: requests queue rather than launch concurrent browsers.
let renderChain = Promise.resolve();
function serializeRender(task) {
    const result = renderChain.then(task, task);
    renderChain = result.then(() => {}, () => {});
    return result;
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Header/footer templates render in an isolated context without web fonts,
// so they use system fonts and explicit sizes/colours.
function footerTemplate(label) {
    return `<div style="width:100%;padding:0 15mm;box-sizing:border-box;text-align:right;`
        + `font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:7.5pt;`
        + `color:#8a8a84;-webkit-print-color-adjust:exact;">`
        + `${escapeHtml(label)}&nbsp;&nbsp;·&nbsp;&nbsp;<span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>`
        + `</div>`;
}

const FONT_WAIT_MS = 5000;

// When the content spills just past a page break (e.g. a lone last section on
// page 2), print slightly smaller instead of leaving a nearly empty page.
// Never below MIN_FIT_SCALE, so type stays comfortably legible.
const MIN_FIT_SCALE = 0.9;

function countPages(pdf) {
    return (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function renderPdf(html, { footerLabel, fitToSavePage = true } = {}) {
    const browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
    try {
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
        } catch (err) {
            // A slow/unreachable font CDN must not fail the export: the content
            // is already in the page and falls back to system fonts.
            if (!err || err.name !== 'TimeoutError') throw err;
        }
        await Promise.race([
            page.evaluate(() => document.fonts.ready.then(() => true)),
            new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
        ]);

        const print = async (scale) => Buffer.from(await page.pdf({
            format: 'A4',
            scale,
            printBackground: true,
            displayHeaderFooter: !!footerLabel,
            headerTemplate: '<span></span>',
            footerTemplate: footerLabel ? footerTemplate(footerLabel) : '<span></span>',
            margin: { top: '15mm', bottom: '16mm', left: '15mm', right: '15mm' },
        }));

        const pdf = await print(1);
        const pages = countPages(pdf);
        if (!fitToSavePage || pages < 2) return pdf;

        let best = await print(MIN_FIT_SCALE);
        if (countPages(best) >= pages) return pdf; // too long to save a page: keep full size
        // Largest scale that still saves the page (a few bisection steps).
        let lo = MIN_FIT_SCALE;
        let hi = 1;
        for (let i = 0; i < 3; i++) {
            const mid = Math.round(((lo + hi) / 2) * 1000) / 1000;
            const candidate = await print(mid);
            if (countPages(candidate) < pages) { lo = mid; best = candidate; } else { hi = mid; }
        }
        return best;
    } finally {
        await browser.close();
    }
}

module.exports = { renderPdf, serializeRender, countPages };
