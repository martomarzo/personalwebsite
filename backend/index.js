const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');
const puppeteer = require('puppeteer');

// --- Setup ---

// Database connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test DB connection
pool.connect((err, client, release) => {
    if (err) return console.error('Error acquiring client', err.stack);
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) return console.error('Error executing query', err.stack);
    });
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

// Serve index.html for the root and admin.html for /admin
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));

// --- PUBLIC API (for the portfolio website) ---

// GET a fully composed resume by its unique SLUG and language
app.get('/api/resume/slug/:slug/:language', async (req, res) => {
    const { slug, language } = req.params;
    const client = await pool.connect();
    try {
        const resume = {};

        // 1. Get Version ID from Slug
        const slugRes = await client.query('SELECT id FROM resume_versions WHERE slug = $1', [slug]);
        if (slugRes.rows.length === 0) {
            return res.status(404).send('Resume version not found');
        }
        const versionId = slugRes.rows[0].id;

        // 2. Reuse the existing logic by calling a helper function or copy-pasting for now
        // For simplicity, I'll update the main logic to accept either ID or Slug.
        
        // --- (Start of the main fetch logic) ---
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

        // ... Get Experience, Education, Projects, Skills, Summary (Same as ID route)
        // (I will wrap this in a shared function in the next turn to keep code clean)

        // 2. Get Experience (if visible)
        if (resume.version.show_experience) {
            const expQuery = `
                SELECT p.id, p.company, p.start_date, p.end_date, d.role, d.description
                FROM experience_pool p
                JOIN experience_details d ON p.id = d.pool_id
                JOIN version_experience_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.end_date DESC NULLS FIRST, p.start_date DESC;
            `;
            const expRes = await client.query(expQuery, [versionId, language]);
            resume.experience = expRes.rows;
        }

        // 3. Get Education (if visible)
        if (resume.version.show_education) {
            const eduQuery = `
                SELECT p.id, p.institution, p.start_date, p.end_date, d.degree, d.description
                FROM education_pool p
                JOIN education_details d ON p.id = d.pool_id
                JOIN version_education_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.end_date DESC NULLS FIRST, p.start_date DESC;
            `;
            const eduRes = await client.query(eduQuery, [versionId, language]);
            resume.education = eduRes.rows;
        }

        // 4. Get Projects (if visible)
        if (resume.version.show_projects) {
            const projQuery = `
                SELECT p.id, p.link, d.name, d.description
                FROM project_pool p
                JOIN project_details d ON p.id = d.pool_id
                JOIN version_project_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `;
            const projRes = await client.query(projQuery, [versionId, language]);
            resume.projects = projRes.rows;
        }

        // 5. Get Skills (if visible)
        if (resume.version.show_skills) {
            const skillsQuery = `
                SELECT p.id, p.percentage, sc.name as category, d.name
                FROM skill_pool p
                JOIN skill_details d ON p.id = d.pool_id
                JOIN skill_categories sc ON p.category_id = sc.id
                JOIN version_skill_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY sc.name, d.name;
            `;
            const skillsRes = await client.query(skillsQuery, [versionId, language]);
            resume.skills = skillsRes.rows;
        }

        // 6. Get Summary (if visible)
        if (resume.version.show_summary) {
            const summaryQuery = `
                SELECT p.id, d.content
                FROM summary_pool p
                JOIN summary_details d ON p.id = d.pool_id
                JOIN version_summary_visibility v ON p.id = v.pool_id
                WHERE v.version_id = $1 AND v.is_visible = TRUE AND d.language = $2
                ORDER BY p.id DESC;
            `;
            const summaryRes = await client.query(summaryQuery, [versionId, language]);
            resume.summary = summaryRes.rows.length > 0 ? summaryRes.rows[0] : null;
        }

        res.json(resume);

    } catch (err) {
        console.error('Error fetching composed resume:', err);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// --- PDF Download API ---
app.get('/api/download/pdf/:versionId/:language', async (req, res) => {
    const { versionId, language } = req.params;
    const url = `${req.protocol}://${req.get('host')}/?version=${versionId}&lang=${language}`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Args for running in a container/CI environment
        });
        const page = await browser.newPage();
        
        // Navigate to the page and wait for it to be fully loaded
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Generate the PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        // Set headers and send the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="resume-v${versionId}-${language}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generating PDF:', err);
        res.status(500).send('Could not generate PDF.');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});


// --- ADMIN APIs ---

// -- Resume Versions --
app.get('/api/admin/versions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Duplicate a version and all its linked visibility data
app.post('/api/admin/versions/duplicate/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get original version data
        const origVersionRes = await client.query('SELECT * FROM resume_versions WHERE id = $1', [id]);
        if (origVersionRes.rows.length === 0) return res.status(404).send('Version not found');
        const v = origVersionRes.rows[0];

        // 2. Insert new version (copy all titles and flags)
        const newName = `${v.name} (Copy)`;
        const newSlug = `${v.slug}-copy-${Date.now()}`;
        const versionQuery = `
            INSERT INTO resume_versions (
                name, slug, 
                title_experience, title_experience_es, show_experience,
                title_education, title_education_es, show_education,
                title_projects, title_projects_es, show_projects,
                title_skills, title_skills_es, show_skills,
                title_summary, title_summary_es, show_summary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id;
        `;
        const newVersionRes = await client.query(versionQuery, [
            newName, newSlug,
            v.title_experience, v.title_experience_es, v.show_experience,
            v.title_education, v.title_education_es, v.show_education,
            v.title_projects, v.title_projects_es, v.show_projects,
            v.title_skills, v.title_skills_es, v.show_skills,
            v.title_summary, v.title_summary_es, v.show_summary
        ]);
        const newVersionId = newVersionRes.rows[0].id;

        // 3. Duplicate Contact Info
        const origContactRes = await client.query('SELECT * FROM contact_info WHERE version_id = $1', [id]);
        if (origContactRes.rows.length > 0) {
            const ci = origContactRes.rows[0];
            await client.query(
                `INSERT INTO contact_info (version_id, name, email, phone, linkedin, github, website, subtitle, subtitle_es, profile_picture)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [newVersionId, ci.name, ci.email, ci.phone, ci.linkedin, ci.github, ci.website, ci.subtitle, ci.subtitle_es, ci.profile_picture]
            );
        }

        // 4. Duplicate Visibility for all sections
        const sections = ['experience', 'education', 'project', 'skill', 'summary'];
        for (const section of sections) {
            const table = `version_${section}_visibility`;
            await client.query(
                `INSERT INTO ${table} (version_id, pool_id, is_visible)
                 SELECT $1, pool_id, is_visible FROM ${table} WHERE version_id = $2`,
                [newVersionId, id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: newVersionId, name: newName });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Duplication error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/admin/versions', async (req, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Name and Slug are required' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const versionResult = await client.query('INSERT INTO resume_versions (name, slug) VALUES ($1, $2) RETURNING *', [name, slug]);
        const newVersion = versionResult.rows[0];
        await client.query('INSERT INTO contact_info (version_id) VALUES ($1)', [newVersion.id]);
        await client.query('COMMIT');
        res.status(201).json(newVersion);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.put('/api/admin/versions/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        name, slug,
        title_experience, title_experience_es, show_experience, 
        title_education, title_education_es, show_education, 
        title_projects, title_projects_es, show_projects, 
        title_skills, title_skills_es, show_skills, 
        title_summary, title_summary_es, show_summary 
    } = req.body;
    try {
        const result = await pool.query(
            `UPDATE resume_versions SET 
             name = $1, slug = $2,
             title_experience = $3, title_experience_es = $4, show_experience = $5, 
             title_education = $6, title_education_es = $7, show_education = $8, 
             title_projects = $9, title_projects_es = $10, show_projects = $11, 
             title_skills = $12, title_skills_es = $13, show_skills = $14, 
             title_summary = $15, title_summary_es = $16, show_summary = $17
             WHERE id = $18 RETURNING *`,
            [
                name, slug,
                title_experience, title_experience_es, show_experience, 
                title_education, title_education_es, show_education, 
                title_projects, title_projects_es, show_projects, 
                title_skills, title_skills_es, show_skills, 
                title_summary, title_summary_es, show_summary, 
                id
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('DATABASE ERROR updating version:', err.message);
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

// -- Contact Info --
app.get('/api/admin/contact_info/:version_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE version_id = $1', [req.params.version_id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/contact_info/:version_id', upload.single('profile_picture'), async (req, res) => {
    const { version_id } = req.params;
    const { name, email, phone, linkedin, github, website, subtitle, subtitle_es } = req.body;
    let profile_picture = req.body.existing_profile_picture;
    if (req.file) {
        profile_picture = '/uploads/' + req.file.filename;
    }
    try {
        const result = await pool.query(
            `UPDATE contact_info 
             SET name = $1, email = $2, phone = $3, linkedin = $4, github = $5, website = $6, subtitle = $7, subtitle_es = $8, profile_picture = $9
             WHERE version_id = $10 RETURNING *`,
            [name, email, phone, linkedin, github, website, subtitle, subtitle_es, profile_picture, version_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('DATABASE ERROR updating contact_info:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// -- Skill Categories --
app.get('/api/admin/skill_categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM skill_categories ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/skill_categories', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO skill_categories (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- Generic Content Pool Management --

const createPoolEndpoints = (section) => {
    // Standardize naming: section = 'experience', 'education', 'project', 'skill', 'summary'
    const plural = section === 'summary' ? 'summaries' : section + 's';
    const poolTable = section + '_pool';
    const detailsTable = section + '_details';
    const visibilityTable = 'version_' + section + '_visibility';

    // Get all items in the pool with their details
    app.get(`/api/admin/${plural}`, async (req, res) => {
        try {
            const query = `
                SELECT p.*, json_agg(d.*) as details
                FROM ${poolTable} p
                LEFT JOIN ${detailsTable} d ON p.id = d.pool_id
                GROUP BY p.id;
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error(`DATABASE ERROR fetching ${plural}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Create a new item in the pool
    app.post(`/api/admin/${plural}`, async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Create the entry in the pool table
            let poolId;
            const poolFields = Object.keys(req.body.pool || {}).filter(k => req.body.pool[k] !== undefined && req.body.pool[k] !== '');
            
            if (poolFields.length > 0) {
                const poolValues = poolFields.map(k => req.body.pool[k]);
                const poolPlaceholders = poolFields.map((_, i) => `$${i + 1}`).join(', ');
                const poolQuery = `INSERT INTO ${poolTable} (${poolFields.join(', ')}) VALUES (${poolPlaceholders}) RETURNING id;`;
                const poolRes = await client.query(poolQuery, poolValues);
                poolId = poolRes.rows[0].id;
            } else {
                // If there are no pool fields (like in summary_pool), just insert default values
                const poolQuery = `INSERT INTO ${poolTable} DEFAULT VALUES RETURNING id;`;
                const poolRes = await client.query(poolQuery);
                poolId = poolRes.rows[0].id;
            }
            
            // 2. Create the details entries
            for (const detail of req.body.details) {
                const detailFields = Object.keys(detail);
                const detailValues = detailFields.map(k => detail[k]);
                const detailPlaceholders = detailFields.map((_, i) => `$${i + 2}`).join(', ');
                const detailQuery = `INSERT INTO ${detailsTable} (pool_id, ${detailFields.join(', ')}) VALUES ($1, ${detailPlaceholders});`;
                await client.query(detailQuery, [poolId, ...detailValues]);
            }

            await client.query('COMMIT');
            res.status(201).json({ id: poolId });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`Error creating ${section}:`, err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });
    
    // Add more endpoints for pool management (update pool, add/update details, delete) as needed...
    
    // Delete an item from the pool
    app.delete(`/api/admin/${plural}/:pool_id`, async (req, res) => {
        const { pool_id } = req.params;
        try {
            // The ON DELETE CASCADE in the schema will handle cleaning up details and visibility
            await pool.query(`DELETE FROM ${poolTable} WHERE id = $1`, [pool_id]);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update a pool item and its details
    app.put(`/api/admin/${plural}/:pool_id`, async (req, res) => {
        const { pool_id } = req.params;
        const { pool: poolData, details: detailsData } = req.body;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Update the pool table
            const filteredPoolFields = Object.keys(poolData || {}).filter(k => poolData[k] !== undefined && poolData[k] !== '');
            if (filteredPoolFields.length > 0) {
                const poolValues = filteredPoolFields.map(k => poolData[k]);
                const setClause = filteredPoolFields.map((field, i) => `${field} = $${i + 1}`).join(', ');
                const poolQuery = `UPDATE ${poolTable} SET ${setClause} WHERE id = $${filteredPoolFields.length + 1}`;
                await client.query(poolQuery, [...poolValues, pool_id]);
            }

            // 2. Upsert details
            if (detailsData && Array.isArray(detailsData)) {
                for (const detail of detailsData) {
                    const detailFields = Object.keys(detail).filter(k => k !== 'id' && k !== 'pool_id');
                    const detailValues = detailFields.map(k => detail[k]);
                    
                    if (detail.id) { // Existing detail, UPDATE it
                        const setClause = detailFields.map((field, i) => `${field} = $${i + 1}`).join(', ');
                        const detailQuery = `UPDATE ${detailsTable} SET ${setClause} WHERE id = $${detailFields.length + 1}`;
                        await client.query(detailQuery, [...detailValues, detail.id]);
                    } else { // New detail, INSERT it
                        const placeholders = detailFields.map((_, i) => `$${i + 2}`).join(', ');
                        const detailQuery = `INSERT INTO ${detailsTable} (pool_id, ${detailFields.join(', ')}) VALUES ($1, ${placeholders})`;
                        await client.query(detailQuery, [pool_id, ...detailValues]);
                    }
                }
            }

            await client.query('COMMIT');
            res.status(200).json({ success: true });

        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });
};

createPoolEndpoints('experience');
createPoolEndpoints('education');
createPoolEndpoints('project');
createPoolEndpoints('skill');
createPoolEndpoints('summary');


// -- Visibility --

// Get all visibilities for a version
app.get('/api/admin/visibility/:version_id/:section', async (req, res) => {
    const { version_id, section } = req.params;
    const visibilityTable = `version_${section}_visibility`;
    try {
        const result = await pool.query(`SELECT pool_id, is_visible FROM ${visibilityTable} WHERE version_id = $1`, [version_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set visibility for an item in a version
app.put('/api/admin/visibility', async (req, res) => {
    const { version_id, section, pool_id, is_visible } = req.body;
    if (!version_id || !section || !pool_id || is_visible === undefined) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    const visibilityTable = `version_${section}_visibility`;
    try {
        const query = `
            INSERT INTO ${visibilityTable} (version_id, pool_id, is_visible)
            VALUES ($1, $2, $3)
            ON CONFLICT (version_id, pool_id)
            DO UPDATE SET is_visible = $3;
        `;
        await pool.query(query, [version_id, pool_id, is_visible]);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('DATABASE ERROR updating visibility:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- Server ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
