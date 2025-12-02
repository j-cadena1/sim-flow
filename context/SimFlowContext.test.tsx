import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SimFlowProvider, useSimFlow } from './SimFlowContext';
import { UserRole, RequestStatus } from '../types';
import React from 'react';

describe('SimFlowContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SimFlowProvider>{children}</SimFlowProvider>
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

  describe('currentUser and switchUser', () => {
    it('should start with first user', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });
      expect(result.current.currentUser.role).toBe(UserRole.USER);
    });

    it('should switch user by role', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.switchUser(UserRole.MANAGER);
      });

      expect(result.current.currentUser.role).toBe(UserRole.MANAGER);
    });
  });

  describe('addRequest', () => {
    it('should add a new request', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest('Test Request', 'Test Description', 'FANUC', 'High');
      });

      expect(result.current.requests).toHaveLength(1);
      expect(result.current.requests[0].title).toBe('Test Request');
      expect(result.current.requests[0].status).toBe(RequestStatus.SUBMITTED);
    });

    it('should sanitize request inputs', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest(
          '<script>alert("xss")</script>Title',
          '<b>Description</b>',
          'FANUC',
          'Medium'
        );
      });

      expect(result.current.requests[0].title).not.toContain('<script>');
      expect(result.current.requests[0].description).not.toContain('<b>');
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest('Test', 'Description', 'FANUC', 'Low');
      });

      const requestId = result.current.requests[0].id;

      act(() => {
        result.current.updateRequestStatus(requestId, RequestStatus.IN_PROGRESS);
      });

      expect(result.current.requests[0].status).toBe(RequestStatus.IN_PROGRESS);
    });
  });

  describe('assignEngineer', () => {
    it('should assign engineer to request', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest('Test', 'Description', 'FANUC', 'High');
      });

      const requestId = result.current.requests[0].id;
      const engineers = result.current.getUsersByRole(UserRole.ENGINEER);
      const engineerId = engineers[0].id;

      act(() => {
        result.current.assignEngineer(requestId, engineerId, 40);
      });

      expect(result.current.requests[0].assignedTo).toBe(engineerId);
      expect(result.current.requests[0].estimatedHours).toBe(40);
      expect(result.current.requests[0].status).toBe(RequestStatus.ENGINEERING_REVIEW);
    });
  });

  describe('addComment', () => {
    it('should add comment to request', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest('Test', 'Description', 'FANUC', 'Medium');
      });

      const requestId = result.current.requests[0].id;

      act(() => {
        result.current.addComment(requestId, 'Test comment');
      });

      expect(result.current.requests[0].comments).toHaveLength(1);
      expect(result.current.requests[0].comments[0].content).toBe('Test comment');
    });

    it('should not add empty comment', () => {
      const { result } = renderHook(() => useSimFlow(), { wrapper });

      act(() => {
        result.current.addRequest('Test', 'Description', 'FANUC', 'Low');
      });

      const requestId = result.current.requests[0].id;

      act(() => {
        result.current.addComment(requestId, '   ');
      });

      expect(result.current.requests[0].comments).toHaveLength(0);
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
