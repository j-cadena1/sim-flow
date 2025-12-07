-- Migration: Fix Request Lifecycle Consistency
-- Description: Ensures requests follow proper lifecycle flow
--
-- Issue: Some requests have status='Submitted' but already have an assigned engineer
-- This violates the intended workflow where engineers are only assigned at 'Engineering Review' stage
--
-- Expected lifecycle:
-- 1. Submitted → no engineer, no allocation
-- 2. Feasibility Review → manager reviewing feasibility
-- 3. Resource Allocation → hours allocated from project
-- 4. Engineering Review → engineer assigned HERE (auto-set by assignEngineer())
-- 5. In Progress → work ongoing
-- 6. Completed/Accepted/Denied → final states

-- Step 1: Fix existing inconsistent data
-- Move requests that have assigned engineers but are in pre-assignment stages to 'Engineering Review'
UPDATE requests
SET status = 'Engineering Review',
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('Submitted', 'Feasibility Review', 'Resource Allocation')
  AND assigned_to IS NOT NULL;

-- Step 2: Add CHECK constraint to prevent future inconsistencies
-- A request can only have an assigned engineer if it's in an appropriate status
ALTER TABLE requests
ADD CONSTRAINT requests_assigned_to_status_check
CHECK (
  (assigned_to IS NULL AND status IN ('Submitted', 'Feasibility Review', 'Resource Allocation'))
  OR
  (assigned_to IS NOT NULL AND status IN ('Engineering Review', 'In Progress', 'Completed', 'Accepted', 'Denied', 'Revision Requested', 'Revision Approval'))
);

-- Step 3: Create a trigger to automatically enforce lifecycle transitions
CREATE OR REPLACE FUNCTION enforce_request_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  -- If engineer is being assigned, ensure status is appropriate
  IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
    -- Engineer being assigned for first time
    IF NEW.status IN ('Submitted', 'Feasibility Review', 'Resource Allocation') THEN
      -- Auto-transition to Engineering Review
      NEW.status := 'Engineering Review';
    END IF;
  END IF;

  -- If engineer is being removed, ensure status is appropriate
  IF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
    -- Engineer being unassigned
    IF NEW.status IN ('Engineering Review', 'In Progress') THEN
      -- Rollback to Resource Allocation
      NEW.status := 'Resource Allocation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS enforce_request_lifecycle_trigger ON requests;
CREATE TRIGGER enforce_request_lifecycle_trigger
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_request_lifecycle();

-- Step 4: Add helpful comments
COMMENT ON CONSTRAINT requests_assigned_to_status_check ON requests IS
  'Ensures engineers are only assigned to requests in appropriate lifecycle stages (Engineering Review onwards)';

COMMENT ON FUNCTION enforce_request_lifecycle() IS
  'Automatically transitions request status when engineers are assigned or unassigned to maintain lifecycle consistency';

-- Step 5: Verify the fix
SELECT
  status,
  COUNT(*) as total,
  COUNT(assigned_to) as with_engineer,
  COUNT(assigned_to) - COUNT(*) FILTER (WHERE assigned_to IS NULL) as inconsistencies
FROM requests
GROUP BY status
ORDER BY status;

-- Summary report
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM requests
  WHERE status = 'Engineering Review'
    AND updated_at > (CURRENT_TIMESTAMP - INTERVAL '1 minute');

  RAISE NOTICE '✅ Lifecycle consistency migration completed';
  RAISE NOTICE '📊 Fixed % inconsistent requests (Submitted → Engineering Review)', fixed_count;
  RAISE NOTICE '🔒 Added CHECK constraint: requests_assigned_to_status_check';
  RAISE NOTICE '⚡ Added trigger: enforce_request_lifecycle_trigger';
END $$;
