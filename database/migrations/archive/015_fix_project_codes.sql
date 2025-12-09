-- Migration: Fix project codes to use auto-generated format
-- Format: NNNNNN-YYYY (e.g., 100001-2025)

-- Step 1: Update existing projects with old-format codes
-- MCO-2025 -> 100001-2025, WHA-2025 -> 100002-2025, QCR-2025 -> 100003-2025
DO $$
DECLARE
    current_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    next_num INTEGER := 100001;
    proj RECORD;
BEGIN
    -- Update all projects that don't match the NNNNNN-YYYY format
    FOR proj IN (
        SELECT id, code
        FROM projects
        WHERE code !~ '^\d{6}-\d{4}$'
        ORDER BY created_at
    ) LOOP
        UPDATE projects
        SET code = next_num || '-' || current_year
        WHERE id = proj.id;

        RAISE NOTICE 'Updated project code from % to %', proj.code, next_num || '-' || current_year;
        next_num := next_num + 1;
    END LOOP;
END $$;

-- Step 2: Add CHECK constraint to enforce the format going forward
-- Only add if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_code_format_check'
    ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_code_format_check
        CHECK (code ~ '^\d{6}-\d{4}$');

        RAISE NOTICE 'Added projects_code_format_check constraint';
    END IF;
END $$;

-- Step 3: Update the status constraint to include all valid statuses
-- First drop the old constraint if it exists
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the new constraint with all valid statuses
ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('Pending', 'Approved', 'Active', 'On Hold', 'Suspended', 'Completed', 'Cancelled', 'Expired', 'Archived'));
