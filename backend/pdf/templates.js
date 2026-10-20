'use strict';

// Server-side HTML templates for the exported PDFs (resume + cover letter).
// They are rendered by Puppeteer `setContent` (see ./render.js), so they never
// depend on loading the public page. Both documents share one header block
// and the website's type system (Space Grotesk / Inter / JetBrains Mono, one
// blue accent), laid out as a compact, single-column, ATS-friendly A4 page.

const FONTS_HREF = 'https://fonts.googleapis.com/css2'
    + '?family=Inter:wght@400;500;600'
    + '&family=JetBrains+Mono:wght@400;500'
    + '&family=Space+Grotesk:wght@500;700'
    + '&display=swap';

const STRINGS = {
    en: {
        locale: 'en-US',
        present: 'Present',
        summary: 'Summary',
        experience: 'Experience',
        skills: 'Skills',
        projects: 'Projects',
        education: 'Education',
        otherSkills: 'Other',
        resumeDoc: 'CV',
        letterDoc: 'Cover Letter',
        greetingCompany: (company) => `Hiring Team at ${company},`,
        greeting: 'Dear Hiring Team,',
        closing: 'Sincerely,',
    },
    es: {
        locale: 'es-ES',
        present: 'Actualidad',
        summary: 'Resumen',
        experience: 'Experiencia',
        skills: 'Habilidades',
        projects: 'Proyectos',
        education: 'Educación',
        otherSkills: 'Otros',
        resumeDoc: 'Currículum',
        letterDoc: 'Carta de presentación',
        greetingCompany: (company) => `Equipo de Contratación en ${company},`,
        greeting: 'Estimado equipo de selección,',
        closing: 'Atentamente,',
    },
};

const lang = (language) => (language === 'es' ? 'es' : 'en');

// --- Text helpers ---------------------------------------------------------

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function clean(value) {
    return value == null ? '' : String(value).trim();
}

// Escaped text with single newlines turned into <br>.
function withBreaks(text) {
    return clean(text).split(/\r?\n/).map((l) => esc(l.trim())).join('<br>');
}

// Paragraphs split on blank lines; single newlines inside a paragraph become <br>.
function paragraphs(text, className) {
    const cls = className ? ` class="${className}"` : '';
    return clean(text)
        .split(/\r?\n\s*\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p${cls}>${withBreaks(p)}</p>`)
        .join('\n');
}

// --- Dates ------------------------------------------------------------------

// Returns { y, m } (m zero-based) for a pg DATE (a JS Date at local midnight),
// a UTC-midnight Date, a 'YYYY-MM-DD' / 'YYYY-MM' string, or a full ISO
// timestamp, without the classic "UTC midnight shows as the previous day" drift.
function calendarParts(value) {
    if (value == null || value === '') return null;
    let date = value;
    if (!(value instanceof Date)) {
        const s = String(value).trim();
        const plain = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(s);
        if (plain) return { y: Number(plain[1]), m: Number(plain[2]) - 1 };
        date = new Date(s);
    }
    if (Number.isNaN(date.getTime())) return null;
    const utcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0
        && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
    return utcMidnight
        ? { y: date.getUTCFullYear(), m: date.getUTCMonth() }
        : { y: date.getFullYear(), m: date.getMonth() };
}

const monthFormatters = {};
function formatMonth(parts, language) {
    const t = STRINGS[lang(language)];
    if (!monthFormatters[t.locale]) {
        monthFormatters[t.locale] = new Intl.DateTimeFormat(t.locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    const s = monthFormatters[t.locale].format(Date.UTC(parts.y, parts.m, 15)).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function dateRange(start, end, language) {
    const s = calendarParts(start);
    const e = calendarParts(end);
    if (!s && !e) return '';
    if (!s) return formatMonth(e, language);
    const from = formatMonth(s, language);
    if (!e) return `${from} – ${STRINGS[lang(language)].present}`;
    const to = formatMonth(e, language);
    return from === to ? from : `${from} – ${to}`;
}

function longDate(language, date = new Date()) {
    return date.toLocaleDateString(STRINGS[lang(language)].locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

// --- Links ------------------------------------------------------------------

// "https://www.linkedin.com/in/x/" -> "linkedin.com/in/x"
function shortUrl(url, { keepQuery = false } = {}) {
    let s = clean(url)
        .replace(/^mailto:/i, '')
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .replace(/^\/\//, '')
        .replace(/^www\./i, '');
    if (!keepQuery) s = s.replace(/[?#].*$/, '');
    return s.replace(/\/+$/, '');
}

const FILE_EXT = /\.(html?|php|aspx?|pdf|jpe?g|png|gif|svg|webp|txt|md|json|xml|js|css)$/i;

// A bare "example.com/path" or "www.example.com" (no scheme) is an external host.
function looksLikeHost(s) {
    const first = s.split(/[/?#]/)[0];
    return /^www\./i.test(first) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(first) && !FILE_EXT.test(first));
}

function absoluteExternal(value) {
    const s = clean(value);
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    return `https://${s.replace(/^\/+/, '')}`;
}

// Profile handles stored without a host ("martomarzo") get the service's URL.
function profileUrl(value, host) {
    const s = clean(value).replace(/^@/, '');
    if (!s) return '';
    if (/^[\w.-]+$/.test(s) && !s.includes('.')) return `https://${host}${s}`;
    return absoluteExternal(s);
}

// Project links: absolute URLs and mailto: stay; anything relative is resolved
// against the public site; the server page carries the version slug so its
// "Back" link returns to the same version. Other schemes are dropped.
function resolveProjectLink(link, publicUrl, slug) {
    const raw = clean(link);
    if (!raw) return '';
    const base = clean(publicUrl).replace(/\/+$/, '');
    let href;
    if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) href = raw;
    else if (raw.startsWith('//')) href = `https:${raw}`;
    else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
    else if (looksLikeHost(raw)) href = `https://${raw}`;
    else if (base) href = `${base}/${raw.replace(/^(\.\/|\/)+/, '')}`;
    else return '';
    if (slug && /server-info\.html/i.test(href) && !/[?&]from=/.test(href)) {
        href += `${href.includes('?') ? '&' : '?'}from=${encodeURIComponent(slug)}`;
    }
    return href;
}

