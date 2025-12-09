-- Migration: Add discussion requests table
-- This allows engineers to request discussions and suggest revised hours

CREATE TABLE IF NOT EXISTS discussion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    engineer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    suggested_hours INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Denied, Override
    reviewed_by UUID REFERENCES users(id),
    manager_response TEXT,
    allocated_hours INTEGER, -- Final hours allocated by manager
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discussion_requests_request_id ON discussion_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_discussion_requests_status ON discussion_requests(status);
