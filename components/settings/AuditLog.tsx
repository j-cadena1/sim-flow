import React, { useState, useEffect } from 'react';
import { Shield, FileDown, RefreshCw, Filter, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../Toast';
import { useAuditLogs, useAuditStats, exportAuditLogsCSV } from '../../lib/api/hooks';

interface AuditFilters {
  action: string;
  entityType: string;
  startDate: string;
  endDate: string;
  limit: number;
  offset: number;
}

/**
 * Audit Log component for tracking all user actions and system events.
 * Provides filtering, pagination, CSV export, manual refresh, and auto-refresh functionality.
 */
export const AuditLog: React.FC = () => {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<AuditFilters>({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: auditData, isLoading, refetch } = useAuditLogs(filters);
  const { data: stats, refetch: refetchStats } = useAuditStats({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  });

  // Auto-refresh functionality - refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
      refetchStats();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refetch, refetchStats]);

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

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetch(), refetchStats()]);
      showToast('Audit logs refreshed', 'success');
    } catch (error) {
      showToast('Failed to refresh audit logs', 'error');
    } finally {
      setIsRefreshing(false);
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
    // Handle special cases for proper capitalization
    const formatted = action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // Fix specific capitalizations
    return formatted
      .replace(/Qadmin/g, 'qAdmin')
      .replace(/Sso/g, 'SSO');
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
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (auditData?.logs) {
      setExpandedLogIds(new Set(auditData.logs.map((log: any) => log.id)));
    }
  };

  const collapseAll = () => {
    setExpandedLogIds(new Set());
  };

  const allExpanded = auditData?.logs && expandedLogIds.size === auditData.logs.length && auditData.logs.length > 0;

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
          <div className="flex flex-wrap gap-2">
            {/* Auto-refresh toggle */}
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900 dark:text-white">Auto-refresh (10s)</span>
            </label>

            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Expand/Collapse All button */}
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              disabled={!auditData?.logs || auditData.logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expand All
                </>
              )}
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
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
              <option value="DEACTIVATE_USER">Deactivate User</option>
              <option value="RESTORE_USER">Restore User</option>
              <option value="DELETE_USER">Delete User (Permanent)</option>
              <option value="CHANGE_QADMIN_PASSWORD">Change Admin Password</option>
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
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-[220px_1fr_180px_32px] gap-4 px-4 py-3 bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <div>Action</div>
              <div>Details</div>
              <div className="text-right">Timestamp</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-slate-800">
              {auditData.logs.map((log: any) => (
                <div key={log.id}>
                  {/* Clickable Row */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <div className="grid md:grid-cols-[220px_1fr_180px_32px] gap-4 items-center">
                      {/* Action Badge - Fixed Width Column */}
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getActionColor(
                            log.action
                          )}`}
                        >
                          <span className="text-sm">{getActionIcon(log.action)}</span>
                          <span className="hidden sm:inline break-words">{formatActionName(log.action)}</span>
                        </span>
                      </div>

                      {/* Main Content - Flexible Width */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{log.user_name}</span>
                          <span className="text-gray-400 dark:text-slate-600">→</span>
                          <span className="text-sm text-gray-600 dark:text-slate-400 capitalize">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-xs font-mono text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {String(log.entity_id).slice(0, 8)}
                            </span>
                          )}
                        </div>
                        {/* Quick Preview of Key Details */}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400 truncate">
                            {Object.entries(log.details).slice(0, 2).map(([key, value], idx) => (
                              <span key={key}>
                                {idx > 0 && <span className="mx-1.5 text-gray-300 dark:text-slate-600">•</span>}
                                <span className="text-gray-400 dark:text-slate-500">{formatDetailKey(key)}:</span>{' '}
                                <span className="text-gray-600 dark:text-slate-300">{formatDetailValue(key, value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Timestamp & IP - Fixed Width Column */}
                      <div className="text-right hidden md:block">
                        <div className="text-sm text-gray-700 dark:text-slate-300">{formatTimestamp(log.timestamp)}</div>
                        <div className="text-xs font-mono text-gray-400 dark:text-slate-500">{log.ip_address || '-'}</div>
                      </div>

                      {/* Expand Indicator */}
                      <div className="hidden md:flex justify-center">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedLogIds.has(log.id) ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {/* Mobile timestamp */}
                    <div className="md:hidden mt-2 text-xs text-gray-400 dark:text-slate-500">
                      {formatTimestamp(log.timestamp)} • {log.ip_address || '-'}
                    </div>
                  </button>

                  {/* Expanded Details Panel */}
                  {expandedLogIds.has(log.id) && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-slate-800/30 border-t border-gray-100 dark:border-slate-800">
                      {/* Event Details Card - Full Width at Top */}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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
