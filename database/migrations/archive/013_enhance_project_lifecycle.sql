-- Migration: Enhanced Project Lifecycle Management
-- Date: 2025-12-06
-- Description: Adds comprehensive lifecycle states, deadlines, priorities,
--              categories, milestones, and audit tracking for projects

-- ============================================================================
-- STEP 1: Expand project status options
-- ============================================================================
-- New statuses:
--   Pending    - Awaiting approval (existing)
--   Active     - Approved and actively being worked on (replaces 'Approved' semantically)
--   On Hold    - Temporarily paused, can be resumed
--   Suspended  - Administratively halted, requires approval to resume
--   Completed  - All work finished successfully
--   Cancelled  - Cancelled before completion
--   Expired    - Past deadline without completion
--   Archived   - Historical record, no longer active (existing)

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
    CHECK (status IN ('Pending', 'Approved', 'Active', 'On Hold', 'Suspended', 'Completed', 'Cancelled', 'Expired', 'Archived'));

-- Migrate existing 'Approved' projects to 'Active' for clarity
-- (Keep 'Approved' valid for backwards compatibility during transition)
UPDATE projects SET status = 'Active' WHERE status = 'Approved';

-- ============================================================================
-- STEP 2: Add new columns for lifecycle management
-- ============================================================================

-- Priority levels for project ordering
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(20)
    DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'));

-- Category for project classification
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Project description for better context
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- Date fields for lifecycle management
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline DATE;

-- Completion tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Owner/stakeholder (different from creator - e.g., project sponsor)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);

-- ============================================================================
-- STEP 3: Create project_status_history table for audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_status_history_project ON project_status_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_status_history_created ON project_status_history(created_at);

-- ============================================================================
-- STEP 4: Create project_hour_transactions table for hour tracking
-- ============================================================================
-- Tracks every allocation, deallocation, and adjustment of hours
CREATE TABLE IF NOT EXISTS project_hour_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'allocation',      -- Hours allocated to a request
        'deallocation',    -- Hours returned from cancelled/denied request
        'adjustment',      -- Manual adjustment by manager
        'completion',      -- Hours finalized on request completion
        'rollover',        -- Hours rolled over from another project
        'extension'        -- Additional hours added to project
    )),
    hours INTEGER NOT NULL,  -- Positive for additions, negative for deductions
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hour_transactions_project ON project_hour_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_request ON project_hour_transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_type ON project_hour_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_created ON project_hour_transactions(created_at);

-- ============================================================================
-- STEP 5: Create project_milestones table for phase tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Skipped')),
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON project_milestones(status);

-- Add trigger for milestones updated_at
DROP TRIGGER IF EXISTS update_milestones_updated_at ON project_milestones;
CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON project_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Add indexes for new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- ============================================================================
-- STEP 7: Add constraint to prevent over-allocation
-- ============================================================================
-- Note: This is a CHECK constraint, but complex validations should be in app logic
-- This just ensures used_hours never exceeds total_hours at DB level
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_hours_valid;
ALTER TABLE projects ADD CONSTRAINT projects_hours_valid
    CHECK (used_hours <= total_hours);

-- ============================================================================
-- STEP 8: Create view for project health metrics
-- ============================================================================
CREATE OR REPLACE VIEW project_health_metrics AS
SELECT
    p.id,
    p.name,
    p.code,
    p.status,
    p.priority,
    p.total_hours,
    p.used_hours,
    p.total_hours - p.used_hours AS available_hours,
    CASE
        WHEN p.total_hours = 0 THEN 0
        ELSE ROUND((p.used_hours::DECIMAL / p.total_hours) * 100, 2)
    END AS utilization_percentage,
    p.deadline,
    CASE
        WHEN p.deadline IS NULL THEN NULL
        WHEN p.deadline < CURRENT_DATE AND p.status NOT IN ('Completed', 'Cancelled', 'Archived', 'Expired') THEN 'Overdue'
        WHEN p.deadline <= CURRENT_DATE + INTERVAL '7 days' THEN 'Due Soon'
        ELSE 'On Track'
    END AS deadline_status,
    p.start_date,
    p.end_date,
    (SELECT COUNT(*) FROM requests r WHERE r.project_id = p.id) AS total_requests,
    (SELECT COUNT(*) FROM requests r WHERE r.project_id = p.id AND r.status = 'Completed') AS completed_requests,
    (SELECT COUNT(*) FROM requests r WHERE r.project_id = p.id AND r.status = 'In Progress') AS active_requests,
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id) AS total_milestones,
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id AND m.status = 'Completed') AS completed_milestones
FROM projects p;

-- ============================================================================
-- STEP 9: Create function to log status changes automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION log_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO project_status_history (
            project_id,
            from_status,
            to_status,
            changed_by,
            changed_by_name
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NULL,  -- Will be set by application
            'System'  -- Default, application should override
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_status_change ON projects;
CREATE TRIGGER trigger_project_status_change
    AFTER UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION log_project_status_change();

-- ============================================================================
-- STEP 10: Update sample data (optional)
-- ============================================================================
-- Add priority and category to existing projects
UPDATE projects SET
    priority = 'High',
    category = 'Manufacturing'
WHERE code = 'MCO-2025';

UPDATE projects SET
    priority = 'Medium',
    category = 'Automation'
WHERE code = 'WHA-2025';

UPDATE projects SET
    priority = 'Medium',
    category = 'Quality'
WHERE code = 'QCR-2025';
