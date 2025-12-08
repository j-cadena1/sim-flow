import React from 'react';

interface DirectoryUser {
  entraId: string;
  name: string;
  email: string;
  jobTitle?: string;
  department?: string;
  isImported: boolean;
}

interface ImportUsersModalProps {
  directoryUsers: DirectoryUser[];
  selectedUsers: Set<string>;
  defaultRole: string;
  onClose: () => void;
  onToggleUser: (entraId: string) => void;
  onDefaultRoleChange: (role: string) => void;
  onImport: () => void;
}

/**
 * Modal component for importing users from Entra ID directory.
 * Allows selection of users and setting a default role for imported users.
 */
export const ImportUsersModal: React.FC<ImportUsersModalProps> = ({
  directoryUsers,
  selectedUsers,
  defaultRole,
  onClose,
  onToggleUser,
  onDefaultRoleChange,
  onImport,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Import Users from Entra ID</h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Default Role for Imported Users
          </label>
          <select
            value={defaultRole}
            onChange={(e) => onDefaultRoleChange(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="End-User">End-User</option>
            <option value="Engineer">Engineer</option>
            <option value="Manager">Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto mb-4">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Select</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
              {directoryUsers.map((user) => (
                <tr key={user.entraId} className={user.isImported ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.entraId)}
                      onChange={() => onToggleUser(user.entraId)}
                      disabled={user.isImported}
                      className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isImported ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                        Already Imported
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                        Available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {selectedUsers.size} user(s) selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onImport}
              disabled={selectedUsers.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Import Selected Users
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
