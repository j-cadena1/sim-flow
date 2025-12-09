-- Migration: Add PKCE State Storage for Production SSO
-- Date: 2025-12-08
-- Description: Replaces in-memory PKCE state storage with database-backed solution
--              for multi-instance production deployments

-- Create PKCE state storage table
CREATE TABLE IF NOT EXISTS pkce_states (
    state VARCHAR(255) PRIMARY KEY,
    code_verifier VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE pkce_states IS 'PKCE code verifiers for OAuth 2.0 SSO flow (multi-instance safe)';

-- Create index for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_pkce_states_expires_at ON pkce_states(expires_at);

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_pkce_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM pkce_states WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Verify migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pkce_states') THEN
        RAISE NOTICE 'Migration 001: PKCE state storage table created successfully';
    ELSE
        RAISE EXCEPTION 'Migration 001: Failed to create pkce_states table';
    END IF;
END $$;
