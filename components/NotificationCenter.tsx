/**
 * Notification Center Page
 *
 * Full-page view of all notifications with filtering and management options
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Filter, Trash2, Check, CheckCheck, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotificationContext } from '../contexts/NotificationContext';
import { useModal } from './Modal';
import type { Notification, NotificationType } from '../types';
import { formatDistanceToNow, formatDateTime } from '../utils/dateUtils';

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const { showConfirm } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const notificationRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAll,
    fetchNotifications,
  } = useNotificationContext();

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to linked page
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleFilterChange = async (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
  };

  // Refetch notifications when filter changes
  useEffect(() => {
    fetchNotifications({ unreadOnly: filter === 'unread' });
  }, [filter, fetchNotifications]);

  // Scroll to and highlight notification from URL param
  useEffect(() => {
    const notificationId = searchParams.get('id');
    if (notificationId && notifications.length > 0) {
      setHighlightedId(notificationId);

      // Wait for next tick to ensure DOM is updated
      setTimeout(() => {
        const element = notificationRefs.current.get(notificationId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Clear highlight after 3 seconds
          setTimeout(() => {
            setHighlightedId(null);
            // Clear the URL param
            setSearchParams({});
          }, 3000);
        }
      }, 100);
    }
  }, [searchParams, notifications, setSearchParams]);

  const handleClearAll = () => {
    showConfirm(
      'Delete All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      async () => {
        await deleteAll();
      }
    );
  };

  // Filter notifications by type if a type filter is selected
  const filteredNotifications = typeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === typeFilter);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/settings#notifications')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Preferences
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('unread')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-slate-700" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
              No notifications
            </h3>
            <p className="text-gray-500 dark:text-slate-400">
              {filter === 'unread' ? "You're all caught up!" : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                ref={(el) => {
                  if (el) {
                    notificationRefs.current.set(notification.id, el);
                  } else {
                    notificationRefs.current.delete(notification.id);
                  }
                }}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-all group ${
                  highlightedId === notification.id
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 animate-pulse'
                    : !notification.read
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500'
                      : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-medium text-gray-900 dark:text-slate-100">
                        {notification.title}
                        {!notification.read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-slate-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.createdAt))}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-500">
                      {notification.triggeredByName && (
                        <span>by {notification.triggeredByName}</span>
                      )}
                      <span>{formatDateTime(notification.createdAt)}</span>
                      {notification.entityType && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">
                          {notification.entityType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
