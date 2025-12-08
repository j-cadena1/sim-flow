-- Migration 021: Add login attempts tracking for account lockout
-- This prevents brute force attacks by temporarily locking accounts after failed attempts

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45), -- IPv6 compatible
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    successful BOOLEAN DEFAULT FALSE
);

-- Index for efficient querying of recent attempts by email
CREATE INDEX idx_login_attempts_email_time ON login_attempts (email, attempted_at DESC);

-- Index for querying by IP address (for IP-based rate limiting)
CREATE INDEX idx_login_attempts_ip_time ON login_attempts (ip_address, attempted_at DESC);

-- Auto-cleanup old login attempts (keep 24 hours of history)
-- This function can be called periodically to maintain table size
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
