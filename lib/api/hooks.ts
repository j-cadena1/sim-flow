/**
 * @fileoverview React Query Hooks for API Operations
 *
 * Provides custom hooks wrapping all API endpoints with TanStack Query
 * for caching, background refetching, and optimistic updates.
 *
 * Hook Categories:
 * - Requests: CRUD, status updates, assignment, comments
 * - Projects: CRUD, status transitions, hour management
 * - Users: List and current user
 * - Analytics: Dashboard stats, completion analysis
 * - Workflows: Title changes, discussion requests
 * - Time Entries: Logging and retrieval
 * - SSO: Configuration management
 *
 * Query Key Structure:
 * - requests.all, requests.list(params), requests.detail(id)
 * - projects.all, projects.list(params), projects.detail(id)
 * - users.all, users.list, users.current
 * - analytics.dashboard, analytics.completion, analytics.allocation
 *
 * All responses are validated against Zod schemas for type safety.
 *
 * @module lib/api/hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { SimRequest, Comment, User, RequestStatus, UserRole, Project, ProjectStatus, TimeEntry, TitleChangeRequest, DiscussionRequest, Attachment, StorageConfig } from '@/types';
import {
  validateResponse,
  RequestsResponseSchema,
  RequestResponseSchema,
  CreateRequestResponseSchema,
  UsersResponseSchema,
  CurrentUserResponseSchema,
  ProjectsResponseSchema,
  ProjectResponseSchema,
  TimeEntriesResponseSchema,
  TimeEntryResponseSchema,
  TitleChangeRequestsResponseSchema,
  DiscussionRequestsResponseSchema,
  DiscussionRequestResponseSchema,
} from './schemas';
import {
  queryKeys,
  requestListQueryOptions,
  requestDetailQueryOptions,
  userQueryOptions,
  currentUserQueryOptions,
  projectQueryOptions,
  analyticsQueryOptions,
  workflowQueryOptions,
  STALE_TIMES,
} from './queryConfig';

// ============================================================================
// Types
// ============================================================================

/** Pagination parameters for list queries */
interface PaginationParams {
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// Request Hooks
// ============================================================================

/**
 * Fetch paginated list of requests with optional status filter
 */
export const useRequests = (params?: PaginationParams & { status?: string }) => {
  return useQuery({
    queryKey: queryKeys.requests.list(params),
    queryFn: async (): Promise<PaginatedResponse<SimRequest>> => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.status) queryParams.append('status', params.status);

      const queryString = queryParams.toString();
      const url = queryString ? `/requests?${queryString}` : '/requests';

      const { data } = await apiClient.get(url);
      const validated = validateResponse(RequestsResponseSchema, data, 'useRequests');
      return {
        data: validated.requests,
        pagination: validated.pagination,
      };
    },
    ...requestListQueryOptions,
  });
};

export const useRequest = (id: string) => {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/requests/${id}`);
      return validateResponse(RequestResponseSchema, data, `useRequest(${id})`);
    },
    enabled: !!id,
    ...requestDetailQueryOptions,
  });
};

export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      vendor: string;
      priority: 'Low' | 'Medium' | 'High';
      projectId: string;
      onBehalfOfUserId?: string;
    }) => {
      const response = await apiClient.post('/requests', data);
      const validated = validateResponse(CreateRequestResponseSchema, response.data, 'useCreateRequest');
      return validated.request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
};

export const useUpdateRequestTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/title`, { title });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

export const useUpdateRequestDescription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/description`, { description });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

export const useRequestTitleChange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, proposedTitle }: { id: string; proposedTitle: string }) => {
      const response = await apiClient.post(`/requests/${id}/title-change-request`, { proposedTitle });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['titleChangeRequests', variables.id] });
    },
  });
};

export const useTitleChangeRequests = (requestId: string) => {
  return useQuery({
    queryKey: ['titleChangeRequests', requestId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/requests/${requestId}/title-change-requests`);
      const validated = validateResponse(TitleChangeRequestsResponseSchema, data, `useTitleChangeRequests(${requestId})`);
      return validated.titleChangeRequests;
    },
    enabled: !!requestId,
  });
};

