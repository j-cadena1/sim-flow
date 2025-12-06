-- Add columns to track when admin creates request on behalf of user
-- Migration 012: Add on behalf of tracking

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS created_by_admin_name VARCHAR(255);

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS idx_requests_created_by_admin ON requests(created_by_admin_id) WHERE created_by_admin_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN requests.created_by_admin_id IS 'ID of admin who created this request on behalf of another user';
COMMENT ON COLUMN requests.created_by_admin_name IS 'Name of admin who created this request on behalf of another user';
