export type UserRole = 'Admin' | 'Manager' | 'Engineer' | 'End-User';

export type RequestStatus =
  | 'Submitted'
  | 'Feasibility Review'
  | 'Resource Allocation'
  | 'Engineering Review'
  | 'Discussion'
  | 'In Progress'
  | 'Completed'
  | 'Revision Requested'
  | 'Revision Approval'
  | 'Accepted'
  | 'Denied';

export type Priority = 'Low' | 'Medium' | 'High';

export type ProjectStatus =
  | 'Pending'
  | 'Approved'    // Legacy - use 'Active' instead
  | 'Active'
  | 'On Hold'
  | 'Suspended'
  | 'Completed'
  | 'Cancelled'
  | 'Expired'
  | 'Archived';

export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type HourTransactionType =
  | 'allocation'
  | 'deallocation'
  | 'adjustment'
  | 'completion'
  | 'rollover'
  | 'extension';

export type MilestoneStatus = 'Pending' | 'In Progress' | 'Completed' | 'Skipped';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  total_hours: number;
  used_hours: number;
  status: ProjectStatus;
  priority: ProjectPriority;
  category: string | null;

  // Dates
  start_date: Date | null;
  end_date: Date | null;
  deadline: Date | null;

  // Completion tracking
  completed_at: Date | null;
  completion_notes: string | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;

  // Owner (project sponsor)
  owner_id: string | null;
  owner_name: string | null;

  // Creator info
  created_by: string | null;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectStatusHistory {
  id: string;
  project_id: string;
  from_status: ProjectStatus | null;
  to_status: ProjectStatus;
  changed_by: string | null;
  changed_by_name: string;
  reason: string | null;
  created_at: Date;
}

export interface ProjectHourTransaction {
  id: string;
  project_id: string;
  request_id: string | null;
  transaction_type: HourTransactionType;
  hours: number;
  balance_before: number;
  balance_after: number;
  performed_by: string | null;
  performed_by_name: string;
  notes: string | null;
  created_at: Date;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  target_date: Date | null;
  completed_at: Date | null;
  status: MilestoneStatus;
  sort_order: number;
  created_by: string | null;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectHealthMetrics {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  total_hours: number;
  used_hours: number;
  available_hours: number;
  utilization_percentage: number;
  deadline: Date | null;
  deadline_status: 'Overdue' | 'Due Soon' | 'On Track' | null;
  start_date: Date | null;
  end_date: Date | null;
  total_requests: number;
  completed_requests: number;
  active_requests: number;
  total_milestones: number;
  completed_milestones: number;
}

export interface SimRequest {
  id: string;
  title: string;
  description: string;
  vendor: string;
  status: RequestStatus;
  priority: Priority;
  created_by: string | null;
  created_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  estimated_hours: number | null;
  allocated_hours: number | null;
  project_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Comment {
  id: string;
  request_id: string;
  author_id: string | null;
  author_name: string;
  author_role: UserRole;
  content: string;
  created_at: Date;
}

export interface ActivityLog {
  id: string;
  request_id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: Date;
}
