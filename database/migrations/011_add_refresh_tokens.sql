-- Migration: Add refresh tokens table for secure token refresh flow
-- This enables longer user sessions without compromising security

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(100),
    user_agent VARCHAR(512),
    ip_address VARCHAR(45)
);

-- Index for efficient token lookup
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Index for cleanup of expired/revoked tokens
CREATE INDEX idx_refresh_tokens_cleanup ON refresh_tokens(expires_at, revoked_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON refresh_tokens TO simflow_user;

-- Comment explaining the table
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for JWT token refresh flow. Tokens are hashed for security.';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token';
COMMENT ON COLUMN refresh_tokens.revoked_reason IS 'Reason for revocation: logout, password_change, admin_revoke, session_limit';
