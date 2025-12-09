-- Add columns to track SSO users and source
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source VARCHAR(50) DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS entra_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;

-- Add check constraint for auth_source
ALTER TABLE users ADD CONSTRAINT users_auth_source_check
  CHECK (auth_source IN ('local', 'entra_id'));

-- Update existing users to be 'local'
UPDATE users SET auth_source = 'local' WHERE auth_source IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_source ON users(auth_source);
CREATE INDEX IF NOT EXISTS idx_users_entra_id ON users(entra_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON users TO "sim-rq_user";
