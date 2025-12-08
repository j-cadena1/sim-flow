-- Migration 018: Notification System
-- Adds support for in-app notifications with WebSocket delivery and email options

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  entity_type VARCHAR(50),
  entity_id UUID,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Global toggles
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  email_digest_frequency VARCHAR(20) DEFAULT 'instant',

  -- Per-type notification toggles
  request_assigned BOOLEAN DEFAULT true,
  request_status_changed BOOLEAN DEFAULT true,
  request_comment_added BOOLEAN DEFAULT true,
  approval_needed BOOLEAN DEFAULT true,
  time_logged BOOLEAN DEFAULT false,
  project_updated BOOLEAN DEFAULT true,
  admin_action BOOLEAN DEFAULT true,

  -- Retention settings
  retention_days INTEGER DEFAULT 30,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create default preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Comment documentation
COMMENT ON TABLE notifications IS 'Stores user notifications for in-app and email delivery';
COMMENT ON TABLE notification_preferences IS 'User-specific notification preferences and settings';

COMMENT ON COLUMN notifications.type IS 'Notification type: REQUEST_ASSIGNED, STATUS_CHANGED, COMMENT_ADDED, APPROVAL_NEEDED, etc.';
COMMENT ON COLUMN notifications.entity_type IS 'Type of related entity: Request, Project, User, etc.';
COMMENT ON COLUMN notifications.entity_id IS 'ID of the related entity for deep linking';
COMMENT ON COLUMN notifications.triggered_by IS 'User who triggered this notification';

COMMENT ON COLUMN notification_preferences.email_digest_frequency IS 'Email delivery frequency: instant, hourly, daily, weekly, never';
COMMENT ON COLUMN notification_preferences.retention_days IS 'Days to keep read notifications before auto-deletion';
