-- Migration: Create pending_uploads table for direct S3 upload tracking
-- This enables browser-to-S3 direct uploads with presigned URLs

CREATE TABLE IF NOT EXISTS pending_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_name VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_uploads_expires_at ON pending_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_uploads_request_id ON pending_uploads(request_id);

COMMENT ON TABLE pending_uploads IS 'Tracks in-progress direct uploads to S3. Records expire after 1 hour.';
COMMENT ON COLUMN pending_uploads.storage_key IS 'S3 object key where the file will be stored';
COMMENT ON COLUMN pending_uploads.expires_at IS 'When the presigned URL expires - cleanup job removes expired records';