export const useReviewTitleChange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved, requestId }: { id: string; approved: boolean; requestId: string }) => {
      const response = await apiClient.patch(`/requests/title-change-requests/${id}/review`, { approved });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['titleChangeRequests', variables.requestId] });
    },
  });
};

export const useUpdateRequestStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/status`, { status });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

export const useAssignEngineer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      engineerId,
      estimatedHours,
    }: {
      id: string;
      engineerId: string;
      estimatedHours: number;
    }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/assign`, {
        engineerId,
        estimatedHours,
      });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
      // Also invalidate projects since hours are allocated
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, content, visibleToRequester }: { requestId: string; content: string; visibleToRequester?: boolean }) => {
      const response = await apiClient.post<{ comment: Comment }>(`/requests/${requestId}/comments`, { content, visibleToRequester });
      return response.data.comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests', variables.requestId] });
    },
  });
};

export const useDeleteRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string; id: string }>(`/requests/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
};

export const useUpdateRequestRequester = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newRequesterId }: { id: string; newRequesterId: string }) => {
      const response = await apiClient.patch<{ request: SimRequest }>(`/requests/${id}/requester`, { newRequesterId });
      return response.data.request;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.id] });
    },
  });
};

// Time Tracking API
export const useTimeEntries = (requestId: string) => {
  return useQuery({
    queryKey: ['timeEntries', requestId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/requests/${requestId}/time`);
      const validated = validateResponse(TimeEntriesResponseSchema, data, `useTimeEntries(${requestId})`);
      return validated.timeEntries;
    },
    enabled: !!requestId,
  });
};

export const useAddTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, hours, description }: { requestId: string; hours: number; description?: string }) => {
      const response = await apiClient.post(`/requests/${requestId}/time`, { hours, description });
      const validated = validateResponse(TimeEntryResponseSchema, response.data, 'useAddTimeEntry');
      return validated.timeEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', variables.requestId] });
    },
  });
};

// Users API
export const useUsers = (role?: UserRole) => {
  return useQuery({
    queryKey: queryKeys.users.byRole(role),
    queryFn: async () => {
      const params = role ? { role } : {};
      const { data } = await apiClient.get('/users', { params });
      const validated = validateResponse(UsersResponseSchema, data, `useUsers(${role || 'all'})`);
      return validated.users;
    },
    ...userQueryOptions,
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.users.current,
    queryFn: async () => {
      const { data } = await apiClient.get('/users/me');
      const validated = validateResponse(CurrentUserResponseSchema, data, 'useCurrentUser');
      return validated.user;
    },
    ...currentUserQueryOptions,
  });
};

// Projects API
export const useProjects = (status?: ProjectStatus) => {
  return useQuery({
    queryKey: queryKeys.projects.list(status),
    queryFn: async () => {
      const params = status ? { status } : {};
      const { data } = await apiClient.get('/projects', { params });
      const validated = validateResponse(ProjectsResponseSchema, data, `useProjects(${status || 'all'})`);
      return validated.projects;
    },
    ...projectQueryOptions,
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}`);
      const validated = validateResponse(ProjectResponseSchema, data, `useProject(${id})`);
      return validated.project;
    },
    enabled: !!id,
    ...projectQueryOptions,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      totalHours: number;
      createdBy: string;
      createdByName: string;
      status?: ProjectStatus;
      description?: string;
      priority?: string;
      category?: string;
      deadline?: string;
    }) => {
      const response = await apiClient.post<{ project: Project }>('/projects', data);
      return response.data.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProjectName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiClient.patch<{ project: Project }>(`/projects/${id}/name`, { name });
      return response.data.project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
    },
  });
};

export const useUpdateProjectStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: ProjectStatus;
      reason?: string;
    }) => {
      const response = await apiClient.patch<{ project: Project }>(`/projects/${id}/status`, {
        status,
        reason,
      });
      return response.data.project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
    },
  });
};

export const useUpdateProjectHours = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, hoursToAdd }: { id: string; hoursToAdd: number }) => {
      const response = await apiClient.patch<{ project: Project }>(`/projects/${id}/hours`, { hoursToAdd });
      return response.data.project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/projects/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useReassignProjectRequests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, targetProjectId }: { projectId: string; targetProjectId: string }) => {
      const response = await apiClient.post(`/projects/${projectId}/requests/reassign`, { targetProjectId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
};

export const useDeleteProjectRequests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiClient.delete(`/projects/${projectId}/requests`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
};

// Discussion Requests API
export const useDiscussionRequests = (requestId: string) => {
  return useQuery({
    queryKey: queryKeys.discussions.byRequest(requestId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/requests/${requestId}/discussion-requests`);
      const validated = validateResponse(DiscussionRequestsResponseSchema, data, `useDiscussionRequests(${requestId})`);
      return validated.discussionRequests;
    },
    enabled: !!requestId,
    ...workflowQueryOptions,
  });
};

