import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SimFlowProvider, useSimFlow } from './SimFlowContext';
import { UserRole, type User } from '../types';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Test mock data
const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Test User', email: 'test@example.com', role: UserRole.USER },
  { id: 'eng-1', name: 'Test Engineer', email: 'engineer@example.com', role: UserRole.ENGINEER },
  { id: 'mgr-1', name: 'Test Manager', email: 'manager@example.com', role: UserRole.MANAGER },
];

// Mock the auth context
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.USER,
};

vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual('./AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    }),
  };
});

// Mock the API hooks
vi.mock('../lib/api/hooks', () => ({
  useRequests: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useCreateRequest: () => ({
    mutate: vi.fn(),
  }),
  useUpdateRequestStatus: () => ({
    mutate: vi.fn(),
  }),
  useAssignEngineer: () => ({
    mutate: vi.fn(),
  }),
  useAddComment: () => ({
    mutate: vi.fn(),
  }),
  useUsers: () => ({
    data: MOCK_USERS,
    isLoading: false,
    isError: false,
  }),
}));

describe('SimFlowContext', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SimFlowProvider>{children}</SimFlowProvider>
    </QueryClientProvider>
  );

  describe('useSimFlow hook', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useSimFlow());
      }).toThrow('useSimFlow must be used within a SimFlowProvider');
    });

    it('should provide context when used within provider', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(result.current).toBeDefined();
      expect(result.current.currentUser).toBeDefined();
      expect(result.current.requests).toEqual([]);
    });
  });

  describe('currentUser', () => {
    it('should use authenticated user from AuthContext', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(result.current.currentUser.role).toBe(UserRole.USER);
      expect(result.current.currentUser.id).toBe('test-user-id');
    });
  });

  describe('API integration methods', () => {
    it('should have addRequest method', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(typeof result.current.addRequest).toBe('function');
    });

    it('should have updateRequestStatus method', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(typeof result.current.updateRequestStatus).toBe('function');
    });

    it('should have assignEngineer method', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(typeof result.current.assignEngineer).toBe('function');
    });

    it('should have addComment method', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(typeof result.current.addComment).toBe('function');
    });
  });

  describe('getUsersByRole', () => {
    it('should filter users by role', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      const engineers = result.current.getUsersByRole(UserRole.ENGINEER);
      expect(engineers.every(u => u.role === UserRole.ENGINEER)).toBe(true);

      const managers = result.current.getUsersByRole(UserRole.MANAGER);
      expect(managers.every(u => u.role === UserRole.MANAGER)).toBe(true);
    });
  });
});
