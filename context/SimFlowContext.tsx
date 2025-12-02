import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { SimRequest, User, UserRole, MOCK_USERS, RequestStatus, Comment } from '../types';
import { loadRequestsFromStorage, saveRequestsToStorage } from '../utils/storage';
import { sanitizeInput } from '../utils/sanitize';

interface SimFlowContextType {
  currentUser: User;
  switchUser: (role: UserRole) => void;
  requests: SimRequest[];
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
  // Simulating Auth
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  // Simulating Database with safe localStorage handling
  const [requests, setRequests] = useState<SimRequest[]>(loadRequestsFromStorage);

  useEffect(() => {
    const saved = saveRequestsToStorage(requests);
    if (!saved) {
      console.error('Failed to save requests to localStorage');
      // Could trigger a toast notification here
    }
  }, [requests]);

  const switchUser = (role: UserRole) => {
    const user = MOCK_USERS.find(u => u.role === role);
    if (user) setCurrentUser(user);
  };

  const addRequest = (title: string, description: string, vendor: string, priority: 'Low' | 'Medium' | 'High') => {
    const newRequest: SimRequest = {
      id: crypto.randomUUID(),
      title: sanitizeInput(title),
      description: sanitizeInput(description),
      vendor: sanitizeInput(vendor),
      priority,
      status: RequestStatus.SUBMITTED,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      comments: []
    };
    setRequests(prev => [newRequest, ...prev]);
  };

  const updateRequestStatus = (id: string, status: RequestStatus) => {
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status } : req
    ));
  };

  const assignEngineer = (id: string, engineerId: string, hours: number) => {
    const engineer = MOCK_USERS.find(u => u.id === engineerId);
    setRequests(prev => prev.map(req => 
      req.id === id ? { 
        ...req, 
        assignedTo: engineerId, 
        assignedToName: engineer?.name, 
        estimatedHours: hours,
        status: RequestStatus.ENGINEERING_REVIEW 
      } : req
    ));
  };

  const addComment = (requestId: string, content: string) => {
    const sanitizedContent = sanitizeInput(content);
    if (!sanitizedContent.trim()) {
      console.warn('Cannot add empty comment');
      return;
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      authorName: currentUser.name,
      authorRole: currentUser.role,
      content: sanitizedContent,
      timestamp: new Date().toISOString()
    };
    setRequests(prev => prev.map(req =>
      req.id === requestId ? { ...req, comments: [...req.comments, newComment] } : req
    ));
  };

  const getUsersByRole = (role: UserRole) => MOCK_USERS.filter(u => u.role === role);

  const contextValue = useMemo(
    () => ({
      currentUser,
      switchUser,
      requests,
      addRequest,
      updateRequestStatus,
      assignEngineer,
      addComment,
      getUsersByRole,
    }),
    [currentUser, requests]
  );

  return (
    <SimFlowContext.Provider value={contextValue}>
      {children}
    </SimFlowContext.Provider>
  );
};