function link(href, text, className) {
    const cls = className ? ` class="${className}"` : '';
    return `<a${cls} href="${esc(href)}">${text}</a>`;
}

// Contact items shared by both documents, as visible text links.
function contactItems({ email, phone, linkedin, github, website, cvUrl }) {
    const items = [];
    const mail = clean(email);
    if (mail) items.push(link(`mailto:${mail}`, esc(mail)));
    const tel = clean(phone);
    const digits = tel.replace(/[^\d]/g, '');
    if (tel && digits) items.push(link(`https://wa.me/${digits}`, esc(tel)));
    const li = profileUrl(linkedin, 'www.linkedin.com/in/');
    if (li) items.push(link(li, esc(shortUrl(li))));
    const gh = profileUrl(github, 'github.com/');
    if (gh) items.push(link(gh, esc(shortUrl(gh))));
    const web = absoluteExternal(website);
    if (web) items.push(link(web, esc(shortUrl(web))));
    const cv = absoluteExternal(cvUrl);
    if (cv) items.push(link(cv, `<span class="label">CV:</span> ${esc(shortUrl(cv, { keepQuery: true }))}`));
    return items;
}

function headerBlock({ name, subtitle, contacts, photoDataUri }) {
    const nm = clean(name);
    const sub = clean(subtitle);
    const photo = clean(photoDataUri);
    const lines = [
        nm ? `<h1 class="name">${esc(nm)}</h1>` : '',
        sub ? `<p class="role">${esc(sub)}</p>` : '',
        contacts.length ? `<p class="contact"><span class="contact-line">${contacts.join(' ')}</span></p>` : '',
    ].filter(Boolean);
    if (!lines.length && !photo) return '';
    return `<header class="head">
  ${lines.length ? `<div class="id">\n    ${lines.join('\n    ')}\n  </div>` : ''}
  ${photo ? `<img class="photo" src="${esc(photo)}" alt="${esc(nm)}">` : ''}
</header>`;
}

// --- Shared stylesheet ------------------------------------------------------

const BASE_CSS = `
:root {
  --ink: #111110;
  --body: #2b2b28;
  --muted: #5d5d58;
  --faint: #9a9a93;
  --rule: #dcdcd6;
  --accent: #0273ad;
  --f-display: 'Space Grotesk', 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --f-body: 'Inter', -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --f-mono: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: var(--f-body);
  font-size: 9.5pt;
  line-height: 1.45;
  color: var(--body);
  background: #fff;
  font-kerning: normal;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
p, li { text-wrap: pretty; }

.head { display: flex; align-items: center; justify-content: space-between; gap: 8mm;
  padding-bottom: 4.5mm; border-bottom: 0.75pt solid var(--rule); }
.id { min-width: 0; }
.name { font-family: var(--f-display); font-weight: 700; font-size: 25pt; line-height: 1;
  letter-spacing: -0.03em; color: var(--ink); }
.name::after { content: ''; display: inline-block; width: 0.15em; height: 0.15em;
  margin-left: 0.06em; background: var(--accent); }
.role { margin-top: 2.4mm; font-family: var(--f-mono); font-weight: 500; font-size: 7.75pt;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); }
/* Each item carries a leading separator; the line is shifted left by the
   separator's width and clipped, so separators never start or end a line. */
.contact { margin-top: 2.8mm; overflow: hidden; font-size: 8.75pt; line-height: 1.5; color: var(--ink); }
.contact-line { display: block; margin-left: -0.9em; }
.contact a { white-space: nowrap; }
.contact a::before { content: '·'; display: inline-block; width: 0.9em; padding-right: 0.45em;
  text-align: right; color: var(--faint); }
.contact .label { color: var(--muted); }
.photo { flex: none; width: 22mm; height: 22mm; border-radius: 50%; object-fit: cover; }
`;

