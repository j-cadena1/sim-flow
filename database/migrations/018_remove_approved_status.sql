-- Migration 018: Remove legacy 'Approved' status from project status enum
-- All 'Approved' projects were migrated to 'Active' in migration 013
-- This migration removes 'Approved' from the CHECK constraint to complete the cleanup

-- Drop and recreate the CHECK constraint without 'Approved'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('Pending', 'Active', 'On Hold', 'Suspended', 'Completed', 'Cancelled', 'Expired', 'Archived'));

-- Verify no projects still have 'Approved' status (should return 0)
DO $$
DECLARE
  approved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO approved_count FROM projects WHERE status = 'Approved';
  IF approved_count > 0 THEN
    RAISE EXCEPTION 'Found % projects with Approved status. Run migration 013 first.', approved_count;
  END IF;
END $$;
