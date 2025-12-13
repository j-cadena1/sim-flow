/// <reference types="vitest/globals" />
/**
 * AuthContext Unit Tests
 *
 * Tests the authentication context including:
 * - useAuth hook validation
 * - SSO callback handling
 * - Session verification
 * - Login/logout functionality
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { UserRole } from '../types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.history.replaceState
const mockReplaceState = vi.fn();
Object.defineProperty(window, 'history', {
  value: { replaceState: mockReplaceState },
  writable: true,
});

// Mock window.location
const mockLocation = {
  search: '',
  pathname: '/dashboard',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock apiClient with hoisted mock functions
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  default: {
    get: mockGet,
    post: mockPost,
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const MOCK_USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.USER,
};

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

function resetMocks() {
  vi.clearAllMocks();
  mockLocation.search = '';
  mockLocation.pathname = '/dashboard';
  mockFetch.mockReset();
  mockReplaceState.mockReset();
}

// ============================================================================
// Tests
// ============================================================================

describe('AuthContext', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // useAuth hook validation Tests
  // --------------------------------------------------------------------------
  describe('useAuth hook validation', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should return context value when inside AuthProvider', async () => {
      // Setup: session verification returns no user
      mockGet.mockRejectedValueOnce(new Error('Not authenticated'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.login).toBeDefined();
      expect(result.current.logout).toBeDefined();
      expect(result.current.logoutAll).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // SSO callback handling Tests
  // --------------------------------------------------------------------------
  describe('SSO callback handling', () => {
    it('should handle successful SSO callback with code and state', async () => {
      mockLocation.search = '?code=auth-code-123&state=state-456';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: MOCK_USER }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(MOCK_USER);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/sso/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: 'auth-code-123', state: 'state-456' }),
      });
    });

    it('should set user on successful SSO response', async () => {
      mockLocation.search = '?code=abc&state=xyz';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: MOCK_USER }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });
    });

    it('should clean URL after successful SSO callback', async () => {
      mockLocation.search = '?code=abc&state=xyz';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: MOCK_USER }),
      });

      renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockReplaceState).toHaveBeenCalledWith(
          {},
          expect.any(String),
          '/dashboard'
        );
      });
    });

    it('should set error on failed SSO response', async () => {
      mockLocation.search = '?code=invalid&state=xyz';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid authorization code' }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Invalid authorization code');
      expect(result.current.user).toBeNull();
    });

    it('should extract error message from nested response', async () => {
      mockLocation.search = '?code=bad&state=xyz';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Nested error message' } }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Nested error message');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Session verification Tests
  // --------------------------------------------------------------------------
  describe('session verification', () => {
    it('should verify session on mount when no SSO params', async () => {
      mockLocation.search = '';
      mockGet.mockResolvedValueOnce({ data: { user: MOCK_USER } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledWith('/auth/verify');
      expect(result.current.user).toEqual(MOCK_USER);
    });

    it('should set user on successful verify', async () => {
      mockLocation.search = '';
      mockGet.mockResolvedValueOnce({ data: { user: MOCK_USER } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });
    });

    it('should set user to null on failed verify (not logged in)', async () => {
      mockLocation.search = '';
      mockGet.mockRejectedValueOnce(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      // Error should NOT be set for normal "not logged in" state
      expect(result.current.error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // login function Tests
  // --------------------------------------------------------------------------
  describe('login function', () => {
    beforeEach(() => {
      mockLocation.search = '';
      // Initial session check returns not logged in
      mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    });

    it('should set isLoading during request', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockFetch.mockReturnValueOnce(loginPromise);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start login
      let loginPromiseResult: Promise<void>;
      act(() => {
        loginPromiseResult = result.current.login('test@example.com', 'password');
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve login
      resolveLogin!({
        ok: true,
        json: async () => ({ user: MOCK_USER }),
      });

      await act(async () => {
        await loginPromiseResult;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set user on successful login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: MOCK_USER }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(result.current.user).toEqual(MOCK_USER);
      expect(result.current.error).toBeNull();
    });

    it('should set error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrong-password');
        } catch (err) {
          thrownError = err as Error;
        }
      });

      expect(thrownError).toBeDefined();
      expect(thrownError!.message).toBe('Invalid credentials');
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.user).toBeNull();
    });

    it('should throw error for caller to handle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Account locked' }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'password');
        })
      ).rejects.toThrow('Account locked');
    });
  });

  // --------------------------------------------------------------------------
  // logout function Tests
  // --------------------------------------------------------------------------
  describe('logout function', () => {
    beforeEach(() => {
      mockLocation.search = '';
      // Initial session check returns logged in user
      mockGet.mockResolvedValueOnce({ data: { user: MOCK_USER } });
    });

    it('should clear user state', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
    });

    it('should ignore network errors and still logout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });

      // Should not throw
      await act(async () => {
        await result.current.logout();
      });

      // User should still be cleared
      expect(result.current.user).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // logoutAll function Tests
  // --------------------------------------------------------------------------
  describe('logoutAll function', () => {
    beforeEach(() => {
      mockLocation.search = '';
      // Initial session check returns logged in user
      mockGet.mockResolvedValueOnce({ data: { user: MOCK_USER } });
    });

    it('should call logout-all endpoint', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(mockPost).toHaveBeenCalledWith('/auth/logout-all');
    });

    it('should clear user state after call', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(MOCK_USER);
      });

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Provider rendering Tests
  // --------------------------------------------------------------------------
  describe('provider rendering', () => {
    it('should render children', async () => {
      mockLocation.search = '';
      mockGet.mockRejectedValueOnce(new Error('Not authenticated'));

      render(
        <AuthProvider>
          <div data-testid="child">Child Content</div>
        </AuthProvider>
      );

      // Wait for auth state to settle
      await waitFor(() => {
        expect(screen.getByTestId('child')).toBeInTheDocument();
      });
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('should provide initial loading state', async () => {
      mockLocation.search = '';

      // Don't resolve immediately
      let resolveVerify: (value: any) => void;
      mockGet.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveVerify = resolve;
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve verify
      resolveVerify!({ data: { user: MOCK_USER } });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
