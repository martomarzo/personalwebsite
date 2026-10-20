# Project overview

## What it is

A self-hosted, bilingual (English/Spanish) online CV for Martín Marzorati, with a private admin panel to manage it. All content (jobs, education, projects, skills, summaries) lives once in a shared library, and any number of **resume versions** pick what to show from it. Each version gets its own public link (`/?v=<slug>`) and can be exported to PDF. An AI assistant (Claude) can take a job posting and create a new version tailored to it, with an optional matching cover letter. A separate page documents the author's home server.

Stack: vanilla HTML/CSS/JS frontend, Node.js + Express backend, PostgreSQL, Puppeteer (PDF), Anthropic SDK (AI tailoring). Deployed on Render.

## Public website (`index.html` + `portfolio-main.js` + `styles.css`)

- **Versioned resume pages** — `/?v=<slug>&lang=<en|es>`. No slug redirects to `?v=pm`. Unknown slug shows "Resume Not Found".
- **Sections**: hero (photo, role subtitle, name, "Get in touch" + LinkedIn buttons, icon links for email / WhatsApp / LinkedIn / GitHub / website), Summary, Experience, Skills, Projects, Education, footer "Let's work together" call to action.
- **Per-version control** of which sections show and what each section is called (per language). Nav links follow the custom titles and hide with their sections.
- **Experience** sorted newest first (ongoing roles on top); multi-line descriptions become bullet lists. AI-tailored versions can override experience text and the summary.
- **Skills** grouped by category as chips; skills rated 85%+ get accent styling (percentages aren't shown).
- **Projects** with optional link; links to the server page carry the current slug so "Back" returns to the same version.
- **Language switch** (EN/ES floating buttons) and **dark/light theme** (floating toggle, remembered in the browser).
- **Animations** (GSAP + ScrollTrigger): hero intro timeline, section headings slide in, cards stagger in on scroll, scroll progress bar, active nav link on scroll. Disabled for reduced-motion users and in print mode.
- **Print mode** (`?print=1`): forces light theme, hides nav/footer/floating controls, tightens spacing. Used by the PDF export.
- Plausible analytics.

## Server documentation page (`server-info.html`)

- Sections loaded from the database, each with a layout type: text, list, grid, table, or "node" (hardware spec cards + services table).
- "Back to Portfolio" returns to the version the visitor came from. "Last updated" date comes from the latest GitHub commit.

## Admin panel (`/admin`, `admin.html` + `admin-dashboard.js` + `admin.css`)

- **Login** with a single password (JWT in an httpOnly cookie, 24h). Logout.
- **Global profile** (shared by all versions): name, email, phone, LinkedIn, GitHub, website, profile photo (downscaled to 500px and stored in the database).
- **Resume versions**: create, rename (slug follows the name), delete, filter, collapse list, open public link, download PDF (choose EN/ES), duplicate (button exists, see known issues).
- **Version settings**: which sections show, role subtitle (EN/ES), section titles (EN/ES).
- **Content library tabs** — Experience, Education, Projects, Skills, Summary: table of all items with a per-version "visible" checkbox, sortable columns, add/edit in a side-by-side EN/ES form, delete. Skills have categories (create new inline) and a percentage.
- **Server Info tab**: manage the server page's sections and items (type, icon, platform, function, order, visibility).
- **Tailor with AI** wizard: pick base version + language, paste job description (and company), optionally ask for a cover letter → review screen with original vs. tailored text for summary and each job, AI-picked skills (editable), AI-suggested new skills (accept, edit names/category/percentage), regenerate with notes → save as a new version. Cover letter can be edited and downloaded as PDF. Each run is logged (job description, model) in the database.
- Toast notifications for save/errors.

## PDF export (`backend/index.js`)

- **Resume PDF** — `GET /api/download/pdf/:id/:lang` (admin only). Headless Chromium opens the public page in print mode and prints A4. The result is cached in the database by a hash of the content, so it only re-renders after a change. One render at a time to fit the 512MB server.
- **Cover letter PDF** — built from an HTML template on the server (name, contact line, date, greeting, body, closing), not stored.

## Data model (PostgreSQL, `backend/database.sql`)

- `resume_versions` (+ section titles/visibility), `contact_info` (one row per version; name/contact/photo are kept in sync across all rows, subtitle is per version).
- For each content type: `*_pool` (language-neutral fields) + `*_details` (one row per language) + `version_*_visibility` (what each version shows).
- `version_experience_override`, `version_summary_override` (AI-tailored text), `ai_tailorings` (audit log), `pdf_cache`, `server_sections`, `server_items`, `skill_categories`.

## Known issues found during review (2026-10-20)

- The admin's `.hidden` class has no CSS rule, so things meant to be hidden still show: the AI wizard displays its input step and review step at the same time, "Suggested new skills" headings always show, and inline rename shows both the input and the old name.
- "Duplicate version" calls `POST /api/admin/versions/duplicate/:id`, which doesn't exist, so it always fails.
- On the Spanish version, interface text stays in English ("Get in touch", "Contact", "View project", "Present", "Let's work together") and dates use English month names.
- The resume PDF is the web page printed: contact details appear only as icons (no visible email/phone), web buttons are printed, project links like `server-info.html` point to `127.0.0.1` inside the PDF, and a typical resume runs to ~7 pages.
- On phones the sticky nav wraps to four rows (~175px).
- Adding a version with a duplicate name fails silently.
