-- Migration: User Soft Delete and Deleted Users Archive
-- This migration adds soft delete support and preserves deleted user identities

-- 1. Add soft delete column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Create deleted_users table to preserve identity of hard-deleted users
-- This allows showing "Deleted User" with tooltip of original name/email
CREATE TABLE IF NOT EXISTS deleted_users (
    id UUID PRIMARY KEY,  -- Same ID as original user
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deletion_reason VARCHAR(500),
    -- Store any additional context that might be useful for auditing
    original_created_at TIMESTAMP WITH TIME ZONE,
    sso_id VARCHAR(255)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_deleted_users_email ON deleted_users(email);

-- 3. Fix CASCADE DELETE issues - time_entries should preserve data
-- First check if the constraint exists and drop it
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'time_entries_engineer_id_fkey'
        AND table_name = 'time_entries'
    ) THEN
        ALTER TABLE time_entries DROP CONSTRAINT time_entries_engineer_id_fkey;
    END IF;
END $$;

-- Re-add with SET NULL instead of CASCADE
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_engineer_id_fkey
FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Fix discussion_requests CASCADE - should preserve data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'discussion_requests_engineer_id_fkey'
        AND table_name = 'discussion_requests'
    ) THEN
        ALTER TABLE discussion_requests DROP CONSTRAINT discussion_requests_engineer_id_fkey;
    END IF;
END $$;

ALTER TABLE discussion_requests
ADD CONSTRAINT discussion_requests_engineer_id_fkey
FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE SET NULL;

-- 5. Fix title_change_requests CASCADE - should preserve data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'title_change_requests_requested_by_fkey'
        AND table_name = 'title_change_requests'
    ) THEN
        ALTER TABLE title_change_requests DROP CONSTRAINT title_change_requests_requested_by_fkey;
    END IF;
END $$;

ALTER TABLE title_change_requests
ADD CONSTRAINT title_change_requests_requested_by_fkey
FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

-- 6. Add index for filtering active users efficiently
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(id) WHERE deleted_at IS NULL;

-- 7. Add comment explaining the soft delete pattern
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp. NULL = active user, non-NULL = deactivated user who cannot login but whose data is preserved.';
COMMENT ON TABLE deleted_users IS 'Archive of permanently deleted users. Preserves identity for historical reference (tooltips, audit trails).';
