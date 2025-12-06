import React, { useState, useEffect } from 'react';
import { Save, TestTube2, Lock, AlertCircle, CheckCircle, Users, Trash2, RefreshCw, Edit2, Download, Shield, Calendar, Filter, FileDown, Globe } from 'lucide-react';
import { useToast } from './Toast';
import { useAuditLogs, useAuditStats, exportAuditLogsCSV } from '../lib/api/hooks';
import apiClient from '../lib/api/client';
import { Sessions } from './Sessions';
import { useAuth } from '../contexts/AuthContext';

// Only the local qAdmin account can configure SSO
const QADMIN_EMAIL = 'qadmin@simflow.local';

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

type ActiveTab = 'sso' | 'users' | 'sessions' | 'audit';

export const Settings: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isQAdmin = user?.email === QADMIN_EMAIL;
  // Default to 'users' tab if not qAdmin (can't see SSO tab)
  const [activeTab, setActiveTab] = useState<ActiveTab>(isQAdmin ? 'sso' : 'users');
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
    // Only load SSO config if user is qAdmin
    if (isQAdmin) {
      loadConfig();
    } else {
      setIsLoading(false);
    }
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, isQAdmin]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/sso/config');
      setConfig(response.data.config);
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

      // Validation
      if (config.enabled && (!config.tenantId || !config.clientId || !config.redirectUri)) {
        showToast('When SSO is enabled, Tenant ID, Client ID, and Redirect URI are required', 'error');
        return;
      }

      const response = await apiClient.put('/sso/config', config);
      setConfig(response.data.config);
      showToast('SSO configuration saved successfully', 'success');
    } catch (error: any) {
      console.error('Error saving SSO config:', error);
      showToast(error.response?.data?.error || 'Failed to save SSO configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);

      if (!config.tenantId || !config.clientId) {
        showToast('Tenant ID and Client ID are required to test the connection', 'error');
        return;
      }

      const response = await apiClient.post('/sso/test', {
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });

      showToast(`Connection test passed: ${response.data.message}`, 'success');
    } catch (error: any) {
      console.error('Error testing SSO config:', error);
      showToast(error.response?.data?.error || 'Connection test failed', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // User management functions
  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await apiClient.get('/users/management');
      setUsers(response.data.users);
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
      const response = await apiClient.get('/users/management/directory');
      setDirectoryUsers(response.data.users);
      setShowImportModal(true);
    } catch (error: any) {
      console.error('Error loading directory users:', error);
      showToast(error.response?.data?.error || 'Failed to load directory users', 'error');
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

      const response = await apiClient.post('/users/management/import', { users: usersToImport });
      showToast(response.data.message, 'success');

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Import errors:', response.data.errors);
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
      await apiClient.patch(`/users/management/${userId}/role`, { role: newRole });
      showToast('User role updated successfully', 'success');
      setEditingUserId(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      showToast(error.response?.data?.error || 'Failed to update user role', 'error');
    }
  };

  const handleSyncUser = async (userId: string) => {
    try {
      await apiClient.post(`/users/management/${userId}/sync`);
      showToast('User synced successfully from Entra ID', 'success');
      loadUsers();
    } catch (error: any) {
      console.error('Error syncing user:', error);
      showToast(error.response?.data?.error || 'Failed to sync user', 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/users/management/${userId}`);
      showToast('User deleted successfully', 'success');
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showToast(error.response?.data?.error || 'Failed to delete user', 'error');
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
          <p className="text-gray-500 dark:text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-500 dark:text-slate-400">Manage system configuration and integrations</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-slate-800">
        {/* SSO Configuration tab - only visible to qAdmin */}
        {isQAdmin && (
          <button
            onClick={() => setActiveTab('sso')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'sso'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            SSO Configuration
            {activeTab === 'sso' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'users'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          User Management
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'sessions'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          Sessions
          {activeTab === 'sessions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'audit'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Audit Log
          {activeTab === 'audit' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>
      </div>

      {/* SSO Configuration Tab - only accessible to qAdmin */}
      {activeTab === 'sso' && isQAdmin && (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 dark:bg-blue-600/20 p-2 rounded-lg">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Entra ID SSO Configuration</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Configure Microsoft Entra ID (Azure AD) single sign-on</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-gray-900 dark:text-white font-medium mb-1">Enable SSO</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Allow users to sign in with Entra ID</div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-8 bg-gray-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 dark:after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-4">
          {/* Tenant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Tenant ID <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.tenantId || ''}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Your Azure/Entra ID tenant (directory) ID</p>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Client ID (Application ID) <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.clientId || ''}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Application (client) ID from Azure app registration</p>
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Client Secret <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="password"
              value={config.clientSecret || ''}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
              placeholder={config.clientSecret === '***MASKED***' ? 'Current secret is set' : 'Enter client secret'}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Client secret value (not the secret ID)</p>
          </div>

          {/* Redirect URI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Redirect URI <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.redirectUri || ''}
              onChange={(e) => setConfig({ ...config, redirectUri: e.target.value })}
              placeholder="https://your-domain.com/auth/callback"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">OAuth2 redirect URI configured in Azure</p>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              OAuth Scopes
            </label>
            <input
              type="text"
              value={config.scopes || ''}
              onChange={(e) => setConfig({ ...config, scopes: e.target.value })}
              placeholder="openid,profile,email"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Comma-separated list of OAuth scopes</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
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
            className="flex items-center gap-2 px-6 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg transition-colors"
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
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Configuration Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600 dark:text-blue-400">
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
            <button
              onClick={loadDirectoryUsers}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Auth Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Last Sync</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-950/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-slate-400">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingUserId === user.id ? (
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
                                onClick={() => handleUpdateRole(user.id, editingRole)}
                                className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
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
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditingRole(user.role);
                                }}
                                className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                          {user.lastSyncAt ? new Date(user.lastSyncAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            {user.authSource === 'entra_id' && (
                              <button
                                onClick={() => handleSyncUser(user.id)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                                title="Sync from Entra ID"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Import Users from Entra ID</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedUsers(new Set());
                }}
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
                onChange={(e) => setDefaultRole(e.target.value)}
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
                          onChange={() => toggleUserSelection(user.entraId)}
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
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedUsers(new Set());
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportUsers}
                  disabled={selectedUsers.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Import Selected Users
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && <Sessions />}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && <AuditLogTab />}
    </div>
  );
};

// Audit Log Tab Component
const AuditLogTab: React.FC = () => {
  const { showToast } = useToast();
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const { data: auditData, isLoading } = useAuditLogs(filters);
  const { data: stats } = useAuditStats({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportAuditLogsCSV(filters);
      showToast('Audit logs exported successfully', 'success');
    } catch (error) {
      showToast('Failed to export audit logs', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    setFilters(prev => ({
      ...prev,
      offset: direction === 'next'
        ? prev.offset + prev.limit
        : Math.max(0, prev.offset - prev.limit)
    }));
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (action.includes('CREATE')) return 'text-green-400 bg-green-400/10 border-green-400/20';
    if (action.includes('UPDATE') || action.includes('ASSIGN')) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    if (action.includes('APPROVE')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (action.includes('REJECT') || action.includes('DENY')) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('DELETE')) return '🗑️';
    if (action.includes('CREATE')) return '✨';
    if (action.includes('UPDATE')) return '✏️';
    if (action.includes('ASSIGN')) return '👤';
    if (action.includes('LOGIN')) return '🔐';
    if (action.includes('LOGOUT')) return '🚪';
    if (action.includes('APPROVE')) return '✅';
    if (action.includes('REJECT') || action.includes('DENY')) return '❌';
    return '📋';
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatDetailValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDetailKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  };

  const toggleExpand = (logId: number) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-600/20 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Audit Log</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">Track all user actions and system events</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <FileDown className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalEvents}</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Total Events</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.keys(stats.eventsByAction).length}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Action Types</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.topUsers.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Active Users</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.recentEvents.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Recent Events</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="SSO_LOGIN">SSO Login</option>
              <option value="CREATE_REQUEST">Create Request</option>
              <option value="UPDATE_REQUEST_STATUS">Update Status</option>
              <option value="ASSIGN_ENGINEER">Assign Engineer</option>
              <option value="DELETE_REQUEST">Delete Request</option>
              <option value="UPDATE_USER_ROLE">Update User Role</option>
              <option value="DELETE_USER">Delete User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Entity Type
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="auth">Authentication</option>
              <option value="request">Request</option>
              <option value="user">User</option>
              <option value="project">Project</option>
              <option value="comment">Comment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading audit logs...
          </div>
        ) : !auditData?.logs || auditData.logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 dark:divide-slate-800">
              {auditData.logs.map((log: any) => (
                <div key={log.id}>
                  {/* Clickable Row */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="w-full px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* Action Icon & Badge */}
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${getActionColor(
                            log.action
                          )}`}
                        >
                          <span>{getActionIcon(log.action)}</span>
                          {formatActionName(log.action)}
                        </span>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{log.user_name}</span>
                          <span className="text-gray-400 dark:text-slate-500">•</span>
                          <span className="text-sm text-gray-500 dark:text-slate-400 capitalize">{log.entity_type}</span>
                          {log.entity_id && (
                            <>
                              <span className="text-gray-400 dark:text-slate-500">•</span>
                              <span className="text-xs font-mono text-gray-400 dark:text-slate-500">
                                #{String(log.entity_id).slice(0, 8)}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Quick Preview of Key Details */}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-1 text-sm text-gray-500 dark:text-slate-400 truncate">
                            {Object.entries(log.details).slice(0, 2).map(([key, value], idx) => (
                              <span key={key}>
                                {idx > 0 && ' • '}
                                <span className="text-gray-400 dark:text-slate-500">{formatDetailKey(key)}:</span>{' '}
                                <span className="text-gray-600 dark:text-slate-300">{formatDetailValue(key, value)}</span>
                              </span>
                            ))}
                            {Object.keys(log.details).length > 2 && (
                              <span className="text-gray-400 dark:text-slate-500"> +{Object.keys(log.details).length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timestamp & IP */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm text-gray-700 dark:text-slate-300">{formatTimestamp(log.timestamp)}</div>
                        <div className="text-xs font-mono text-gray-400 dark:text-slate-500">{log.ip_address || '-'}</div>
                      </div>

                      {/* Expand Indicator */}
                      <div className="flex-shrink-0">
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details Panel */}
                  {expandedLogId === log.id && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-slate-800/30 border-t border-gray-100 dark:border-slate-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                        {/* User Info Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">User Information</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">Name</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{log.user_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">Email</span>
                              <span className="text-sm text-gray-700 dark:text-slate-300">{log.user_email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">User ID</span>
                              <span className="text-xs font-mono text-gray-500 dark:text-slate-400">{log.user_id?.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </div>

                        {/* Event Info Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Event Information</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">Action</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatActionName(log.action)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">Entity Type</span>
                              <span className="text-sm text-gray-700 dark:text-slate-300 capitalize">{log.entity_type}</span>
                            </div>
                            {log.entity_id && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-slate-400">Entity ID</span>
                                <span className="text-xs font-mono text-gray-500 dark:text-slate-400">{log.entity_id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Connection Info Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Connection</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">IP Address</span>
                              <span className="text-sm font-mono text-gray-700 dark:text-slate-300">{log.ip_address || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500 dark:text-slate-400">Timestamp</span>
                              <span className="text-sm text-gray-700 dark:text-slate-300">{formatTimestamp(log.timestamp)}</span>
                            </div>
                            {log.user_agent && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-slate-400">User Agent</span>
                                <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[150px]" title={log.user_agent}>
                                  {log.user_agent.split('/')[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Details Card - Full Width */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-4 bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Event Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between py-1 border-b border-gray-100 dark:border-slate-800 last:border-0">
                                <span className="text-sm text-gray-500 dark:text-slate-400">{formatDetailKey(key)}</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white ml-2 text-right">
                                  {formatDetailValue(key, value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-slate-400">
                Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, auditData.pagination.total)} of{' '}
                {auditData.pagination.total} events
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange('prev')}
                  disabled={filters.offset === 0}
                  className="px-3 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded transition-colors text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange('next')}
                  disabled={!auditData.pagination.hasMore}
                  className="px-3 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
