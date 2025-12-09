-- Extend avatar_url column to support base64 encoded images from Entra ID
ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;

-- Grant permissions
GRANT ALL PRIVILEGES ON users TO "sim-rq_user";
