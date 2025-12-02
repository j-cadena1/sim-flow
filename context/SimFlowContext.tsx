import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserRole, MOCK_USERS, RequestStatus, SimRequest } from '../types';
import {
  useRequests,
  useCreateRequest,
  useUpdateRequestStatus,
  useAssignEngineer,
  useAddComment,
  useUsers,
} from '../api/hooks';

interface SimFlowContextType {
  currentUser: User;
  switchUser: (role: UserRole) => void;
  requests: SimRequest[];
  isLoadingRequests: boolean;
  addRequest: (title: string, description: string, vendor: string, priority: 'Low' | 'Medium' | 'High') => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  assignEngineer: (id: string, engineerId: string, hours: number) => void;
  addComment: (requestId: string, content: string) => void;
  getUsersByRole: (role: UserRole) => User[];
}

const SimFlowContext = createContext<SimFlowContextType | undefined>(undefined);

export const useSimFlow = () => {
  const context = useContext(SimFlowContext);
  if (!context) throw new Error('useSimFlow must be used within a SimFlowProvider');
  return context;
};

export const SimFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Current user state (using mock users for role switching)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const stored = sessionStorage.getItem('sim-flow-current-user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return MOCK_USERS[0];
      }
    }
    return MOCK_USERS[0];
  });

  // Persist current user to sessionStorage for API authentication
  useEffect(() => {
    sessionStorage.setItem('sim-flow-current-user', JSON.stringify(currentUser));
  }, [currentUser]);

  // API hooks
  const { data: requests = [], isLoading: isLoadingRequests } = useRequests();
  const createRequestMutation = useCreateRequest();
  const updateStatusMutation = useUpdateRequestStatus();
  const assignEngineerMutation = useAssignEngineer();
  const addCommentMutation = useAddComment();
  const { data: users = [] } = useUsers();

  const switchUser = (role: UserRole) => {
    const user = MOCK_USERS.find(u => u.role === role);
    if (user) {
      setCurrentUser(user);
    }
  };

  const addRequest = (
    title: string,
    description: string,
    vendor: string,
    priority: 'Low' | 'Medium' | 'High'
  ) => {
    createRequestMutation.mutate({ title, description, vendor, priority });
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
    // Use API users if available, otherwise fall back to mock users
    if (users.length > 0) {
      return users.filter(u => u.role === role);
    }
    return MOCK_USERS.filter(u => u.role === role);
  };

  return (
    <SimFlowContext.Provider
      value={{
        currentUser,
        switchUser,
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
