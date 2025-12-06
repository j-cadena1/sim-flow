/**
 * @fileoverview API Client Configuration
 *
 * Configures Axios instance for all API requests with:
 * - Cookie-based authentication (withCredentials: true)
 * - Automatic 401 handling with redirect to login
 * - Request timeout configuration
 *
 * The client uses HTTP-only session cookies set by the server.
 * No manual token management is required.
 *
 * @module lib/api/client
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/** API base URL - proxied by Nginx in production */
const API_BASE_URL = '/api';

/**
 * Pre-configured Axios instance for API requests
 *
 * Features:
 * - Automatic cookie handling for session auth
 * - 10 second timeout
 * - JSON content type
 * - Automatic redirect to login on 401
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true, // Send cookies with requests
});

// Response interceptor for handling auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401 (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't redirect if we're on auth endpoints
      if (originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/verify') ||
          originalRequest.url?.includes('/auth/logout')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Session is invalid, redirect to login
      window.location.href = '/';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