function documentHtml({ language, title, css, body }) {
    return `<!doctype html>
<html lang="${lang(language)}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(FONTS_HREF)}">
<style>${BASE_CSS}${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// --- Resume -----------------------------------------------------------------

const RESUME_CSS = `
.sec { margin-top: 5.2mm; }
.sec-title { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.6mm;
  font-family: var(--f-mono); font-weight: 500; font-size: 7.5pt; line-height: 1.4;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent);
  break-after: avoid; page-break-after: avoid; }
.sec-title::after { content: ''; flex: 1; border-top: 0.75pt solid var(--rule); }

.summary p { font-size: 9.75pt; line-height: 1.5; color: var(--body); }
.summary p + p { margin-top: 1.6mm; }

.entry { break-inside: avoid; page-break-inside: avoid; }
.entry + .entry { margin-top: 3.4mm; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 5mm; }
.entry-title { font-size: 9.75pt; line-height: 1.35; font-weight: 600; color: var(--ink); }
.entry-title .org { font-weight: 400; color: var(--muted); }
.entry-meta { flex: none; font-family: var(--f-mono); font-size: 7.5pt; letter-spacing: 0.01em;
  color: var(--muted); white-space: nowrap; }
.entry-meta a { color: var(--accent); }
.entry-text { margin-top: 0.9mm; }
.bullets { list-style: none; margin-top: 1mm; }
.bullets li { position: relative; padding-left: 3.6mm; }
.bullets li + li { margin-top: 0.5mm; }
.bullets li::before { content: ''; position: absolute; left: 0.4mm; top: 0.6em;
  width: 1.05mm; height: 1.05mm; background: var(--accent); }

.skills { display: grid; grid-template-columns: 36mm 1fr; column-gap: 5mm; row-gap: 1.2mm; }
.skills dt { font-weight: 600; color: var(--ink); }
.skills dd { color: var(--body); }
`;

function sectionTitle(version, key, t) {
    return clean(version[`title_${key}`]) || t[key];
}

function descriptionHtml(text) {
    const lines = clean(text)
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^[-•*·▪–—]\s+/, ''))
        .filter(Boolean);
    if (!lines.length) return '';
    if (lines.length === 1) return `<p class="entry-text">${esc(lines[0])}</p>`;
    return `<ul class="bullets">\n${lines.map((l) => `      <li>${esc(l)}</li>`).join('\n')}\n    </ul>`;
}

function entryHtml({ title, org, meta, body }) {
    return `<div class="entry">
    <div class="entry-head">
      <h3 class="entry-title">${esc(title)}${org ? ` <span class="org">— ${esc(org)}</span>` : ''}</h3>
      ${meta ? `<span class="entry-meta">${meta}</span>` : ''}
    </div>
    ${body}
  </div>`;
}

function section(key, title, inner) {
    if (!inner) return '';
    return `<section class="sec sec-${key}">
  <h2 class="sec-title">${esc(title)}</h2>
  ${inner}
