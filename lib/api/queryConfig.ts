/**
 * React Query Configuration
 *
 * Centralized caching configuration for optimal performance.
 * Different data types have different staleness tolerances.
 */

import { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Stale Time Constants (when data is considered "fresh")
// ============================================================================

export const STALE_TIMES = {
  // User data changes infrequently
  USER: 10 * 60 * 1000, // 10 minutes

  // Current user session data
  CURRENT_USER: 5 * 60 * 1000, // 5 minutes

  // Request lists change frequently in active workflows
  REQUESTS: 30 * 1000, // 30 seconds

  // Individual request details (comments may update often)
  REQUEST_DETAIL: 15 * 1000, // 15 seconds

  // Project data is relatively stable
  PROJECTS: 5 * 60 * 1000, // 5 minutes

  // Time entries shouldn't change much once entered
  TIME_ENTRIES: 2 * 60 * 1000, // 2 minutes

  // Title change requests need timely updates for approval workflows
  TITLE_CHANGES: 30 * 1000, // 30 seconds

  // Discussion requests are part of active workflows
  DISCUSSIONS: 30 * 1000, // 30 seconds

  // Audit logs are historical and don't change
  AUDIT_LOGS: 5 * 60 * 1000, // 5 minutes

  // Analytics/stats can be cached longer
  ANALYTICS: 10 * 60 * 1000, // 10 minutes
} as const;

// ============================================================================
// Garbage Collection Time Constants (when inactive data is removed from cache)
// ============================================================================

export const GC_TIMES = {
  // Keep user data in cache for a while
  USER: 30 * 60 * 1000, // 30 minutes

  // Request data can be cleaned up sooner
  REQUESTS: 10 * 60 * 1000, // 10 minutes

  // Projects can stay longer
  PROJECTS: 30 * 60 * 1000, // 30 minutes

  // Analytics should persist
  ANALYTICS: 60 * 60 * 1000, // 1 hour

  // Default gc time
  DEFAULT: 5 * 60 * 1000, // 5 minutes
} as const;

// ============================================================================
// Query Key Factories
// ============================================================================

export const queryKeys = {
  // Users
  users: {
    all: ['users'] as const,
    byRole: (role?: string) => ['users', role] as const,
    current: ['user', 'me'] as const,
  },

  // Requests
  requests: {
    all: ['requests'] as const,
    list: (params?: Record<string, unknown>) => ['requests', params] as const,
    detail: (id: string) => ['requests', id] as const,
    comments: (id: string) => ['requests', id, 'comments'] as const,
  },

  // Projects
  projects: {
    all: ['projects'] as const,
    list: (status?: string) => ['projects', status] as const,
    detail: (id: string) => ['projects', id] as const,
  },

  // Time entries
  timeEntries: {
    byRequest: (requestId: string) => ['timeEntries', requestId] as const,
  },

  // Title change requests
  titleChanges: {
    byRequest: (requestId: string) => ['titleChangeRequests', requestId] as const,
    pending: ['titleChangeRequests', 'pending'] as const,
  },

  // Discussion requests
  discussions: {
    byRequest: (requestId: string) => ['discussion-requests', requestId] as const,
  },

  // Audit logs
  auditLogs: {
    all: ['audit-logs'] as const,
    filtered: (filters?: Record<string, unknown>) => ['audit-logs', filters] as const,
    stats: (filters?: Record<string, unknown>) => ['audit-stats', filters] as const,
  },

  // Analytics
  analytics: {
    dashboard: (filters?: Record<string, unknown>) => ['dashboard-stats', filters] as const,
    completion: ['completion-analysis'] as const,
    allocation: ['allocation-analysis'] as const,
  },
} as const;

// ============================================================================
// Query Client Factory
// ============================================================================

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on window focus by default - user action should trigger this
        refetchOnWindowFocus: false,

        // Retry once on failure
        retry: 1,

        // Default stale time - data is fresh for 30 seconds
        staleTime: 30 * 1000,

        // Default gc time - keep data for 5 minutes after becoming inactive
        gcTime: GC_TIMES.DEFAULT,

        // Refetch on reconnect
        refetchOnReconnect: true,

        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
      },
      mutations: {
        // Retry mutations once on network errors
        retry: 1,
      },
    },
  });
}

// ============================================================================
// Query Options Helpers
// ============================================================================

/**
 * Get optimized query options for user-related queries
 */
export const userQueryOptions = {
  staleTime: STALE_TIMES.USER,
  gcTime: GC_TIMES.USER,
};

/**
 * Get optimized query options for current user
 */
export const currentUserQueryOptions = {
  staleTime: STALE_TIMES.CURRENT_USER,
  gcTime: GC_TIMES.USER,
};

/**
 * Get optimized query options for request list queries
 */
export const requestListQueryOptions = {
  staleTime: STALE_TIMES.REQUESTS,
  gcTime: GC_TIMES.REQUESTS,
};

/**
 * Get optimized query options for request detail queries
 */
export const requestDetailQueryOptions = {
  staleTime: STALE_TIMES.REQUEST_DETAIL,
  gcTime: GC_TIMES.REQUESTS,
};

/**
 * Get optimized query options for project queries
 */
export const projectQueryOptions = {
  staleTime: STALE_TIMES.PROJECTS,
  gcTime: GC_TIMES.PROJECTS,
};

/**
 * Get optimized query options for analytics queries
 */
export const analyticsQueryOptions = {
  staleTime: STALE_TIMES.ANALYTICS,
  gcTime: GC_TIMES.ANALYTICS,
};

/**
 * Get optimized query options for workflow-related queries
 * (title changes, discussions)
 */
export const workflowQueryOptions = {
  staleTime: STALE_TIMES.DISCUSSIONS,
  gcTime: GC_TIMES.REQUESTS,
};
