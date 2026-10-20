/* portfolio-main.js v4.0 — public CV page + server documentation page.
   Content renders without any animation library; GSAP / ScrollTrigger / Lenis
   only enhance it when they load and the visitor hasn't asked for reduced motion. */
(() => {
    'use strict';

    const API = '/api';
    const root = document.documentElement;
    const params = new URLSearchParams(window.location.search);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const I18N = {
        en: {
            nav_about: 'About', nav_experience: 'Experience', nav_skills: 'Skills',
            nav_projects: 'Projects', nav_education: 'Education',
            contact: 'Contact', menu: 'Menu', close: 'Close', skip: 'Skip to content',
            getInTouch: 'Get in touch', downloadCv: 'Download CV', preparing: 'Preparing…',
            downloadFailed: 'Try again later', viewProject: 'View project',
            present: 'Present', ongoing: 'Ongoing',
            letsWork: "Let's work together", copyEmail: 'Copy', copied: 'Copied',
            backToTop: 'Back to top', rights: 'All rights reserved.',
            switchTheme: 'Switch theme', language: 'Language', contactLinks: 'Contact links',
            notFoundTitle: 'Not found', notFoundText: "This resume version doesn't exist or has moved.",
            notFoundCta: 'View main resume', loadErrorTitle: 'Offline',
            loadErrorText: "The resume couldn't be loaded. Check your connection and try again.",
            retry: 'Try again', scroll: 'Scroll',
            yr: 'yr', yrs: 'yrs', mo: 'mo', mos: 'mos',
            email: 'Email', whatsapp: 'WhatsApp', website: 'Website', otherSkills: 'Other',
        },
        es: {
            nav_about: 'Perfil', nav_experience: 'Experiencia', nav_skills: 'Habilidades',
            nav_projects: 'Proyectos', nav_education: 'Formación',
            contact: 'Contacto', menu: 'Menú', close: 'Cerrar', skip: 'Saltar al contenido',
            getInTouch: 'Hablemos', downloadCv: 'Descargar CV', preparing: 'Preparando…',
            downloadFailed: 'Inténtalo más tarde', viewProject: 'Ver proyecto',
            present: 'Actualidad', ongoing: 'En curso',
            letsWork: 'Trabajemos juntos', copyEmail: 'Copiar', copied: 'Copiado',
            backToTop: 'Volver arriba', rights: 'Todos los derechos reservados.',
            switchTheme: 'Cambiar tema', language: 'Idioma', contactLinks: 'Enlaces de contacto',
            notFoundTitle: 'No encontrado', notFoundText: 'Esta versión del CV no existe o se ha movido.',
            notFoundCta: 'Ver CV principal', loadErrorTitle: 'Sin conexión',
            loadErrorText: 'No se pudo cargar el CV. Revisa tu conexión e inténtalo de nuevo.',
            retry: 'Reintentar', scroll: 'Desliza',
            yr: 'año', yrs: 'años', mo: 'mes', mos: 'meses',
            email: 'Email', whatsapp: 'WhatsApp', website: 'Web', otherSkills: 'Otros',
        },
    };

    const lang = params.get('lang') === 'es' ? 'es' : 'en';
    const locale = lang === 'es' ? 'es-ES' : 'en-US';
    const t = (key) => (I18N[lang][key] ?? I18N.en[key] ?? key);
    const SECTIONS = ['about', 'experience', 'skills', 'projects', 'education'];

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const state = { slug: null, motion: false, lenis: null, menuOpen: false };

    // ---------------------------------------------------------------- dates

    // DATE columns arrive as ISO strings at (server-local) midnight; nudging by
    // 12h before reading UTC parts keeps the calendar month stable in any timezone.
    function toYearMonth(value) {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        const shifted = new Date(d.getTime() + 12 * 3600 * 1000);
        return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() };
    }

    const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    function formatMonth(ym) {
        if (!ym) return '';
        const s = monthFmt.format(new Date(Date.UTC(ym.y, ym.m, 15))).replace('.', '');
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function formatRange(start, end, openLabel) {
        const a = formatMonth(toYearMonth(start));
        const b = end ? formatMonth(toYearMonth(end)) : openLabel;
        return a ? `${a} – ${b}` : b;
    }

    function formatDuration(start, end) {
        const a = toYearMonth(start);
        if (!a) return '';
        const now = new Date();
        const b = toYearMonth(end) || { y: now.getFullYear(), m: now.getMonth() };
        const months = (b.y - a.y) * 12 + (b.m - a.m) + 1;
        if (months <= 0) return '';
        const y = Math.floor(months / 12);
        const m = months % 12;
        const parts = [];
        if (y) parts.push(`${y} ${y === 1 ? t('yr') : t('yrs')}`);
        if (m) parts.push(`${m} ${m === 1 ? t('mo') : t('mos')}`);
        return parts.join(' ');
    }

    // ------------------------------------------------------------ utilities

    function textToHtml(text) {
        return esc(text).replace(/\n/g, '<br>');
    }

    // Admin-entered links: allow web, mail and relative links only (never javascript: etc.).
    function safeUrl(url) {
        const value = String(url || '').trim();
        if (!value) return null;
        if (/^(https?:|mailto:|tel:)/i.test(value) || value.startsWith('//')) return value;
        if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
        return value;
    }

    function prettyUrl(url) {
        return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    }

    function navOffset() {
        const nav = $('.site-nav');
        return nav ? nav.offsetHeight : 0;
    }

    function scrollToTarget(target) {
        if (state.lenis) {
            state.lenis.scrollTo(target === 0 ? 0 : target, { offset: target === 0 ? 0 : -navOffset() + 1, duration: 1.3 });
            return;
        }
        const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - navOffset() + 1;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    async function fetchJson(url) {
        const res = await fetch(url);
        if (res.status === 404) return { notFound: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // ------------------------------------------------------------- chrome

    function initMotion() {
        state.motion = !reduceMotion && typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
        if (state.motion) {
            gsap.registerPlugin(ScrollTrigger);
            gsap.config({ nullTargetWarn: false });
        } else {
            root.classList.add('no-motion');
        }

        if (!reduceMotion && typeof window.Lenis === 'function') {
            try {
                state.lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
                if (state.motion) {
                    state.lenis.on('scroll', ScrollTrigger.update);
                    gsap.ticker.add((time) => state.lenis.raf(time * 1000));
                    gsap.ticker.lagSmoothing(0);
                } else {
                    const raf = (time) => { state.lenis.raf(time); requestAnimationFrame(raf); };
                    requestAnimationFrame(raf);
                }
            } catch (err) {
                state.lenis = null;
            }
        }
    }

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href').slice(1);
            if (!id) return;
            const target = id === 'home' ? 0 : document.getElementById(id);
            if (target === null) return;
            e.preventDefault();
            if (state.menuOpen) toggleMenu(false);
            scrollToTarget(target);
            if (target !== 0) {
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }
        });
    }

    function initScrollChrome() {
        const nav = $('.site-nav');
        const bar = $('.scroll-progress');
        let lastY = window.scrollY;
        let ticking = false;

        const update = () => {
            ticking = false;
            const y = window.scrollY;
            if (nav) {
                nav.classList.toggle('is-scrolled', y > 24);
                if (!state.menuOpen) {
                    if (y > lastY + 6 && y > 520) nav.classList.add('is-hidden');
                    else if (y < lastY - 6 || y < 520) nav.classList.remove('is-hidden');
                }
            }
            if (bar && !root.classList.contains('is-loading')) {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
            }
            lastY = y;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        nav?.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
        update();
    }

    function initTheme() {
        const buttons = $$('.theme-toggle');
        const metas = $$('meta[name="theme-color"]');
        const syncMeta = () => {
            const bg = getComputedStyle(document.body).backgroundColor;
            metas.forEach((m) => m.setAttribute('content', bg));
        };

        const apply = () => {
            root.classList.toggle('light-mode');
            const isLight = root.classList.contains('light-mode');
            try { localStorage.setItem('theme-mode', isLight ? 'light' : 'dark'); } catch (e) { /* storage off */ }
        };

        buttons.forEach((btn) => {
            btn.setAttribute('aria-label', t('switchTheme'));
            btn.addEventListener('click', () => {
                if (!document.startViewTransition || reduceMotion) {
                    apply();
                    syncMeta();
                    return;
                }
                const r = btn.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
                root.classList.add('theme-switching');
                const vt = document.startViewTransition(apply);
                vt.ready.then(() => {
                    root.animate(
                        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                        { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
                    );
                }).catch(() => {});
                vt.finished.finally(() => { root.classList.remove('theme-switching'); syncMeta(); });
            });
        });
    }

    // ------------------------------------------------------- portfolio UI

    function applyStaticI18n() {
        root.setAttribute('lang', lang);
        $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
        $$('.nav-links a[data-nav]').forEach((a) => { a.textContent = t(`nav_${a.dataset.nav}`); });
        $('.lang-switch')?.setAttribute('aria-label', t('language'));
        $('.contact-info')?.setAttribute('aria-label', t('contactLinks'));
        const cue = $('.scroll-cue span');
        if (cue) cue.textContent = t('scroll');
    }

    function initLangSwitch() {
        const group = $('.lang-switch');
        if (!group) return;
        group.dataset.active = lang;
        $$('.lang-btn', group).forEach((btn) => {
            const active = btn.dataset.lang === lang;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
            btn.addEventListener('click', () => {
                if (btn.dataset.lang === lang) return;
                group.dataset.active = btn.dataset.lang;
                const next = new URLSearchParams(window.location.search);
                next.set('v', state.slug || params.get('v') || 'pm');
                next.set('lang', btn.dataset.lang);
                document.body.style.transition = 'opacity 0.25s ease';
                document.body.style.opacity = '0';
                setTimeout(() => { window.location.search = next.toString(); }, reduceMotion ? 0 : 220);
            });
        });
    }

    function buildMobileMenu() {
        const list = $('.mobile-menu-links');
        if (!list) return;
        const links = $$('.nav-links a[data-nav]').filter((a) => !a.hidden);
        list.innerHTML = links.map((a, i) => `
            <li><a href="${a.getAttribute('href')}" style="--i:${i}"><small>${String(i + 1).padStart(2, '0')}</small>${esc(a.textContent)}</a></li>
        `).join('');
    }

    function toggleMenu(force) {
        const open = typeof force === 'boolean' ? force : !state.menuOpen;
        state.menuOpen = open;
        const btn = $('.menu-btn');
        const menu = $('.mobile-menu');
        root.classList.toggle('menu-open', open);
        btn?.setAttribute('aria-expanded', String(open));
        $('.menu-btn-label').textContent = open ? t('close') : t('menu');
        menu?.setAttribute('aria-hidden', String(!open));
        if (menu) menu.inert = !open;
        if (state.lenis) open ? state.lenis.stop() : state.lenis.start();
        else document.body.style.overflow = open ? 'hidden' : '';
        if (open) setTimeout(() => $('.mobile-menu-links a')?.focus(), 350);
    }

    function initMenu() {
        const menu = $('.mobile-menu');
        if (menu) menu.inert = true;
        $('.menu-btn')?.addEventListener('click', () => toggleMenu());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.menuOpen) { toggleMenu(false); $('.menu-btn')?.focus(); }
        });
        window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches && state.menuOpen) toggleMenu(false); });
    }

    function initActiveSection() {
        const links = $$('.nav-links a[data-nav]');
        const indicator = $('.nav-indicator');
        let current = null;

        const moveIndicator = () => {
            if (!indicator) return;
            const link = links.find((a) => a.dataset.nav === current && !a.hidden);
            if (!link || !link.offsetWidth) { indicator.style.opacity = '0'; return; }
            indicator.style.width = `${link.offsetWidth}px`;
            indicator.style.transform = `translateX(${link.offsetLeft}px)`;
            indicator.style.opacity = '1';
        };

        const setActive = (id) => {
            current = id;
            links.forEach((a) => {
                const on = a.dataset.nav === id;
                a.classList.toggle('active', on);
                if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
            });
            moveIndicator();
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        SECTIONS.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });

        const hero = $('#home');
        if (hero) {
            new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(null); }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
        }
        window.addEventListener('resize', moveIndicator);
        document.fonts?.ready.then(moveIndicator);
    }

    // ------------------------------------------------------------ render

    function setSectionTitle(id, title) {
        const h2 = $(`#${id} .section-title`);
        if (!h2) return;
        const text = title || h2.textContent;
        h2.innerHTML = `<span class="line"><span>${esc(text)}</span></span>`;
    }

    function setSectionVisible(id, visible) {
        const section = document.getElementById(id);
        if (section) section.hidden = !visible;
        const link = $(`.nav-links a[data-nav="${id}"]`);
        if (link) link.hidden = !visible;
    }

    function buildName(name) {
        const words = String(name || '').trim().split(/\s+/).filter(Boolean);
        return words.map((word, wi) => {
            const chars = Array.from(word).map((c) => `<span class="char">${esc(c)}</span>`).join('');
            const dot = wi === words.length - 1 ? '<span class="char dot">.</span>' : '';
            return `<span class="word">${chars}${dot}</span>`;
        }).join('');
    }

    function renderHero(v) {
        const name = v.contact_name || 'Martín Marzorati';
        const h1 = $('.hero-name');
        h1.innerHTML = buildName(name);
        h1.setAttribute('aria-label', name);
        $$('.word', h1).forEach((w) => w.setAttribute('aria-hidden', 'true'));

        $('.subtitle').textContent = v.subtitle || '';

        const pic = $('.profile-pic');
        if (pic) {
            pic.src = safeUrl(v.profile_picture) || 'photos/Martin.jpg';
            pic.alt = name;
        }

        const phoneDigits = v.phone ? v.phone.replace(/[^\d]/g, '') : '';
        const actions = [];
        if (v.email) actions.push(`<a class="pill pill-primary" data-magnetic href="mailto:${esc(v.email)}">${esc(t('getInTouch'))} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`);
        actions.push(`<button type="button" class="pill pill-secondary" data-magnetic data-download><i class="fas fa-arrow-down" aria-hidden="true"></i> <span>${esc(t('downloadCv'))}</span></button>`);
        $('.hero-actions').innerHTML = actions.join('');

        const icons = [
            v.email && { href: `mailto:${v.email}`, icon: 'fas fa-envelope', label: `${t('email')}: ${v.email}` },
            phoneDigits && { href: `https://wa.me/${phoneDigits}`, icon: 'fab fa-whatsapp', label: `${t('whatsapp')}: ${v.phone}`, ext: true },
            safeUrl(v.linkedin) && { href: safeUrl(v.linkedin), icon: 'fab fa-linkedin-in', label: 'LinkedIn', ext: true },
            safeUrl(v.github) && { href: safeUrl(v.github), icon: 'fab fa-github', label: 'GitHub', ext: true },
            safeUrl(v.website) && { href: safeUrl(v.website), icon: 'fas fa-globe', label: t('website'), ext: true },
        ].filter(Boolean);
        $('.contact-info').innerHTML = icons.map((i) => `
            <li><a href="${esc(i.href)}" ${i.ext ? 'target="_blank" rel="noopener"' : ''} aria-label="${esc(i.label)}" title="${esc(i.label)}"><i class="${i.icon}" aria-hidden="true"></i></a></li>
        `).join('');

        const printBits = [v.email, v.phone, v.linkedin && prettyUrl(v.linkedin), v.github && prettyUrl(v.github), v.website && prettyUrl(v.website)].filter(Boolean);
        $('.print-contact').textContent = printBits.join('  ·  ');
    }

    function renderFooter(v) {
        const name = v.contact_name || 'Martín Marzorati';
        const cta = $('.footer-cta');
        if (cta) {
            if (v.email) cta.href = `mailto:${v.email}`;
            else cta.hidden = true;
        }

        const emailBox = $('.footer-email');
        if (emailBox) {
            emailBox.innerHTML = v.email ? `
                <a href="mailto:${esc(v.email)}">${esc(v.email)}</a>
                <button type="button" class="copy-btn" data-copy="${esc(v.email)}"><i class="far fa-copy" aria-hidden="true"></i> <span>${esc(t('copyEmail'))}</span></button>
            ` : '';
        }

        const phoneDigits = v.phone ? v.phone.replace(/[^\d]/g, '') : '';
        const links = [
            safeUrl(v.linkedin) && `<li><a href="${esc(safeUrl(v.linkedin))}" target="_blank" rel="noopener">LinkedIn <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a></li>`,
            safeUrl(v.github) && `<li><a href="${esc(safeUrl(v.github))}" target="_blank" rel="noopener">GitHub <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a></li>`,
            phoneDigits && `<li><a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">WhatsApp <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a></li>`,
            safeUrl(v.website) && `<li><a href="${esc(safeUrl(v.website))}" target="_blank" rel="noopener">${esc(t('website'))} <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a></li>`,
            `<li><button type="button" data-download><span>${esc(t('downloadCv'))}</span> <i class="fas fa-arrow-down" aria-hidden="true"></i></button></li>`,
        ].filter(Boolean);
        $('.footer-links').innerHTML = links.join('');

        $('.footer-text').textContent = `© ${new Date().getFullYear()} ${name}. ${t('rights')}`;
    }

    function renderSummary(summary) {
        const el = $('#about .summary');
        const content = summary && summary.content ? summary.content.trim() : '';
        if (!content) return false;
        if (state.motion) {
            el.innerHTML = content.split('\n').map((line) => line.split(/\s+/).filter(Boolean)
                .map((w) => `<span class="w">${esc(w)}</span>`).join(' ')).join('<br>');
        } else {
            el.innerHTML = textToHtml(content);
        }
        return true;
    }

    function descriptionHtml(text) {
        const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return '';
        if (lines.length === 1) return `<p>${esc(lines[0])}</p>`;
        return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`;
    }

    function renderTimeline(id, items, kind) {
        const list = $(`#${id} .timeline`);
        if (!list) return false;
        list.innerHTML = items.map((item) => {
            const isExp = kind === 'experience';
            const title = isExp ? item.role : item.degree;
            const org = isExp ? item.company : item.institution;
            const range = formatRange(item.start_date, item.end_date, isExp ? t('present') : t('ongoing'));
            const duration = isExp ? formatDuration(item.start_date, item.end_date) : '';
            return `
                <li class="tl-item">
                    <span class="tl-dot" aria-hidden="true"></span>
                    <div class="tl-meta">
                        <span class="tl-date">${esc(range)}</span>
                        ${duration ? `<span class="tl-duration">${esc(duration)}</span>` : ''}
                    </div>
                    <div class="tl-body">
                        <h3 class="tl-role">${esc(title)}</h3>
                        ${org ? `<p class="tl-org">${esc(org)}</p>` : ''}
                        ${item.description ? `<div class="tl-desc">${descriptionHtml(item.description)}</div>` : ''}
                    </div>
                </li>`;
        }).join('');
        return items.length > 0;
    }

    // The rail runs from the first dot to the last one, not to the bottom of the list.
    function sizeTimelineRails() {
        $$('.timeline').forEach((list) => {
            const items = $$('.tl-item', list);
            if (!items.length) return;
            const lastDot = $('.tl-dot', items[items.length - 1]);
            const firstDot = $('.tl-dot', items[0]);
            const height = (items[items.length - 1].offsetTop + lastDot.offsetTop) - (items[0].offsetTop + firstDot.offsetTop);
            list.style.setProperty('--rail-h', `${Math.max(0, height)}px`);
        });
    }

    function renderSkills(skills) {
        const container = $('#skills .skills-list');
        const groups = new Map();
        skills.forEach((s) => {
            const cat = s.category || t('otherSkills');
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(s);
        });
        container.innerHTML = Array.from(groups.entries()).map(([cat, list]) => `
            <div class="skill-row">
                <h3 class="skill-cat">${esc(cat)} <span>${String(list.length).padStart(2, '0')}</span></h3>
                <ul class="chips">
                    ${list.map((s) => `<li class="chip${(s.percentage || 0) >= 85 ? ' is-strong' : ''}">${esc(s.name)}</li>`).join('')}
                </ul>
            </div>
        `).join('');
        return groups.size > 0;
    }

    function projectHref(rawLink) {
        const link = safeUrl(rawLink);
        if (!link) return null;
        if (link.includes('server-info.html')) {
            return `${link}${link.includes('?') ? '&' : '?'}from=${encodeURIComponent(state.slug)}`;
        }
        return link;
    }

    function renderProjects(projects) {
        const grid = $('#projects .projects-grid');
        grid.innerHTML = projects.map((p, i) => {
            const href = projectHref(p.link);
            const external = href && /^(https?:)?\/\//.test(href);
            const tag = href ? 'a' : 'article';
            const attrs = href ? `href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}` : '';
            return `
                <${tag} class="project-card" ${attrs}>
                    <div class="project-top">
                        <span class="project-index">${String(i + 1).padStart(2, '0')}</span>
                        ${href ? `<span class="project-arrow" aria-hidden="true"><i class="fas ${external ? 'fa-arrow-up-right-from-square' : 'fa-arrow-right'}"></i></span>` : ''}
                    </div>
                    <h3 class="project-title">${esc(p.name)}</h3>
                    ${p.description ? `<p class="project-description">${esc(p.description)}</p>` : ''}
                    ${href ? `<span class="project-link">${esc(t('viewProject'))}</span>` : ''}
                </${tag}>`;
        }).join('');

        if (finePointer) {
            $$('.project-card', grid).forEach((card) => {
                card.addEventListener('pointermove', (e) => {
                    const r = card.getBoundingClientRect();
                    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    card.style.setProperty('--my', `${e.clientY - r.top}px`);
                });
            });
        }
        return projects.length > 0;
    }

    function updateMeta(v, summary) {
        const name = v.contact_name || 'Martín Marzorati';
        document.title = v.subtitle ? `${name} — ${v.subtitle}` : name;
        const desc = summary && summary.content ? summary.content.replace(/\s+/g, ' ').trim() : '';
        if (desc) {
            const short = desc.length > 158 ? `${desc.slice(0, 155).replace(/\s+\S*$/, '')}…` : desc;
            $('meta[name="description"]')?.setAttribute('content', short);
            $('meta[property="og:description"]')?.setAttribute('content', short);
        }
        $('meta[property="og:title"]')?.setAttribute('content', document.title);
    }

    function renderState(kind) {
        SECTIONS.forEach((id) => setSectionVisible(id, false));
        $('#main').hidden = true;
        $('.footer-cta').hidden = true;
        $('.footer-grid').hidden = true;
        $('.contact-info').hidden = true;
        $('.profile-pic').hidden = true;
        $('.scroll-cue').hidden = true;
        const title = kind === 'notFound' ? t('notFoundTitle') : t('loadErrorTitle');
        $('.subtitle').textContent = kind === 'notFound' ? '404' : '';
        $('.hero-name').innerHTML = buildName(title);
        const msg = kind === 'notFound' ? t('notFoundText') : t('loadErrorText');
        const action = kind === 'notFound'
            ? `<a class="pill pill-primary" href="?v=pm&amp;lang=${lang}">${esc(t('notFoundCta'))} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
            : `<button type="button" class="pill pill-primary" onclick="location.reload()">${esc(t('retry'))}</button>`;
        $('.hero-actions').innerHTML = action;
        $('.hero-name').insertAdjacentHTML('afterend', `<p class="state-message">${esc(msg)}</p>`);
        $('.footer-text').textContent = `© ${new Date().getFullYear()}`;
    }

    // ----------------------------------------------------------- actions

    function initActions() {
        document.addEventListener('click', async (e) => {
            const dl = e.target.closest('[data-download]');
            if (dl) { e.preventDefault(); downloadCv(dl); return; }

            const copy = e.target.closest('[data-copy]');
            if (copy) {
                const value = copy.dataset.copy;
                try {
                    await navigator.clipboard.writeText(value);
                } catch (err) {
                    const ta = document.createElement('textarea');
                    ta.value = value;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
                    ta.remove();
                }
                const label = $('span', copy);
                copy.classList.add('is-done');
                $('i', copy).className = 'fas fa-check';
                if (label) label.textContent = t('copied');
                clearTimeout(copy._timer);
                copy._timer = setTimeout(() => {
                    copy.classList.remove('is-done');
                    $('i', copy).className = 'far fa-copy';
                    if (label) label.textContent = t('copyEmail');
                }, 2000);
            }
        });
    }

    async function downloadCv(btn) {
        if (btn.getAttribute('aria-busy') === 'true' || !state.slug) return;
        const label = $('span', btn) || btn;
        const original = label.textContent;
        btn.setAttribute('aria-busy', 'true');
        label.textContent = t('preparing');
        try {
            const res = await fetch(`${API}/resume/pdf/${encodeURIComponent(state.slug)}/${lang}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const match = (res.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/);
            const filename = match ? match[1] : `CV-${lang.toUpperCase()}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            if (typeof window.plausible === 'function') window.plausible('Download CV', { props: { lang, version: state.slug } });
            label.textContent = original;
        } catch (err) {
            label.textContent = t('downloadFailed');
            setTimeout(() => { label.textContent = original; }, 2600);
        } finally {
            btn.removeAttribute('aria-busy');
        }
    }

    // ------------------------------------------------------------ motion

    function revealPage() {
        root.classList.remove('is-loading');
        if (!state.motion) return;
        const { gsap: g } = window;

        // CSS hover transitions on the same properties would smear GSAP's per-frame
        // updates, so they're switched off on an element while it animates in.
        const unfreeze = (els) => () => g.set(els, { clearProps: 'transition' });
        const freeze = (els) => { g.set(els, { transition: 'none' }); return unfreeze(els); };

        const intro = g.timeline({ defaults: { ease: 'expo.out' } });
        intro.from('.site-nav', { yPercent: -100, opacity: 0, duration: 1.1, clearProps: 'transform,opacity', onStart: () => freeze('.site-nav'), onComplete: unfreeze('.site-nav') }, 0)
            .from('.hero .profile-pic', { scale: 0.5, opacity: 0, duration: 1.2, clearProps: 'transform,opacity', onStart: () => freeze('.hero .profile-pic'), onComplete: unfreeze('.hero .profile-pic') }, 0.1)
            .from('.hero .subtitle', { x: -16, opacity: 0, duration: 1 }, 0.3)
            .from('.hero-name .char', { yPercent: 115, duration: 1.25, stagger: 0.03 }, 0.2)
            .from('.hero .state-message', { y: 16, opacity: 0, duration: 0.9 }, '-=0.8')
            .from('.hero-actions > *', { y: 20, opacity: 0, duration: 1, stagger: 0.08, clearProps: 'transform,opacity' }, '-=0.85')
            .from('.contact-info li', { y: 16, opacity: 0, duration: 0.9, stagger: 0.05, clearProps: 'transform,opacity' }, '<0.1')
            .from('.scroll-cue', { opacity: 0, duration: 1 }, '-=0.5');

        // Hero drifts up and fades slightly as you scroll past it.
        g.to('.hero-inner', {
            yPercent: -10, opacity: 0.35, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });

        $$('.section:not([hidden]) .section-title').forEach((h2) => {
            g.from($('.line > span', h2), {
                yPercent: 105, duration: 1.1, ease: 'expo.out',
                scrollTrigger: { trigger: h2, start: 'top 88%', once: true },
            });
        });

        const words = $$('#about .summary .w');
        if (words.length) {
            g.fromTo(words, { opacity: 0.16 }, {
                opacity: 1, ease: 'none', stagger: 0.1,
                scrollTrigger: { trigger: '#about .summary', start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
            });
        }

        $$('.timeline').forEach((list) => {
            ScrollTrigger.create({
                trigger: list, start: 'top 62%', end: 'bottom 62%', scrub: true,
                onUpdate: (self) => list.style.setProperty('--progress', self.progress.toFixed(4)),
            });
            $$('.tl-item', list).forEach((item) => {
                ScrollTrigger.create({ trigger: item, start: 'top 62%', toggleClass: 'is-active' });
                const tl = g.timeline({ scrollTrigger: { trigger: item, start: 'top 86%', once: true }, defaults: { ease: 'expo.out' } });
                tl.from($('.tl-meta', item), { x: -20, opacity: 0, duration: 1 }, 0)
                    .from($$('.tl-role, .tl-org', item), { y: 24, opacity: 0, duration: 1, stagger: 0.06 }, 0.05)
                    .from($$('.tl-desc p, .tl-desc li', item), { y: 14, opacity: 0, duration: 0.9, stagger: 0.05 }, 0.18);
            });
        });

        ScrollTrigger.batch('.skill-row', {
            start: 'top 88%', once: true,
            onEnter: (rows) => rows.forEach((row, i) => {
                g.timeline({ delay: i * 0.08, defaults: { ease: 'expo.out' } })
                    .from($('.skill-cat', row), { opacity: 0, x: -12, duration: 0.9 }, 0)
                    .from($$('.chip', row), {
                        opacity: 0, y: 14, scale: 0.94, duration: 0.8, stagger: 0.035, clearProps: 'transform,opacity',
                        onStart: () => freeze($$('.chip', row)), onComplete: unfreeze($$('.chip', row)),
                    }, 0.05);
            }),
        });

        ScrollTrigger.batch('.project-card', {
            start: 'top 88%', once: true,
            onEnter: (cards) => {
                freeze(cards);
                g.from(cards, { y: 48, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'transform,opacity', onComplete: unfreeze(cards) });
            },
        });

        g.from('.footer-cta-text', {
            y: 40, opacity: 0, duration: 1.1, ease: 'expo.out',
            scrollTrigger: { trigger: '.footer-cta', start: 'top 90%', once: true },
        });
        g.from('.footer-cta-arrow', {
            scale: 0.4, rotate: -90, opacity: 0, duration: 1.2, ease: 'expo.out',
            scrollTrigger: { trigger: '.footer-cta', start: 'top 90%', once: true },
        });

        initHeroGlow();
        initMagnetic();
        document.fonts?.ready.then(() => ScrollTrigger.refresh());
    }

    function initHeroGlow() {
        const hero = $('.hero') || $('.server-hero');
        const glow = hero ? $('.hero-glow', hero) : null;
        if (!hero || !glow || !finePointer) return;
        const r = hero.getBoundingClientRect();
        gsap.set(glow, { x: r.width * 0.78, y: r.height * 0.3 });
        const xTo = gsap.quickTo(glow, 'x', { duration: 1.6, ease: 'power3.out' });
        const yTo = gsap.quickTo(glow, 'y', { duration: 1.6, ease: 'power3.out' });
        hero.addEventListener('pointermove', (e) => {
            const rect = hero.getBoundingClientRect();
            xTo(e.clientX - rect.left);
            yTo(e.clientY - rect.top);
        });
    }

    function initMagnetic() {
        if (!finePointer) return;
        $$('[data-magnetic], .footer-cta-arrow').forEach((el) => {
            const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
            const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
            const host = el.classList.contains('footer-cta-arrow') ? el.closest('.footer-cta') : el;
            host.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
            });
            host.addEventListener('pointerleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
            });
        });
    }

    // ------------------------------------------------------------ pages

    async function loadPortfolio() {
        const slug = params.get('v');
        if (!slug) {
            window.location.replace(`?v=pm&lang=${lang}`);
            return;
        }
        state.slug = slug;

        let data;
        try {
            data = await fetchJson(`${API}/resume/slug/${encodeURIComponent(slug)}/${lang}`);
        } catch (err) {
            console.error('Error loading portfolio content:', err);
            renderState('error');
            revealPage();
            return;
        }
        if (!data || data.notFound || !data.version) {
            renderState('notFound');
            revealPage();
            return;
        }

        try { sessionStorage.setItem('last_slug', slug); } catch (e) { /* storage off */ }
        const v = data.version;

        setSectionTitle('about', v.title_summary);
        setSectionTitle('experience', v.title_experience);
        setSectionTitle('skills', v.title_skills);
        setSectionTitle('projects', v.title_projects);
        setSectionTitle('education', v.title_education);

        renderHero(v);
        renderFooter(v);
        updateMeta(v, data.summary);

        const has = {
            about: !!v.show_summary && renderSummary(data.summary),
            experience: !!v.show_experience && renderTimeline('experience', data.experience || [], 'experience'),
            skills: !!v.show_skills && renderSkills(data.skills || []),
            projects: !!v.show_projects && renderProjects(data.projects || []),
            education: !!v.show_education && renderTimeline('education', data.education || [], 'education'),
        };
        SECTIONS.forEach((id) => setSectionVisible(id, has[id]));
        buildMobileMenu();
        sizeTimelineRails();
        window.addEventListener('resize', sizeTimelineRails);
        document.fonts?.ready.then(sizeTimelineRails);
        revealPage();
    }

    function sanitizeIcon(cls, fallback) {
        const clean = String(cls || '').replace(/[^a-z0-9 -]/gi, '').trim();
        return clean || fallback;
    }

    function renderServerSection(section) {
        const items = section.items || [];
        let body = '';
        if (section.layout_type === 'node') {
            const specs = items.filter((i) => i.item_type === 'spec');
            const services = items.filter((i) => i.item_type !== 'spec');
            body = `
                ${section.description ? `<p>${textToHtml(section.description)}</p>` : ''}
                ${specs.length ? `<h3 class="srv-subhead">Hardware</h3><div class="srv-specs">${specs.map((s) => `
                    <div class="spec-card">
                        <i class="${sanitizeIcon(s.icon, 'fas fa-microchip')}" aria-hidden="true"></i>
                        <div class="spec-info"><span class="spec-label">${esc(s.title)}</span><span class="spec-value">${esc(s.content)}</span></div>
                    </div>`).join('')}</div>` : ''}
                ${services.length ? `<h3 class="srv-subhead">Services</h3><div class="table-wrap"><table>
                    <thead><tr><th>Service</th><th>Type</th><th>Role</th></tr></thead>
                    <tbody>${services.map((s) => `<tr><td>${esc(s.title)}</td><td><span class="platform-tag">${esc(s.platform || 'VM')}</span></td><td>${esc(s.function || s.content)}</td></tr>`).join('')}</tbody>
                </table></div>` : ''}`;
        } else if (section.layout_type === 'grid') {
            body = `${section.description ? `<p>${textToHtml(section.description)}</p>` : ''}
                <div class="srv-grid">${items.map((i) => `<div class="srv-card"><h3>${esc(i.title)}</h3><p>${textToHtml(i.content)}</p></div>`).join('')}</div>`;
        } else if (section.layout_type === 'table') {
            body = `${section.description ? `<p>${textToHtml(section.description)}</p>` : ''}
                <div class="table-wrap"><table>
                    <thead><tr><th>Service</th><th>Platform</th><th>Primary function</th></tr></thead>
                    <tbody>${items.map((i) => `<tr><td>${esc(i.title)}</td><td><span class="platform-tag">${esc(i.platform)}</span></td><td>${esc(i.function)}</td></tr>`).join('')}</tbody>
                </table></div>`;
        } else if (section.layout_type === 'text') {
            body = `<p>${textToHtml(section.description)}</p>`;
        } else {
            body = `${section.description ? `<p>${textToHtml(section.description)}</p>` : ''}
                <ul class="srv-list">${items.map((i) => `<li><strong>${esc(i.title)}:</strong> ${esc(i.content)}</li>`).join('')}</ul>`;
        }
        const id = String(section.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `
            <section class="srv-section" id="${esc(id)}">
                <header class="srv-head">
                    <span class="srv-icon"><i class="${sanitizeIcon(section.icon, 'fas fa-circle-info')}" aria-hidden="true"></i></span>
                    <h2>${esc(section.title)}</h2>
                </header>
                <div class="srv-body">${body}</div>
            </section>`;
    }

    async function loadServerInfo() {
        const main = $('.server-main');
        if (!main) return;
        try {
            const sections = await fetchJson(`${API}/server-info`);
            if (!Array.isArray(sections) || !sections.length) {
                main.innerHTML = '<p class="state-message" style="padding:64px 0">No server information available yet.</p>';
                return;
            }
            main.innerHTML = sections.map(renderServerSection).join('');
            main.removeAttribute('aria-busy');
        } catch (err) {
            console.error('Error loading server info:', err);
            main.innerHTML = '<p class="state-message" style="padding:64px 0">Server information could not be loaded. Please try again later.</p>';
            return;
        }

        if (!state.motion) return;
        gsap.from('.server-hero .hero-inner > *', { y: 24, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 });
        $$('.srv-section').forEach((sec) => {
            gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 86%', once: true }, defaults: { ease: 'expo.out' } })
                .from($('.srv-head', sec), { x: -20, opacity: 0, duration: 1 }, 0)
                .from($('.srv-body', sec).children, { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, 0.08);
        });
        initHeroGlow();
        document.fonts?.ready.then(() => ScrollTrigger.refresh());
    }

    async function updateServerDate() {
        const el = $('#updated-date');
        if (!el) return;
        let date = new Date();
        try {
            const res = await fetch('https://api.github.com/repos/martomarzo/personalwebsite/commits?per_page=1');
            if (res.ok) {
                const commits = await res.json();
                if (commits.length) date = new Date(commits[0].commit.author.date);
            }
        } catch (err) { /* fall back to today */ }
        el.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function setupBackLink() {
        const back = $('.nav-back');
        if (!back) return;
        let from = params.get('from');
        try { from = from || sessionStorage.getItem('last_slug'); } catch (e) { /* storage off */ }
        back.href = `/?v=${encodeURIComponent(from || 'pm')}`;
    }

    // ------------------------------------------------------------- boot

    function init() {
        const body = document.body;
        initMotion();
        initTheme();
        initAnchors();
        initScrollChrome();

        if (body.classList.contains('page-portfolio')) {
            applyStaticI18n();
            initLangSwitch();
            initMenu();
            initActiveSection();
            initActions();
            loadPortfolio();
        }

        if (body.classList.contains('page-server-info')) {
            setupBackLink();
            updateServerDate();
            loadServerInfo();
        }
    }

    // Coming back via the browser's back button restores the faded-out page from cache.
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) { document.body.style.opacity = ''; document.body.style.transition = ''; }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