</section>`;
}

function buildResumeHtml(resume, { language, publicUrl, photoDataUri } = {}) {
    const L = lang(language);
    const t = STRINGS[L];
    const version = (resume && resume.version) || {};
    const shown = (key) => version[`show_${key}`] !== false;
    const name = clean(version.contact_name);

    const header = headerBlock({
        name,
        subtitle: version.subtitle,
        contacts: contactItems(version),
        photoDataUri,
    });

    const parts = [];

    const summaryText = resume && resume.summary ? clean(resume.summary.content) : '';
    if (shown('summary') && summaryText) {
        parts.push(section('summary', sectionTitle(version, 'summary', t), `<div class="summary">${paragraphs(summaryText)}</div>`));
    }

    if (shown('experience')) {
        const items = (resume.experience || [])
            .filter((e) => clean(e.role) || clean(e.company))
            .map((e) => entryHtml({
                title: clean(e.role) || clean(e.company),
                org: clean(e.role) ? clean(e.company) : '',
                meta: esc(dateRange(e.start_date, e.end_date, L)),
                body: descriptionHtml(e.description),
            }));
        parts.push(section('experience', sectionTitle(version, 'experience', t), items.join('\n  ')));
    }

    if (shown('skills')) {
        const groups = new Map();
        for (const s of resume.skills || []) {
            const skill = clean(s.name);
            if (!skill) continue;
            const cat = clean(s.category) || t.otherSkills;
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(skill);
        }
        const rows = [...groups].map(([cat, names]) => `<dt>${esc(cat)}</dt><dd>${esc(names.join(', '))}</dd>`);
        parts.push(section('skills', sectionTitle(version, 'skills', t), rows.length ? `<dl class="skills">\n    ${rows.join('\n    ')}\n  </dl>` : ''));
    }

    if (shown('projects')) {
        const items = (resume.projects || [])
            .filter((p) => clean(p.name))
            .map((p) => {
                const href = resolveProjectLink(p.link, publicUrl, version.slug);
                return entryHtml({
                    title: clean(p.name),
                    meta: href ? link(href, esc(shortUrl(href))) : '',
                    body: descriptionHtml(p.description),
                });
            });
        parts.push(section('projects', sectionTitle(version, 'projects', t), items.join('\n  ')));
    }

    if (shown('education')) {
        const items = (resume.education || [])
            .filter((e) => clean(e.degree) || clean(e.institution))
            .map((e) => entryHtml({
                title: clean(e.degree) || clean(e.institution),
                org: clean(e.degree) ? clean(e.institution) : '',
                meta: esc(dateRange(e.start_date, e.end_date, L)),
                body: descriptionHtml(e.description),
            }));
        parts.push(section('education', sectionTitle(version, 'education', t), items.join('\n  ')));
    }

    return documentHtml({
        language: L,
        title: name ? `${name} — ${t.resumeDoc}` : t.resumeDoc,
        css: RESUME_CSS,
        body: [header, ...parts].filter(Boolean).join('\n'),
    });
}

// --- Cover letter -------------------------------------------------------------

const LETTER_CSS = `
body { font-size: 10.5pt; line-height: 1.55; }
.letter { padding: 5mm 6mm 0; }
.date { margin-top: 10mm; font-family: var(--f-mono); font-size: 8pt; letter-spacing: 0.04em; color: var(--muted); }
.greeting { margin-top: 8mm; color: var(--ink); font-weight: 500; }
.body { margin-top: 4.5mm; }
.para { color: var(--body); }
.para + .para { margin-top: 3.4mm; }
.closing { margin-top: 8mm; color: var(--body); }
.signature { margin-top: 1.6mm; font-family: var(--f-display); font-weight: 700; font-size: 13pt;
  letter-spacing: -0.02em; color: var(--ink); }
`;

function buildCoverLetterHtml({ text, candidateName, subtitle, email, phone, linkedin, website, cvUrl, companyName, language } = {}) {
    const L = lang(language);
    const t = STRINGS[L];
    const name = clean(candidateName);
    const company = clean(companyName);

    const header = headerBlock({
        name,
        subtitle,
        contacts: contactItems({ email, phone, linkedin, website, cvUrl }),
    });
    const body = paragraphs(text, 'para');

    const html = [
        header,
        `<p class="date">${esc(longDate(L))}</p>`,
        `<p class="greeting">${esc(company ? t.greetingCompany(company) : t.greeting)}</p>`,
        body ? `<div class="body">\n${body}\n</div>` : '',
        `<p class="closing">${esc(t.closing)}</p>`,
        name ? `<p class="signature">${esc(name)}</p>` : '',
    ].filter(Boolean).join('\n');

    return documentHtml({
        language: L,
        title: name ? `${name} — ${t.letterDoc}` : t.letterDoc,
        css: LETTER_CSS,
        body: `<main class="letter">\n${html}\n</main>`,
    });
}

// --- Filenames ----------------------------------------------------------------

// 'Martín Marzorati', 'es' -> 'Martin-Marzorati-CV-ES.pdf'
function resumeFilename(name, language) {
    const base = clean(name)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const suffix = `CV-${lang(language).toUpperCase()}.pdf`;
    return base ? `${base}-${suffix}` : suffix;
}

module.exports = {
    buildResumeHtml,
    buildCoverLetterHtml,
    resumeFilename,
    // exported for reuse/tests
    escapeHtml: esc,
    dateRange,
    resolveProjectLink,
    shortUrl,
};
