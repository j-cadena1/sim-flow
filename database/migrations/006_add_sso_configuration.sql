-- Add SSO configuration table
-- This stores Entra ID (Azure AD) SSO settings configurable by Admin

CREATE TABLE IF NOT EXISTS sso_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enabled BOOLEAN NOT NULL DEFAULT false,

    -- Entra ID / Azure AD Configuration
    tenant_id VARCHAR(255),
    client_id VARCHAR(255),
    client_secret TEXT, -- Should be encrypted in production
    redirect_uri VARCHAR(512),

    -- Additional OAuth settings
    authority VARCHAR(512), -- e.g., https://login.microsoftonline.com/{tenant_id}
    scopes TEXT, -- Comma-separated or JSON array of scopes

    -- Audit fields
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_sso_configuration_updated_at
    BEFORE UPDATE ON sso_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default disabled configuration
INSERT INTO sso_configuration (enabled, tenant_id, client_id, client_secret, redirect_uri, authority, scopes)
VALUES (
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'openid,profile,email'
);

-- Create index on enabled for quick checks
CREATE INDEX idx_sso_configuration_enabled ON sso_configuration(enabled);

-- Grant permissions
GRANT ALL PRIVILEGES ON sso_configuration TO simflow_user;
