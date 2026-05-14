-- Migration 0002: Add google_id for OAuth and make password_hash nullable
-- google_id is required by passport-google-oauth20 strategy
-- password_hash must be nullable so Google OAuth users can be created without a password

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
