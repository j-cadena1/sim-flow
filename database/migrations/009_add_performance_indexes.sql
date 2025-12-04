-- Add performance indexes for frequently queried columns
-- Run this migration in production to improve query performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_source_entra ON users(auth_source, entra_id) WHERE auth_source = 'entra_id';

-- Requests table indexes
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_engineer ON requests(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_requests_project_id ON requests(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at DESC);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Title change requests indexes
CREATE INDEX IF NOT EXISTS idx_title_changes_request_id ON title_change_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_title_changes_status ON title_change_requests(status);

-- Discussion requests indexes
CREATE INDEX IF NOT EXISTS idx_discussion_requests_request_id ON discussion_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_discussion_requests_status ON discussion_requests(status);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_request_id ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_request_id ON time_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_requests_engineer_status ON requests(assigned_engineer_id, status) WHERE assigned_engineer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_requester_status ON requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_project_status ON requests(project_id, status) WHERE project_id IS NOT NULL;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO simflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO simflow_user;

-- Analyze tables to update statistics after index creation
ANALYZE users;
ANALYZE requests;
ANALYZE projects;
ANALYZE title_change_requests;
ANALYZE discussion_requests;
ANALYZE comments;
ANALYZE time_entries;
