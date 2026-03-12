const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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

// Test connection
pool.connect(async (err, client, release) => {
    if (err) {
        return console.error('CRITICAL: Database connection failed!', err.message);
    }
    console.log('Database connected successfully.');
    release();
});

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Authentication Middleware ---
const authenticateAdmin = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) {
        if (req.xhr || req.path.startsWith('/api')) {
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
        if (req.xhr || req.path.startsWith('/api')) {
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
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

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

        if (versionRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const version = versionRes.rows[0];
        const resume = { version, experience: [], education: [], projects: [], skills: [], summary: null };

        const fetchSection = async (section) => {
            const tbl = section === 'projects' ? 'project' : section;
            const result = await client.query(`
                SELECT p.*, d.*
                FROM ${tbl}_pool p 
                JOIN ${tbl}_details d ON p.id = d.pool_id
                JOIN version_${tbl}_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
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
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (client) client.release();
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
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY name');
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

app.get('/api/admin/contact_info/:version_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE version_id = $1', [req.params.version_id]);
        res.json(result.rows[0] || {});
    } catch (err) {
        console.error('Error in server sections API:', err.message);
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
        // 1. Update Global Fields for ALL versions (Name, Email, Phone, Socials, Photo)
        await pool.query(`
            UPDATE contact_info 
            SET name=$1, email=$2, phone=$3, linkedin=$4, github=$5, website=$6, profile_picture=$7
        `, [name, email, phone, linkedin, github, website, profile_picture]);

        // 2. Update Version-Specific Fields (Subtitles) for the current version
        const result = await pool.query(`
            UPDATE contact_info 
            SET subtitle=$1, subtitle_es=$2
            WHERE version_id=$3 RETURNING *`,
            [subtitle, subtitle_es, version_id]
        );
        res.json(result.rows[0]);
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
            const poolVals = Object.values(poolData);
            const poolRes = await client.query(`INSERT INTO ${tbl}_pool (${poolCols}) VALUES (${poolVals.map((_, i) => '$'+(i+1)).join(',')}) RETURNING id`, poolVals);
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

app.listen(port, () => console.log(`Server running on port ${port}`));
