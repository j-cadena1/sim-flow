-- Migration: Add comment visibility flag for internal comments
-- Allows Engineers, Managers, and Admins to post internal comments not visible to End-Users

-- Add visible_to_requester column (default true for existing comments)
ALTER TABLE comments
ADD COLUMN visible_to_requester BOOLEAN NOT NULL DEFAULT true;

-- Add index for filtering comments by visibility
CREATE INDEX IF NOT EXISTS idx_comments_visible_to_requester ON comments(request_id, visible_to_requester);

-- Add comment to explain the column
COMMENT ON COLUMN comments.visible_to_requester IS 'When false, comment is only visible to Engineers, Managers, and Admins (internal notes)';
