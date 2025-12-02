export type UserRole = 'Admin' | 'Manager' | 'Engineer' | 'End-User';

export type RequestStatus =
  | 'Submitted'
  | 'Feasibility Review'
  | 'Resource Allocation'
  | 'Engineering Review'
  | 'In Progress'
  | 'Completed'
  | 'Revision Requested'
  | 'Accepted'
  | 'Denied';

export type Priority = 'Low' | 'Medium' | 'High';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
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
  details: Record<string, any> | null;
  created_at: Date;
}
