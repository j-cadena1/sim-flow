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
  PENDING = 'Pending', // Awaiting management approval
  APPROVED = 'Approved', // Active project
  ARCHIVED = 'Archived' // Closed project
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string; // Legacy - use avatarUrl instead
  avatarUrl?: string; // Profile picture URL or data URL
}

export interface Comment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
  createdAt?: string; // Backend uses createdAt
}

export interface Project {
  id: string;
  name: string;
  code: string; // Unique project code
  totalHours: number;
  usedHours: number;
  status: ProjectStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
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
  requestedBy: string;
  requestedByName: string;
  currentTitle: string;
  proposedTitle: string;
  status: 'Pending' | 'Approved' | 'Denied';
  reviewedBy?: string;
  reviewedByName?: string;
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

  createdBy: string; // User ID
  createdByName: string;
  createdAt: string;

  assignedTo?: string; // Engineer User ID
  assignedToName?: string;

  estimatedHours?: number;
  allocatedHours?: number; // Hours allocated from project bucket

  projectId?: string; // Associated project
  projectName?: string;
  projectCode?: string;

  comments: Comment[];
}

// Mock Data for Initial Load
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice User', role: UserRole.USER, avatar: 'https://picsum.photos/seed/u1/200' },
  { id: 'm1', name: 'Bob Manager', role: UserRole.MANAGER, avatar: 'https://picsum.photos/seed/m1/200' },
  { id: 'e1', name: 'Charlie Engineer', role: UserRole.ENGINEER, avatar: 'https://picsum.photos/seed/e1/200' },
  { id: 'a1', name: 'Dave Admin', role: UserRole.ADMIN, avatar: 'https://picsum.photos/seed/a1/200' },
];

export const MOCK_REQUESTS: SimRequest[] = [
  {
    id: 'req1',
    title: 'Analyze new gripper design',
    description: 'We have a new gripper design and need to analyze its performance.',
    vendor: 'FANUC',
    status: RequestStatus.SUBMITTED,
    priority: 'High',
    createdBy: 'u1',
    createdByName: 'Alice User',
    createdAt: new Date().toISOString(),
    comments: [],
  },
  {
    id: 'req2',
    title: 'Cycle time validation for cell 12',
    description: 'Validate the cycle time for the new layout in cell 12.',
    vendor: 'Siemens',
    status: RequestStatus.IN_PROGRESS,
    priority: 'Medium',
    createdBy: 'u1',
    createdByName: 'Alice User',
    createdAt: new Date().toISOString(),
    assignedTo: 'e1',
    assignedToName: 'Charlie Engineer',
    estimatedHours: 16,
    comments: [],
  },
];