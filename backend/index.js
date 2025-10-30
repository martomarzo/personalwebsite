const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
console.log('Current working directory:', process.cwd()); // Added for debugging
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use an absolute path to ensure files are saved in the correct directory
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Database connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log('Database connected:', result.rows[0].now);
    });
});

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, '..'))); // Serve static files from the project root
app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve static files from the project root's 'public' directory

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve admin.html for the /admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// Basic test route (moved to /api/test to avoid conflict with /)
app.get('/api/test', (req, res) => {
    res.send('Backend API is running!');
});

// Helper to get default version object
async function getDefaultVersion() {
    const res = await pool.query('SELECT * FROM resume_versions WHERE is_default = TRUE LIMIT 1');
    return res.rows[0] || null;
}

// --- Resume Versions Endpoints ---

// GET all resume versions
app.get('/api/resume_versions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resume_versions ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET a single resume version by ID
app.get('/api/resume_versions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM resume_versions WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Resume version not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST a new resume version
app.post('/api/resume_versions', async (req, res) => {
    try {
        const { name, language, is_default, title_professional_summary, title_professional_experience, title_technical_skills, title_personal_projects, title_education, title_languages, show_professional_summary, show_professional_experience, show_technical_skills, show_personal_projects, show_education, show_languages } = req.body;
        if (is_default) {
            // Ensure only one default version exists
            await pool.query('UPDATE resume_versions SET is_default = FALSE WHERE is_default = TRUE');
        }
        const result = await pool.query(
            'INSERT INTO resume_versions (name, language, is_default, title_professional_summary, title_professional_experience, title_technical_skills, title_personal_projects, title_education, title_languages, show_professional_summary, show_professional_experience, show_technical_skills, show_personal_projects, show_education, show_languages) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING * ',
            [name, language, is_default || false, title_professional_summary, title_professional_experience, title_technical_skills, title_personal_projects, title_education, title_languages, show_professional_summary, show_professional_experience, show_technical_skills, show_personal_projects, show_education, show_languages]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) an existing resume version
app.put('/api/resume_versions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, language, is_default, title_professional_summary, title_professional_experience, title_technical_skills, title_personal_projects, title_education, title_languages, show_professional_summary, show_professional_experience, show_technical_skills, show_personal_projects, show_education, show_languages } = req.body;
        if (is_default) {
            await pool.query('UPDATE resume_versions SET is_default = FALSE WHERE is_default = TRUE AND id != $1', [id]);
        }
        const result = await pool.query(
            'UPDATE resume_versions SET name = $1, language = $2, is_default = $3, title_professional_summary = $4, title_professional_experience = $5, title_technical_skills = $6, title_personal_projects = $7, title_education = $8, title_languages = $9, show_professional_summary = $10, show_professional_experience = $11, show_technical_skills = $12, show_personal_projects = $13, show_education = $14, show_languages = $15 WHERE id = $16 RETURNING * ',
            [name, language, is_default || false, title_professional_summary, title_professional_experience, title_technical_skills, title_personal_projects, title_education, title_languages, show_professional_summary, show_professional_experience, show_technical_skills, show_personal_projects, show_education, show_languages, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).send('Resume version not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE a resume version
app.delete('/api/resume_versions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM resume_versions WHERE id = $1 RETURNING * ', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Resume version not found');
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Experience Endpoints ---

// GET all experience entries for a given version or default
app.get('/api/experience', async (req, res) => {
    try {
        let versionId = req.query.versionId;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        const result = await pool.query('SELECT * FROM experience WHERE version_id = $1 ORDER BY end_date DESC NULLS FIRST, start_date DESC', [versionId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET a single experience entry by ID
app.get('/api/experience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM experience WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Experience entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST a new experience entry
app.post('/api/experience', async (req, res) => {
    try {
        let { title, company, location, start_date, end_date, description, contact_person, contact_email, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        end_date = end_date === '' ? null : end_date; // Convert empty string to null
        start_date = start_date === '' ? null : start_date; // Convert empty string to null
        const result = await pool.query(
            'INSERT INTO experience (title, company, location, start_date, end_date, description, contact_person, contact_email, version_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING * ',
            [title, company, location, start_date, end_date, description, contact_person, contact_email, version_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) an existing experience entry
app.put('/api/experience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { title, company, location, start_date, end_date, description, contact_person, contact_email, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        end_date = end_date === '' ? null : end_date; // Convert empty string to null
        start_date = start_date === '' ? null : start_date; // Convert empty string to null
        const result = await pool.query(
            'UPDATE experience SET title = $1, company = $2, location = $3, start_date = $4, end_date = $5, description = $6, contact_person = $7, contact_email = $8, version_id = $9 WHERE id = $10 RETURNING * ',
            [title, company, location, start_date, end_date, description, contact_person, contact_email, version_id, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).send('Experience entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE an experience entry
app.delete('/api/experience/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let versionId = req.query.versionId || req.body.version_id;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.status(400).send('version_id is required');
        const result = await pool.query('DELETE FROM experience WHERE id = $1 AND version_id = $2 RETURNING * ', [id, versionId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Experience entry not found or not in specified version');
        }
        res.status(204).send(); // No content for successful deletion
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Education Endpoints ---

// GET all education entries for a given version or default
app.get('/api/education', async (req, res) => {
    try {
        let versionId = req.query.versionId;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.json([]);
        const result = await pool.query('SELECT * FROM education WHERE version_id = $1 ORDER BY end_date DESC NULLS FIRST, start_date DESC', [versionId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET a single education entry by ID
app.get('/api/education/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM education WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Education entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST a new education entry
app.post('/api/education', async (req, res) => {
    try {
        let { degree, institution, start_date, end_date, description, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        end_date = end_date === '' ? null : end_date; // Convert empty string to null
        start_date = start_date === '' ? null : start_date; // Convert empty string to null
        const result = await pool.query(
            'INSERT INTO education (degree, institution, start_date, end_date, description, version_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING * ',
            [degree, institution, start_date, end_date, description, version_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) an existing education entry
app.put('/api/education/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { degree, institution, start_date, end_date, description, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        end_date = end_date === '' ? null : end_date; // Convert empty string to null
        start_date = start_date === '' ? null : start_date; // Convert empty string to null
        const result = await pool.query(
            'UPDATE education SET degree = $1, institution = $2, start_date = $3, end_date = $4, description = $5, version_id = $6 WHERE id = $7 RETURNING * ',
            [degree, institution, start_date, end_date, description, version_id, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).send('Education entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE an education entry
app.delete('/api/education/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let versionId = req.query.versionId || req.body.version_id;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.status(400).send('version_id is required');
        const result = await pool.query('DELETE FROM education WHERE id = $1 AND version_id = $2 RETURNING * ', [id, versionId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Education entry not found or not in specified version');
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Projects Endpoints ---

// GET all project entries for a given version or default
app.get('/api/projects', async (req, res) => {
    try {
        let versionId = req.query.versionId;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.json([]);
        const result = await pool.query('SELECT * FROM projects WHERE version_id = $1 ORDER BY id DESC', [versionId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET a single project entry by ID
app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Project entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST a new project entry
app.post('/api/projects', async (req, res) => {
    try {
        const { title, description, link, icon, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        const result = await pool.query(
            'INSERT INTO projects (title, description, link, icon, version_id) VALUES ($1, $2, $3, $4, $5) RETURNING * ',
            [title, description, link, icon, version_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) an existing project entry
app.put('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, link, icon, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        const result = await pool.query(
            'UPDATE projects SET title = $1, description = $2, link = $3, icon = $4, version_id = $5 WHERE id = $6 RETURNING * ',
            [title, description, link, icon, version_id, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).send('Project entry not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE a project entry
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let versionId = req.query.versionId || req.body.version_id;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.status(400).send('version_id is required');
        const result = await pool.query('DELETE FROM projects WHERE id = $1 AND version_id = $2 RETURNING * ', [id, versionId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Project entry not found or not in specified version');
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Skills Endpoints ---

// GET all skills for a given version or default
app.get('/api/skills', async (req, res) => {
    try {
        let versionId = req.query.versionId;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.json([]);
        const result = await pool.query('SELECT * FROM skills WHERE version_id = $1 ORDER BY category, name', [versionId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET a single skill by ID
app.get('/api/skills/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM skills WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Skill not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST a new skill
app.post('/api/skills', async (req, res) => {
    try {
        const { category, name, level, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        const result = await pool.query(
            'INSERT INTO skills (category, name, level, version_id) VALUES ($1, $2, $3, $4) RETURNING * ',
            [category, name, level, version_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) an existing skill
app.put('/api/skills/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, name, level, version_id } = req.body;
        if (!version_id) return res.status(400).send('version_id is required');
        const result = await pool.query(
            'UPDATE skills SET category = $1, name = $2, level = $3, version_id = $4 WHERE id = $5 RETURNING * ',
            [category, name, level, version_id, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).send('Skill not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// DELETE a skill
app.delete('/api/skills/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let versionId = req.query.versionId || req.body.version_id;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.status(400).send('version_id is required');
        const result = await pool.query('DELETE FROM skills WHERE id = $1 AND version_id = $2 RETURNING * ', [id, versionId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Skill not found or not in specified version');
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Summary Endpoints ---

// GET the professional summary for a given version or default
app.get('/api/summary', async (req, res) => {
    try {
        let versionId = req.query.versionId;
        if (!versionId) {
            const defaultVersion = await getDefaultVersion();
            if (defaultVersion) versionId = defaultVersion.id;
        }
        if (!versionId) return res.status(404).send('No default version found');
        const result = await pool.query('SELECT * FROM summary WHERE version_id = $1 LIMIT 1', [versionId]); // Limit 1 as only one summary per version
        if (result.rows.length === 0) {
            return res.status(404).send('Summary not found for this version');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) the professional summary for a given version or create if not exists
app.put('/api/summary', async (req, res) => {
    try {
        const { content, subtitle, version_id } = req.body;
        console.log('PUT /api/summary received:', { content, subtitle, version_id }); // Debug log
        if (!version_id) return res.status(400).send('version_id is required');

        // Check if a summary already exists for this version_id
        const existingSummary = await pool.query('SELECT id FROM summary WHERE version_id = $1', [version_id]);
        console.log('Existing summary for version_id', version_id, ':', existingSummary.rows); // Debug log

        let result;
        if (existingSummary.rows.length > 0) {
            // Update existing summary
            const summaryId = existingSummary.rows[0].id;
            result = await pool.query(
                'UPDATE summary SET content = $1, subtitle = $2 WHERE id = $3 AND version_id = $4 RETURNING * ',
                [content, subtitle, summaryId, version_id]
            );
        } else {
            // Insert new summary
            result = await pool.query(
                'INSERT INTO summary (content, subtitle, version_id) VALUES ($1, $2, $3) RETURNING * ',
                [content, subtitle, version_id]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// --- Contact Info Endpoints ---

// GET the global contact information (no version_id)
app.get('/api/contact_info', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_info WHERE id = 1'); // Always fetch ID 1
        if (result.rows.length === 0) {
            return res.status(404).send('Contact info not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT (update) the global contact information (no version_id)
app.put('/api/contact_info/:id', upload.single('profile_pic'), async (req, res) => {
    try {
        const { id } = req.params;
        const { email, phone, linkedin_url, github_url, instagram_url } = req.body; // Removed subtitle, version_id
        let profile_pic_url = req.body.profile_pic_url; // Existing URL or empty

        if (req.file) {
            // If a new file was uploaded, use its path
            profile_pic_url = '/uploads/' + req.file.filename;
        }

        const result = await pool.query(
            'UPDATE contact_info SET email = $1, phone = $2, linkedin_url = $3, github_url = $4, instagram_url = $5, profile_pic_url = $6 WHERE id = $7 RETURNING * ',
            [email, phone, linkedin_url, github_url, instagram_url, profile_pic_url, id] // Removed subtitle, version_id
        );

        if (result.rows.length === 0) {
            // If no existing contact_info for this ID, try to insert (upsert-like behavior)
             const insertResult = await pool.query(
                'INSERT INTO contact_info (id, email, phone, linkedin_url, github_url, instagram_url, profile_pic_url) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET email = $2, phone = $3, linkedin_url = $4, github_url = $5, instagram_url = $6, profile_pic_url = $7 RETURNING * ',
                [id, email, phone, linkedin_url, github_url, instagram_url, profile_pic_url]
            ); // Removed subtitle, version_id
            return res.json(insertResult.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});