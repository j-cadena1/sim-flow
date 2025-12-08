/**
 * Notification Types and Interfaces
 */

export type NotificationType =
  | 'REQUEST_ASSIGNED'
  | 'REQUEST_STATUS_CHANGED'
  | 'REQUEST_COMMENT_ADDED'
  | 'APPROVAL_NEEDED'
  | 'APPROVAL_REVIEWED'
  | 'TIME_LOGGED'
  | 'PROJECT_UPDATED'
  | 'ADMIN_ACTION'
  | 'TITLE_CHANGE_REQUESTED'
  | 'TITLE_CHANGE_REVIEWED'
  | 'DISCUSSION_REQUESTED'
  | 'DISCUSSION_REVIEWED';

export type EntityType = 'Request' | 'Project' | 'User' | 'TitleChange' | 'Discussion';

export type EmailDigestFrequency = 'instant' | 'hourly' | 'daily' | 'weekly' | 'never';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
  entityType?: EntityType;
  entityId?: string;
  triggeredBy?: string;
  triggeredByName?: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  emailDigestFrequency: EmailDigestFrequency;
  requestAssigned: boolean;
  requestStatusChanged: boolean;
  requestCommentAdded: boolean;
  approvalNeeded: boolean;
  timeLogged: boolean;
  projectUpdated: boolean;
  adminAction: boolean;
  retentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityType?: EntityType;
  entityId?: string;
  triggeredBy?: string;
}

export interface NotificationQueryParams {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: NotificationType;
}

export interface UpdatePreferencesParams {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  emailDigestFrequency?: EmailDigestFrequency;
  requestAssigned?: boolean;
  requestStatusChanged?: boolean;
  requestCommentAdded?: boolean;
  approvalNeeded?: boolean;
  timeLogged?: boolean;
  projectUpdated?: boolean;
  adminAction?: boolean;
  retentionDays?: number;
}
