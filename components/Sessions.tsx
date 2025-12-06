import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, Trash2, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from './Toast';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/api/client';

interface Session {
  id: string;
  createdAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

function parseUserAgent(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };

  let device = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = ua.includes('iPad') ? 'Tablet' : 'Mobile'; }

  // Detect Browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  return { device, browser, os };
}

function getDeviceIcon(device: string) {
  switch (device) {
    case 'Mobile':
      return <Smartphone className="w-5 h-5" />;
    case 'Tablet':
      return <Monitor className="w-5 h-5" />;
    default:
      return <Monitor className="w-5 h-5" />;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const Sessions: React.FC = () => {
  const { showToast } = useToast();
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/auth/sessions');
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      showToast('Failed to load sessions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      await apiClient.delete(`/auth/sessions/${sessionId}`);
      showToast('Session revoked successfully', 'success');
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error revoking session:', error);
      showToast('Failed to revoke session', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('This will log you out from all devices including this one. Continue?')) {
      return;
    }

    try {
      setIsRevokingAll(true);
      await logoutAll();
      // logoutAll will redirect to login
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      showToast('Failed to revoke all sessions', 'error');
      setIsRevokingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-600/20 p-2 rounded-lg">
            <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Sessions</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Manage your active login sessions across devices
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSessions}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAllSessions}
              disabled={isRevokingAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
            >
              {isRevokingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Log out all devices
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-slate-400">
          No active sessions found
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => {
            const { device, browser, os } = parseUserAgent(session.userAgent);
            const isCurrentSession = index === 0; // Most recent is likely current

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isCurrentSession
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    isCurrentSession
                      ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                  }`}>
                    {getDeviceIcon(device)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {browser} on {os}
                      </span>
                      {isCurrentSession && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full">
                          Current session
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                      <span>{session.ipAddress || 'Unknown IP'}</span>
                      <span>•</span>
                      <span>Started {formatDate(session.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {!isCurrentSession && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revokingId === session.id}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {revokingId === session.id ? (
                      <div className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 dark:border-red-400/30 dark:border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Security tip:</strong> If you see any sessions you don't recognize, revoke them immediately
          and consider changing your password or re-authenticating with SSO.
        </p>
      </div>
    </div>
  );
};

export default Sessions;
