-- Migration: Add SSO columns to users table
-- Date: 2025-12-08
-- Description: Adds auth_source, entra_id, and last_sync_at columns for Entra ID SSO support

-- Add auth_source column (local or entra_id)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source VARCHAR(50) DEFAULT 'local';
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_auth_source_check
  CHECK (auth_source IN ('local', 'entra_id'));

-- Add entra_id column for Entra ID user identifier
ALTER TABLE users ADD COLUMN IF NOT EXISTS entra_id VARCHAR(255) UNIQUE;

-- Add last_sync_at column for tracking SSO sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Update existing users to have 'local' auth_source
UPDATE users SET auth_source = 'local' WHERE auth_source IS NULL;

-- Create indexes for SSO lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_source ON users(auth_source);
CREATE INDEX IF NOT EXISTS idx_users_entra_id ON users(entra_id) WHERE entra_id IS NOT NULL;

-- Update deleted_users table: rename sso_id to entra_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deleted_users' AND column_name = 'sso_id'
  ) THEN
    ALTER TABLE deleted_users RENAME COLUMN sso_id TO entra_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deleted_users' AND column_name = 'entra_id'
  ) THEN
    ALTER TABLE deleted_users ADD COLUMN entra_id VARCHAR(255);
  END IF;
END $$;

-- Drop old columns if they exist (from previous schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'sso_id'
  ) THEN
    ALTER TABLE users DROP COLUMN sso_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'sso_provider'
  ) THEN
    ALTER TABLE users DROP COLUMN sso_provider;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_sso_login'
  ) THEN
    ALTER TABLE users DROP COLUMN last_sso_login;
  END IF;
END $$;

-- Expand avatar_url to TEXT to support long Microsoft Graph photo URLs
ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
