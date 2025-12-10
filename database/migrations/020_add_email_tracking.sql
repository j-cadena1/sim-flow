-- Migration: Add email tracking to notifications
-- This allows tracking which notifications have been sent via email

-- Add column to track when notification was emailed
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Index for efficiently finding unsent notifications per user
-- Used by digest jobs to find notifications that need to be emailed
CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON notifications(user_id, created_at)
  WHERE emailed_at IS NULL;
