import React from 'react';
import { Users, Download, RefreshCw, Shield, Edit2, CheckCircle, Trash2 } from 'lucide-react';

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

interface UserManagementProps {
  users: ManagedUser[];
  isLoadingUsers: boolean;
  isLoadingDirectory: boolean;
  showDeactivated: boolean;
  editingUserId: string | null;
  editingRole: string;
  onShowDeactivatedChange: (show: boolean) => void;
  onLoadDirectoryUsers: () => void;
  onEditRole: (userId: string, currentRole: string) => void;
  onCancelEdit: () => void;
  onUpdateRole: (userId: string, newRole: string) => void;
  onSyncUser: (userId: string) => void;
  onDeactivateUser: (userId: string) => void;
  onRestoreUser: (userId: string) => void;
  onPermanentlyDeleteUser: (user: ManagedUser) => void;
  setEditingRole: (role: string) => void;
  isProtectedUser: (email: string) => boolean;
}

/**
 * User Management component for managing users and importing from Entra ID directory.
 * Allows viewing active/deactivated users, syncing with Entra ID, and managing user roles.
 */
export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  isLoadingUsers,
  isLoadingDirectory,
  showDeactivated,
  editingUserId,
  editingRole,
  onShowDeactivatedChange,
  onLoadDirectoryUsers,
  onEditRole,
  onCancelEdit,
  onUpdateRole,
  onSyncUser,
  onDeactivateUser,
  onRestoreUser,
  onPermanentlyDeleteUser,
  setEditingRole,
  isProtectedUser,
}) => {
  return (
    <div className="space-y-6">
      {/* Header with Import Button */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-600/20 p-2 rounded-lg">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Manage users and import from Entra ID directory</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => onShowDeactivatedChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500"
            />
            Show deactivated users
          </label>
          <button
            onClick={onLoadDirectoryUsers}
            disabled={isLoadingDirectory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLoadingDirectory ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Import from Entra ID
              </>
            )}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {isLoadingUsers ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">Loading users...</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">No users found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Auth Source</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-slate-950/50 ${user.deletedAt ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-slate-400">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id && !user.deletedAt ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value)}
                            className="px-2 py-1 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Engineer">Engineer</option>
                            <option value="End-User">End-User</option>
                          </select>
                          <button
                            onClick={() => onUpdateRole(user.id, editingRole)}
                            className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.role === 'Admin' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' :
                            user.role === 'Manager' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                            user.role === 'Engineer' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                            'bg-gray-100 dark:bg-slate-500/20 text-gray-600 dark:text-slate-400'
                          }`}>
                            {user.role}
                          </span>
                          {!user.deletedAt && !isProtectedUser(user.email) && (
                            <button
                              onClick={() => onEditRole(user.id, user.role)}
                              className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                              title="Edit role"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.deletedAt ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                          Deactivated
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.authSource === 'entra_id'
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-slate-500/20 text-gray-600 dark:text-slate-400'
                      }`}>
                        {user.authSource === 'entra_id' ? 'Entra ID' : 'Local'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {user.deletedAt ? (
                          <>
                            {/* Restore button for deactivated users */}
                            <button
                              onClick={() => onRestoreUser(user.id)}
                              className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                              title="Restore user"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {/* Permanently delete button */}
                            <button
                              onClick={() => onPermanentlyDeleteUser(user)}
                              className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                              title="Permanently delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Sync button for Entra ID users */}
                            {user.authSource === 'entra_id' && (
                              <button
                                onClick={() => onSyncUser(user.id)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                                title="Sync from Entra ID"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            {/* Deactivate button for active users (not for protected accounts) */}
                            {!isProtectedUser(user.email) && (
                              <button
                                onClick={() => onDeactivateUser(user.id)}
                                className="text-orange-600 dark:text-orange-400 hover:text-orange-500 dark:hover:text-orange-300"
                                title="Deactivate user"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
