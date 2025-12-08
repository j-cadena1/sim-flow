-- Migration 017: Add 'Discussion' status to lifecycle CHECK constraint
-- Created: 2025-12-07
-- Purpose: Fix database constraint to allow 'Discussion' status when engineer is assigned

DO $$
BEGIN
  RAISE NOTICE '🔄 Migration 017: Adding Discussion status to lifecycle constraints';

  -- Fix 1: Drop and recreate the main status CHECK constraint to include 'Discussion'
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
  ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (status IN (
    'Submitted',
    'Feasibility Review',
    'Resource Allocation',
    'Engineering Review',
    'Discussion',
    'In Progress',
    'Completed',
    'Revision Requested',
    'Revision Approval',
    'Accepted',
    'Denied'
  ));

  -- Fix 2: Drop and recreate the assigned_to CHECK constraint to include 'Discussion'
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assigned_to_status_check;
  ALTER TABLE requests ADD CONSTRAINT requests_assigned_to_status_check
  CHECK (
    (assigned_to IS NULL AND status IN ('Submitted', 'Feasibility Review', 'Resource Allocation'))
    OR
    (assigned_to IS NOT NULL AND status IN ('Engineering Review', 'Discussion', 'In Progress', 'Completed', 'Accepted', 'Denied', 'Revision Requested', 'Revision Approval'))
  );

  -- Update the constraint comment
  COMMENT ON CONSTRAINT requests_assigned_to_status_check ON requests IS
    'Ensures engineers are only assigned to requests in appropriate lifecycle stages (Engineering Review, Discussion, In Progress onwards)';

  RAISE NOTICE '✅ Added Discussion status to both status check constraints';
END $$;