export const useCreateDiscussionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reason, suggestedHours }: { requestId: string; reason: string; suggestedHours?: number }) => {
      const response = await apiClient.post(`/requests/${requestId}/discussion-request`, {
        reason,
        suggestedHours,
      });
      const validated = validateResponse(DiscussionRequestResponseSchema, response.data, 'useCreateDiscussionRequest');
      return validated.discussionRequest;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['discussion-requests', variables.requestId] });
    },
  });
};

export const useReviewDiscussionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      requestId,
      action,
      managerResponse,
      allocatedHours,
    }: {
      id: string;
      requestId: string;
      action: 'approve' | 'deny' | 'override';
      managerResponse?: string;
      allocatedHours?: number;
    }) => {
      const response = await apiClient.patch<{ message: string; allocatedHours?: number }>(
        `/requests/discussion-requests/${id}/review`,
        {
          action,
          managerResponse,
          allocatedHours,
        }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requests', variables.requestId] });
      queryClient.invalidateQueries({ queryKey: ['discussion-requests', variables.requestId] });
    },
  });
};

// Audit Logs API
export const useAuditLogs = (filters?: {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string | number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: queryKeys.auditLogs.filtered(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId.toString());
      if (filters?.action) params.append('action', filters.action);
      if (filters?.entityType) params.append('entityType', filters.entityType);
      if (filters?.entityId) params.append('entityId', filters.entityId.toString());
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const { data } = await apiClient.get(`/audit-logs?${params.toString()}`);
      return data;
    },
    staleTime: STALE_TIMES.AUDIT_LOGS,
  });
};

export const useAuditStats = (filters?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.auditLogs.stats(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const { data } = await apiClient.get(`/audit-logs/stats?${params.toString()}`);
      return data;
    },
    staleTime: STALE_TIMES.AUDIT_LOGS,
  });
};

export const exportAuditLogsCSV = async (filters?: {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string | number;
  startDate?: string;
  endDate?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.userId) params.append('userId', filters.userId.toString());
  if (filters?.action) params.append('action', filters.action);
  if (filters?.entityType) params.append('entityType', filters.entityType);
  if (filters?.entityId) params.append('entityId', filters.entityId.toString());
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);

  const response = await apiClient.get(`/audit-logs/export?${params.toString()}`, {
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ============================================================================
// Analytics Hooks
// ============================================================================

/**
 * Fetch dashboard statistics with optional date range
 */
export const useDashboardStats = (filters?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const { data } = await apiClient.get(`/analytics/dashboard?${params.toString()}`);
      return data.stats;
    },
    ...analyticsQueryOptions,
  });
};

/**
 * Fetch time-to-completion analysis
 */
export const useCompletionAnalysis = () => {
  return useQuery({
    queryKey: queryKeys.analytics.completion,
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/completion-time');
      return data.analysis;
    },
    ...analyticsQueryOptions,
  });
};

/**
 * Fetch hour allocation vs actual analysis
 */
export const useAllocationAnalysis = () => {
  return useQuery({
    queryKey: queryKeys.analytics.allocation,
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/hour-allocation');
      return data.analysis;
    },
    ...analyticsQueryOptions,
  });
};

// ============================================================================
// Project Health Metrics API
// ============================================================================

/**
 * Fetch all projects with health metrics
 */
export const useProjectsWithMetrics = (status?: string) => {
  return useQuery({
    queryKey: ['projects', 'metrics', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const { data } = await apiClient.get(`/projects/metrics${params}`);
      return data.projects;
    },
    ...projectQueryOptions,
  });
};

