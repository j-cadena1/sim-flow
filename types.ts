export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager', // Process Owner
  ENGINEER = 'Engineer',
  USER = 'End-User'
}

export enum RequestStatus {
  SUBMITTED = 'Submitted', // Waiting for manager review
  MANAGER_REVIEW = 'Manager Review', // Manager reviewing feasibility and assigning resources
  ENGINEERING_REVIEW = 'Engineering Review', // Engineer accepting/rejecting assignment
  DISCUSSION = 'Discussion', // Engineer requested discussion with manager
  IN_PROGRESS = 'In Progress', // Engineer working
  COMPLETED = 'Completed', // Work done
  REVISION_REQUESTED = 'Revision Requested', // User wants changes
  REVISION_APPROVAL = 'Revision Approval', // Manager reviewing revision request
  ACCEPTED = 'Accepted', // User accepted the completed work
  DENIED = 'Denied'
}

export enum ProjectStatus {
  PENDING = 'Pending',       // Awaiting management approval
  ACTIVE = 'Active',         // Approved and actively being worked on
  ON_HOLD = 'On Hold',       // Temporarily paused, can be resumed
  SUSPENDED = 'Suspended',   // Administratively halted, requires approval to resume
  COMPLETED = 'Completed',   // All work finished successfully
  CANCELLED = 'Cancelled',   // Cancelled before completion
  EXPIRED = 'Expired',       // Past deadline without completion
  ARCHIVED = 'Archived'      // Historical record, no longer active
}

export enum ProjectPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum HourTransactionType {
  ALLOCATION = 'allocation',
  DEALLOCATION = 'deallocation',
  ADJUSTMENT = 'adjustment',
  COMPLETION = 'completion',
  ROLLOVER = 'rollover',
  EXTENSION = 'extension'
}

export enum MilestoneStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  SKIPPED = 'Skipped'
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string; // Profile picture URL or data URL
}

export interface Comment {
  id: string;
  authorId?: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  timestamp?: string;
  createdAt?: string; // Backend uses createdAt
  visibleToRequester?: boolean; // When false, only visible to Engineers, Managers, and Admins
}

export interface Project {
  id: string;
  name: string;
  code: string; // Unique project code
  description?: string | null;
  totalHours: number;
  usedHours: number;
  availableHours?: number; // Computed: totalHours - usedHours
  status: ProjectStatus;
  priority?: ProjectPriority | null; // Optional - defaults to Medium if not set
  category?: string | null;

  // Dates
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;

  // Completion tracking
  completedAt?: string | null;
  completionNotes?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;

  // Owner (project sponsor, different from creator)
  ownerId?: string | null;
  ownerName?: string | null;

  // Creator info
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProjectStatusHistory {
  id: string;
  projectId: string;
  fromStatus?: ProjectStatus;
  toStatus: ProjectStatus;
  changedBy?: string;
  changedByName: string;
  reason?: string;
  createdAt: string;
}

export interface ProjectHourTransaction {
  id: string;
  projectId: string;
  requestId?: string;
  transactionType: HourTransactionType;
  hours: number; // Positive for additions, negative for deductions
  balanceBefore: number;
  balanceAfter: number;
  performedBy?: string;
  performedByName: string;
  notes?: string;
  createdAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetDate?: string;
  completedAt?: string;
  status: MilestoneStatus;
  sortOrder: number;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectHealthMetrics {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  priority?: ProjectPriority;
  totalHours: number;
  usedHours: number;
  availableHours: number;
  utilizationPercentage: number;
  deadline?: string;
  deadlineStatus?: 'Overdue' | 'Due Soon' | 'On Track';
  startDate?: string;
  endDate?: string;
  totalRequests: number;
  completedRequests: number;
  activeRequests: number;
  totalMilestones: number;
  completedMilestones: number;
}

export interface TimeEntry {
  id: string;
  requestId: string;
  engineerId: string | null;
  engineerName: string;
  hours: number;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TitleChangeRequest {
  id: string;
  requestId: string;
  requestedBy?: string | null;
  requestedByName: string;
  currentTitle: string;
  proposedTitle: string;
  status: 'Pending' | 'Approved' | 'Denied';
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DiscussionRequest {
  id: string;
  requestId: string;
  engineerId: string | null;
  engineerName?: string;
  reason: string;
  suggestedHours?: number | null;
  status: 'Pending' | 'Approved' | 'Denied' | 'Override';
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  managerResponse?: string | null;
  allocatedHours?: number | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface SimRequest {
  id: string;
  title: string;
  description: string;
  vendor: string; // e.g., FANUC, Siemens
  status: RequestStatus;
  priority: 'Low' | 'Medium' | 'High';

  createdBy?: string | null; // User ID
  createdByName: string;
  createdAt: string;

  // Fields for when admin creates request on behalf of user
  createdByAdminId?: string | null;
  createdByAdminName?: string | null;

  assignedTo?: string | null; // Engineer User ID
  assignedToName?: string | null;

  estimatedHours?: number | null;
  allocatedHours?: number | null; // Hours allocated from project bucket

  projectId?: string | null; // Associated project
  projectName?: string | null;
  projectCode?: string | null;

  comments: Comment[];
}

// Notification Types
export enum NotificationType {
  REQUEST_ASSIGNED = 'REQUEST_ASSIGNED',
  REQUEST_STATUS_CHANGED = 'REQUEST_STATUS_CHANGED',
  REQUEST_COMMENT_ADDED = 'REQUEST_COMMENT_ADDED',
  APPROVAL_NEEDED = 'APPROVAL_NEEDED',
  APPROVAL_REVIEWED = 'APPROVAL_REVIEWED',
  TIME_LOGGED = 'TIME_LOGGED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  ADMIN_ACTION = 'ADMIN_ACTION',
  TITLE_CHANGE_REQUESTED = 'TITLE_CHANGE_REQUESTED',
  TITLE_CHANGE_REVIEWED = 'TITLE_CHANGE_REVIEWED',
  DISCUSSION_REQUESTED = 'DISCUSSION_REQUESTED',
  DISCUSSION_REVIEWED = 'DISCUSSION_REVIEWED'
}

export enum EmailDigestFrequency {
  INSTANT = 'instant',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  NEVER = 'never'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  entityType?: 'Request' | 'Project' | 'User' | 'TitleChange' | 'Discussion';
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
  createdAt: string;
  updatedAt: string;
}