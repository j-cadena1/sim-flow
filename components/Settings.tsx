import React, { useState, useEffect } from 'react';
import { Save, TestTube2, Lock, AlertCircle, CheckCircle, Users, Trash2, RefreshCw, Edit2, Download } from 'lucide-react';
import { useToast } from './Toast';

interface SSOConfig {
  id: string;
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  authority: string | null;
  scopes: string | null;
}

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  authSource: string;
  entraId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

interface DirectoryUser {
  entraId: string;
  name: string;
  email: string;
  jobTitle?: string;
  department?: string;
  isImported: boolean;
}

type ActiveTab = 'sso' | 'users';

export const Settings: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('sso');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [config, setConfig] = useState<SSOConfig>({
    id: '',
    enabled: false,
    tenantId: null,
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    authority: null,
    scopes: 'openid,profile,email',
  });

  // User management state
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [defaultRole, setDefaultRole] = useState('End-User');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('');

  useEffect(() => {
    loadConfig();
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch('/api/sso/config', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load SSO configuration');
      }

      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Error loading SSO config:', error);
      showToast('Failed to load SSO configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('sim-flow-token');

      // Validation
      if (config.enabled && (!config.tenantId || !config.clientId || !config.redirectUri)) {
        showToast('When SSO is enabled, Tenant ID, Client ID, and Redirect URI are required', 'error');
        return;
      }

      const response = await fetch('/api/sso/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save SSO configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      showToast('SSO configuration saved successfully', 'success');
    } catch (error) {
      console.error('Error saving SSO config:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save SSO configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      const token = localStorage.getItem('sim-flow-token');

      if (!config.tenantId || !config.clientId) {
        showToast('Tenant ID and Client ID are required to test the connection', 'error');
        return;
      }

      const response = await fetch('/api/sso/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: config.tenantId,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      showToast(`Connection test passed: ${data.message}`, 'success');
    } catch (error) {
      console.error('Error testing SSO config:', error);
      showToast(error instanceof Error ? error.message : 'Connection test failed', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // User management functions
  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch('/api/users/management', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadDirectoryUsers = async () => {
    try {
      setIsLoadingDirectory(true);
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch('/api/users/management/directory', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load directory users');
      }

      const data = await response.json();
      setDirectoryUsers(data.users);
      setShowImportModal(true);
    } catch (error) {
      console.error('Error loading directory users:', error);
      showToast(error instanceof Error ? error.message : 'Failed to load directory users', 'error');
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  const handleImportUsers = async () => {
    try {
      const usersToImport = directoryUsers
        .filter(u => selectedUsers.has(u.entraId) && !u.isImported)
        .map(u => ({
          email: u.email,
          name: u.name,
          entraId: u.entraId,
          role: defaultRole,
        }));

      if (usersToImport.length === 0) {
        showToast('No users selected for import', 'error');
        return;
      }

      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch('/api/users/management/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: usersToImport }),
      });

      if (!response.ok) {
        throw new Error('Failed to import users');
      }

      const data = await response.json();
      showToast(data.message, 'success');

      if (data.errors && data.errors.length > 0) {
        console.warn('Import errors:', data.errors);
      }

      setShowImportModal(false);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error) {
      console.error('Error importing users:', error);
      showToast('Failed to import users', 'error');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch(`/api/users/management/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user role');
      }

      showToast('User role updated successfully', 'success');
      setEditingUserId(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update user role', 'error');
    }
  };

  const handleSyncUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch(`/api/users/management/${userId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync user');
      }

      showToast('User synced successfully from Entra ID', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error syncing user:', error);
      showToast(error instanceof Error ? error.message : 'Failed to sync user', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('sim-flow-token');
      const response = await fetch(`/api/users/management/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      showToast('User deleted successfully', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete user', 'error');
    }
  };

  const toggleUserSelection = (entraId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(entraId)) {
      newSelected.delete(entraId);
    } else {
      newSelected.add(entraId);
    }
    setSelectedUsers(newSelected);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage system configuration and integrations</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('sso')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'sso'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Lock className="w-4 h-4 inline mr-2" />
          SSO Configuration
          {activeTab === 'sso' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'users'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          User Management
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
      </div>

      {/* SSO Configuration Tab */}
      {activeTab === 'sso' && (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Entra ID SSO Configuration</h2>
            <p className="text-sm text-slate-400">Configure Microsoft Entra ID (Azure AD) single sign-on</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="mb-6 p-4 bg-slate-950 rounded-lg border border-slate-800">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-white font-medium mb-1">Enable SSO</div>
              <div className="text-sm text-slate-400">Allow users to sign in with Entra ID</div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-4">
          {/* Tenant ID */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tenant ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.tenantId || ''}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Your Azure/Entra ID tenant (directory) ID</p>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Client ID (Application ID) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.clientId || ''}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Application (client) ID from Azure app registration</p>
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Client Secret <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={config.clientSecret || ''}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
              placeholder={config.clientSecret === '***MASKED***' ? 'Current secret is set' : 'Enter client secret'}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Client secret value (not the secret ID)</p>
          </div>

          {/* Redirect URI */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Redirect URI <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.redirectUri || ''}
              onChange={(e) => setConfig({ ...config, redirectUri: e.target.value })}
              placeholder="https://your-domain.com/auth/callback"
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">OAuth2 redirect URI configured in Azure</p>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              OAuth Scopes
            </label>
            <input
              type="text"
              value={config.scopes || ''}
              onChange={(e) => setConfig({ ...config, scopes: e.target.value })}
              placeholder="openid,profile,email"
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Comma-separated list of OAuth scopes</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting || !config.tenantId || !config.clientId}
            className="flex items-center gap-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isTesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube2 className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Configuration Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-400">
              <li>Register your application in Azure/Entra ID portal first</li>
              <li>Configure the redirect URI in your Azure app registration</li>
              <li>Grant required API permissions (User.Read at minimum)</li>
              <li>SSO will be available after saving and enabling</li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Header with Import Button */}
          <div className="flex items-center justify-between bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">User Management</h2>
                <p className="text-sm text-slate-400">Manage users and import from Entra ID directory</p>
              </div>
            </div>
            <button
              onClick={loadDirectoryUsers}
              disabled={isLoadingDirectory}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
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

          {/* Users Table */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-400">Loading users...</p>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No users found</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Auth Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Sync</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-950/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value)}
                                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white text-sm"
                              >
                                <option value="Admin">Admin</option>
                                <option value="Manager">Manager</option>
                                <option value="Engineer">Engineer</option>
                                <option value="End-User">End-User</option>
                              </select>
                              <button
                                onClick={() => handleUpdateRole(user.id, editingRole)}
                                className="text-green-400 hover:text-green-300"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="text-slate-400 hover:text-slate-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                user.role === 'Admin' ? 'bg-red-500/20 text-red-400' :
                                user.role === 'Manager' ? 'bg-purple-500/20 text-purple-400' :
                                user.role === 'Engineer' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {user.role}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditingRole(user.role);
                                }}
                                className="text-slate-400 hover:text-slate-300"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.authSource === 'entra_id'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {user.authSource === 'entra_id' ? 'Entra ID' : 'Local'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                          {user.lastSyncAt ? new Date(user.lastSyncAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            {user.authSource === 'entra_id' && (
                              <button
                                onClick={() => handleSyncUser(user.id)}
                                className="text-blue-400 hover:text-blue-300"
                                title="Sync from Entra ID"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-400 hover:text-red-300"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Import Users from Entra ID</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedUsers(new Set());
                }}
                className="text-slate-400 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Default Role for Imported Users
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value="End-User">End-User</option>
                <option value="Engineer">Engineer</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              <table className="w-full">
                <thead className="bg-slate-950 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {directoryUsers.map((user) => (
                    <tr key={user.entraId} className={user.isImported ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.entraId)}
                          onChange={() => toggleUserSelection(user.entraId)}
                          disabled={user.isImported}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{user.email}</td>
                      <td className="px-4 py-3">
                        {user.isImported ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                            Already Imported
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="text-sm text-slate-400">
                {selectedUsers.size} user(s) selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedUsers(new Set());
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportUsers}
                  disabled={selectedUsers.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Import Selected Users
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
