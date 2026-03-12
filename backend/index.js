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
// Render provides a DATABASE_URL. If it's available, use it.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Required for many cloud DB providers
    // Fallback to individual env vars for local development
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
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
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- API Routes ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));

// GET a fully composed resume by its unique SLUG and language
app.get('/api/resume/slug/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    const client = await pool.connect();
    try {
        const resume = {};
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
        resume.version = versionRes.rows[0];

        if (resume.version.show_experience) {
            const expRes = await client.query(`
                SELECT p.id, p.company, p.start_date, p.end_date, d.role, d.description
                FROM experience_pool p JOIN experience_details d ON p.id = d.pool_id
                JOIN version_experience_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.end_date DESC NULLS FIRST, p.start_date DESC;
            `, [versionId, language]);
            resume.experience = expRes.rows;
        }

        if (resume.version.show_education) {
            const eduRes = await client.query(`
                SELECT p.id, p.institution, p.start_date, p.end_date, d.degree, d.description
                FROM education_pool p JOIN education_details d ON p.id = d.pool_id
                JOIN version_education_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.end_date DESC NULLS FIRST, p.start_date DESC;
            `, [versionId, language]);
            resume.education = eduRes.rows;
        }

        if (resume.version.show_projects) {
            const projRes = await client.query(`
                SELECT p.id, p.link, d.name, d.description
                FROM project_pool p JOIN project_details d ON p.id = d.pool_id
                JOIN version_project_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `, [versionId, language]);
            resume.projects = projRes.rows;
        }

        if (resume.version.show_skills) {
            const skillsRes = await client.query(`
                SELECT p.id, p.percentage, sc.name as category, d.name
                FROM skill_pool p JOIN skill_details d ON p.id = d.pool_id
                JOIN skill_categories sc ON p.category_id = sc.id
                JOIN version_skill_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY sc.name, d.name;
            `, [versionId, language]);
            resume.skills = skillsRes.rows;
        }

        if (resume.version.show_summary) {
            const summaryRes = await client.query(`
                SELECT p.id, d.content
                FROM summary_pool p JOIN summary_details d ON p.id = d.pool_id
                JOIN version_summary_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `, [versionId, language]);
            resume.summary = summaryRes.rows.length > 0 ? summaryRes.rows[0] : null;
        }

        res.json(resume);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// Admin Versions
app.get('/api/admin/versions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
