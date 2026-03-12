-- Drop all tables in order to reset the schema completely.
-- The CASCADE option will drop any dependent objects.
DROP TABLE IF EXISTS
    resume_versions,
    contact_info,
    experience_pool,
    experience_details,
    version_experience_visibility,
    education_pool,
    education_details,
    version_education_visibility,
    project_pool,
    project_details,
    version_project_visibility,
    skill_pool,
    skill_details,
    version_skill_visibility,
    summary_pool,
    summary_details,
    version_summary_visibility
CASCADE;

-- Stores the different resume versions and their specific settings.
CREATE TABLE resume_versions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    -- Dynamic titles and visibility flags for each section
    title_experience VARCHAR(255) DEFAULT 'Experience',
    show_experience BOOLEAN DEFAULT true,
    title_education VARCHAR(255) DEFAULT 'Education',
    show_education BOOLEAN DEFAULT true,
    title_projects VARCHAR(255) DEFAULT 'Projects',
    show_projects BOOLEAN DEFAULT true,
    title_skills VARCHAR(255) DEFAULT 'Skills',
    show_skills BOOLEAN DEFAULT true,
    title_summary VARCHAR(255) DEFAULT 'Summary',
    show_summary BOOLEAN DEFAULT true
);

-- Stores contact information, with each entry linked to a specific resume version.
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
    -- Subtitle is now part of contact info for the version
    subtitle VARCHAR(255),
    UNIQUE(version_id)
);

-- =============================================
-- Experience Section
-- =============================================
CREATE TABLE experience_pool (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255),
    start_date DATE,
    end_date DATE
);

CREATE TABLE experience_details (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES experience_pool(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    role VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE(pool_id, language)
);

CREATE TABLE version_experience_visibility (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES experience_pool(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    PRIMARY KEY (version_id, pool_id)
);

-- =============================================
-- Education Section
-- =============================================
CREATE TABLE education_pool (
    id SERIAL PRIMARY KEY,
    institution VARCHAR(255),
    start_date DATE,
    end_date DATE
);

CREATE TABLE education_details (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES education_pool(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE(pool_id, language)
);

CREATE TABLE version_education_visibility (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES education_pool(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    PRIMARY KEY (version_id, pool_id)
);

-- =============================================
-- Projects Section
-- =============================================
CREATE TABLE project_pool (
    id SERIAL PRIMARY KEY,
    link VARCHAR(255)
);

CREATE TABLE project_details (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES project_pool(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE(pool_id, language)
);

CREATE TABLE version_project_visibility (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES project_pool(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    PRIMARY KEY (version_id, pool_id)
);

-- =============================================
-- Skills Section
-- =============================================
CREATE TABLE skill_pool (
    id SERIAL PRIMARY KEY,
    percentage INTEGER
);

CREATE TABLE skill_details (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES skill_pool(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    UNIQUE(pool_id, language)
);

CREATE TABLE version_skill_visibility (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES skill_pool(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    PRIMARY KEY (version_id, pool_id)
);

-- =============================================
-- Summary Section
-- =============================================
CREATE TABLE summary_pool (
    id SERIAL PRIMARY KEY
);

CREATE TABLE summary_details (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES summary_pool(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    content TEXT,
    UNIQUE(pool_id, language)
);

CREATE TABLE version_summary_visibility (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id INTEGER NOT NULL REFERENCES summary_pool(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    PRIMARY KEY (version_id, pool_id)
);

-- =============================================
-- Default Data
-- =============================================
-- Insert a default resume version to get started.
INSERT INTO resume_versions (name) VALUES ('Default')
ON CONFLICT (name) DO NOTHING;

-- Associate a default contact info entry for the default version.
INSERT INTO contact_info (version_id)
SELECT id FROM resume_versions WHERE name = 'Default'
ON CONFLICT (version_id) DO NOTHING;
