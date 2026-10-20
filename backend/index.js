const express = require('express');
const { Pool, types } = require('pg');
types.setTypeParser(1082, (value) => value); // DATE → 'YYYY-MM-DD' (no timezone shift)
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const sharp = require('sharp');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { getProvider } = require('./llm/provider');
const { buildResumeHtml, buildCoverLetterHtml, resumeFilename } = require('./pdf/templates');
const { renderPdf, serializeRender } = require('./pdf/render');

const app = express();
const port = process.env.PORT || 3000;

// Auth Secrets
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// --- Database Setup ---
const dbConfig = {
    connectionString: process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL,
    ssl: (process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL) ? { rejectUnauthorized: false } : false,
    max: 5, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);

// Test connection and ensure schema is up to date. There is no migration
// runner, so additive columns are applied idempotently here on every startup
// (works against both the local DB and Render's remote DB).
pool.connect(async (err, client, release) => {
    if (err) {
        return console.error('CRITICAL: Database connection failed!', err.message);
    }
    console.log('Database connected successfully.');
    try {
        await client.query(`
            ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS profile_picture_data BYTEA;
            ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS profile_picture_mime TEXT;
        `);
    } catch (e) {
        console.error('Schema ensure failed:', e.message);
    } finally {
        release();
    }
});

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Authentication Middleware ---
const authenticateAdmin = (req, res, next) => {
    const token = req.cookies.adminToken;
    // originalUrl, not path: under app.use('/api/admin', ...) req.path is mount-relative,
    // which made API calls get a 302 to /login instead of the 401 the admin UI expects.
    const isApi = req.xhr || req.originalUrl.startsWith('/api');
    if (!token) {
        if (isApi) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('adminToken');
        if (isApi) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }
};

// --- AUTH ROUTES ---

app.get('/login', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('adminToken', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

// --- File Upload Setup ---
// Profile pictures are stored as BYTEA in Postgres (the Render filesystem is
// ephemeral, so disk uploads vanish on every redeploy). Keep uploads in memory
// and never touch disk.
const upload = multer({ storage: multer.memoryStorage() });

// Downscale a profile picture buffer. Source photos can be many MB (phone
// cameras); the avatar only ever renders small, and the full-resolution image
// was bloating exported PDFs to ~9MB. Caps width at 500px and auto-orients from
// EXIF. Returns the processed bytes plus their mime type for DB storage.
async function downscaleProfilePicture(buffer) {
    const { data, info } = await sharp(buffer)
        .rotate()
        .resize({ width: 500, withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
    return { data, mime: `image/${info.format}` };
}

// --- PAGE ROUTES ---
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'public', 'uploads')));

app.get('/admin', authenticateAdmin, (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'admin.html'));
});

