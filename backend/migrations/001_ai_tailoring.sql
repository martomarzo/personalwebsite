-- Migration: AI tailoring support
-- Adds override tables, audit trail, and created_at on resume_versions.
-- Idempotent: safe to re-run.

ALTER TABLE resume_versions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill created_at for existing rows so ordering by created_at is well-defined.
UPDATE resume_versions SET created_at = now() WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS version_experience_override (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    pool_id    INTEGER NOT NULL REFERENCES experience_pool(id) ON DELETE CASCADE,
    language   VARCHAR(10) NOT NULL,
    description TEXT,
    source     VARCHAR(20) DEFAULT 'ai',
    generated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (version_id, pool_id, language)
);

CREATE TABLE IF NOT EXISTS version_summary_override (
    version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
    language   VARCHAR(10) NOT NULL,
    content    TEXT,
    source     VARCHAR(20) DEFAULT 'ai',
    generated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (version_id, language)
);

CREATE TABLE IF NOT EXISTS ai_tailorings (
    id SERIAL PRIMARY KEY,
    version_id INTEGER REFERENCES resume_versions(id) ON DELETE CASCADE,
    provider VARCHAR(50),
    model VARCHAR(100),
    job_description TEXT,
    company_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
