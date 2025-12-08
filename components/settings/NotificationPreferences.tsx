/**
 * Notification Preferences Component
 *
 * Allows users to customize their notification settings
 */

import React, { useState, useEffect } from 'react';
import { Bell, Save, RefreshCw } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import type { NotificationPreferences as NotificationPreferencesType, EmailDigestFrequency } from '../../types';

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { preferences, fetchPreferences, updatePreferences } = useNotifications({
    userId: user?.id,
    autoFetch: true,
  });

  const [localPreferences, setLocalPreferences] = useState<Partial<NotificationPreferencesType>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local preferences when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  const handleToggle = (field: keyof NotificationPreferencesType) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
    setHasChanges(true);
  };

  const handleDigestChange = (frequency: EmailDigestFrequency) => {
    setLocalPreferences((prev) => ({
      ...prev,
      emailDigestFrequency: frequency,
    }));
    setHasChanges(true);
  };

  const handleRetentionChange = (days: number) => {
    setLocalPreferences((prev) => ({
      ...prev,
      retentionDays: days,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences(localPreferences);
      showToast('Notification preferences updated successfully', 'success');
      setHasChanges(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to update preferences', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await fetchPreferences();
      showToast('Preferences reset', 'info');
      setHasChanges(false);
    } catch (error) {
      showToast('Failed to reset preferences', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!preferences || !localPreferences.userId) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-slate-400">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            Notification Preferences
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Customize how and when you receive notifications
        </p>
      </div>

      {/* In-App Notifications */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">
          In-App Notifications
        </h3>

        <div className="space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-slate-700">
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100">
                Enable In-App Notifications
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Show notifications in the app header and notification center
              </p>
            </div>
            <button
              onClick={() => handleToggle('inAppEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localPreferences.inAppEnabled
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPreferences.inAppEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Individual Notification Types */}
          {localPreferences.inAppEnabled && (
            <>
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Notify me when:
                </p>

                {[
                  { field: 'requestAssigned', label: 'A request is assigned to me' },
                  { field: 'requestStatusChanged', label: 'Request status changes' },
                  { field: 'requestCommentAdded', label: 'Someone comments on a request' },
                  { field: 'approvalNeeded', label: 'My approval is needed' },
                  { field: 'timeLogged', label: 'Time is logged to a project' },
                  { field: 'projectUpdated', label: 'A project is updated' },
                  { field: 'adminAction', label: 'An admin performs an action' },
                ].map(({ field, label }) => (
                  <label
                    key={field}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 rounded px-2 -mx-2"
                  >
                    <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                    <input
                      type="checkbox"
                      checked={localPreferences[field as keyof NotificationPreferencesType] as boolean}
                      onChange={() => handleToggle(field as keyof NotificationPreferencesType)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">
          Email Notifications
        </h3>

        <div className="space-y-4">
          {/* Email Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-slate-700">
            <div>
              <p className="font-medium text-gray-900 dark:text-slate-100">
                Enable Email Notifications
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Receive notifications via email
              </p>
            </div>
            <button
              onClick={() => handleToggle('emailEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localPreferences.emailEnabled
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localPreferences.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Email Digest Frequency */}
          {localPreferences.emailEnabled && (
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                Email Digest Frequency
              </p>
              <div className="space-y-2">
                {(['instant', 'hourly', 'daily', 'weekly', 'never'] as EmailDigestFrequency[]).map((freq) => (
                  <label
                    key={freq}
                    className="flex items-center py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 rounded px-2 -mx-2"
                  >
                    <input
                      type="radio"
                      name="emailDigestFrequency"
                      value={freq}
                      checked={localPreferences.emailDigestFrequency === freq}
                      onChange={() => handleDigestChange(freq)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700 dark:text-slate-300 capitalize">
                      {freq}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Retention */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">
          Notification Retention
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Auto-delete read notifications after (days)
          </label>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
            Read notifications older than this will be automatically deleted. Unread notifications are never deleted.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="365"
              value={localPreferences.retentionDays || 30}
              onChange={(e) => handleRetentionChange(parseInt(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">days</span>
          </div>
          {localPreferences.retentionDays && (localPreferences.retentionDays < 1 || localPreferences.retentionDays > 365) && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Retention days must be between 1 and 365
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges || isSaving}
          className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
};
