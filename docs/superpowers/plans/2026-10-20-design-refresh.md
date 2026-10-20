# Design Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public CV site, the admin panel and the exported PDFs look and feel professionally built, without changing what the product does (plus agreed bug fixes and extras).

**Architecture:** Three independent tracks split by file ownership (website / admin / PDF+backend) that meet at two HTTP contracts. Vanilla HTML/CSS/JS, no build step. PDFs move from "print the public page" to server-side HTML templates rendered by Puppeteer `setContent`.

**Tech Stack:** Express 4, pg, Puppeteer 24, GSAP 3.12.5 + ScrollTrigger (cdnjs), Lenis 1.3.26 (jsDelivr), Font Awesome 6.0.0, Node 22 `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-20-design-refresh-design.md` (background: `docs/PROJECT_OVERVIEW.md`)

## Global Constraints

- Keep `styles.css` token names: `--bg-color --bg-even --card-bg --nav-bg --border-color --border-hover --text-color --text-light --text-muted --accent --accent-light --accent-dim --accent-glow --accent-contrast --font-family-portfolio --font-display --font-mono --radius-card --radius-btn --radius-pill`.
- Accent `#0e9de9` (dark) / `#0273ad` (light). Fonts: Space Grotesk (display), Inter (body), JetBrains Mono (labels/dates).
- `prefers-reduced-motion: reduce` disables all motion incl. Lenis; content is never left hidden if a CDN script fails.
- Keep one Chromium at a time (`serializeRender`); keep `pdf_cache`.
- Preserve the uncommitted suggested-skill `percentage` input (admin-dashboard.js ~L1257, L1346; admin.css `.new-skill-row`).
- Do not touch the remote database. Verify UI against the mock server: `python3 <scratchpad>/admin_mock.py` (port 4174, serves the repo live with fake public + admin APIs).

## Review Focus

1. GSAP or Lenis fails to load (offline/CDN blocked) → every section still visible and usable. (Task 1 check)
2. Spanish version (`lang=es`) → all UI chrome, dates and PDF labels in Spanish ("Actualidad", "Contacto", "Descargar CV"). (Tasks 1, 4)
3. Sparse data: version with no phone/github/photo, experience with empty description, no skills → no crash, no empty headings (site and PDF). (Tasks 1, 4)
4. Content containing `& < > "` → escaped in PDF templates and admin markup. (Tasks 3, 4)
5. Public PDF route: unknown slug → 404, bad language → 400, repeated cache-miss renders → 429. (Task 5)

---

## Track A — Website (owner: main session)

### Task 1: Public site redesign + motion

**Files:** Modify `index.html`, `styles.css`, `portfolio-main.js`

**Interfaces:** Consumes `GET /api/resume/pdf/:slug/:language` (Task 5) for the Download CV button.

- [ ] Nav: short labels from a dictionary (not the long section titles), EN/ES segmented control + theme button inside the nav, "Download CV" link, compact menu button under 860px opening a full-screen animated overlay; sliding active-link indicator.
- [ ] Hero: name split into letters revealed from a mask; role line + CTAs stagger; grain overlay + cursor-following glow (pointer devices only); magnetic primary CTAs.
- [ ] Summary: words light up with scroll (scrubbed), static when reduced motion.
- [ ] Experience/Education: 2-column timeline (dates + duration left, role/company/bullets right), progress line filling on scroll; null-safe description.
- [ ] Skills: category rows (label left, chips right); remove JS height equalizer.
- [ ] Projects: whole card clickable, cursor spotlight border, arrow motion.
- [ ] i18n dictionary for all UI strings; dates via `toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')`; `<html lang>` set.
- [ ] Loading state (no empty headings flash), dynamic `document.title`, meta description + OG tags, footer copy, back-to-top.
- [ ] Theme switch circular reveal via View Transitions (fallback: instant). Lenis on non-reduced-motion, wired to ScrollTrigger.
- [ ] `@media print` styles for Ctrl+P.
- [ ] Verify: screenshots desktop/mobile, dark/light, en/es, reduced motion, and with GSAP/Lenis requests blocked → content visible; console has 0 errors.

### Task 2: Server info page restyle

**Files:** Modify `server-info.html` (and its section in `styles.css`)

- [ ] Remove stale hardcoded content; skeleton while loading; restyle header/nav/sections to match Task 1; same theme/lang controls; escape-safe rendering.
- [ ] Verify via mock (`/api/server-info` is stubbed) screenshots.

## Track B — PDF + backend (owner: subagent)

### Task 3: Shared PDF templates + renderer

**Files:**
- Create: `backend/pdf/templates.js`, `backend/pdf/render.js`, `backend/pdf/templates.test.js`
- Modify: `package.json` (`"test": "node --test backend/pdf/"`)

