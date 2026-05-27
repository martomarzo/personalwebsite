-- Drop only the tables used by the current application
DROP TABLE IF EXISTS
    pdf_cache,
    version_experience_visibility,
    version_education_visibility,
    version_project_visibility,
    version_skill_visibility,
    version_summary_visibility,
    experience_details,
    education_details,
    project_details,
    skill_details,
    summary_details,
    experience_pool,
    education_pool,
    project_pool,
    skill_pool,
    summary_pool,
    skill_categories,
    contact_info,
    resume_versions,
    server_items,
    server_sections
CASCADE;

-- Core Tables
CREATE TABLE resume_versions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title_experience VARCHAR(255) DEFAULT 'Experience',
    title_experience_es VARCHAR(255) DEFAULT 'Experiencia',
    show_experience BOOLEAN DEFAULT true,
    title_education VARCHAR(255) DEFAULT 'Education',
    title_education_es VARCHAR(255) DEFAULT 'Educación',
    show_education BOOLEAN DEFAULT true,
    title_projects VARCHAR(255) DEFAULT 'Projects',
    title_projects_es VARCHAR(255) DEFAULT 'Proyectos',
    show_projects BOOLEAN DEFAULT true,
    title_skills VARCHAR(255) DEFAULT 'Skills',
    title_skills_es VARCHAR(255) DEFAULT 'Habilidades',
    show_skills BOOLEAN DEFAULT true,
    title_summary VARCHAR(255) DEFAULT 'Summary',
    title_summary_es VARCHAR(255) DEFAULT 'Resumen',
    show_summary BOOLEAN DEFAULT true
);

CREATE TABLE contact_info (
    id SERIAL PRIMARY KEY,
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    linkedin VARCHAR(255),
    github VARCHAR(255),
    website VARCHAR(255),
    profile_picture VARCHAR(255),
    subtitle VARCHAR(255),
    subtitle_es VARCHAR(255),
    UNIQUE(version_id)
);

-- Pool & Details system
CREATE TABLE experience_pool (id SERIAL PRIMARY KEY, company VARCHAR(255), start_date DATE, end_date DATE);
CREATE TABLE experience_details (id SERIAL PRIMARY KEY, pool_id INTEGER NOT NULL REFERENCES experience_pool(id) ON DELETE CASCADE, language VARCHAR(10) NOT NULL, role VARCHAR(255) NOT NULL, description TEXT, UNIQUE(pool_id, language));
CREATE TABLE version_experience_visibility (version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE, pool_id INTEGER NOT NULL REFERENCES experience_pool(id) ON DELETE CASCADE, is_visible BOOLEAN DEFAULT true, PRIMARY KEY (version_id, pool_id));

CREATE TABLE education_pool (id SERIAL PRIMARY KEY, institution VARCHAR(255), start_date DATE, end_date DATE);
CREATE TABLE education_details (id SERIAL PRIMARY KEY, pool_id INTEGER NOT NULL REFERENCES education_pool(id) ON DELETE CASCADE, language VARCHAR(10) NOT NULL, degree VARCHAR(255) NOT NULL, description TEXT, UNIQUE(pool_id, language));
CREATE TABLE version_education_visibility (version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE, pool_id INTEGER NOT NULL REFERENCES education_pool(id) ON DELETE CASCADE, is_visible BOOLEAN DEFAULT true, PRIMARY KEY (version_id, pool_id));

CREATE TABLE project_pool (id SERIAL PRIMARY KEY, link VARCHAR(255));
CREATE TABLE project_details (id SERIAL PRIMARY KEY, pool_id INTEGER NOT NULL REFERENCES project_pool(id) ON DELETE CASCADE, language VARCHAR(10) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, UNIQUE(pool_id, language));
CREATE TABLE version_project_visibility (version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE, pool_id INTEGER NOT NULL REFERENCES project_pool(id) ON DELETE CASCADE, is_visible BOOLEAN DEFAULT true, PRIMARY KEY (version_id, pool_id));

CREATE TABLE skill_categories (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE skill_pool (id SERIAL PRIMARY KEY, category_id INTEGER REFERENCES skill_categories(id) ON DELETE SET NULL, percentage INTEGER);
CREATE TABLE skill_details (id SERIAL PRIMARY KEY, pool_id INTEGER NOT NULL REFERENCES skill_pool(id) ON DELETE CASCADE, language VARCHAR(10) NOT NULL, name VARCHAR(255) NOT NULL, UNIQUE(pool_id, language));
CREATE TABLE version_skill_visibility (version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE, pool_id INTEGER NOT NULL REFERENCES skill_pool(id) ON DELETE CASCADE, is_visible BOOLEAN DEFAULT true, PRIMARY KEY (version_id, pool_id));

CREATE TABLE summary_pool (id SERIAL PRIMARY KEY);
CREATE TABLE summary_details (id SERIAL PRIMARY KEY, pool_id INTEGER NOT NULL REFERENCES summary_pool(id) ON DELETE CASCADE, language VARCHAR(10) NOT NULL, content TEXT, UNIQUE(pool_id, language));
CREATE TABLE version_summary_visibility (version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE, pool_id INTEGER NOT NULL REFERENCES summary_pool(id) ON DELETE CASCADE, is_visible BOOLEAN DEFAULT true, PRIMARY KEY (version_id, pool_id));

-- Server Info Management
CREATE TABLE server_sections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    icon VARCHAR(100),
    description TEXT,
    layout_type VARCHAR(50) DEFAULT 'list', -- 'text', 'list', 'grid', 'table'
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true
);

CREATE TABLE server_items (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES server_sections(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    icon VARCHAR(100),
    platform VARCHAR(100), -- for table rows
    function VARCHAR(255), -- for table rows
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true
);

-- Cache of generated PDF exports. Keyed by (version, language). content_hash is
-- a hash of the composed resume payload; when it no longer matches, the cached
-- PDF is stale and gets re-rendered. Stored in the DB (not on disk) because
-- Render's filesystem is ephemeral and wiped on every redeploy.
CREATE TABLE pdf_cache (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    content_hash TEXT NOT NULL,
    pdf BYTEA NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (version_id, language)
);
