/**
 * @fileoverview SimFlow Context
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
 * @module contexts/SimFlowContext
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
 * Context value interface for SimFlow
 */
interface SimFlowContextType {
  currentUser: User;
  requests: SimRequest[];
  isLoadingRequests: boolean;
  addRequest: (title: string, description: string, vendor: string, priority: 'Low' | 'Medium' | 'High', projectId: string, onBehalfOfUserId?: string) => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  assignEngineer: (id: string, engineerId: string, hours: number) => void;
  addComment: (requestId: string, content: string) => void;
  getUsersByRole: (role: UserRole) => User[];
}

const SimFlowContext = createContext<SimFlowContextType | undefined>(undefined);

/**
 * Hook to access SimFlow context
 *
 * @throws Error if used outside of SimFlowProvider
 * @returns SimFlowContextType with user, requests, and actions
 */
export const useSimFlow = () => {
  const context = useContext(SimFlowContext);
  if (!context) throw new Error('useSimFlow must be used within a SimFlowProvider');
  return context;
};

/**
 * Provider component for SimFlow context
 *
 * Wraps children with request management capabilities.
 * Requires AuthContext to be present (returns null if not authenticated).
 */
export const SimFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  const addComment = (requestId: string, content: string) => {
    addCommentMutation.mutate({ requestId, content });
  };

  const getUsersByRole = (role: UserRole) => {
    // Use API users
    return users.filter(u => u.role === role);
  };

  return (
    <SimFlowContext.Provider
      value={{
        currentUser,
        requests,
        isLoadingRequests,
        addRequest,
        updateRequestStatus,
        assignEngineer,
        addComment,
        getUsersByRole,
      }}
    >
      {children}
    </SimFlowContext.Provider>
  );
};
