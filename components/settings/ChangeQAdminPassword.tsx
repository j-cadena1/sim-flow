import React, { useState } from 'react';
import { Key, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import apiClient from '../../lib/api/client';

interface ChangeQAdminPasswordProps {
  /** Whether the current user is qAdmin themselves (requires current password) */
  isQAdmin: boolean;
  /** Callback when password is successfully changed */
  onSuccess: () => void;
  /** Callback when password change fails */
  onError: (message: string) => void;
}

/**
 * Change Password Component for qAdmin Local Account
 *
 * Features:
 * - qAdmin must provide current password
 * - Other Admins can change without current password
 * - Password strength requirements (min 8 characters)
 * - Confirmation field to prevent typos
 */
export const ChangeQAdminPassword: React.FC<ChangeQAdminPasswordProps> = ({
  isQAdmin,
  onSuccess,
  onError,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;
  const canSubmit =
    (!isQAdmin || currentPassword.length > 0) &&
    newPassword.length > 0 &&
    passwordsMatch &&
    passwordLongEnough;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    try {
      setIsChanging(true);

      const payload: { currentPassword?: string; newPassword: string } = {
        newPassword,
      };

      // qAdmin must provide current password
      if (isQAdmin) {
        payload.currentPassword = currentPassword;
      }

      await apiClient.post('/users/management/change-qadmin-password', payload);

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      onSuccess();
    } catch (error: any) {
      console.error('Error changing password:', error);
      onError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 dark:bg-amber-600/20 p-2 rounded-lg">
          <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Change System Administrator Password
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {isQAdmin
              ? 'Update your local administrator password'
              : 'Reset the qAdmin local administrator password'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isQAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400" size={18} />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400" size={18} />
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new password (min 8 characters)"
              required
            />
          </div>
          {newPassword.length > 0 && !passwordLongEnough && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={14} />
              Password must be at least 8 characters long
            </p>
          )}
          {newPassword.length >= 8 && (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 size={14} />
              Password meets minimum length requirement
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400" size={18} />
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm new password"
              required
            />
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={14} />
              Passwords do not match
            </p>
          )}
          {confirmPassword.length > 0 && passwordsMatch && (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 size={14} />
              Passwords match
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-passwords"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700 rounded focus:ring-blue-500"
          />
          <label htmlFor="show-passwords" className="text-sm text-gray-700 dark:text-slate-300">
            Show passwords
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
          <button
            type="submit"
            disabled={!canSubmit || isChanging}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <Key size={18} />
            {isChanging ? 'Changing Password...' : 'Change Password'}
          </button>
        </div>

        {!isQAdmin && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> As an Admin user, you can reset the qAdmin password without knowing the current password.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};