**Interfaces — Produces:**
- `buildResumeHtml(resume, { language, publicUrl, photoDataUri }) -> string` — `resume` is `composeResume()` output (`version` row incl. `contact_name,email,phone,linkedin,github,website,subtitle,title_*`).
- `buildCoverLetterHtml({ text, candidateName, subtitle, email, phone, linkedin, website, cvUrl, companyName, language, photoDataUri }) -> string`
- `resumeFilename(name, language) -> string` e.g. `Martin-Marzorati-CV-EN.pdf` (ASCII-folded).
- `renderPdf(html, { footerLabel }) -> Promise<Buffer>` (Puppeteer `setContent`, A4, footer "label · page/total" when `footerLabel`).

- [ ] Tests (`node:test`): email/phone/linkedin appear as visible text; relative link `server-info.html` becomes `${publicUrl}/server-info.html`; `language:'es'` → "Actualidad" and Spanish month names, `language:'en'` → "Present"; `&<>"` escaped; missing phone/photo/skills → no empty element/heading; `resumeFilename('Martín Marzorati','es') === 'Martin-Marzorati-CV-ES.pdf'`.
- [ ] Implement; render mock data (`.claude/mock_server.py` RESUME) to scratchpad PDF; mock resume fits in ≤ 2 A4 pages; inspect PNG of the HTML at A4 width.

### Task 4: Wire templates into routes

**Files:** Modify `backend/index.js`

- [ ] `PDF_RENDER_VERSION = 'v2'`; one shared `getOrRenderResumePdf(client, version, language)` used by admin + public routes; photo bytes read from `contact_info.profile_picture_data` as data URI (fallback `photos/Martin.jpg`); cover letter route uses new template + version subtitle.
- [ ] `Content-Disposition` uses `resumeFilename`; `node --check backend/index.js` passes.

### Task 5: New endpoints

**Files:** Modify `backend/index.js`

- [ ] `GET /api/resume/pdf/:slug/:language` (public): 400 if language ∉ {en,es}; 404 unknown slug; cache hit served directly; cache-miss renders rate-limited in memory (≤ 6 renders / 10 min per IP) → 429.
- [ ] `POST /api/admin/versions/duplicate/:id`: transaction copying `resume_versions` (name `"<name> (copy)"`, slug `<slug>-copy`, suffix `-2`, `-3`… until unique), `contact_info`, all `version_*_visibility`, `version_experience_override`, `version_summary_override`; returns new row (201).

## Track C — Admin (owner: subagent)

### Task 6: Admin shell, controls, tables, dialogs, bug fixes

**Files:** Modify `admin.html`, `admin.css`, `admin-dashboard.js`

**Interfaces — Consumes:** `POST /api/admin/versions/duplicate/:id` (Task 5).

- [ ] Global `.hidden{display:none!important}`; add-version error toast; duplicate wired to new route.
- [ ] Sticky top bar (mark, "Admin", View site ↗ for current version, theme, logout); load Space Grotesk/JetBrains Mono; aligned max-width container.
- [ ] Dark-styled `date/number/select/file/checkbox`; human labels map; profile photo drop zone; collapsible profile card.
- [ ] Versions: real `<button>` actions with aria-labels, taller list, animated PDF language menu; context label "Visibility for: <version>".
- [ ] Tabs with sliding indicator + `visible/total` counts; rows with switches, EN/ES badges (missing = warning style), icon edit/delete; empty state; skeleton rows.
- [ ] `confirmDialog(message, {danger}) -> Promise<boolean>` and `promptDialog(message) -> Promise<string|null>` replace `confirm`/`prompt`; toasts restyled with close + progress.
- [ ] Verify against mock, desktop + 390px, dark + light; console 0 errors.

### Task 7: Side-panel editor + wizard + login

**Files:** Modify `admin.html`, `admin.css`, `admin-dashboard.js`, `login.html`

- [ ] Pool-item and server editors open in a right slide-in drawer (focus trap, Esc closes with dirty-check via `confirmDialog`, Ctrl/Cmd+S saves, auto-grow textareas, "Present" switch).
- [ ] Tailor wizard: stepper header, steps actually toggle, styled diff cards and generating state.
- [ ] Login: branded card, show/hide password, loading state, error shake, reduced-motion safe.
- [ ] Verify flows against mock: edit → save → toast; Esc; wizard steps; login error/success.

## Wrap-up

### Task 8: Integrate, review, document

- [ ] Website "Download CV" points at Task 5 route; cross-check admin + site share tokens in light/dark.
- [ ] Whole-change review (fresh reviewer); fix findings.
- [ ] Update `CHANGELOG.md` (create, back-fill from git history) and `README.md` feature list.
