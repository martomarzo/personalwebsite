-- Table for Professional Experience
CREATE TABLE IF NOT EXISTS experience (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE,
    description TEXT,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    version_id INTEGER,
    CONSTRAINT fk_experience_version
        FOREIGN KEY (version_id)
        REFERENCES resume_versions(id)
        ON DELETE SET NULL
);

-- Table for Education
CREATE TABLE IF NOT EXISTS education (
    id SERIAL PRIMARY KEY,
    degree VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    description TEXT,
    version_id INTEGER,
    CONSTRAINT fk_education_version
        FOREIGN KEY (version_id)
        REFERENCES resume_versions(id)
        ON DELETE SET NULL
);

-- Table for Projects
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    link VARCHAR(255),
    icon VARCHAR(255),
    version_id INTEGER,
    CONSTRAINT fk_projects_version
        FOREIGN KEY (version_id)
        REFERENCES resume_versions(id)
        ON DELETE SET NULL
);

-- Table for Skills
CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    level INTEGER,
    version_id INTEGER,
    CONSTRAINT fk_skills_version
        FOREIGN KEY (version_id)
        REFERENCES resume_versions(id)
        ON DELETE SET NULL
);

-- Drop existing summary table if it exists to recreate with new constraints
DROP TABLE IF EXISTS summary CASCADE;

-- Table for Professional Summary
CREATE TABLE IF NOT EXISTS summary (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    subtitle VARCHAR(255),
    version_id INTEGER UNIQUE, -- Ensure only one summary per version
    CONSTRAINT fk_summary_version
        FOREIGN KEY (version_id)
        REFERENCES resume_versions(id)
        ON DELETE CASCADE
);

-- Table for Contact Information
CREATE TABLE IF NOT EXISTS contact_info (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(255),
    linkedin_url VARCHAR(255),
    github_url VARCHAR(255),
    instagram_url VARCHAR(255),
    profile_pic_url VARCHAR(255)
);

-- Table for Resume Versions
CREATE TABLE IF NOT EXISTS resume_versions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    title_professional_summary VARCHAR(255) DEFAULT 'Professional Summary',
    title_professional_experience VARCHAR(255) DEFAULT 'Professional Experience',
    title_technical_skills VARCHAR(255) DEFAULT 'Technical Skills & Expertise',
    title_personal_projects VARCHAR(255) DEFAULT 'Personal Projects',
    title_education VARCHAR(255) DEFAULT 'Education',
    title_languages VARCHAR(255) DEFAULT 'Languages',
    show_professional_summary BOOLEAN DEFAULT TRUE,
    show_professional_experience BOOLEAN DEFAULT TRUE,
    show_technical_skills BOOLEAN DEFAULT TRUE,
    show_personal_projects BOOLEAN DEFAULT TRUE,
    show_education BOOLEAN DEFAULT TRUE,
    show_languages BOOLEAN DEFAULT TRUE
);

-- Add profile_pic_url to contact_info (already exists, but kept for completeness)
ALTER TABLE contact_info
ADD COLUMN IF NOT EXISTS profile_pic_url VARCHAR(255);