import React from 'react';
import { Save, TestTube2, Lock, AlertCircle } from 'lucide-react';

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

interface SSOConfigurationProps {
  config: SSOConfig;
  isSaving: boolean;
  isTesting: boolean;
  onConfigChange: (config: SSOConfig) => void;
  onSave: () => void;
  onTest: () => void;
}

/**
 * SSO Configuration component for managing Entra ID (Azure AD) single sign-on settings.
 * Only accessible to qAdmin users when SSO is configured via database (not environment variables).
 */
export const SSOConfiguration: React.FC<SSOConfigurationProps> = ({
  config,
  isSaving,
  isTesting,
  onConfigChange,
  onSave,
  onTest,
}) => {
  return (
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
              onChange={(e) => onConfigChange({ ...config, enabled: e.target.checked })}
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
            onChange={(e) => onConfigChange({ ...config, tenantId: e.target.value })}
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
            onChange={(e) => onConfigChange({ ...config, clientId: e.target.value })}
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
            onChange={(e) => onConfigChange({ ...config, clientSecret: e.target.value })}
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
            onChange={(e) => onConfigChange({ ...config, redirectUri: e.target.value })}
            placeholder="https://your-domain.com/api/auth/sso/callback"
            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Must match the Redirect URI in your Azure app registration (e.g., https://simflow.company.com/api/auth/sso/callback)</p>
        </div>

        {/* Scopes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            OAuth Scopes
          </label>
          <input
            type="text"
            value={config.scopes || ''}
            onChange={(e) => onConfigChange({ ...config, scopes: e.target.value })}
            placeholder="openid,profile,email"
            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Comma-separated list of OAuth scopes</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onSave}
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
          onClick={onTest}
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
  );
};
