-- Migration: Add Projects and Revision Approval
-- Date: 2025-12-02

-- Step 1: Add 'Revision Approval' status to requests
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (status IN (
    'Submitted',
    'Feasibility Review',
    'Resource Allocation',
    'Engineering Review',
    'In Progress',
    'Completed',
    'Revision Requested',
    'Revision Approval',
    'Accepted',
    'Denied'
));

-- Step 2: Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    total_hours INTEGER NOT NULL CHECK (total_hours >= 0),
    used_hours INTEGER DEFAULT 0 CHECK (used_hours >= 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('Pending', 'Approved', 'Archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Add project-related columns to requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS allocated_hours INTEGER CHECK (allocated_hours >= 0);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_project_id ON requests(project_id);

-- Step 5: Add trigger for projects updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: No sample projects are seeded. Create projects through the UI after deployment.