/**
 * Fetch health metrics for a single project
 */
export const useProjectHealthMetrics = (id: string) => {
  return useQuery({
    queryKey: ['projects', id, 'metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}/metrics`);
      return data.metrics;
    },
    enabled: !!id,
    ...projectQueryOptions,
  });
};

/**
 * Fetch projects approaching deadline
 */
export const useProjectsNearDeadline = (daysAhead = 7) => {
  return useQuery({
    queryKey: ['projects', 'near-deadline', daysAhead],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/near-deadline?days=${daysAhead}`);
      return data.projects;
    },
    ...projectQueryOptions,
  });
};

/**
 * Fetch project status history
 */
export const useProjectHistory = (id: string) => {
  return useQuery({
    queryKey: ['projects', id, 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}/history`);
      return data.history;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.PROJECTS,
  });
};

/**
 * Fetch project hour transactions
 */
export const useProjectHourTransactions = (id: string) => {
  return useQuery({
    queryKey: ['projects', id, 'hours', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}/hours/history`);
      return data.transactions;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.PROJECTS,
  });
};

/**
 * Extend project budget (add hours)
 */
export const useExtendProjectBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      hours,
      reason,
    }: {
      id: string;
      hours: number;
      reason: string;
    }) => {
      const { data } = await apiClient.post(`/projects/${id}/hours/extend`, { hours, reason });
      return data.project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id, 'hours', 'history'] });
    },
  });
};

/**
 * Manual hour adjustment
 */
export const useAdjustProjectHours = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      hours,
      reason,
    }: {
      id: string;
      hours: number;
      reason: string;
    }) => {
      const { data } = await apiClient.post(`/projects/${id}/hours/adjust`, { hours, reason });
      return data.project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id, 'hours', 'history'] });
    },
  });
};

// ============================================================================
// Attachment Hooks
// ============================================================================

/**
 * Fetch storage configuration
 */
export const useStorageConfig = () => {
  return useQuery({
    queryKey: queryKeys.attachments.storageConfig,
    queryFn: async (): Promise<StorageConfig> => {
      const { data } = await apiClient.get('/storage/config');
      return data;
    },
    staleTime: STALE_TIMES.USER, // Storage config rarely changes
  });
};

/**
 * Fetch attachments for a request
 */
export const useAttachments = (requestId: string) => {
  return useQuery({
    queryKey: queryKeys.attachments.byRequest(requestId),
    queryFn: async (): Promise<Attachment[]> => {
      const { data } = await apiClient.get(`/requests/${requestId}/attachments`);
      return data.attachments;
    },
    enabled: !!requestId,
    staleTime: STALE_TIMES.REQUEST_DETAIL,
  });
};

/**
 * Upload an attachment to a request
 */
export const useUploadAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, file }: { requestId: string; file: File }): Promise<Attachment> => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await apiClient.post(`/requests/${requestId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data.attachment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments.byRequest(variables.requestId) });
    },
  });
};

/**
 * Download an attachment via streaming endpoint
 * Uses backend-proxied download which works reliably behind reverse proxies
 */
export const useDownloadAttachment = () => {
  return useMutation({
    mutationFn: async ({ requestId, attachmentId }: { requestId: string; attachmentId: string }) => {
      // Use the stream endpoint which proxies through the backend
      // This works reliably behind reverse proxies where presigned URLs may fail
      const streamUrl = `/api/requests/${requestId}/attachments/${attachmentId}/stream`;

      // Get attachment info for the filename
      const { data: attachments } = await apiClient.get(`/requests/${requestId}/attachments`);
      const attachment = (attachments.attachments as Attachment[]).find((a) => a.id === attachmentId);
      const fileName = attachment?.originalFileName || 'download';
      const contentType = attachment?.contentType || 'application/octet-stream';

      return {
        downloadUrl: streamUrl,
        fileName,
        contentType,
        expiresIn: 0, // Stream doesn't expire
      };
    },
  });
};

/**
 * Delete an attachment
 */
export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, attachmentId }: { requestId: string; attachmentId: string }) => {
      const { data } = await apiClient.delete(`/requests/${requestId}/attachments/${attachmentId}`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attachments.byRequest(variables.requestId) });
    },
  });
};

