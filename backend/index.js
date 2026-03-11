const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');

// --- Setup ---

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('CRITICAL: Database connection failed!', err.message);
    else console.log('Database connected successfully.');
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- PUBLIC API ---

// GET a fully composed resume by its unique SLUG and language
app.get('/api/resume/slug/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    let client;
    try {
        client = await pool.connect();
        const slugRes = await client.query('SELECT id FROM resume_versions WHERE slug = $1', [slug]);
        if (slugRes.rows.length === 0) return res.status(404).send('Resume version not found');
        const versionId = slugRes.rows[0].id;

        const versionQuery = `
            SELECT 
                rv.id, rv.name, rv.slug, rv.show_experience, rv.show_education, rv.show_projects, rv.show_skills, rv.show_summary,
                ci.name as contact_name, ci.email, ci.phone, ci.linkedin, ci.github, ci.website, ci.profile_picture,
                CASE WHEN $2 = 'es' THEN rv.title_experience_es ELSE rv.title_experience END as title_experience,
                CASE WHEN $2 = 'es' THEN rv.title_education_es ELSE rv.title_education END as title_education,
                CASE WHEN $2 = 'es' THEN rv.title_projects_es ELSE rv.title_projects END as title_projects,
                CASE WHEN $2 = 'es' THEN rv.title_skills_es ELSE rv.title_skills END as title_skills,
                CASE WHEN $2 = 'es' THEN rv.title_summary_es ELSE rv.title_summary END as title_summary,
                CASE WHEN $2 = 'es' THEN ci.subtitle_es ELSE ci.subtitle END as subtitle
            FROM resume_versions rv
            LEFT JOIN contact_info ci ON rv.id = ci.version_id
            WHERE rv.id = $1;
        `;
        const versionRes = await client.query(versionQuery, [versionId, language]);
        const resume = { version: versionRes.rows[0] };

        // Sections
        const fetchSection = async (section) => {
            const query = `
                SELECT p.*, d.*
                FROM ${section}_pool p JOIN ${section}_details d ON p.id = d.pool_id
                JOIN version_${section}_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `;
            const result = await client.query(query, [versionId, language]);
            return result.rows;
        };

        if (resume.version.show_experience) resume.experience = await fetchSection('experience');
        if (resume.version.show_education) resume.education = await fetchSection('education');
        if (resume.version.show_projects) resume.projects = await fetchSection('project');
        
        if (resume.version.show_skills) {
            const query = `
                SELECT p.id, p.percentage, sc.name as category, d.name
                FROM skill_pool p JOIN skill_details d ON p.id = d.pool_id
                JOIN skill_categories sc ON p.category_id = sc.id
                JOIN version_skill_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY sc.name, d.name;
            `;
            const result = await client.query(query, [versionId, language]);
            resume.skills = result.rows;
        }

        if (resume.version.show_summary) {
            const result = await client.query(`
                SELECT p.id, d.content
                FROM summary_pool p JOIN summary_details d ON p.id = d.pool_id
                JOIN version_summary_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC LIMIT 1;
            `, [versionId, language]);
            resume.summary = result.rows[0] || null;
        }

        res.json(resume);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// --- ADMIN APIs ---

// Versions
app.get('/api/admin/versions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/versions', async (req, res) => {
    const { name, slug } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const vResult = await client.query('INSERT INTO resume_versions (name, slug) VALUES ($1, $2) RETURNING *', [name, slug]);
        const version = vResult.rows[0];
        await client.query('INSERT INTO contact_info (version_id) VALUES ($1)', [version.id]);
        await client.query('COMMIT');
        res.json(version);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.put('/api/admin/versions/:id', async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const query = `
        UPDATE resume_versions SET 
        name=$1, slug=$2, title_experience=$3, title_experience_es=$4, show_experience=$5,
        title_education=$6, title_education_es=$7, show_education=$8,
        title_projects=$9, title_projects_es=$10, show_projects=$11,
        title_skills=$12, title_skills_es=$13, show_skills=$14,
        title_summary=$15, title_summary_es=$16, show_summary=$17
        WHERE id=$18 RETURNING *
    `;
    try {
        const result = await pool.query(query, [
            b.name, b.slug, b.title_experience, b.title_experience_es, b.show_experience,
            b.title_education, b.title_education_es, b.show_education,
            b.title_projects, b.title_projects_es, b.show_projects,
            b.title_skills, b.title_skills_es, b.show_skills,
            b.title_summary, b.title_summary_es, b.show_summary, id
        ]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contact Info
app.get('/api/admin/contact_info/:version_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE version_id = $1', [req.params.version_id]);
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/contact_info/:version_id', upload.single('profile_picture'), async (req, res) => {
    const { version_id } = req.params;
    const b = req.body;
    let profile_picture = b.existing_profile_picture;
    if (req.file) profile_picture = '/uploads/' + req.file.filename;

    const query = `
        UPDATE contact_info SET 
        name=$1, email=$2, phone=$3, linkedin=$4, github=$5, website=$6, subtitle=$7, subtitle_es=$8, profile_picture=$9
        WHERE version_id=$10 RETURNING *
    `;
    try {
        const result = await pool.query(query, [b.name, b.email, b.phone, b.linkedin, b.github, b.website, b.subtitle, b.subtitle_es, profile_picture, version_id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Skill Categories
app.get('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM skill_categories ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO skill_categories (name) VALUES ($1) RETURNING *', [req.body.name]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generic Pool Sections
const poolSections = ['experience', 'education', 'project', 'skill', 'summary'];
poolSections.forEach(section => {
    const plural = section === 'summary' ? 'summaries' : section + 's';

    app.get(`/api/admin/${plural}`, async (req, res) => {
        try {
            const pResult = await pool.query(`SELECT * FROM ${section}_pool`);
            const dResult = await pool.query(`SELECT * FROM ${section}_details`);
            const results = pResult.rows.map(item => ({
                ...item,
                details: dResult.rows.filter(d => d.pool_id === item.id)
            }));
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete(`/api/admin/${plural}/:id`, async (req, res) => {
        try {
            await pool.query(`DELETE FROM ${section}_pool WHERE id = $1`, [req.params.id]);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

// Visibility
app.get('/api/admin/visibility/:version_id/:section', async (req, res) => {
    const { version_id, section } = req.params;
    try {
        const result = await pool.query(`SELECT pool_id, is_visible FROM version_${section}_visibility WHERE version_id = $1`, [version_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/visibility', async (req, res) => {
    const { version_id, section, pool_id, is_visible } = req.body;
    const query = `
        INSERT INTO version_${section}_visibility (version_id, pool_id, is_visible)
        VALUES ($1, $2, $3)
        ON CONFLICT (version_id, pool_id)
        DO UPDATE SET is_visible = $3
    `;
    try {
        await pool.query(query, [version_id, pool_id, is_visible]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
