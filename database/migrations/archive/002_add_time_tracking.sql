-- Migration: Add time tracking functionality
-- Description: Creates time_entries table for tracking work hours on requests

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    engineer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    engineer_name VARCHAR(255) NOT NULL,
    hours DECIMAL(5, 2) NOT NULL CHECK (hours > 0),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on request_id for faster lookups
CREATE INDEX idx_time_entries_request_id ON time_entries(request_id);

-- Create index on engineer_id for faster lookups
CREATE INDEX idx_time_entries_engineer_id ON time_entries(engineer_id);
