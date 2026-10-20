# Martín Marzorati — Personal Portfolio & Dynamic CV

A bilingual (English/Spanish) online CV with a private admin panel. All content (experience, education, projects, skills, summaries) lives once in a shared library, and any number of **resume versions** choose what to show. Each version has its own link and a PDF export, and an AI wizard can create a version tailored to a job posting. Full feature notes: [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md). Release notes: [`CHANGELOG.md`](CHANGELOG.md).

## Features

### Public site
- Versioned pages: `/?v=<slug>&lang=<en|es>`, fully translated interface, Spanish month names.
- Editorial dark/light design with motion: letter-by-letter hero reveal, scroll-lit summary, experience timeline that fills as you scroll, cursor glow, magnetic buttons, circular theme reveal, smooth scrolling (GSAP + ScrollTrigger + Lenis). All motion is off for reduced-motion users, and content stays visible if the scripts fail to load.
- Mobile menu overlay, language and theme switches in the top bar, "Download CV" button, copy-email button.
- Home server documentation page (`server-info.html`) driven by the database.

### Admin panel (`/admin`)
- Password login (JWT cookie).
- Global profile (name, contacts, photo) shared by every version.
- Versions: create, rename, duplicate, delete, open, download PDF (EN/ES); per-version section visibility, subtitles and section titles in both languages.
- Content library with per-version visibility switches and a side-panel bilingual editor.
- Server Info editor.
- **Tailor with AI**: paste a job description, review and edit the AI's rewrite of experience, summary and skills, optionally generate a cover letter, save as a new version.

### PDF export
- Dedicated A4 resume template rendered server-side with Puppeteer (clickable contact details, page numbers, localized labels), cached in the database until the content changes.
- Matching cover-letter PDF.
- Endpoints: `GET /api/resume/pdf/:slug/:lang` (public, rate-limited on fresh renders) and `GET /api/download/pdf/:id/:lang` (admin).

## Tech stack
- **Frontend:** vanilla HTML/CSS/JS (no build step), GSAP 3.12.5, Lenis 1.3.26, Font Awesome 6.
- **Backend:** Node.js, Express, PostgreSQL (`pg`), Puppeteer (PDF), Sharp (photo resizing), Multer (uploads), Anthropic SDK (AI tailoring).

## Project structure
```text
├── backend/
│   ├── index.js          # Express server & API routes
│   ├── pdf/              # Resume + cover letter templates and the Puppeteer renderer (+ tests)
│   ├── llm/              # AI tailoring provider (Anthropic)
│   ├── migrations/       # Idempotent SQL migrations
│   └── database.sql      # Full schema
├── docs/                 # Project overview, design specs and plans
├── photos/               # Static images & favicon
├── index.html            # Public CV page
├── portfolio-main.js     # Public site + server page logic
├── styles.css            # Design tokens + public site styles
├── admin.html / admin.css / admin-dashboard.js   # Admin panel
├── login.html            # Admin login
└── server-info.html      # Home server documentation page
```

## Getting started

Prerequisites: Node.js 18+ and PostgreSQL.

1. `npm install` (also downloads the Chromium used for PDFs).
2. Create `backend/.env`:
   ```text
   PORT=3000
   DATABASE_URL=postgres://user:password@host:5432/resume
   ADMIN_PASSWORD=change-me
   JWT_SECRET=a-long-random-string
   PUBLIC_URL=https://your-domain.example      # used for absolute links in PDFs
   ANTHROPIC_API_KEY=...                       # optional, enables AI tailoring
   ```
3. Run `backend/database.sql` against your database to create the schema.
4. `node backend/index.js` and open `http://localhost:3000`.

Tests: `npm test` (PDF template tests, no database needed).

## License
© 2025–2026 Martín Marzorati. All rights reserved.
