-- Migration: Add qAdmin account disable functionality
-- Allows Entra ID admins to disable the local qAdmin account for enhanced security

-- Add column to track if qAdmin local login is disabled
-- This is a system-wide setting, not a user-specific one
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default setting: qAdmin is enabled by default
INSERT INTO system_settings (key, value, updated_at)
VALUES ('qadmin_disabled', 'false', NOW())
ON CONFLICT (key) DO NOTHING;

-- Add comment explaining the setting
COMMENT ON TABLE system_settings IS 'System-wide configuration settings. qadmin_disabled: When true, prevents local login for qadmin@sim-rq.local account. Can only be disabled if at least one Entra ID admin exists.';

-- Grant permissions
GRANT ALL PRIVILEGES ON system_settings TO "sim-rq_user";
