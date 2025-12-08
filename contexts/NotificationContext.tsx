/**
 * Notification Context
 *
 * Provides global notification state and actions across the application.
 * Ensures NotificationBell and NotificationCenter share the same state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { Notification, NotificationPreferences } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';

const API_BASE = '/api';

interface NotificationContextValue {
  // State
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;

  // Actions
  fetchNotifications: (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) => Promise<any>;
  fetchUnreadCount: () => Promise<number>;
  fetchPreferences: () => Promise<NotificationPreferences | null>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<NotificationPreferences>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle incoming real-time notifications
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);

    // Update unread count if notification is unread
    if (!notification.read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  // Initialize WebSocket connection
  const { isConnected } = useWebSocket({
    userId: user?.id,
    onNotification: handleNewNotification,
    enabled: !!user?.id,
  });

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (params: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (params.unreadOnly) queryParams.set('unreadOnly', 'true');
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.offset) queryParams.set('offset', params.offset.toString());

      const response = await axios.get(`${API_BASE}/notifications?${queryParams}`, {
        withCredentials: true,
      });

      setNotifications(response.data.notifications);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to fetch notifications';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/notifications/unread-count`, {
        withCredentials: true,
      });
      setUnreadCount(response.data.count);
      return response.data.count;
    } catch (err: any) {
      console.error('Failed to fetch unread count:', err);
      return 0;
    }
  }, []);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/notifications/preferences`, {
        withCredentials: true,
      });
      setPreferences(response.data);
      return response.data;
    } catch (err: any) {
      console.error('Failed to fetch preferences:', err);
      return null;
    }
  }, []);

  // Update notification preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    try {
      const response = await axios.patch(
        `${API_BASE}/notifications/preferences`,
        updates,
        { withCredentials: true }
      );
      setPreferences(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update preferences';
      throw new Error(message);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await axios.patch(
        `${API_BASE}/notifications/${notificationId}/read`,
        {},
        { withCredentials: true }
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await axios.patch(
        `${API_BASE}/notifications/read-all`,
        {},
        { withCredentials: true }
      );

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await axios.delete(`${API_BASE}/notifications/${notificationId}`, {
        withCredentials: true,
      });

      // Update local state - find notification before deleting to check if it was unread
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === notificationId);

        // Update unread count if deleted notification was unread
        if (notification && !notification.read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }

        return prev.filter((n) => n.id !== notificationId);
      });
    } catch (err: any) {
      console.error('Failed to delete notification:', err);
      throw err;
    }
  }, []);

  // Delete all notifications
  const deleteAll = useCallback(async () => {
    try {
      await axios.delete(`${API_BASE}/notifications`, {
        withCredentials: true,
      });

      // Update local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to delete all notifications:', err);
      throw err;
    }
  }, []);

  // Auto-fetch on mount when user is available
  useEffect(() => {
    if (user?.id) {
      fetchNotifications({ unreadOnly: false });
      fetchUnreadCount();
      fetchPreferences();
    }
  }, [user?.id, fetchNotifications, fetchUnreadCount, fetchPreferences]);

  const value: NotificationContextValue = {
    // State
    notifications,
    unreadCount,
    preferences,
    loading,
    error,
    isConnected,

    // Actions
    fetchNotifications,
    fetchUnreadCount,
    fetchPreferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