/**
 * Get processing status of an attachment
 */
export const useAttachmentProcessingStatus = (attachmentId: string, enabled = true) => {
  return useQuery({
    queryKey: ['attachment-status', attachmentId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/attachments/${attachmentId}/status`);
      return data as { processingStatus: string; processingError?: string };
    },
    enabled: !!attachmentId && enabled,
    refetchInterval: (query) => {
      // Poll every 2 seconds while processing
      const data = query.state.data;
      if (data?.processingStatus === 'pending' || data?.processingStatus === 'processing') {
        return 2000;
      }
      return false;
    },
  });
};

// ============================================================================
// Direct S3 Upload Hook
// ============================================================================

/** Progress state for direct S3 uploads */
export interface DirectUploadProgress {
  /** Current phase of the upload */
  phase: 'init' | 'uploading' | 'completing';
  /** Upload progress percentage (0-100) */
  percent: number;
}

/** Response from upload initialization */
interface InitUploadResponse {
  uploadId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

/**
 * Direct S3 upload hook for large files
 *
 * Attempts direct browser-to-S3 upload using presigned URLs.
 * Automatically falls back to backend-proxied upload if direct upload fails
 * (e.g., when behind Cloudflare Tunnel without proper S3_PUBLIC_ENDPOINT config).
 *
 * Flow:
 * 1. Init: Get presigned PUT URL from backend
 * 2. Upload: PUT file directly to S3 (with progress tracking)
 * 3. Complete: Notify backend to create attachment record
 *
 * Fallback (if step 2 fails):
 * - Uses legacy multipart upload through backend
 *
 * Benefits:
 * - No nginx/backend timeout issues for large files (when direct works)
 * - Real upload progress from XHR
 * - Automatic fallback ensures uploads always work
 *
 * @example
 * const { uploadFile, cancelUpload, isUploading } = useDirectUpload();
 *
 * await uploadFile(requestId, file, (progress) => {
 *   console.log(`${progress.phase}: ${progress.percent}%`);
 * });
 */
export const useDirectUpload = () => {
  const queryClient = useQueryClient();

  // Track active XHR for cancellation
  let activeXhr: XMLHttpRequest | null = null;
  let activeUploadId: string | null = null;
  let activeRequestId: string | null = null;

  /**
   * Fallback: Upload via backend using XHR for reliable progress tracking
   * Uses XHR instead of axios to avoid timeout issues with large files
   *
   * @param skipInitProgress - If true, don't reset progress to 0% (used when falling back from direct upload)
   */
  const uploadViaBackend = async (
    requestId: string,
    file: File,
    onProgress?: (progress: DirectUploadProgress) => void,
    skipInitProgress = false
  ): Promise<Attachment> => {
    // Only reset progress if this is the primary path, not a fallback
    if (!skipInitProgress) {
      onProgress?.({ phase: 'uploading', percent: 0 });
    }

    const formData = new FormData();
    formData.append('file', file);

    return new Promise<Attachment>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXhr = xhr;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress?.({ phase: 'uploading', percent });
        }
      });

      xhr.addEventListener('load', () => {
        activeXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            onProgress?.({ phase: 'completing', percent: 100 });
            queryClient.invalidateQueries({ queryKey: queryKeys.attachments.byRequest(requestId) });
            resolve(response.attachment);
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || errorResponse.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        activeXhr = null;
        reject(new Error('Upload failed - network error'));
      });

      xhr.addEventListener('abort', () => {
        activeXhr = null;
        reject(new Error('Upload cancelled'));
      });

      // Use relative URL - will go through nginx proxy
      xhr.open('POST', `/api/requests/${requestId}/attachments`);
      xhr.withCredentials = true; // Include cookies for auth
      // Don't set Content-Type - browser will set it with boundary for FormData
      xhr.send(formData);
    });
  };

  /**
   * Upload a file directly to S3 using presigned URL
   * Falls back to backend upload if direct upload fails
   */
  const uploadFile = async (
    requestId: string,
    file: File,
    onProgress?: (progress: DirectUploadProgress) => void
  ): Promise<Attachment> => {
    activeRequestId = requestId;

    // Phase 1: Initialize upload - get presigned URL
    onProgress?.({ phase: 'init', percent: 0 });

    let initData: InitUploadResponse;
    try {
      const response = await apiClient.post<InitUploadResponse>(
        `/requests/${requestId}/attachments/init`,
        {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }
      );
      initData = response.data;
    } catch (initError) {
      // If init fails, fall back to legacy upload (don't reset progress)
      console.warn('[Upload] Direct upload init failed, using backend upload:', initError);
      return uploadViaBackend(requestId, file, onProgress, false);
    }

    activeUploadId = initData.uploadId;
    const { uploadUrl } = initData;

    // Phase 2: Upload directly to S3 with progress tracking
    // Using XHR instead of fetch because fetch doesn't support upload progress
    onProgress?.({ phase: 'uploading', percent: 0 });

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhr = xhr;

        // Track progress to detect stalled uploads (e.g., Cloudflare buffering)
        let lastProgressTime = Date.now();
        let lastProgressPercent = 0;
        const PROGRESS_TIMEOUT_MS = 15000; // 15 seconds without progress = stalled

        // Check for stalled upload every 5 seconds
        const progressCheckInterval = setInterval(() => {
          const timeSinceProgress = Date.now() - lastProgressTime;
          if (timeSinceProgress > PROGRESS_TIMEOUT_MS && lastProgressPercent < 100) {
            clearInterval(progressCheckInterval);
            xhr.abort();
            reject(new Error('Upload stalled - no progress for 15 seconds (possible proxy buffering)'));
          }
        }, 5000);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            lastProgressTime = Date.now();
            lastProgressPercent = percent;
            onProgress?.({ phase: 'uploading', percent });
          }
        });

        xhr.addEventListener('load', () => {
          clearInterval(progressCheckInterval);
          activeXhr = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          clearInterval(progressCheckInterval);
          activeXhr = null;
          reject(new Error('Upload failed - network error'));
        });

        xhr.addEventListener('abort', () => {
          clearInterval(progressCheckInterval);
          activeXhr = null;
          reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });
    } catch (uploadError) {
      // If it was user-cancelled, re-throw (don't fall back)
      if (uploadError instanceof Error && uploadError.message === 'Upload cancelled') {
        throw uploadError;
      }

      // Log the error for debugging
      const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
      console.warn(`[Upload] Direct S3 upload failed: ${errorMessage}`);
      console.warn('[Upload] Falling back to backend-proxied upload...');

      // Cancel the pending upload record
      if (activeUploadId) {
        try {
          await apiClient.delete(`/requests/${requestId}/attachments/cancel`, {
            data: { uploadId: activeUploadId },
          });
        } catch {
          // Ignore cleanup errors
        }
        activeUploadId = null;
      }

      // Fall back to backend-proxied upload (skip progress reset since we already showed progress)
      return uploadViaBackend(requestId, file, onProgress, true);
    }

    // Phase 3: Complete upload - create attachment record
    onProgress?.({ phase: 'completing', percent: 100 });

    const { data: completeData } = await apiClient.post<{ attachment: Attachment }>(
      `/requests/${requestId}/attachments/complete`,
      { uploadId: activeUploadId }
    );

    // Clear tracking
    activeUploadId = null;
    activeRequestId = null;

    // Invalidate attachments query to show new file
    queryClient.invalidateQueries({ queryKey: queryKeys.attachments.byRequest(requestId) });

    return completeData.attachment;
  };

  /**
   * Cancel an in-progress upload
   */
  const cancelUpload = async (): Promise<void> => {
    // Abort XHR if in progress
    if (activeXhr) {
      activeXhr.abort();
      activeXhr = null;
    }

    // Notify backend to clean up pending upload record and any S3 files
    if (activeUploadId && activeRequestId) {
      try {
        await apiClient.delete(`/requests/${activeRequestId}/attachments/cancel`, {
          data: { uploadId: activeUploadId },
        });
      } catch {
        // Ignore errors during cancellation - cleanup service will handle orphans
      }
    }

    activeUploadId = null;
    activeRequestId = null;
  };

  return {
    uploadFile,
    cancelUpload,
    /** Check if upload is currently in progress */
    get isUploading(): boolean {
      return activeXhr !== null || activeUploadId !== null;
    },
  };
};
