import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSimFlow } from '../contexts/SimFlowContext';
import { useTheme } from '../contexts/ThemeContext';
import { RequestStatus, UserRole } from '../types';
import { CHART_COLORS, STATUS_INDICATOR_COLORS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Clock, CheckCircle, AlertOctagon, Plus, BarChart3, FolderKanban, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { useProjectsWithMetrics, useProjectsNearDeadline } from '../lib/api/hooks';

export const Dashboard: React.FC = () => {
  const { requests, currentUser } = useSimFlow();
  const { theme } = useTheme();
  const { data: projectMetrics = [] } = useProjectsWithMetrics();
  const { data: nearDeadlineProjects = [] } = useProjectsNearDeadline(7);

  // Memoize needsAttentionCount separately (matches logic described in Dashboard specification)
  const needsAttentionCount = useMemo(() => {
    if (!currentUser) return 0;

    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return requests.filter(r => r.status === RequestStatus.MANAGER_REVIEW).length;
    }
    if (currentUser.role === UserRole.ENGINEER) {
      return requests.filter(r =>
        r.assignedTo === currentUser.id &&
        (r.status === RequestStatus.ENGINEERING_REVIEW || r.status === RequestStatus.REVISION_REQUESTED)
      ).length;
    }
    // End-User
    return requests.filter(r =>
      r.createdBy === currentUser.id &&
      r.status === RequestStatus.REVISION_APPROVAL
    ).length;
  }, [requests, currentUser]);

  // Memoize stats calculations with role-based filtering
  const stats = useMemo(() => {
    // Apply role-based filtering (matches RequestList logic)
    let visibleRequests = requests;
    if (currentUser.role === UserRole.USER) {
      // End-users only see their own requests
      visibleRequests = requests.filter(r => r.createdBy === currentUser.id);
    } else if (currentUser.role === UserRole.ENGINEER) {
      // Engineers see unassigned work ready for them, or their own assigned work
      visibleRequests = requests.filter(r =>
        r.assignedTo === currentUser.id || r.status === RequestStatus.ENGINEERING_REVIEW
      );
    }
    // Admins and Managers see all requests (no filtering needed)

    const total = visibleRequests.length;
    const inProgress = visibleRequests.filter(r => [RequestStatus.IN_PROGRESS, RequestStatus.ENGINEERING_REVIEW, RequestStatus.DISCUSSION].includes(r.status)).length;
    const completed = visibleRequests.filter(r => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.ACCEPTED).length;
    const pending = visibleRequests.filter(r => [RequestStatus.SUBMITTED, RequestStatus.MANAGER_REVIEW].includes(r.status)).length;
    const denied = visibleRequests.filter(r => r.status === RequestStatus.DENIED).length;

    // User-specific stats
    const myRequests = requests.filter(r => r.createdBy === currentUser.id);
    const assignedToMe = requests.filter(r => r.assignedTo === currentUser.id);

    return { total, inProgress, completed, pending, denied, myRequests: myRequests.length, assignedToMe: assignedToMe.length, needsAttention: needsAttentionCount };
  }, [requests, currentUser, needsAttentionCount]);

  // Project stats
  const projectStats = useMemo(() => {
    const activeProjects = projectMetrics.filter((p: any) => p.status === 'Active');
    const totalBudget = activeProjects.reduce((sum: number, p: any) => sum + (p.totalHours || 0), 0);
    const usedBudget = activeProjects.reduce((sum: number, p: any) => sum + (p.usedHours || 0), 0);
    const avgUtilization = activeProjects.length > 0
      ? activeProjects.reduce((sum: number, p: any) => sum + (Number(p.utilizationPercentage) || 0), 0) / activeProjects.length
      : 0;

    return {
      active: activeProjects.length,
      total: projectMetrics.length,
      totalBudget,
      usedBudget,
      avgUtilization: Math.round(avgUtilization * 10) / 10
    };
  }, [projectMetrics]);

  // Memoize chart data
  const statusData = useMemo(() => [
    { name: 'Pending', value: stats.pending, color: CHART_COLORS.pending },
    { name: 'Engineering', value: stats.inProgress, color: CHART_COLORS.engineering },
    { name: 'Completed', value: stats.completed, color: CHART_COLORS.completed },
    { name: 'Denied', value: stats.denied, color: CHART_COLORS.denied },
  ], [stats]);

  interface StatCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ size?: number }>;
    color: string;
    to?: string;
  }

  const StatCard: React.FC<StatCardProps> = React.memo(({ label, value, icon: Icon, color, to }) => {
    const content = (
      <>
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
          <Icon size={64} />
        </div>
        <div className="relative z-10">
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
      </>
    );

    if (to) {
      return (
        <Link
          to={to}
          className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 relative overflow-hidden group shadow-sm hover:border-blue-500 dark:hover:border-blue-600 transition-all cursor-pointer"
        >
          {content}
        </Link>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 relative overflow-hidden group shadow-sm">
        {content}
      </div>
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-gray-500 dark:text-slate-400">Real-time overview of simulation throughput and your work.</p>
      </div>

      {/* Quick Actions */}
      <div className={`grid grid-cols-1 ${currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        <Link
          to="/new"
          className="group bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-6 rounded-xl text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Plus size={20} />
                <h3 className="font-semibold">New Request</h3>
              </div>
              <p className="text-sm text-blue-100 dark:text-blue-200">Submit a simulation request</p>
            </div>
            <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
          </div>
        </Link>

        {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
          <Link
            to="/analytics"
            className="group bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-6 rounded-xl text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={20} />
                  <h3 className="font-semibold">Analytics</h3>
                </div>
                <p className="text-sm text-purple-100 dark:text-purple-200">View detailed insights</p>
              </div>
              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
            </div>
          </Link>
        )}

        <Link
          to="/projects"
          className="group bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 p-6 rounded-xl text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban size={20} />
                <h3 className="font-semibold">Projects</h3>
              </div>
              <p className="text-sm text-green-100 dark:text-green-200">Manage hour buckets</p>
            </div>
            <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
          </div>
        </Link>
      </div>

      {/* At-a-Glance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={stats.total} icon={Activity} color="text-blue-500" to="/requests" />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={Clock}
          color="text-indigo-500"
          to={`/requests?status=${RequestStatus.IN_PROGRESS},${RequestStatus.ENGINEERING_REVIEW},${RequestStatus.DISCUSSION}`}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          color="text-green-500"
          to={`/requests?status=${RequestStatus.COMPLETED},${RequestStatus.ACCEPTED}`}
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          icon={AlertOctagon}
          color="text-yellow-500"
          to={`/requests?status=${RequestStatus.SUBMITTED},${RequestStatus.MANAGER_REVIEW}`}
        />
      </div>

      {/* Personal Overview - Not shown for End-Users */}
      {currentUser.role !== UserRole.USER && (stats.needsAttention > 0 || stats.assignedToMe > 0 || stats.myRequests > 0) && (
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-slate-900/50 dark:to-slate-800/50 border border-orange-200 dark:border-orange-900/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-orange-600 dark:text-orange-400" size={20} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Work</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.needsAttention > 0 && (
              <Link
                to="/requests?filter=needs-attention"
                className="group bg-white dark:bg-slate-900 p-4 rounded-lg border border-orange-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-600 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.needsAttention}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Needs Attention</p>
                  </div>
                  <AlertOctagon className="text-orange-400 dark:text-orange-600 opacity-50" size={32} />
                </div>
              </Link>
            )}
            {currentUser.role === UserRole.ENGINEER && stats.assignedToMe > 0 && (
              <Link
                to="/requests?filter=assigned-to-me"
                className="group bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.assignedToMe}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Assigned to Me</p>
                  </div>
                  <Activity className="text-blue-400 dark:text-blue-600 opacity-50" size={32} />
                </div>
              </Link>
            )}
            <Link
              to="/requests?filter=my-requests"
              className="group bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.myRequests}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">My Requests</p>
                </div>
                <Activity className="text-purple-400 dark:text-purple-600 opacity-50" size={32} />
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Project Health Overview */}
      {projectStats.active > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Health</h3>
            </div>
            <Link
              to="/projects"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projectStats.active}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projectStats.totalBudget.toLocaleString()}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Hours Used</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projectStats.usedBudget.toLocaleString()}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Avg. Utilization</p>
              <p className={`text-2xl font-bold ${
                projectStats.avgUtilization > 80 ? 'text-red-600 dark:text-red-400' :
                projectStats.avgUtilization > 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-green-600 dark:text-green-400'
              }`}>{projectStats.avgUtilization}%</p>
            </div>
          </div>

          {/* Projects Near Deadline */}
          {nearDeadlineProjects.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-800">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                <span className="text-yellow-600 dark:text-yellow-400">⚠️</span> {nearDeadlineProjects.length} project{nearDeadlineProjects.length !== 1 ? 's' : ''} approaching deadline
              </p>
              <div className="flex flex-wrap gap-2">
                {nearDeadlineProjects.slice(0, 3).map((project: any) => (
                  <Link
                    key={project.id}
                    to="/projects"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>
                    <span className="text-yellow-700 dark:text-yellow-400">({project.days_until_deadline}d)</span>
                  </Link>
                ))}
                {nearDeadlineProjects.length > 3 && (
                  <span className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400">
                    +{nearDeadlineProjects.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Request Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                  borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb',
                  color: theme === 'dark' ? '#fff' : '#111827',
                  borderRadius: '8px',
                  boxShadow: theme === 'dark' ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                itemStyle={{ color: theme === 'dark' ? '#fff' : '#111827' }}
                cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f3f4f6' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <Link
              to="/requests"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {requests.slice(0, 5).map(req => {
              const statusColor = STATUS_INDICATOR_COLORS[req.status as keyof typeof STATUS_INDICATOR_COLORS] || STATUS_INDICATOR_COLORS.DEFAULT;
              return (
                <Link
                  key={req.id}
                  to={`/requests/${req.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800/50 hover:border-blue-500/50 hover:bg-gray-100 dark:hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{req.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 ml-2 flex-shrink-0">{req.status}</span>
                </Link>
              );
            })}
            {requests.length === 0 && <p className="text-gray-500 dark:text-slate-500 text-sm text-center py-8">No recent activity.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};