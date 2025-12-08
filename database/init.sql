-- Sim-Flow Database Schema
-- PostgreSQL 16

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Manager', 'Engineer', 'End-User')),
    avatar_url VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requests table
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    vendor VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'Submitted',
        'Feasibility Review',
        'Resource Allocation',
        'Engineering Review',
        'Discussion',
        'In Progress',
        'Completed',
        'Revision Requested',
        'Accepted',
        'Denied'
    )),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255) NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    estimated_hours INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log table
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_by ON requests(created_by);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_comments_request_id ON comments(request_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
CREATE INDEX idx_activity_log_request_id ON activity_log(request_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for requests table
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data: Create users for each role with default passwords
-- qAdmin: admin123, Alice: user123, Bob: manager123, Charlie: engineer123
INSERT INTO users (name, email, password_hash, role, avatar_url) VALUES
    ('qAdmin', 'qadmin@simflow.local', '$2b$10$oTh9EogqkPkBWT.9Y0hEKOfW5Wfe2RdfTsucyJizYk1cN23VsY7ie', 'Admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=qAdmin'),
    ('Alice User', 'alice@simflow.local', '$2b$10$lMDP35A/sQxhLCJbgVPGkOjPY9lRMUBMO7MzRRLHLkZJ2RX6e2mee', 'End-User', 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice'),
    ('Bob Manager', 'bob@simflow.local', '$2b$10$tNgQPQGmKIVU6E467EKbIed/1Kqbh.D99q/izl2yZ6DSZoqfqmmUS', 'Manager', 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob'),
    ('Charlie Engineer', 'charlie@simflow.local', '$2b$10$ZqaYJK.tKOidGRV0OsSGtu9lUCt7J4.sWRKe2Zq8K9JnHv9y04ghy', 'Engineer', 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie');

-- Apply migrations
\i /docker-entrypoint-initdb.d/migrations/001_add_projects_and_revisions.sql
\i /docker-entrypoint-initdb.d/migrations/002_add_time_tracking.sql
\i /docker-entrypoint-initdb.d/migrations/003_add_title_change_requests.sql
\i /docker-entrypoint-initdb.d/migrations/004_add_discussion_requests.sql
\i /docker-entrypoint-initdb.d/migrations/005_add_user_passwords.sql
\i /docker-entrypoint-initdb.d/migrations/006_add_sso_configuration.sql
\i /docker-entrypoint-initdb.d/migrations/007_add_user_sso_tracking.sql
\i /docker-entrypoint-initdb.d/migrations/008_extend_avatar_url.sql
\i /docker-entrypoint-initdb.d/migrations/009_add_performance_indexes.sql
\i /docker-entrypoint-initdb.d/migrations/010_add_audit_logs.sql
\i /docker-entrypoint-initdb.d/migrations/011_add_refresh_tokens.sql
\i /docker-entrypoint-initdb.d/migrations/012_add_on_behalf_of_fields.sql
\i /docker-entrypoint-initdb.d/migrations/013_enhance_project_lifecycle.sql
\i /docker-entrypoint-initdb.d/migrations/014_user_soft_delete.sql
\i /docker-entrypoint-initdb.d/migrations/015_fix_project_codes.sql
\i /docker-entrypoint-initdb.d/migrations/016_fix_lifecycle_consistency.sql
\i /docker-entrypoint-initdb.d/migrations/017_add_discussion_to_lifecycle_check.sql

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO simflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO simflow_user;
