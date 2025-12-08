import React from 'react';
import { Lock, Users, Globe, Shield, Key, Bell } from 'lucide-react';

type ActiveTab = 'sso' | 'users' | 'security' | 'sessions' | 'audit' | 'notifications';

interface SettingsTabsProps {
  activeTab: ActiveTab;
  showSsoTab: boolean;
  showUsersTab: boolean;
  showSecurityTab: boolean;
  showAuditTab: boolean;
  onTabChange: (tab: ActiveTab) => void;
}

/**
 * Tab navigation component for the Settings page.
 * Conditionally shows tabs based on user permissions and SSO configuration source.
 */
export const SettingsTabs: React.FC<SettingsTabsProps> = ({
  activeTab,
  showSsoTab,
  showUsersTab,
  showSecurityTab,
  showAuditTab,
  onTabChange,
}) => {
  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-slate-800">
      {/* SSO Configuration tab - only visible to qAdmin when NOT configured via environment variables */}
      {showSsoTab && (
        <button
          onClick={() => onTabChange('sso')}
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
      {showUsersTab && (
        <button
          onClick={() => onTabChange('users')}
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
      )}
      {showSecurityTab && (
        <button
          onClick={() => onTabChange('security')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'security'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          Security
          {activeTab === 'security' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>
      )}
      <button
        onClick={() => onTabChange('sessions')}
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
        onClick={() => onTabChange('notifications')}
        className={`px-6 py-3 font-medium transition-colors relative ${
          activeTab === 'notifications'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
        }`}
      >
        <Bell className="w-4 h-4 inline mr-2" />
        Notifications
        {activeTab === 'notifications' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
        )}
      </button>
      {showAuditTab && (
        <button
          onClick={() => onTabChange('audit')}
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
      )}
    </div>
  );
};
