const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

// --- Database Setup ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Test connection and check tables
pool.connect(async (err, client, release) => {
    if (err) {
        return console.error('CRITICAL: Database connection failed!', err.message);
    }
    console.log('Database connected successfully.');
    try {
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Available tables:', res.rows.map(r => r.table_name).join(', '));
        if (res.rows.length === 0) {
            console.warn('WARNING: No tables found in the database. Did you run database.sql?');
        }
    } catch (queryErr) {
        console.error('Error checking tables:', queryErr.message);
    } finally {
        release();
    }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- File Upload Setup ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Static files (must be before routes if you want them to take precedence, 
// but we want API routes to take precedence, so we put them AFTER API routes or use specific paths)
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// --- PUBLIC API ROUTES ---

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', database: 'connected', time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Main resume data fetcher
app.get('/api/resume/slug/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    let client;
    try {
        client = await pool.connect();
        
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
            WHERE rv.slug = $1;
        `, [slug, language]);

        if (versionRes.rows.length === 0) {
            return res.status(404).json({ error: 'Resume version not found', slug });
        }

        const version = versionRes.rows[0];
        const resume = { version, experience: [], education: [], projects: [], skills: [], summary: null };

        const fetchSection = async (section) => {
            const tbl = section === 'projects' ? 'project' : section;
            const query = `
                SELECT p.*, d.*
                FROM ${tbl}_pool p 
                JOIN ${tbl}_details d ON p.id = d.pool_id
                JOIN version_${tbl}_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `;
            const result = await client.query(query, [version.id, language]);
            return result.rows;
        };

        if (version.show_experience) resume.experience = await fetchSection('experience');
        if (version.show_education) resume.education = await fetchSection('education');
        if (version.show_projects) resume.projects = await fetchSection('projects');
        
        if (version.show_skills) {
            const result = await client.query(`
                SELECT p.id, p.percentage, sc.name as category, d.name
                FROM skill_pool p JOIN skill_details d ON p.id = d.pool_id
                JOIN skill_categories sc ON p.category_id = sc.id
                JOIN version_skill_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY sc.name, d.name;
            `, [version.id, language]);
            resume.skills = result.rows;
        }

        if (version.show_summary) {
            const result = await client.query(`
                SELECT p.id, d.content
                FROM summary_pool p JOIN summary_details d ON p.id = d.pool_id
                JOIN version_summary_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC LIMIT 1;
            `, [version.id, language]);
            resume.summary = result.rows[0] || null;
        }

        res.json(resume);
    } catch (err) {
        console.error('API ERROR:', err.message);
        res.status(500).json({ error: 'Database query failed', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// --- ADMIN API ROUTES ---

// Versions Management
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
    try {
        const result = await pool.query(
            'INSERT INTO resume_versions (name, slug) VALUES ($1, $2) RETURNING *',
            [name, slug]
        );
        // Also create default contact info for the new version
        await pool.query('INSERT INTO contact_info (version_id) VALUES ($1)', [result.rows[0].id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/versions/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const sets = Object.keys(fields).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(fields);
    try {
        const result = await pool.query(
            `UPDATE resume_versions SET ${sets} WHERE id = $${values.length + 1} RETURNING *`,
            [...values, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/versions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM resume_versions WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contact Info Management
app.get('/api/admin/contact_info/:version_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE version_id = $1', [req.params.version_id]);
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/contact_info/:version_id', upload.single('profile_pic'), async (req, res) => {
    const { version_id } = req.params;
    const { name, email, phone, linkedin, github, website, subtitle, subtitle_es } = req.body;
    let profile_picture = req.body.profile_picture;

    if (req.file) {
        profile_picture = '/uploads/' + req.file.filename;
    }

    try {
        const result = await pool.query(`
            UPDATE contact_info 
            SET name=$1, email=$2, phone=$3, linkedin=$4, github=$5, website=$6, profile_picture=$7, subtitle=$8, subtitle_es=$9
            WHERE version_id=$10 RETURNING *`,
            [name, email, phone, linkedin, github, website, profile_picture, subtitle, subtitle_es, version_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Visibility Management
app.get('/api/admin/visibility/:version_id/:section', async (req, res) => {
    const { version_id, section } = req.params;
    const tbl = section === 'project' ? 'project' : section; // Match DB table naming
    try {
        const result = await pool.query(`SELECT pool_id, is_visible FROM version_${tbl}_visibility WHERE version_id = $1`, [version_id]);
        res.json(result.rows);
    } catch (err) {
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
        res.status(500).json({ error: err.message });
    }
});

// --- CONTENT MANAGEMENT ENDPOINTS ---
// (Simplified CRUD generator for the pool/details system)
const createCrudRoutes = (section) => {
    const plural = section === 'summary' ? 'summaries' : section + 's';
    const tbl = section === 'project' ? 'project' : section;

    // GET all from pool
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

    // POST new item (Pool + Details)
    app.post(`/api/admin/${plural}`, async (req, res) => {
        const { pool: poolData, details } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const poolCols = Object.keys(poolData).join(', ');
            const poolVals = Object.values(poolData);
            const poolPlaceholders = poolVals.map((_, i) => `$${i + 1}`).join(', ');
            
            const poolRes = await client.query(
                `INSERT INTO ${tbl}_pool (${poolCols}) VALUES (${poolPlaceholders}) RETURNING id`,
                poolVals
            );
            const poolId = poolRes.rows[0].id;

            for (const detail of details) {
                const detailCols = Object.keys(detail).join(', ');
                const detailVals = Object.values(detail);
                const detailPlaceholders = detailVals.map((_, i) => `$${i + 1}`).join(', ');
                await client.query(
                    `INSERT INTO ${tbl}_details (${detailCols}, pool_id) VALUES (${detailPlaceholders}, ${poolId})`,
                    detailVals
                );
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

    // PUT update item
    app.put(`/api/admin/${plural}/:id`, async (req, res) => {
        const { id } = req.params;
        const { pool: poolData, details } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (Object.keys(poolData).length > 0) {
                const poolSets = Object.keys(poolData).map((k, i) => `${k} = $${i + 1}`).join(', ');
                await client.query(`UPDATE ${tbl}_pool SET ${poolSets} WHERE id = $${Object.keys(poolData).length + 1}`, [...Object.values(poolData), id]);
            }
            for (const detail of details) {
                if (detail.id) {
                    const detailId = detail.id;
                    delete detail.id;
                    const detailSets = Object.keys(detail).map((k, i) => `${k} = $${i + 1}`).join(', ');
                    await client.query(`UPDATE ${tbl}_details SET ${detailSets} WHERE id = $${Object.keys(detail).length + 1}`, [...Object.values(detail), detailId]);
                } else {
                    const detailCols = Object.keys(detail).join(', ');
                    const detailVals = Object.values(detail);
                    const detailPlaceholders = detailVals.map((_, i) => `$${i + 1}`).join(', ');
                    await client.query(`INSERT INTO ${tbl}_details (${detailCols}, pool_id) VALUES (${detailPlaceholders}, ${id})`, detailVals);
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

    // DELETE item
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
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO skill_categories (name) VALUES ($1) RETURNING *', [req.body.name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PAGE ROUTES ---

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));

// Catch-all for static files
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
