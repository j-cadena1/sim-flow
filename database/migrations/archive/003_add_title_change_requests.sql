-- Migration: Add title change request approval workflow
-- Description: Creates table for tracking title change requests that need approval

-- Create title_change_requests table
CREATE TABLE IF NOT EXISTS title_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_by_name VARCHAR(255) NOT NULL,
    current_title VARCHAR(255) NOT NULL,
    proposed_title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'Approved', 'Denied')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_title_change_requests_request_id ON title_change_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_title_change_requests_status ON title_change_requests(status);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_title_change_requests_updated_at ON title_change_requests;
CREATE TRIGGER update_title_change_requests_updated_at
    BEFORE UPDATE ON title_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
