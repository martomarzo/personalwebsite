# Changelog

What changed for visitors of the CV site and for the admin, one section per working session (newest first).

## 2026-10-20 — Design refresh

**Website**
- New look throughout, keeping the same dark editorial style: a full-screen hero where your name reveals letter by letter, a soft light that follows the cursor, film grain, and buttons that lean toward the pointer.
- The summary lights up word by word as you scroll; experience and education are now a timeline with dates on the left, how long each role lasted ("2 yrs 8 mos"), and a line that fills in as you read.
- Skills are grouped in rows by category; projects are fully clickable cards with a glow that follows the cursor.
- Smooth, weighted scrolling; the top bar hides while scrolling down and returns when scrolling up.
- Phones get a proper menu (full-screen overlay) instead of a top bar that wrapped into four rows.
- Language (EN/ES) and light/dark switches moved into the top bar; switching theme plays a circular reveal.
- The Spanish version is now fully in Spanish: buttons, labels, "Actualidad", and Spanish month names.
- Visitors can download the CV as a PDF straight from the site ("Download CV").
- Footer shows your email with a one-click copy button and direct links; "back to top".
- Clear pages for a missing resume version or a failed load, link previews for social sharing, and a clean result when someone prints the page.
- Everything still works, fully visible, if animations are turned off on the device or the animation scripts can't load.
- The home server page was redesigned to match and shows a loading placeholder instead of outdated text.

**PDF**
- Resumes export in a dedicated A4 layout instead of a printed web page: name, role and contact details as clickable text, compact single column that applicant-tracking systems can read, page numbers, Spanish labels for Spanish versions, and a proper file name.
- The cover letter uses the same header and typefaces, so CV and letter look like a set.
- Previously generated PDFs are regenerated automatically in the new layout.

**Admin**
- Redesigned dashboard: top bar, dark-styled date pickers, dropdowns and uploads, readable field names, on/off switches, quieter row actions, EN/ES badges that flag missing translations, loading and empty states.
- Items now open in a side panel (Esc to close, Ctrl/Cmd+S to save, warns before discarding edits); confirmations use in-app dialogs instead of browser pop-ups.
- Version settings moved next to the content library, with a show/hide switch and title per section and an EN/ES toggle for subtitles and titles.
- The library shows which version you're editing, with visible/total counts per tab; the selected version, tab and collapsed panels are remembered.
- Profile photo can be dragged onto the avatar; new versions are selected right after you create them; version links drop accents (Martín → martin).
- The AI wizard has a clear two-step layout and asks before closing the review step.
- Works on phones and tablets (tables become cards on small screens).
- New login page with show/hide password.
- Fixed: the AI wizard showed both of its steps at once; "Duplicate version" always failed; adding a version with an existing name failed silently; "Add summary" always failed.
- Safer saving: version settings only touch that version's subtitles and titles (they can no longer blank the shared profile), nothing saves while a version is still loading, the profile can't be saved if it failed to load, and an entry filled in one language no longer creates an empty copy in the other.
- Dates no longer shift back a day on save when the server isn't on UTC; skills without a category now appear on the site and PDF (under "Other").
- In the AI wizard, clearing a tailored description keeps the original text, and closing during a generation no longer leaves the wizard stuck.

## 2026-06-19
- Phone link opens a WhatsApp chat instead of dialing.

## 2026-06-11
- Visual refresh of the public site (editorial dark style, new typography).

## 2026-06-05
- Suggested new skills from the AI wizard can be given a percentage.

## 2026-05-31
- AI-tailored resume versions: paste a job posting, review the AI's rewrite, save it as a new version, optionally with a cover letter.
- Experience and education sort correctly by date.

## 2026-05-30
- Profile photo is stored in the database, so it survives redeploys.

## 2026-05-27
- PDF downloads are cached and only regenerated after content changes.

## 2026-05-22 – 2026-05-24
- Modern restyle of the site and admin panel; animation and alignment fixes; fixed adding items in admin.

## 2026-03-11 – 2026-03-12
- Rebuilt on a Node.js + PostgreSQL backend with an admin panel, password login, and an editable home server page.

## 2025-10-30
- First version of the backend to manage CV content.

## 2025-05 – 2025-10
- Original static site: profile, experience, skills, projects, education, downloadable PDF, home server page, Plausible analytics, contact details updates.
