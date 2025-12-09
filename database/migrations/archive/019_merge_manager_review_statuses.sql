-- Migration 019: Merge 'Feasibility Review' and 'Resource Allocation' into 'Manager Review'
-- Created: 2025-12-07
-- Purpose: Simplify the request workflow by combining two manager-facing statuses into one

DO $$
DECLARE
  feasibility_count INTEGER;
  resource_count INTEGER;
BEGIN
  RAISE NOTICE '🔄 Migration 019: Merging Feasibility Review + Resource Allocation → Manager Review';

  -- Count existing records in each status
  SELECT COUNT(*) INTO feasibility_count FROM requests WHERE status = 'Feasibility Review';
  SELECT COUNT(*) INTO resource_count FROM requests WHERE status = 'Resource Allocation';
  RAISE NOTICE '  Found % requests in Feasibility Review', feasibility_count;
  RAISE NOTICE '  Found % requests in Resource Allocation', resource_count;

  -- Step 1: Drop constraints FIRST (before updating data)
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
  ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assigned_to_status_check;
  RAISE NOTICE '  Dropped old constraints';

  -- Step 2: Update all existing requests with old statuses to new status
  UPDATE requests SET status = 'Manager Review' WHERE status IN ('Feasibility Review', 'Resource Allocation');
  RAISE NOTICE '  Migrated % requests to Manager Review', feasibility_count + resource_count;

  -- Step 3: Recreate the main status CHECK constraint with new values
  ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (status IN (
    'Submitted',
    'Manager Review',
    'Engineering Review',
    'Discussion',
    'In Progress',
    'Completed',
    'Revision Requested',
    'Revision Approval',
    'Accepted',
    'Denied'
  ));
  RAISE NOTICE '  Added new requests_status_check constraint';

  -- Step 4: Recreate the assigned_to CHECK constraint with new status
  ALTER TABLE requests ADD CONSTRAINT requests_assigned_to_status_check
  CHECK (
    (assigned_to IS NULL AND status IN ('Submitted', 'Manager Review'))
    OR
    (assigned_to IS NOT NULL AND status IN ('Engineering Review', 'Discussion', 'In Progress', 'Completed', 'Accepted', 'Denied', 'Revision Requested', 'Revision Approval'))
  );
  RAISE NOTICE '  Added new requests_assigned_to_status_check constraint';

  -- Update constraint comments
  COMMENT ON CONSTRAINT requests_status_check ON requests IS
    'Valid request statuses: Submitted → Manager Review → Engineering Review → In Progress → Completed → Accepted (with branches for Discussion, Revision, Denied)';

  COMMENT ON CONSTRAINT requests_assigned_to_status_check ON requests IS
    'Ensures engineers are only assigned to requests in appropriate lifecycle stages (Engineering Review onwards)';

  RAISE NOTICE '✅ Successfully merged statuses into Manager Review (workflow reduced from 11 to 10 states)';
END $$;
