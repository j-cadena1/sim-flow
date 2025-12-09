-- Migration 010: Add Audit Logs
-- This migration adds comprehensive audit logging for tracking all user actions

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'ASSIGN'
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'request', 'project', 'user', 'comment'
    entity_id VARCHAR(50), -- ID of the affected entity (can be UUID or integer)
    details JSONB, -- Additional context (old values, new values, etc.)
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT, -- Browser/client info
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- Grant permissions
GRANT ALL PRIVILEGES ON audit_logs TO "sim-rq_user";
GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO "sim-rq_user";

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all user actions in the system';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (CREATE, UPDATE, DELETE, LOGIN, ASSIGN, etc.)';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected (request, project, user, comment, etc.)';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the affected entity, if applicable';
COMMENT ON COLUMN audit_logs.details IS 'JSON object with additional context like changed fields, old/new values';
