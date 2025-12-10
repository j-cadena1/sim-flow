/**
 * @fileoverview Sim RQ Context
 *
 * Provides application-wide state and actions for request management.
 * Acts as a facade over the API hooks, providing a simplified interface
 * for components to interact with requests.
 *
 * This context:
 * - Exposes the authenticated user
 * - Provides request CRUD operations
 * - Offers user lookup by role (for engineer assignment)
 *
 * Note: This context requires AuthContext to be present in the component tree.
 * It will return null if no user is authenticated.
 *
 * @module contexts/SimRQContext
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { User, UserRole, RequestStatus, SimRequest } from '../types';
import { useAuth } from './AuthContext';
import {
  useRequests,
  useCreateRequest,
  useUpdateRequestStatus,
  useAssignEngineer,
  useAddComment,
  useUsers,
} from '../lib/api/hooks';

/**
 * Context value interface for Sim RQ
 */
interface SimRQContextType {
  currentUser: User;
  requests: SimRequest[];
  isLoadingRequests: boolean;
  addRequest: (title: string, description: string, vendor: string, priority: 'Low' | 'Medium' | 'High', projectId: string, onBehalfOfUserId?: string) => void;
  addRequestAsync: (title: string, description: string, vendor: string, priority: 'Low' | 'Medium' | 'High', projectId: string, onBehalfOfUserId?: string) => Promise<SimRequest | null>;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  assignEngineer: (id: string, engineerId: string, hours: number) => void;
  addComment: (requestId: string, content: string, visibleToRequester?: boolean) => void;
  getUsersByRole: (role: UserRole) => User[];
}

const SimRQContext = createContext<SimRQContextType | undefined>(undefined);

/**
 * Hook to access Sim RQ context
 *
 * @throws Error if used outside of SimRQProvider
 * @returns SimRQContextType with user, requests, and actions
 */
export const useSimRQ = () => {
  const context = useContext(SimRQContext);
  if (!context) throw new Error('useSimRQ must be used within a SimRQProvider');
  return context;
};

/**
 * Provider component for Sim RQ context
 *
 * Wraps children with request management capabilities.
 * Requires AuthContext to be present (returns null if not authenticated).
 */
export const SimRQProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: authUser } = useAuth();

  // API hooks
  const { data: requestsData, isLoading: isLoadingRequests } = useRequests();
  const requests = requestsData?.data || [];
  const createRequestMutation = useCreateRequest();
  const updateStatusMutation = useUpdateRequestStatus();
  const assignEngineerMutation = useAssignEngineer();
  const addCommentMutation = useAddComment();
  const { data: users = [] } = useUsers();

  // Use authenticated user as current user - must exist to render provider
  if (!authUser) {
    return null;
  }
  const currentUser = authUser as User;

  const addRequest = (
    title: string,
    description: string,
    vendor: string,
    priority: 'Low' | 'Medium' | 'High',
    projectId: string,
    onBehalfOfUserId?: string
  ) => {
    createRequestMutation.mutate({ title, description, vendor, priority, projectId, onBehalfOfUserId });
  };

  const addRequestAsync = async (
    title: string,
    description: string,
    vendor: string,
    priority: 'Low' | 'Medium' | 'High',
    projectId: string,
    onBehalfOfUserId?: string
  ): Promise<SimRequest | null> => {
    try {
      return await createRequestMutation.mutateAsync({ title, description, vendor, priority, projectId, onBehalfOfUserId });
    } catch {
      return null;
    }
  };

  const updateRequestStatus = (id: string, status: RequestStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  const assignEngineer = (id: string, engineerId: string, hours: number) => {
    assignEngineerMutation.mutate({
      id,
      engineerId,
      estimatedHours: hours,
    });
  };

  const addComment = (requestId: string, content: string, visibleToRequester?: boolean) => {
    addCommentMutation.mutate({ requestId, content, visibleToRequester });
  };

  const getUsersByRole = (role: UserRole) => {
    // Use API users
    return users.filter(u => u.role === role);
  };

  return (
    <SimRQContext.Provider
      value={{
        currentUser,
        requests,
        isLoadingRequests,
        addRequest,
        addRequestAsync,
        updateRequestStatus,
        assignEngineer,
        addComment,
        getUsersByRole,
      }}
    >
      {children}
    </SimRQContext.Provider>
  );
};