// Serve static assets
app.use(express.static(path.resolve(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

// --- PUBLIC API ROUTES ---

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// Fetch all server info for the public page
app.get('/api/server-info', async (req, res) => {
    try {
        const sectionsRes = await pool.query('SELECT * FROM server_sections WHERE is_visible = true ORDER BY display_order');
        const sections = sectionsRes.rows;

        for (const section of sections) {
            const itemsRes = await pool.query('SELECT * FROM server_items WHERE section_id = $1 AND is_visible = true ORDER BY display_order', [section.id]);
            section.items = itemsRes.rows;
        }

        res.json(sections);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Fetch a resume_versions row (with localized titles + joined contact info) by
// either slug or id. Returns null if not found. `key` is 'slug' or 'id'.
async function fetchVersionRow(client, key, value, language) {
    const versionRes = await client.query(`
        SELECT
            rv.*,
            ci.name as contact_name, ci.email, ci.phone, ci.linkedin, ci.github, ci.website, ci.profile_picture,
            CASE WHEN $2 = 'es' THEN rv.title_experience_es ELSE rv.title_experience END as title_experience,
            CASE WHEN $2 = 'es' THEN rv.title_education_es ELSE rv.title_education END as title_education,
            CASE WHEN $2 = 'es' THEN rv.title_projects_es ELSE rv.title_projects END as title_projects,
            CASE WHEN $2 = 'es' THEN rv.title_skills_es ELSE rv.title_skills END as title_skills,
            CASE WHEN $2 = 'es' THEN rv.title_summary_es ELSE rv.title_summary END as title_summary,
            CASE WHEN $2 = 'es' THEN ci.subtitle_es ELSE ci.subtitle END as subtitle
        FROM resume_versions rv
        LEFT JOIN contact_info ci ON rv.id = ci.version_id
        WHERE rv.${key === 'id' ? 'id' : 'slug'} = $1;
    `, [value, language]);
    return versionRes.rows[0] || null;
}

// Compose the full resume payload (sections respecting visibility) for a given
// version row. Shared by the public API and the PDF export so the cached PDF's
// content hash always matches what the page actually renders.
async function composeResume(client, version, language) {
    const resume = { version, experience: [], education: [], projects: [], skills: [], summary: null };

    const fetchSection = async (section) => {
        const tbl = section === 'projects' ? 'project' : section;
        // experience/education sort chronologically; ongoing roles (NULL end_date) come first.
        // projects have no date column, so fall back to insertion order.
        const orderBy = (section === 'experience' || section === 'education')
            ? 'p.end_date DESC NULLS FIRST, p.start_date DESC NULLS LAST, p.id DESC'
            : 'p.id DESC';

        // Experience supports per-version description overrides (AI tailoring).
        if (section === 'experience') {
            const result = await client.query(`
                SELECT p.id AS pool_id, p.company, p.start_date, p.end_date,
                       d.language, d.role,
                       COALESCE(o.description, d.description) AS description,
                       (o.description IS NOT NULL) AS is_tailored
                FROM experience_pool p
                JOIN experience_details d ON p.id = d.pool_id
                JOIN version_experience_visibility v ON p.id = v.pool_id
                LEFT JOIN version_experience_override o
                       ON o.version_id = v.version_id AND o.pool_id = p.id AND o.language = d.language
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY ${orderBy};
            `, [version.id, language]);
            return result.rows;
        }

        const result = await client.query(`
            SELECT p.*, d.*
            FROM ${tbl}_pool p
            JOIN ${tbl}_details d ON p.id = d.pool_id
            JOIN version_${tbl}_visibility v ON p.id = v.pool_id
            WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
            ORDER BY ${orderBy};
        `, [version.id, language]);
        return result.rows;
    };

    if (version.show_experience) resume.experience = await fetchSection('experience');
    if (version.show_education) resume.education = await fetchSection('education');
    if (version.show_projects) resume.projects = await fetchSection('projects');

    if (version.show_skills) {
        const result = await client.query(`
            SELECT p.id, p.percentage, sc.name as category, d.name
            FROM skill_pool p JOIN skill_details d ON p.id = d.pool_id
            LEFT JOIN skill_categories sc ON p.category_id = sc.id
            JOIN version_skill_visibility v ON p.id = v.pool_id
            WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
            ORDER BY sc.name NULLS LAST, d.name;
        `, [version.id, language]);
        resume.skills = result.rows;
    }

    if (version.show_summary) {
        // Per-version override wins over the canonical visible summary, when present.
        const override = await client.query(
            'SELECT content FROM version_summary_override WHERE version_id = $1 AND language = $2',
            [version.id, language]
        );
        if (override.rows.length && override.rows[0].content) {
            resume.summary = { id: null, content: override.rows[0].content, is_tailored: true };
        } else {
            const result = await client.query(`
                SELECT p.id, d.content
                FROM summary_pool p JOIN summary_details d ON p.id = d.pool_id
                JOIN version_summary_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC LIMIT 1;
            `, [version.id, language]);
            resume.summary = result.rows[0] || null;
        }
    }
    return resume;
}

app.get('/api/resume/slug/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    let client;
    try {
        client = await pool.connect();
        const version = await fetchVersionRow(client, 'slug', slug, language);
        if (!version) return res.status(404).json({ error: 'Not found' });
        const resume = await composeResume(client, version, language);
        res.json(resume);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (client) client.release();
    }
});

// --- PDF EXPORT ---
// Resume PDFs are rendered from a dedicated A4 template (backend/pdf) fed by the
// same composeResume() payload as the public page, cached in pdf_cache by a hash
// of that payload, and rendered one Chromium at a time (serializeRender).
// Bump when the PDF layout changes so all cached PDFs are invalidated.
const PDF_RENDER_VERSION = 'v2';
const PDF_LANGUAGES = new Set(['en', 'es']);

// Absolute base for links inside PDFs (project links, CV URL). Behind Render's
// proxy req.protocol is "http", so honour X-Forwarded-Proto in the fallback.
function publicBaseUrl(req) {
    const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    return (process.env.PUBLIC_URL || `${proto}://${req.get('host')}`).replace(/\/+$/, '');
}

// Bundled photo used when no profile picture is stored in the DB. The original
// is several MB, so it is downscaled once and memoized as a data URI.
let fallbackPhotoPromise = null;
function fallbackPhotoDataUri() {
    if (!fallbackPhotoPromise) {
        fallbackPhotoPromise = sharp(path.resolve(__dirname, '..', 'photos', 'Martin.jpg'))
            .rotate()
            .resize({ width: 300, withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer()
            .then((buf) => `data:image/jpeg;base64,${buf.toString('base64')}`)
            .catch((err) => {
                console.error('Fallback photo unavailable:', err.message);
                fallbackPhotoPromise = null;
                return null;
            });
    }
    return fallbackPhotoPromise;
}

async function resumePhotoDataUri(db) {
    const result = await db.query(
        'SELECT profile_picture_data, profile_picture_mime FROM contact_info WHERE profile_picture_data IS NOT NULL LIMIT 1'
    );
    const row = result.rows[0];
    if (row && row.profile_picture_data) {
        return `data:${row.profile_picture_mime || 'image/jpeg'};base64,${Buffer.from(row.profile_picture_data).toString('base64')}`;
    }
    return fallbackPhotoDataUri();
}

// Identical concurrent cache misses share one render instead of queueing duplicates.
const inflightResumeRenders = new Map();

// Returns { pdf, filename } for a version/language, from pdf_cache when the
// composed content is unchanged, otherwise rendering and caching a fresh PDF.
// `db` is anything with .query (pass the pool so no connection is held while
// Chromium renders). `allowRender()` is consulted only before a real render;
// when it returns false the result is { pdf: null, filename, limited: true }.
async function getOrRenderResumePdf(db, version, language, publicUrl, { allowRender } = {}) {
    const resume = await composeResume(db, version, language);
    const filename = resumeFilename(version.contact_name, language);
    const hash = crypto.createHash('sha256')
        .update(`${PDF_RENDER_VERSION}:${language}:${publicUrl}:${JSON.stringify(resume)}`)
        .digest('hex');

    const cached = await db.query(
        'SELECT content_hash, pdf FROM pdf_cache WHERE version_id = $1 AND language = $2',
        [version.id, language]
    );
    if (cached.rows.length && cached.rows[0].content_hash === hash) {
        return { pdf: Buffer.from(cached.rows[0].pdf), filename }; // cache hit — no Chromium launch
    }

    const key = `${version.id}:${language}:${hash}`;
    let job = inflightResumeRenders.get(key);
    if (!job) {
        if (allowRender && !allowRender()) return { pdf: null, filename, limited: true };
        job = (async () => {
            const photoDataUri = await resumePhotoDataUri(db);
            const html = buildResumeHtml(resume, { language, publicUrl, photoDataUri });
            const name = (version.contact_name || '').trim();
            const pdf = await serializeRender(() => renderPdf(html, { footerLabel: name ? `${name} · CV` : 'CV' }));
            await db.query(`
                INSERT INTO pdf_cache (version_id, language, content_hash, pdf, generated_at)
                VALUES ($1, $2, $3, $4, now())
                ON CONFLICT (version_id, language)
                DO UPDATE SET content_hash = $3, pdf = $4, generated_at = now()
            `, [version.id, language, hash, pdf]);
            return pdf;
        })().finally(() => inflightResumeRenders.delete(key));
        inflightResumeRenders.set(key, job);
    }
    return { pdf: await job, filename };
}

function sendPdf(res, pdf, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
}

// Public endpoint renders are rate-limited per client (cache hits are free).
const PUBLIC_RENDER_LIMIT = 6;
const PUBLIC_RENDER_WINDOW_MS = 10 * 60 * 1000;
const publicRenderHits = new Map(); // client ip -> recent render timestamps

// The nearest proxy appends the address it saw to X-Forwarded-For, so the last
// entry can't be spoofed by the client (the first one can).
function clientIp(req) {
    const xff = req.get('x-forwarded-for');
    if (xff) return xff.split(',').pop().trim();
    return req.socket.remoteAddress || 'unknown';
}

function allowPublicRender(ip) {
    const now = Date.now();
    if (publicRenderHits.size > 1000) {
        for (const [k, hits] of publicRenderHits) {
            if (!hits.some((t) => now - t < PUBLIC_RENDER_WINDOW_MS)) publicRenderHits.delete(k);
        }
    }
    const recent = (publicRenderHits.get(ip) || []).filter((t) => now - t < PUBLIC_RENDER_WINDOW_MS);
    const allowed = recent.length < PUBLIC_RENDER_LIMIT;
    if (allowed) recent.push(now);
    publicRenderHits.set(ip, recent);
    return allowed;
}

// Public "Download CV" (linked from the website). Not behind admin auth.
app.get('/api/resume/pdf/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    if (!PDF_LANGUAGES.has(language)) return res.status(400).json({ error: 'Language must be "en" or "es".' });
    try {
        const version = await fetchVersionRow(pool, 'slug', slug, language);
        if (!version) return res.status(404).json({ error: 'Resume not found' });

        const ip = clientIp(req);
        const { pdf, filename, limited } = await getOrRenderResumePdf(pool, version, language, publicBaseUrl(req), {
            allowRender: () => allowPublicRender(ip),
        });
        if (limited) return res.status(429).json({ error: 'Too many PDF requests. Please try again in a few minutes.' });

        res.setHeader('Cache-Control', 'no-cache');
        sendPdf(res, pdf, filename);
    } catch (err) {
        console.error('Public PDF error:', err.message);
        res.status(500).json({ error: 'PDF generation failed' });
    }
});

// Download a version as PDF. Authenticated (triggered from the admin panel).
app.get('/api/download/pdf/:id/:language', authenticateAdmin, async (req, res) => {
    const { id, language } = req.params;
    if (!PDF_LANGUAGES.has(language)) return res.status(400).json({ error: 'Language must be "en" or "es".' });
    try {
        const version = await fetchVersionRow(pool, 'id', id, language);
        if (!version) return res.status(404).json({ error: 'Version not found' });
        const { pdf, filename } = await getOrRenderResumePdf(pool, version, language, publicBaseUrl(req));
        sendPdf(res, pdf, filename);
    } catch (err) {
        console.error('PDF generation error:', err.message);
        res.status(500).json({ error: 'PDF generation failed' });
    }
});

// --- ADMIN API ---
app.use('/api/admin', authenticateAdmin);

// Server Info Admin API
app.get('/api/admin/server-sections', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM server_sections ORDER BY display_order');
        res.json(result.rows);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/server-sections', async (req, res) => {
    const { title, icon, description, layout_type, display_order, is_visible } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO server_sections (title, icon, description, layout_type, display_order, is_visible) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, icon, description, layout_type, display_order, is_visible]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/server-sections/:id', async (req, res) => {
    const { id } = req.params;
    const { title, icon, description, layout_type, display_order, is_visible } = req.body;
    try {
        const result = await pool.query(
            'UPDATE server_sections SET title=$1, icon=$2, description=$3, layout_type=$4, display_order=$5, is_visible=$6 WHERE id=$7 RETURNING *',
            [title, icon, description, layout_type, display_order, is_visible, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/server-sections/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM server_sections WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/server-items/:section_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM server_items WHERE section_id = $1 ORDER BY display_order', [req.params.section_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/server-items', async (req, res) => {
    const { section_id, title, content, icon, platform, function: func, display_order, is_visible, item_type } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO server_items (section_id, title, content, icon, platform, function, display_order, is_visible, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [section_id, title, content, icon, platform, func, display_order, is_visible, item_type]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/server-items/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, icon, platform, function: func, display_order, is_visible, item_type } = req.body;
    try {
        const result = await pool.query(
            'UPDATE server_items SET title=$1, content=$2, icon=$3, platform=$4, function=$5, display_order=$6, is_visible=$7, item_type=$8 WHERE id=$9 RETURNING *',
            [title, content, icon, platform, func, display_order, is_visible, item_type, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/server-items/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM server_items WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/versions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY created_at DESC NULLS LAST, name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '..', 'photos', 'favicon.ico')));

app.post('/api/admin/versions', async (req, res) => {
    const { name, slug } = req.body;
    try {
        const result = await pool.query('INSERT INTO resume_versions (name, slug) VALUES ($1, $2) RETURNING *', [name, slug]);
        
        // Copy global info from any existing version if available to maintain "global" sync
        await pool.query(`
            INSERT INTO contact_info (version_id, name, email, phone, linkedin, github, website, profile_picture)
            SELECT $1, name, email, phone, linkedin, github, website, profile_picture 
            FROM contact_info LIMIT 1
            ON CONFLICT (version_id) DO NOTHING
        `, [result.rows[0].id]);
        
        // Ensure a record exists even if it's the first one
        const check = await pool.query('SELECT 1 FROM contact_info WHERE version_id = $1', [result.rows[0].id]);
        if (check.rows.length === 0) {
            await pool.query('INSERT INTO contact_info (version_id) VALUES ($1)', [result.rows[0].id]);
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error in version creation:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/versions/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const sets = Object.keys(fields).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(fields);
    try {
        const result = await pool.query(`UPDATE resume_versions SET ${sets} WHERE id = $${values.length + 1} RETURNING *`, [...values, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/versions/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM resume_versions WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Duplicate a version with everything that belongs to it: settings/titles,
// contact info (incl. subtitles and photo bytes), per-section visibility and
// AI text overrides. Name/slug get "(copy)"/"-copy" (then 2, 3, …) until unique.
app.post('/api/admin/versions/duplicate/:id', async (req, res) => {
    const sourceId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(sourceId)) return res.status(400).json({ error: 'Invalid version id.' });

    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        console.error('Error duplicating version:', err.message);
        return res.status(500).json({ error: 'Database unavailable.' });
    }
    try {
        await client.query('BEGIN');

        const srcRes = await client.query('SELECT name, slug FROM resume_versions WHERE id = $1', [sourceId]);
        if (!srcRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Version not found.' });
        }
        const src = srcRes.rows[0];

        const existing = await client.query('SELECT name, slug FROM resume_versions');
        const names = new Set(existing.rows.map((r) => r.name));
        const slugs = new Set(existing.rows.map((r) => r.slug));
        let name;
        let slug;
        for (let n = 1; ; n++) {
            name = n === 1 ? `${src.name} (copy)` : `${src.name} (copy ${n})`;
            slug = n === 1 ? `${src.slug}-copy` : `${src.slug}-copy-${n}`;
            if (!names.has(name) && !slugs.has(slug)) break;
        }

        const newVerRes = await client.query(`
            INSERT INTO resume_versions (
                name, slug,
                title_experience, title_experience_es, show_experience,
                title_education,  title_education_es,  show_education,
                title_projects,   title_projects_es,   show_projects,
                title_skills,     title_skills_es,     show_skills,
                title_summary,    title_summary_es,    show_summary
            )
            SELECT $1, $2,
                title_experience, title_experience_es, show_experience,
                title_education,  title_education_es,  show_education,
                title_projects,   title_projects_es,   show_projects,
                title_skills,     title_skills_es,     show_skills,
                title_summary,    title_summary_es,    show_summary
            FROM resume_versions WHERE id = $3
            RETURNING *
        `, [name, slug, sourceId]);
        const newVersion = newVerRes.rows[0];

        const ciRes = await client.query(`
            INSERT INTO contact_info (
                version_id, name, email, phone, linkedin, github, website,
                profile_picture, profile_picture_data, profile_picture_mime,
                subtitle, subtitle_es
            )
            SELECT $1, name, email, phone, linkedin, github, website,
                profile_picture, profile_picture_data, profile_picture_mime,
                subtitle, subtitle_es
            FROM contact_info WHERE version_id = $2
        `, [newVersion.id, sourceId]);
        if (ciRes.rowCount === 0) {
            // Source had no contact row: seed the global (shared) fields like a new version does.
            const seeded = await client.query(`
                INSERT INTO contact_info (version_id, name, email, phone, linkedin, github, website,
                    profile_picture, profile_picture_data, profile_picture_mime)
                SELECT $1, name, email, phone, linkedin, github, website,
                    profile_picture, profile_picture_data, profile_picture_mime
                FROM contact_info LIMIT 1
            `, [newVersion.id]);
            if (seeded.rowCount === 0) {
                await client.query('INSERT INTO contact_info (version_id) VALUES ($1)', [newVersion.id]);
            }
        }

        for (const tbl of ['experience', 'education', 'project', 'skill', 'summary']) {
            await client.query(`
                INSERT INTO version_${tbl}_visibility (version_id, pool_id, is_visible)
                SELECT $1, pool_id, is_visible FROM version_${tbl}_visibility WHERE version_id = $2
            `, [newVersion.id, sourceId]);
        }

        await client.query(`
            INSERT INTO version_experience_override (version_id, pool_id, language, description, source, generated_at)
            SELECT $1, pool_id, language, description, source, generated_at
            FROM version_experience_override WHERE version_id = $2
        `, [newVersion.id, sourceId]);
        await client.query(`
            INSERT INTO version_summary_override (version_id, language, content, source, generated_at)
            SELECT $1, language, content, source, generated_at
            FROM version_summary_override WHERE version_id = $2
        `, [newVersion.id, sourceId]);

        await client.query('COMMIT');
        res.status(201).json(newVersion);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error duplicating version:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Serves the profile picture stored in the DB. Public: the portfolio page, the
// admin preview, and the Puppeteer PDF render all load this URL as an <img> src.
// The photo is global (shared across all versions), so any row with bytes works.
app.get('/api/profile_picture', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT profile_picture_data, profile_picture_mime FROM contact_info WHERE profile_picture_data IS NOT NULL LIMIT 1'
        );
        const row = result.rows[0];
        if (!row || !row.profile_picture_data) return res.status(404).end();
        res.setHeader('Content-Type', row.profile_picture_mime || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(Buffer.from(row.profile_picture_data));
    } catch (err) {
        console.error('Error serving profile picture:', err.message);
        res.status(500).end();
    }
});

app.get('/api/admin/global_profile', async (req, res) => {
    try {
        // Prefer a row that already has a profile picture; fall back to any row
        const result = await pool.query(
            'SELECT * FROM contact_info ORDER BY (profile_picture IS NOT NULL) DESC LIMIT 1'
        );
        const row = result.rows[0] || {};
        delete row.profile_picture_data; // never ship raw image bytes in JSON
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/global_profile', upload.single('profile_pic'), async (req, res) => {
    const { name, email, phone, linkedin, github, website } = req.body;
    let profile_picture = req.body.profile_picture;
    try {
        if (req.file) {
            // Store the downscaled bytes in the DB and point profile_picture at the
            // serving endpoint. The timestamp busts the browser cache on each upload.
            const { data, mime } = await downscaleProfilePicture(req.file.buffer);
            profile_picture = '/api/profile_picture?v=' + Date.now();
            await pool.query(
                'UPDATE contact_info SET name=$1, email=$2, phone=$3, linkedin=$4, github=$5, website=$6, profile_picture=$7, profile_picture_data=$8, profile_picture_mime=$9',
                [name, email, phone, linkedin, github, website, profile_picture, data, mime]
            );
        } else {
            await pool.query(
                'UPDATE contact_info SET name=$1, email=$2, phone=$3, linkedin=$4, github=$5, website=$6, profile_picture=$7',
                [name, email, phone, linkedin, github, website, profile_picture]
            );
        }
        res.json({ success: true, profile_picture: profile_picture || null });
    } catch (err) {
        console.error('Error in global profile update:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/contact_info/:version_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE version_id = $1', [req.params.version_id]);
        const row = result.rows[0] || {};
        delete row.profile_picture_data; // never ship raw image bytes in JSON
        res.json(row);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/contact_info/:version_id', upload.single('profile_pic'), async (req, res) => {
    const { version_id } = req.params;
    const body = req.body || {};

    try {
        // 1. Shared fields for ALL versions — only the ones present in the request.
        //    A new photo also stores its downscaled bytes and points profile_picture at
        //    the serving endpoint (timestamp busts the cache).
        const globalSets = {};
        ['name', 'email', 'phone', 'linkedin', 'github', 'website', 'profile_picture'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(body, key)) globalSets[key] = body[key];
        });
        if (req.file) {
            const { data, mime } = await downscaleProfilePicture(req.file.buffer);
            globalSets.profile_picture = '/api/profile_picture?v=' + Date.now();
            globalSets.profile_picture_data = data;
            globalSets.profile_picture_mime = mime;
        }
        const globalKeys = Object.keys(globalSets);
        if (globalKeys.length) {
            await pool.query(
                `UPDATE contact_info SET ${globalKeys.map((k, i) => `${k}=$${i + 1}`).join(', ')}`,
                globalKeys.map((k) => globalSets[k])
            );
        }

        // 2. Version-specific subtitles for this version (only those sent).
        const subKeys = ['subtitle', 'subtitle_es'].filter((k) => Object.prototype.hasOwnProperty.call(body, k));
        const result = subKeys.length
            ? await pool.query(
                `UPDATE contact_info SET ${subKeys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE version_id=$${subKeys.length + 1} RETURNING *`,
                [...subKeys.map((k) => body[k]), version_id]
            )
            : await pool.query('SELECT * FROM contact_info WHERE version_id=$1', [version_id]);
        const row = result.rows[0] || {};
        delete row.profile_picture_data; // never ship raw image bytes in JSON
        res.json(row);
    } catch (err) {
        console.error('Error in global contact update:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/visibility/:version_id/:section', async (req, res) => {
    const { version_id, section } = req.params;
    const tbl = section === 'project' ? 'project' : section;
    try {
        const result = await pool.query(`SELECT pool_id, is_visible FROM version_${tbl}_visibility WHERE version_id = $1`, [version_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/visibility', async (req, res) => {
    const { version_id, section, pool_id, is_visible } = req.body;
    const tbl = section === 'project' ? 'project' : section;
    try {
        await pool.query(`
            INSERT INTO version_${tbl}_visibility (version_id, pool_id, is_visible)
            VALUES ($1, $2, $3)
            ON CONFLICT (version_id, pool_id) DO UPDATE SET is_visible = $3`,
            [version_id, pool_id, is_visible]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const createCrudRoutes = (section) => {
    const plural = section === 'summary' ? 'summaries' : section + 's';
    const tbl = section === 'project' ? 'project' : section;

    app.get(`/api/admin/${plural}`, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT p.*, (SELECT json_agg(d.*) FROM ${tbl}_details d WHERE d.pool_id = p.id) as details
                FROM ${tbl}_pool p ORDER BY p.id DESC`);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`/api/admin/${plural}`, async (req, res) => {
        const { pool: poolData, details } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const poolCols = Object.keys(poolData).join(', ');
            const poolVals = Object.values(poolData).map(v => v === '' ? null : v);
            const poolRes = poolVals.length
                ? await client.query(`INSERT INTO ${tbl}_pool (${poolCols}) VALUES (${poolVals.map((_, i) => '$'+(i+1)).join(',')}) RETURNING id`, poolVals)
                : await client.query(`INSERT INTO ${tbl}_pool DEFAULT VALUES RETURNING id`);
            const poolId = poolRes.rows[0].id;

            for (const detail of details) {
                const dCols = Object.keys(detail).join(', ');
                const dVals = Object.values(detail);
                await client.query(`INSERT INTO ${tbl}_details (${dCols}, pool_id) VALUES (${dVals.map((_, i) => '$'+(i+1)).join(',')}, ${poolId})`, dVals);
            }
            await client.query('COMMIT');
            res.status(201).json({ id: poolId });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    app.put(`/api/admin/${plural}/:id`, async (req, res) => {
        const { id } = req.params;
        const { pool: poolData, details } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (Object.keys(poolData).length > 0) {
                const sets = Object.keys(poolData).map((k, i) => `${k} = $${i + 1}`).join(', ');
                await client.query(`UPDATE ${tbl}_pool SET ${sets} WHERE id = $${Object.keys(poolData).length + 1}`, [...Object.values(poolData), id]);
            }
            for (const detail of details) {
                if (detail.id) {
                    const dId = detail.id; delete detail.id;
                    const sets = Object.keys(detail).map((k, i) => `${k} = $${i + 1}`).join(', ');
                    await client.query(`UPDATE ${tbl}_details SET ${sets} WHERE id = $${Object.keys(detail).length + 1}`, [...Object.values(detail), dId]);
                } else {
                    const dCols = Object.keys(detail).join(', ');
                    const dVals = Object.values(detail);
                    await client.query(`INSERT INTO ${tbl}_details (${dCols}, pool_id) VALUES (${dVals.map((_, i) => '$'+(i+1)).join(',')}, ${id})`, dVals);
                }
            }
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    app.delete(`/api/admin/${plural}/:id`, async (req, res) => {
        try {
            await pool.query(`DELETE FROM ${tbl}_pool WHERE id = $1`, [req.params.id]);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};

['experience', 'education', 'project', 'skill', 'summary'].forEach(createCrudRoutes);

app.get('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM skill_categories ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO skill_categories (name) VALUES ($1) RETURNING *', [req.body.name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error in server sections API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- AI TAILORING ---
// Generate tailored experience descriptions / summary / skill visibility for a job posting,
// using a base resume version as the source content. Does NOT persist — returns suggestions
// for the user to review and edit before committing.
app.post('/api/admin/tailor/preview', async (req, res) => {
    const { base_version_id, language, job_description, company_name, notes, include_cover_letter } = req.body || {};

    if (!base_version_id || !language || !job_description) {
        return res.status(400).json({ error: 'base_version_id, language, and job_description are required.' });
    }
    if (job_description.length > 12000) {
        return res.status(400).json({ error: 'job_description exceeds 12,000 character limit.' });
    }

    let client;
    try {
        client = await pool.connect();
        const version = await fetchVersionRow(client, 'id', base_version_id, language);
        if (!version) return res.status(404).json({ error: 'Base version not found.' });

        const baseResume = await composeResume(client, version, language);

        // Full skill pool (not just what's visible on this base) — so the AI knows
        // what already exists when deciding whether to suggest new skills.
        const allSkillsRes = await client.query(`
            SELECT p.id, sc.name AS category, d.name
            FROM skill_pool p
            LEFT JOIN skill_categories sc ON p.category_id = sc.id
            JOIN skill_details d ON p.id = d.pool_id
            WHERE d.language = $1
            ORDER BY p.id`, [language]);
        const allSkills = allSkillsRes.rows;

        const categoriesRes = await client.query('SELECT name FROM skill_categories ORDER BY name');
        const allCategories = categoriesRes.rows.map(r => r.name);

        const provider = getProvider();
        const suggestions = await provider.tailor({
            baseResume: { ...baseResume, skills: allSkills, allCategories },
            jobDescription: job_description,
            companyName: company_name || '',
            language,
            notes: notes || '',
            includeCoverLetter: !!include_cover_letter,
            candidateName: version.contact_name || '',
        });

        res.json({
            base_version_id,
            language,
            suggestions,
            // ship the canonical view alongside, so the UI can render before/after without a second round-trip
            base_resume: {
                experience: baseResume.experience.map(e => ({
                    pool_id: e.pool_id,
                    company: e.company,
                    role: e.role,
                    description: e.description,
                })),
                skills: baseResume.skills.map(s => ({ id: s.id, name: s.name, category: s.category })),
                summary: baseResume.summary ? baseResume.summary.content : null,
                all_categories: allCategories,
            },
        });
    } catch (err) {
        console.error('Tailor preview error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// Persist a tailored version: create a new resume_versions row, copy visibility from base,
// apply AI-driven skill visibility overrides, write experience/summary text overrides,
// and record an ai_tailorings audit row — all in one transaction.
app.post('/api/admin/tailor/commit', async (req, res) => {
    const {
        base_version_id, language,
        new_slug, new_name,
        suggestions,
        job_description, company_name, notes,
    } = req.body || {};

    if (!base_version_id || !language || !new_slug || !new_name || !suggestions) {
        return res.status(400).json({ error: 'base_version_id, language, new_slug, new_name, and suggestions are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. New resume_versions row with metadata copied from the base
        const newVerRes = await client.query(`
            INSERT INTO resume_versions (
                name, slug,
                title_experience, title_experience_es, show_experience,
                title_education,  title_education_es,  show_education,
                title_projects,   title_projects_es,   show_projects,
                title_skills,     title_skills_es,     show_skills,
                title_summary,    title_summary_es,    show_summary
            )
            SELECT $1, $2,
                title_experience, title_experience_es, show_experience,
                title_education,  title_education_es,  show_education,
                title_projects,   title_projects_es,   show_projects,
                title_skills,     title_skills_es,     show_skills,
                title_summary,    title_summary_es,    show_summary
            FROM resume_versions WHERE id = $3
            RETURNING id
        `, [new_name, new_slug, base_version_id]);
        if (!newVerRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Base version not found.' });
        }
        const newVersionId = newVerRes.rows[0].id;

        // 2. Contact info copied from base
        await client.query(`
            INSERT INTO contact_info (
                version_id, name, email, phone, linkedin, github, website,
                profile_picture, profile_picture_data, profile_picture_mime,
                subtitle, subtitle_es
            )
            SELECT $1, name, email, phone, linkedin, github, website,
                profile_picture, profile_picture_data, profile_picture_mime,
                subtitle, subtitle_es
            FROM contact_info WHERE version_id = $2
        `, [newVersionId, base_version_id]);

        // 3. Copy visibility for non-skill sections verbatim
        for (const tbl of ['experience', 'education', 'project', 'summary']) {
            await client.query(`
                INSERT INTO version_${tbl}_visibility (version_id, pool_id, is_visible)
                SELECT $1, pool_id, is_visible
                FROM version_${tbl}_visibility WHERE version_id = $2
            `, [newVersionId, base_version_id]);
        }

        // 4. Skills:
        //    (a) seed a visibility row for every existing pool entry on the new version (FALSE by default)
        //    (b) insert any AI-suggested new skills the user accepted (creates skill_pool + en/es details)
        //    (c) flip is_visible=TRUE for AI's existing-pool picks plus the newly-created skill IDs
        await client.query(`
            INSERT INTO version_skill_visibility (version_id, pool_id, is_visible)
            SELECT $1, p.id, FALSE FROM skill_pool p
            ON CONFLICT (version_id, pool_id) DO NOTHING
        `, [newVersionId]);

        const newSkillIds = [];
        for (const ns of (suggestions.new_skills_accepted || [])) {
            if (!ns || !ns.name_en || !ns.name_es) continue;
            let categoryId = null;
            if (ns.category) {
                const catRes = await client.query(
                    'SELECT id FROM skill_categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [ns.category]
                );
                categoryId = catRes.rows[0]?.id || null;
            }
            let percentage = null;
            if (ns.percentage !== null && ns.percentage !== undefined && ns.percentage !== '') {
                const pct = parseInt(ns.percentage, 10);
                if (!Number.isNaN(pct)) percentage = Math.max(0, Math.min(100, pct));
            }
            const poolRes = await client.query(
                'INSERT INTO skill_pool (category_id, percentage) VALUES ($1, $2) RETURNING id',
                [categoryId, percentage]
            );
            const newPoolId = poolRes.rows[0].id;
            await client.query(
                'INSERT INTO skill_details (pool_id, language, name) VALUES ($1, $2, $3)',
                [newPoolId, 'en', ns.name_en]
            );
            await client.query(
                'INSERT INTO skill_details (pool_id, language, name) VALUES ($1, $2, $3)',
                [newPoolId, 'es', ns.name_es]
            );
            newSkillIds.push(newPoolId);
        }

        const visibleIds = [...new Set([...(suggestions.skills_visible || []).map(Number), ...newSkillIds])];
        if (visibleIds.length) {
            await client.query(`
                INSERT INTO version_skill_visibility (version_id, pool_id, is_visible)
                SELECT $1, p.id, TRUE FROM skill_pool p WHERE p.id = ANY($2)
                ON CONFLICT (version_id, pool_id) DO UPDATE SET is_visible = TRUE
            `, [newVersionId, visibleIds]);
        }

        // 5. Experience description overrides
        for (const item of (suggestions.experience || [])) {
            if (!item.pool_id || typeof item.description !== 'string') continue;
            await client.query(`
                INSERT INTO version_experience_override (version_id, pool_id, language, description, source)
                VALUES ($1, $2, $3, $4, 'ai')
                ON CONFLICT (version_id, pool_id, language)
                DO UPDATE SET description = $4, source = 'ai', generated_at = now()
            `, [newVersionId, item.pool_id, language, item.description]);
        }

        // 6. Summary override
        if (typeof suggestions.summary === 'string' && suggestions.summary.trim()) {
            await client.query(`
                INSERT INTO version_summary_override (version_id, language, content, source)
                VALUES ($1, $2, $3, 'ai')
                ON CONFLICT (version_id, language)
                DO UPDATE SET content = $3, source = 'ai', generated_at = now()
            `, [newVersionId, language, suggestions.summary]);
        }

        // 7. Audit trail
        const meta = suggestions._meta || {};
        await client.query(`
            INSERT INTO ai_tailorings (version_id, provider, model, job_description, company_name, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [newVersionId, meta.provider || null, meta.model || null, job_description || null, company_name || null, notes || null]);

        await client.query('COMMIT');
        res.status(201).json({ id: newVersionId, slug: new_slug, name: new_name });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Tailor commit error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// --- COVER LETTER PDF ---
// Generates a one-page cover letter PDF on the fly from user-supplied (possibly AI-generated, possibly edited) text,
// using the same header and type as the resume PDF (backend/pdf/templates.js).
// Nothing is persisted server-side — the PDF is streamed back as a download.
app.post('/api/admin/tailor/cover-letter-pdf', async (req, res) => {
    const { base_version_id, text, company_name, language, target_slug } = req.body || {};

    if (!base_version_id || !text) {
        return res.status(400).json({ error: 'base_version_id and text are required.' });
    }
    if (text.length > 8000) {
        return res.status(400).json({ error: 'Cover letter text exceeds 8,000 character limit.' });
    }

    try {
        // pool.query (not a held client) so no connection is pinned while Chromium renders.
        const ci = await pool.query(
            'SELECT name, email, phone, linkedin, website, subtitle, subtitle_es FROM contact_info WHERE version_id = $1',
            [base_version_id]
        );
        const contact = ci.rows[0] || {};
        const lang = language === 'es' ? 'es' : 'en';

        const baseUrl = publicBaseUrl(req);
        const cvUrl = target_slug
            ? `${baseUrl}/?v=${encodeURIComponent(target_slug)}${lang === 'es' ? '&lang=es' : ''}`
            : null;

        const html = buildCoverLetterHtml({
            text,
            candidateName: contact.name || '',
            // Same subtitle the resume header shows for this language.
            subtitle: (lang === 'es' ? contact.subtitle_es : contact.subtitle) || '',
            email: contact.email || '',
            phone: contact.phone || '',
            linkedin: contact.linkedin || '',
            website: contact.website || '',
            cvUrl,
            companyName: company_name || '',
            language: lang,
        });

        const pdf = await serializeRender(() => renderPdf(html));

        const filenameSlug = (company_name || 'cover-letter')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover-letter';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="cover-letter-${filenameSlug}.pdf"`);
        res.send(pdf);
    } catch (err) {
        console.error('Cover letter PDF error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
