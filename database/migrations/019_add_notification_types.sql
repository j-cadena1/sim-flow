-- Migration: Add new notification types for manager reviews
-- Adds REQUEST_PENDING_REVIEW and PROJECT_PENDING_APPROVAL notification types

-- Update the notifications type check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'REQUEST_ASSIGNED',
    'REQUEST_STATUS_CHANGED',
    'REQUEST_COMMENT_ADDED',
    'REQUEST_PENDING_REVIEW',
    'PROJECT_PENDING_APPROVAL',
    'APPROVAL_NEEDED',
    'APPROVAL_REVIEWED',
    'TIME_LOGGED',
    'PROJECT_UPDATED',
    'ADMIN_ACTION',
    'TITLE_CHANGE_REQUESTED',
    'TITLE_CHANGE_REVIEWED',
    'DISCUSSION_REQUESTED',
    'DISCUSSION_REVIEWED'
));
