export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager', // Process Owner
  ENGINEER = 'Engineer',
  USER = 'End-User'
}

export enum RequestStatus {
  SUBMITTED = 'Submitted', // Waiting for feasibility
  FEASIBILITY_REVIEW = 'Feasibility Review', // Manager reviewing
  RESOURCE_ALLOCATION = 'Resource Allocation', // Manager approved feasibility, assigning engineer
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
  APPROVED = 'Approved',     // Legacy - use ACTIVE instead
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
  avatar?: string; // Legacy - use avatarUrl instead
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
}

export interface Project {
  id: string;
  name: string;
  code: string; // Unique project code
  description?: string;
  totalHours: number;
  usedHours: number;
  availableHours?: number; // Computed: totalHours - usedHours
  status: ProjectStatus;
  priority?: ProjectPriority; // Optional - defaults to Medium if not set
  category?: string;

  // Dates
  startDate?: string;
  endDate?: string;
  deadline?: string;

  // Completion tracking
  completedAt?: string;
  completionNotes?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  // Owner (project sponsor, different from creator)
  ownerId?: string;
  ownerName?: string;

  // Creator info
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
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
  engineerId: string;
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
  engineerId: string;
  engineerName: string;
  reason: string;
  suggestedHours?: number;
  status: 'Pending' | 'Approved' | 'Denied' | 'Override';
  reviewedBy?: string;
  reviewedByName?: string;
  managerResponse?: string;
  allocatedHours?: number;
  createdAt: string;
  reviewedAt?: string;
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