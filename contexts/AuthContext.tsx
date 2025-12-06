/**
 * @fileoverview Authentication Context
 *
 * Manages user authentication state and provides login/logout functionality.
 * Supports both local authentication and Microsoft Entra ID SSO.
 *
 * Authentication Flow:
 * 1. On mount, checks for existing session via /api/auth/verify
 * 2. Handles SSO callback if code/state params present in URL
 * 3. Provides login() for local auth and logout() for session termination
 * 4. Uses HTTP-only cookies for session management (set by server)
 *
 * Session Management:
 * - Sessions are stored server-side with HTTP-only cookies
 * - No tokens stored in localStorage/sessionStorage
 * - logoutAll() revokes all sessions across devices
 *
 * @module contexts/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import apiClient from '../lib/api/client';

/**
 * Authentication context value interface
 */
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  logoutAll: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state by checking session with server
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if this is an SSO callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
          // Handle SSO callback - credentials: include sends cookies
          const response = await fetch(`/api/auth/sso/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || errorData.error || 'SSO login failed. Please try again.';
            setError(errorMessage);
          }
        } else {
          // Normal initialization - verify session with server
          try {
            const response = await apiClient.get('/auth/verify');
            setUser(response.data.user);
          } catch {
            // Session invalid or not logged in - this is normal
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Authentication failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use fetch for login with credentials: include to receive cookies
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: receive and store cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error || 'Login failed';
        throw new Error(errorMessage);
      }

      // Server sets HttpOnly cookie, we just store user in state
      setUser(data.user);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint - server will clear the cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {
        // Ignore errors - we're logging out anyway
      });
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const logoutAll = async () => {
    try {
      // Call logout-all endpoint to revoke all sessions
      await apiClient.post('/auth/logout-all');
    } finally {
      setUser(null);
      setError(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, logoutAll, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
