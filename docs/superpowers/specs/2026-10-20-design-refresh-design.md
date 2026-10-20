# Design refresh — website, admin, PDF (2026-10-20)

## Intent

The product works; the goal is that every surface (public CV site, admin panel, exported PDFs) reads as built by a professional frontend specialist. Functionality stays the same except for bug fixes and the agreed extras. Background: see `docs/PROJECT_OVERVIEW.md`.

## Decisions (made by the owner)

- **Website:** evolve the current dark editorial look (Space Grotesk display, Inter body, JetBrains Mono details, single blue accent `#0e9de9` / light `#0273ad`). No new visual identity.
- **PDF:** replace "print the web page" with a dedicated A4 resume layout rendered on the server from the same data.
- **Admin:** full polish, including a slide-in side-panel editor.
- **Extras:** matching cover-letter design; public "Download CV" button on the website; inertia smooth scrolling (Lenis).

## Goals

1. Public site: fix mobile nav, move EN/ES + theme into the nav, richer motion (hero letter reveal, scroll-lit summary, timeline that fills on scroll, cursor glow/grain, magnetic CTAs, circular theme reveal), timeline layout for experience/education with role durations, category-row skills, clickable project cards, Spanish UI strings + localized dates, loading state, meta/OG tags, cleaner footer, server page restyled to match, sensible Ctrl+P output.
2. Admin: fix `.hidden`, duplicate-version, silent add-version failure; top app bar; dark-styled native controls; human field labels; switches; quiet icon actions; EN/ES translation badges; slide-in editor (Esc / Ctrl+S); custom confirm/prompt dialogs; loading + empty states; animated tabs with counts; restyled wizard and toasts; branded login; responsive.
3. PDF: compact single-column ATS-friendly A4 resume (target 1–2 pages), contact details as clickable text, absolute links, localized labels/dates, page-number footer, PDF title, friendly filename, no dependence on loading the public page; cache invalidated; cover letter shares the same header and type.

## Non-goals

- No framework migration, no build step. Vanilla HTML/CSS/JS stays.
- No database schema changes (a new endpoint is fine).
- No change to how AI tailoring generates content.

## Anti-goals (would be a failure even if it "works")

- Motion that blocks reading or makes the CV feel slow: every reveal must finish quickly, content must never stay invisible if JS/GSAP fails, and `prefers-reduced-motion` turns motion (including Lenis) off.
- Breaking existing admin flows or losing the uncommitted "percentage" field on suggested skills.
- A PDF that hides contact details behind icons or runs long.

## Constraints

- Render instance with 512MB: one Chromium at a time (keep `serializeRender`), launch on demand.
- Public PDF endpoint must be cheap: serve from `pdf_cache` when the content hash matches; rate-limit cache-miss renders.
- External scripts only from pinned CDN versions (GSAP 3.12.5, Lenis 1.3.26).

## Work split (by file ownership)

| Area | Files |
|---|---|
| Website | `index.html`, `styles.css`, `portfolio-main.js`, `server-info.html` |
| Admin | `admin.html`, `admin.css`, `admin-dashboard.js`, `login.html` |
| PDF + backend | `backend/index.js`, new `backend/pdf/*` |

Shared contracts:
- `styles.css` design tokens (`--bg-color`, `--card-bg`, `--text-*`, `--accent*`, `--border-*`, `--font-*`, `--radius-*`) keep their names; admin may add its own tokens in `admin.css`.
- New public route `GET /api/resume/pdf/:slug/:language` → PDF attachment (used by the website button).
- New admin route `POST /api/admin/versions/duplicate/:id` → copies a version with all its visibility, overrides and contact info; returns the new row.

## Left to the builder

Exact motion timings, spacing, component details, and copy for UI labels, within the direction above.
