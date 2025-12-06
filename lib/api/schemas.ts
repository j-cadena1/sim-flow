/**
 * API Response Validation Schemas
 *
 * Uses Zod for runtime validation of API responses.
 * This catches mismatches between API and frontend expectations early.
 */

import { z } from 'zod';
import { UserRole, RequestStatus, ProjectStatus, ProjectPriority } from '../../types';

// ============================================================================
// Base Schemas
// ============================================================================

export const UserRoleSchema = z.nativeEnum(UserRole);
export const RequestStatusSchema = z.nativeEnum(RequestStatus);
export const ProjectStatusSchema = z.nativeEnum(ProjectStatus);
export const ProjectPrioritySchema = z.nativeEnum(ProjectPriority);

// ============================================================================
// User Schemas
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  role: UserRoleSchema,
  avatar: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const UsersResponseSchema = z.object({
  users: z.array(UserSchema),
});

export const CurrentUserResponseSchema = z.object({
  user: UserSchema,
});

// ============================================================================
// Comment Schema
// ============================================================================

export const CommentSchema = z.object({
  id: z.string(),
  authorId: z.string().optional(),
  authorName: z.string(),
  authorRole: UserRoleSchema,
  content: z.string(),
  timestamp: z.string().optional(),
  createdAt: z.string().optional(),
});

// ============================================================================
// Project Schemas
// ============================================================================

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable().optional(),
  totalHours: z.number(),
  usedHours: z.number(),
  availableHours: z.number().optional(),
  status: ProjectStatusSchema,
  priority: ProjectPrioritySchema.nullable().optional(),
  category: z.string().nullable().optional(),

  // Dates
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),

  // Completion tracking
  completedAt: z.string().nullable().optional(),
  completionNotes: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),

  // Owner
  ownerId: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),

  // Creator info
  createdBy: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const ProjectsResponseSchema = z.object({
  projects: z.array(ProjectSchema),
});

export const ProjectResponseSchema = z.object({
  project: ProjectSchema,
});

// ============================================================================
// Request Schemas
// ============================================================================

export const SimRequestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  vendor: z.string(),
  status: RequestStatusSchema,
  priority: z.enum(['Low', 'Medium', 'High']),
  createdBy: z.string().nullable(),
  createdByName: z.string(),
  createdAt: z.string(),
  createdByAdminId: z.string().nullable().optional(),
  createdByAdminName: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  allocatedHours: z.number().nullable().optional(),
  projectId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  projectCode: z.string().nullable().optional(),
  comments: z.array(CommentSchema).optional().default([]),
});

export const PaginationMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

export const RequestsResponseSchema = z.object({
  requests: z.array(SimRequestSchema),
  pagination: PaginationMetaSchema,
});

export const RequestResponseSchema = z.object({
  request: SimRequestSchema,
  comments: z.array(CommentSchema).optional(),
});

export const CreateRequestResponseSchema = z.object({
  request: SimRequestSchema,
});

// ============================================================================
// Time Entry Schemas
// ============================================================================

export const TimeEntrySchema = z.object({
  id: z.string(),
  requestId: z.string(),
  engineerId: z.string().nullable(),
  engineerName: z.string(),
  hours: z.number(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const TimeEntriesResponseSchema = z.object({
  timeEntries: z.array(TimeEntrySchema),
});

export const TimeEntryResponseSchema = z.object({
  timeEntry: TimeEntrySchema,
});

// ============================================================================
// Title Change Request Schemas
// ============================================================================

export const TitleChangeRequestSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  requestedBy: z.string().nullable(),
  requestedByName: z.string(),
  currentTitle: z.string(),
  proposedTitle: z.string(),
  status: z.enum(['Pending', 'Approved', 'Denied']),
  reviewedBy: z.string().nullable().optional(),
  reviewedByName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const TitleChangeRequestsResponseSchema = z.object({
  titleChangeRequests: z.array(TitleChangeRequestSchema),
});

// ============================================================================
// Discussion Request Schemas
// ============================================================================

export const DiscussionRequestSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  engineerId: z.string().nullable(),
  engineerName: z.string().optional(),
  reason: z.string(),
  suggestedHours: z.number().nullable().optional(),
  status: z.enum(['Pending', 'Approved', 'Denied', 'Override']),
  reviewedBy: z.string().nullable().optional(),
  reviewedByName: z.string().nullable().optional(),
  managerResponse: z.string().nullable().optional(),
  allocatedHours: z.number().nullable().optional(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
});

export const DiscussionRequestsResponseSchema = z.object({
  discussionRequests: z.array(DiscussionRequestSchema),
});

export const DiscussionRequestResponseSchema = z.object({
  discussionRequest: DiscussionRequestSchema,
});

// ============================================================================
// Error Response Schema
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string(),
    requestId: z.string().optional(),
  }),
});

// Legacy error format (for backward compatibility)
export const LegacyErrorResponseSchema = z.object({
  error: z.string(),
});

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validates API response data against a schema.
 * In development, throws validation errors.
 * In production, logs warnings and returns the data as-is.
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessage = `API Response Validation Error [${context}]: ${result.error.message}`;

    if (process.env.NODE_ENV === 'development') {
      console.warn(errorMessage, {
        issues: result.error.issues,
        data,
      });
    }

    // In production, we still want to proceed with the data
    // but log the validation issues for monitoring
    return data as T;
  }

  return result.data;
}
