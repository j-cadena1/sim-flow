/**
 * @fileoverview Shared types and interfaces for RequestDetail components
 *
 * This module contains all type definitions used across the request-detail
 * component family to maintain consistency and avoid duplication.
 *
 * @module components/request-detail/types
 */

import { SimRequest, Comment, User, Project, TimeEntry, TitleChangeRequest, DiscussionRequest } from '../../types';

/**
 * Props for RequestHeader component
 */
export interface RequestHeaderProps {
  /** The request object */
  request: SimRequest;
  /** Current user */
  currentUser: User;
  /** Whether the user can edit the title */
  canEditTitle: boolean;
  /** Whether the user can directly edit (vs request change) */
  canDirectlyEditTitle: boolean;
  /** Whether admin/manager options are available */
  showAdminOptions: boolean;
  /** Callback when delete is requested */
  onDelete: () => void;
  /** Callback when title edit is requested */
  onTitleEdit: (newTitle: string) => void;
  /** Callback when requester change is requested */
  onRequesterChange: (newRequesterId: string) => void;
  /** All users for requester reassignment */
  allUsers: User[];
}

/**
 * Props for RequestInfo component
 */
export interface RequestInfoProps {
  /** The request object */
  request: SimRequest;
  /** Whether description can be edited */
  canEditDescription: boolean;
  /** Callback when description is updated */
  onDescriptionUpdate: (newDescription: string) => void;
}

/**
 * Props for RequestTimeline component
 */
export interface RequestTimelineProps {
  /** The request object */
  request: SimRequest;
  /** Status history entries */
  statusHistory?: Array<{
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedBy: string;
    changedByName: string;
    createdAt: string;
    reason?: string;
  }>;
}

/**
 * Props for RequestComments component
 */
export interface RequestCommentsProps {
  /** Array of comments */
  comments: Comment[];
  /** Current comment input value */
  comment: string;
  /** Comment validation error */
  commentError: string;
  /** Whether the "Show requester" checkbox should be displayed */
  showVisibilityCheckbox: boolean;
  /** Current visibility checkbox state */
  visibleToRequester: boolean;
  /** Callback when comment changes */
  onCommentChange: (value: string) => void;
  /** Callback when visibility checkbox changes */
  onVisibilityChange: (visible: boolean) => void;
  /** Callback when comment is submitted */
  onCommentSubmit: () => void;
}

/**
 * Props for RequestActions component
 */
export interface RequestActionsProps {
  /** The request object */
  request: SimRequest;
  /** Current user */
  currentUser: User;
  /** Project information */
  project?: Project | null;
  /** Available engineers for assignment */
  engineers: User[];
  /** Title change requests */
  titleChangeRequests: TitleChangeRequest[];
  /** Discussion requests */
  discussionRequests: DiscussionRequest[];
  /** Manager action handlers */
  onStartManagerReview: () => void;
  onDeny: () => void;
  onAssign: (engineerId: string, hours: number) => void;
  onApproveRevision: () => void;
  onDenyRevision: () => void;
  /** Engineer action handlers */
  onEngineerAccept: () => void;
  onEngineerComplete: () => void;
  onRequestDiscussion: () => void;
  /** User action handlers */
  onAccept: () => void;
  onRevisionRequest: () => void;
  /** Title change handlers */
  onReviewTitleChange: (titleChangeRequest: TitleChangeRequest, approved: boolean) => void;
  /** Discussion handlers */
  onReviewDiscussion: (discussionRequest: DiscussionRequest, action: 'approve' | 'deny' | 'override', allocatedHours?: number, managerResponse?: string) => void;
}

/**
 * Props for TimeTracking component
 */
export interface TimeTrackingProps {
  /** The request object */
  request: SimRequest;
  /** Current user */
  currentUser: User;
  /** Time entries for this request */
  timeEntries: TimeEntry[];
  /** Callback when time is logged */
  onLogTime: (hours: number, description: string) => void;
  /** Whether time logging is in progress */
  isLoggingTime?: boolean;
}

/**
 * Props for TitleChangeRequests component
 */
export interface TitleChangeRequestsProps {
  /** Title change requests */
  titleChangeRequests: TitleChangeRequest[];
  /** Whether current user can review */
  canReview: boolean;
  /** Callback when reviewing a title change */
  onReview: (titleChangeRequest: TitleChangeRequest, approved: boolean) => void;
  /** Whether review is in progress */
  isReviewing?: boolean;
}

/**
 * Props for StatusChangeModal component
 */
export interface StatusChangeModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Title of the modal */
  title: string;
  /** Message to display */
  message: string;
  /** Confirm button text */
  confirmText: string;
  /** Confirm button variant */
  confirmVariant?: 'primary' | 'success' | 'danger' | 'warning';
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

/**
 * Props for EngineerAssignmentModal component
 */
export interface EngineerAssignmentModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Available engineers */
  engineers: User[];
  /** Project information */
  project?: Project | null;
  /** Selected engineer ID */
  selectedEngineerId: string;
  /** Estimated hours */
  estimatedHours: number;
  /** Callback when engineer selection changes */
  onEngineerChange: (engineerId: string) => void;
  /** Callback when hours change */
  onHoursChange: (hours: number) => void;
  /** Callback when assignment is confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Whether assignment is in progress */
  isAssigning?: boolean;
}

/**
 * Props for RequestSidebar component
 */
export interface RequestSidebarProps {
  /** The request object */
  request: SimRequest;
}
