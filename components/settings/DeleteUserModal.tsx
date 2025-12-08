import React from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  authSource: string;
  entraId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface DeleteUserModalProps {
  user: ManagedUser;
  confirmEmail: string;
  deleteReason: string;
  onConfirmEmailChange: (email: string) => void;
  onDeleteReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for permanently deleting a user from the system.
 * Requires email confirmation to prevent accidental deletions.
 */
export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  confirmEmail,
  deleteReason,
  onConfirmEmailChange,
  onDeleteReasonChange,
  onCancel,
  onConfirm,
}) => {
  const isConfirmValid = confirmEmail.toLowerCase() === user.email.toLowerCase();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 dark:bg-red-600/20 p-2 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Permanently Delete User</h3>
        </div>

        <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">
            <strong>Warning:</strong> This action cannot be undone. The user <strong>{user.name}</strong> ({user.email}) will be permanently removed from the system.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Their identity will be archived for historical reference, but their account and login access will be permanently deleted.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Type the user's email to confirm: <strong>{user.email}</strong>
            </label>
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => onConfirmEmailChange(e.target.value)}
              placeholder="Enter email to confirm"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Reason for deletion (optional)
            </label>
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => onDeleteReasonChange(e.target.value)}
              placeholder="e.g., Employee left the company"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};
