import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, X } from 'lucide-react';

interface QAdminStatus {
  disabled: boolean;
  entraIdAdminCount: number;
  canManage: boolean;
}

/**
 * Component for Entra ID admins to disable/enable the qAdmin local account.
 * Only visible to Entra ID administrators.
 */
export const QAdminManagement: React.FC = () => {
  const [status, setStatus] = useState<QAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/users/management/qadmin-status');

      if (!response.ok) {
        throw new Error('Failed to fetch qAdmin status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching qAdmin status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDisableConfirm = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/users/management/qadmin/disable', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disable qAdmin account');
      }

      const data = await response.json();
      setSuccessMessage(data.message);
      setShowDisableModal(false);
      await fetchStatus(); // Refresh status
    } catch (err) {
      console.error('Error disabling qAdmin:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable qAdmin account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableConfirm = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/users/management/qadmin/enable', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enable qAdmin account');
      }

      const data = await response.json();
      setSuccessMessage(data.message);
      setShowEnableModal(false);
      await fetchStatus(); // Refresh status
    } catch (err) {
      console.error('Error enabling qAdmin:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable qAdmin account');
    } finally {
      setActionLoading(false);
    }
  };

  // Only show to Entra ID admins
  if (!status?.canManage) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Local Admin Account Management
          </h3>
        </div>
        <p className="text-gray-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-5 h-5 text-orange-500 dark:text-orange-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Local Admin Account Management
        </h3>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                Enhanced Security Feature
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                As an Entra ID administrator, you can disable the local qAdmin account
                to enforce SSO-only authentication. This prevents local login bypass and
                ensures all authentication goes through Microsoft Entra ID.
              </p>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
              Local qAdmin Account Status
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {status.entraIdAdminCount} Entra ID admin{status.entraIdAdminCount !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status.disabled ? (
              <>
                <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Disabled (Secure)
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                  Enabled
                </span>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {status.disabled ? (
            <button
              onClick={() => setShowEnableModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Enable Local Admin Account
            </button>
          ) : (
            <button
              onClick={() => setShowDisableModal(true)}
              disabled={actionLoading || status.entraIdAdminCount === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
              title={status.entraIdAdminCount === 0 ? 'At least one Entra ID admin required' : ''}
            >
              Disable Local Admin Account
            </button>
          )}
          {status.entraIdAdminCount === 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Cannot disable: At least one Entra ID admin must exist before disabling the local admin account.
            </p>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1 pt-2 border-t border-gray-200 dark:border-slate-700">
          <p>
            <strong>Security Note:</strong> When disabled, qadmin@sim-rq.local cannot log in
            with email/password. All administrators must authenticate through Microsoft Entra ID SSO.
          </p>
          <p>
            <strong>Requirements:</strong> At least one active Entra ID administrator must exist
            before the local admin account can be disabled.
          </p>
        </div>
      </div>

      {/* Disable Confirmation Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-600/20 p-2 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Disable Local Admin Account
                </h3>
              </div>
              <button
                onClick={() => setShowDisableModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Security Enhancement:</strong> This will prevent <strong>qadmin@sim-rq.local</strong> from logging in with email/password.
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                Only Entra ID SSO authentication will be available. All administrators must authenticate through Microsoft Entra ID.
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                You can re-enable it later if needed.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDisableModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisableConfirm}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors"
              >
                {actionLoading ? 'Disabling...' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enable Confirmation Modal */}
      {showEnableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-600/20 p-2 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Enable Local Admin Account
                </h3>
              </div>
              <button
                onClick={() => setShowEnableModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This will allow <strong>qadmin@sim-rq.local</strong> to log in with email/password again.
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                Both local authentication and Entra ID SSO will be available.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEnableModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEnableConfirm}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {actionLoading ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
