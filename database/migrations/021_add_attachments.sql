-- Migration: Add file attachments support
-- Date: 2025-12-09
-- Description: Adds attachments table for request file uploads with S3-compatible storage

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    thumbnail_key VARCHAR(500),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_name VARCHAR(255) NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE attachments IS 'File attachments for simulation requests stored in S3-compatible storage';
COMMENT ON COLUMN attachments.storage_key IS 'S3 object key for the file';
COMMENT ON COLUMN attachments.file_name IS 'Sanitized filename used in storage';
COMMENT ON COLUMN attachments.original_file_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN attachments.thumbnail_key IS 'S3 object key for thumbnail (images/videos only)';
COMMENT ON COLUMN attachments.processing_status IS 'Status of media processing: pending, processing, completed, failed';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_attachments_request_id ON attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_processing_status ON attachments(processing_status) WHERE processing_status != 'completed';
