import React, { useState, useMemo } from 'react';
import {
  useDashboardStats,
  useCompletionAnalysis,
  useAllocationAnalysis,
} from '../lib/api/hooks';
import {
  BarChart,
  TrendingUp,
  Clock,
  Users,
  Briefcase,
  Activity,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  Timer,
  Zap,
} from 'lucide-react';

// Status color mapping with proper workflow colors
const STATUS_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  Submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  'Feasibility Review': { bg: 'bg-purple-100 dark:bg-purple-900/30', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400' },
  'Resource Allocation': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', bar: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-400' },
  'Engineering Review': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', bar: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400' },
  Discussion: { bg: 'bg-amber-100 dark:bg-amber-900/30', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  'In Progress': { bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' },
  Completed: { bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  'Revision Requested': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' },
  'Revision Approval': { bg: 'bg-lime-100 dark:bg-lime-900/30', bar: 'bg-lime-500', text: 'text-lime-700 dark:text-lime-400' },
  Accepted: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  Denied: { bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
};

const getStatusColors = (status: string) => {
  return STATUS_COLORS[status] || { bg: 'bg-gray-100 dark:bg-slate-800', bar: 'bg-gray-500', text: 'text-gray-700 dark:text-slate-400' };
};

// Priority colors
const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-800' },
  Medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-800' },
  Low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-800' },
};

const getPriorityColors = (priority: string) => {
  return PRIORITY_COLORS[priority] || { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-400', border: 'border-gray-300 dark:border-slate-700' };
};

// Simple mini bar chart component
const MiniBarChart: React.FC<{ data: number[]; maxValue?: number; color?: string }> = ({
  data,
  maxValue,
  color = 'bg-blue-500'
}) => {
  const max = maxValue || Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, i) => (
        <div
          key={i}
          className={`w-1.5 ${color} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '2px' : '0' }}
          title={`${value}`}
        />
      ))}
    </div>
  );
};

// Donut chart component for status distribution
const DonutChart: React.FC<{
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}> = ({ data, size = 120 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Calculate segments with proper cumulative offsets
  let cumulativePercentage = 0;
  const segments = data.map((item) => {
    const percentage = total > 0 ? item.value / total : 0;
    const segment = {
      ...item,
      percentage,
      offset: cumulativePercentage,
    };
    cumulativePercentage += percentage;
    return segment;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          className="dark:stroke-slate-800"
        />
        {segments.map((segment, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="12"
            strokeDasharray={`${segment.percentage * circumference} ${circumference}`}
            strokeDashoffset={-segment.offset * circumference}
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{total}</div>
          <div className="text-xs text-gray-500 dark:text-slate-500">Total</div>
        </div>
      </div>
    </div>
  );
};

const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'completion' | 'allocation'>('overview');

  const { data: dashboardStats, isLoading: statsLoading, error: statsError } = useDashboardStats(dateRange);
  const { data: completionAnalysis, isLoading: completionLoading } = useCompletionAnalysis();
  const { data: allocationAnalysis, isLoading: allocationLoading } = useAllocationAnalysis();

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
  };

  const clearDateRange = () => {
    setDateRange({});
  };

  // Calculate trend data from request trends
  const trendData = useMemo(() => {
    if (!dashboardStats?.requestTrends) return { created: [], completed: [] };
    const trends = [...dashboardStats.requestTrends].reverse().slice(-14);
    return {
      created: trends.map(t => t.created),
      completed: trends.map(t => t.completed),
    };
  }, [dashboardStats?.requestTrends]);

  // Calculate completion rate
  const completionRate = useMemo(() => {
    if (!dashboardStats?.overview) return 0;
    const { totalRequests, completedRequests } = dashboardStats.overview;
    return totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
  }, [dashboardStats?.overview]);

  // Status chart data - using distinct hex colors for SVG stroke
  const statusChartData = useMemo(() => {
    if (!dashboardStats?.requestsByStatus) return [];
    const statusColorMap: Record<string, string> = {
      Submitted: '#eab308',        // yellow
      'Feasibility Review': '#f97316', // orange
      'Resource Allocation': '#ec4899', // pink
      'Engineering Review': '#3b82f6', // blue
      Discussion: '#06b6d4',       // cyan
      'In Progress': '#8b5cf6',    // violet
      Completed: '#22c55e',        // green
      'Revision Requested': '#f59e0b', // amber
      'Revision Approval': '#a3e635', // lime
      Denied: '#ef4444',           // red
    };
    // Filter out "Accepted" status as it's only relevant for end-users
    return dashboardStats.requestsByStatus
      .filter(item => item.status !== 'Accepted')
      .map(item => ({
        label: item.status,
        value: item.count,
        color: statusColorMap[item.status] || '#6b7280',
      }));
  }, [dashboardStats?.requestsByStatus]);

  if (statsLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">Failed to load analytics data.</p>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Insights and performance metrics</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <input
            type="date"
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            value={dateRange.startDate || ''}
            onChange={(e) => handleDateRangeChange(e.target.value, dateRange.endDate || '')}
          />
          <span className="text-gray-600 dark:text-slate-400">to</span>
          <input
            type="date"
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            value={dateRange.endDate || ''}
            onChange={(e) => handleDateRangeChange(dateRange.startDate || '', e.target.value)}
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <button
              onClick={clearDateRange}
              className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-300 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          Overview
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('completion')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'completion'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          Completion Time
          {activeTab === 'completion' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'allocation'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          Hour Allocation
          {activeTab === 'allocation' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
          )}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardStats && (
        <div className="space-y-6">
          {/* Key Metrics Cards with Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Activity className="w-6 h-6" />}
              label="Total Requests"
              value={dashboardStats.overview.totalRequests}
              color="blue"
              subtitle={`${dashboardStats.overview.activeRequests} active`}
              trend={trendData.created.length > 0 ? <MiniBarChart data={trendData.created} color="bg-blue-500" /> : undefined}
            />
            <MetricCard
              icon={<CheckCircle2 className="w-6 h-6" />}
              label="Completed"
              value={dashboardStats.overview.completedRequests}
              color="green"
              subtitle={`${completionRate.toFixed(1)}% completion rate`}
              trend={trendData.completed.length > 0 ? <MiniBarChart data={trendData.completed} color="bg-green-500" /> : undefined}
            />
            <MetricCard
              icon={<Briefcase className="w-6 h-6" />}
              label="Active Projects"
              value={dashboardStats.overview.activeProjects}
              color="purple"
              subtitle={`of ${dashboardStats.overview.totalProjects} total`}
            />
            <MetricCard
              icon={<Clock className="w-6 h-6" />}
              label="Hours Used"
              value={`${dashboardStats.overview.totalHoursUsed.toFixed(0)}h`}
              color="orange"
              subtitle={`of ${dashboardStats.overview.totalHoursAllocated.toFixed(0)}h allocated`}
              progress={dashboardStats.overview.totalHoursAllocated > 0
                ? (dashboardStats.overview.totalHoursUsed / dashboardStats.overview.totalHoursAllocated) * 100
                : 0}
            />
          </div>

          {/* Two Column Layout for Status and Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Requests by Status with Donut Chart */}
            {dashboardStats.requestsByStatus && dashboardStats.requestsByStatus.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Requests by Status</h2>
                <div className="flex items-start gap-6">
                  <DonutChart data={statusChartData} size={140} />
                  <div className="flex-1 space-y-2 max-h-[180px] overflow-y-auto">
                    {statusChartData.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 truncate">{item.label}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Average Metrics */}
            {dashboardStats.averageMetrics && (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  Performance Metrics
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Timer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-slate-400">Avg. Completion Time</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {dashboardStats.averageMetrics.averageCompletionTimeDays?.toFixed(1) || 'N/A'} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-slate-400">Avg. Hours per Request</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {dashboardStats.averageMetrics.averageHoursPerRequest?.toFixed(1) || 'N/A'}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-slate-400">Avg. Response Time</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {dashboardStats.averageMetrics.averageResponseTime?.toFixed(1) || 'N/A'}h
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Requests by Priority */}
          {dashboardStats.requestsByPriority && dashboardStats.requestsByPriority.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Requests by Priority</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dashboardStats.requestsByPriority.map((item) => {
                  const colors = getPriorityColors(item.priority);
                  const Icon = item.priority === 'High' ? AlertTriangle : item.priority === 'Medium' ? Minus : CheckCircle2;
                  return (
                    <div
                      key={item.priority}
                      className={`p-4 rounded-lg border ${colors.bg} ${colors.border} ${colors.text}`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium opacity-80">{item.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="text-3xl font-bold mt-2">{item.count}</div>
                      <div className="text-sm font-medium mt-1">{item.priority} Priority</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project Utilization */}
          {dashboardStats.projectUtilization && dashboardStats.projectUtilization.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Project Utilization</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Project
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Budget
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Used
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300 w-48">
                        Utilization
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.projectUtilization.slice(0, 10).map((project) => (
                      <tr key={project.projectId} className="border-b border-gray-200 dark:border-slate-800">
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {project.projectName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-500">{project.projectCode}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                          {project.totalHours.toFixed(0)}h
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                          {project.usedHours.toFixed(0)}h
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  project.utilizationPercentage > 90
                                    ? 'bg-red-500'
                                    : project.utilizationPercentage > 70
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(project.utilizationPercentage, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium w-12 text-right ${
                              project.utilizationPercentage > 90
                                ? 'text-red-600 dark:text-red-400'
                                : project.utilizationPercentage > 70
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-green-600 dark:text-green-400'
                            }`}>
                              {project.utilizationPercentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Two Column Layout for Engineer Workload and Top Vendors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engineer Workload */}
            {dashboardStats.engineerWorkload && dashboardStats.engineerWorkload.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  Engineer Workload
                </h2>
                <div className="space-y-4">
                  {dashboardStats.engineerWorkload.slice(0, 5).map((engineer) => (
                    <div key={engineer.engineerId} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {engineer.engineerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {engineer.engineerName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-500">
                          {engineer.assignedRequests} active • {engineer.completedRequests} completed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {engineer.totalHoursLogged.toFixed(0)}h
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-500">logged</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Vendors */}
            {dashboardStats.topVendors && dashboardStats.topVendors.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Vendors</h2>
                <div className="space-y-3">
                  {dashboardStats.topVendors.slice(0, 5).map((vendor, index) => {
                    const maxCount = dashboardStats.topVendors[0].requestCount;
                    const percentage = (vendor.requestCount / maxCount) * 100;
                    return (
                      <div key={vendor.vendor}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 dark:text-slate-600 w-4">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {vendor.vendor}
                            </span>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {vendor.requestCount} requests
                          </span>
                        </div>
                        <div className="ml-6 bg-gray-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Time Analysis Tab */}
      {activeTab === 'completion' && (
        <CompletionTimeTab data={completionAnalysis} isLoading={completionLoading} />
      )}

      {/* Hour Allocation Analysis Tab */}
      {activeTab === 'allocation' && (
        <AllocationAnalysisTab data={allocationAnalysis} isLoading={allocationLoading} />
      )}
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange';
  subtitle?: string;
  trend?: React.ReactNode;
  progress?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, subtitle, trend, progress }) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  };

  const progressColors = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div className={`inline-flex p-2.5 rounded-lg border ${colorClasses[color]}`}>{icon}</div>
        {trend && <div className="ml-2">{trend}</div>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{value}</div>
      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{subtitle}</div>}
      {progress !== undefined && (
        <div className="mt-3 bg-gray-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`${progressColors[color]} h-full rounded-full transition-all`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Completion Time Analysis Tab
const CompletionTimeTab: React.FC<{ data: any; isLoading: boolean }> = ({ data, isLoading }) => {
  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalRequests = data.reduce((sum: number, row: any) => sum + row.totalRequests, 0);
    const weightedAvg = data.reduce((sum: number, row: any) => sum + (row.averageDays * row.totalRequests), 0) / totalRequests;
    const fastestPriority = data.reduce((min: any, row: any) =>
      !min || row.averageDays < min.averageDays ? row : min, null);
    const slowestPriority = data.reduce((max: any, row: any) =>
      !max || row.averageDays > max.averageDays ? row : max, null);
    return { totalRequests, weightedAvg, fastestPriority, slowestPriority };
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">Loading completion analysis...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-12 border border-gray-200 dark:border-slate-800 text-center">
        <Clock className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-slate-400">No completion data available yet.</p>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">Complete some requests to see time analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Total Completed</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalRequests}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Avg. Completion</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.weightedAvg.toFixed(1)} days</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-green-500" />
              <div className="text-sm text-gray-600 dark:text-slate-400">Fastest</div>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {summaryStats.fastestPriority.priority}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500">{summaryStats.fastestPriority.averageDays.toFixed(1)} days avg</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
              <div className="text-sm text-gray-600 dark:text-slate-400">Slowest</div>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {summaryStats.slowestPriority.priority}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500">{summaryStats.slowestPriority.averageDays.toFixed(1)} days avg</div>
          </div>
        </div>
      )}

      {/* Visual Comparison */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
          Completion Time by Priority
        </h2>
        <div className="space-y-6">
          {data.map((row: any) => {
            const maxDays = Math.max(...data.map((d: any) => d.maxDays));
            const colors = getPriorityColors(row.priority);
            return (
              <div key={row.priority}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {row.priority}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-slate-400">{row.totalRequests} requests</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{row.averageDays.toFixed(1)} days</span>
                </div>
                <div className="relative h-8 bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                  {/* Range bar (min to max) */}
                  <div
                    className="absolute h-full bg-gray-300 dark:bg-slate-700 rounded"
                    style={{
                      left: `${(row.minDays / maxDays) * 100}%`,
                      width: `${((row.maxDays - row.minDays) / maxDays) * 100}%`,
                    }}
                  />
                  {/* Average marker */}
                  <div
                    className={`absolute top-1 bottom-1 w-1 rounded ${colors.bg.replace('bg-', 'bg-').replace('/30', '')} ${
                      row.priority === 'High' ? 'bg-red-500' : row.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ left: `${(row.averageDays / maxDays) * 100}%` }}
                  />
                  {/* Median marker */}
                  <div
                    className="absolute top-2 bottom-2 w-0.5 bg-blue-600 rounded"
                    style={{ left: `${(row.medianDays / maxDays) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-slate-500">
                  <span>Min: {row.minDays.toFixed(1)}d</span>
                  <span>Median: {row.medianDays.toFixed(1)}d</span>
                  <span>Max: {row.maxDays.toFixed(1)}d</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Detailed Statistics</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Priority</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Requests</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Avg. Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Min Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Max Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Median Days</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any) => {
                const colors = getPriorityColors(row.priority);
                return (
                  <tr key={row.priority} className="border-b border-gray-200 dark:border-slate-800">
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">{row.totalRequests}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-gray-900 dark:text-white">{row.averageDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.minDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.maxDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.medianDays.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Hour Allocation Analysis Tab
const AllocationAnalysisTab: React.FC<{ data: any; isLoading: boolean }> = ({ data, isLoading }) => {
  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalAllocated = data.reduce((sum: number, row: any) => sum + row.allocatedHours, 0);
    const totalActual = data.reduce((sum: number, row: any) => sum + row.actualHours, 0);
    const hasEstimates = totalAllocated > 0;
    const overBudget = data.filter((row: any) => row.variance > 0).length;
    const underBudget = data.filter((row: any) => row.variance < 0).length;
    const onTarget = data.filter((row: any) => row.variance === 0 && row.allocatedHours > 0).length;
    const avgAccuracy = totalAllocated > 0 ? (totalActual / totalAllocated) * 100 : 0;
    const requestCount = data.length;
    const avgHoursPerRequest = requestCount > 0 ? totalActual / requestCount : 0;
    return { totalAllocated, totalActual, overBudget, underBudget, onTarget, avgAccuracy, hasEstimates, requestCount, avgHoursPerRequest };
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">Loading allocation analysis...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-12 border border-gray-200 dark:border-slate-800 text-center">
        <BarChart className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-slate-400">No allocation data available yet.</p>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">Complete requests with time entries to see hour allocation analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Total Hours Logged</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {summaryStats.totalActual.toFixed(0)}h
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">across {summaryStats.requestCount} requests</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Avg Hours per Request</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {summaryStats.avgHoursPerRequest.toFixed(1)}h
            </div>
          </div>
          {summaryStats.hasEstimates ? (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="text-sm text-gray-600 dark:text-slate-400">Estimation Accuracy</div>
                <div className={`text-2xl font-bold mt-1 ${
                  summaryStats.avgAccuracy >= 90 && summaryStats.avgAccuracy <= 110
                    ? 'text-green-600 dark:text-green-400'
                    : summaryStats.avgAccuracy >= 80 && summaryStats.avgAccuracy <= 120
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {summaryStats.avgAccuracy.toFixed(0)}%
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  <div className="text-sm text-gray-600 dark:text-slate-400">Over Budget</div>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{summaryStats.overBudget}</div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="text-sm text-gray-600 dark:text-slate-400">Completed Requests</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {summaryStats.requestCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <div className="text-sm text-gray-600 dark:text-slate-400">No Estimates</div>
                </div>
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">Add estimates to track accuracy</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Visual Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
          {summaryStats?.hasEstimates ? 'Allocated vs Actual Hours' : 'Hours Logged by Request'}
        </h2>
        <div className="space-y-4">
          {(() => {
            const maxActual = Math.max(...data.slice(0, 10).map((r: any) => r.actualHours), 1);
            return data.slice(0, 10).map((row: any) => {
              const hasEstimate = row.allocatedHours > 0;
              const maxHours = hasEstimate ? Math.max(row.allocatedHours, row.actualHours) : maxActual;
              const allocatedWidth = hasEstimate ? (row.allocatedHours / maxHours) * 100 : 0;
              const actualWidth = (row.actualHours / maxHours) * 100;
              return (
                <div key={row.requestId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-md">{row.title}</span>
                    {hasEstimate ? (
                      <span className={`text-sm font-medium ${
                        row.variance > 0 ? 'text-red-600 dark:text-red-400' : row.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'
                      }`}>
                        {row.variance > 0 ? '+' : ''}{row.variance.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {row.actualHours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                  <div className="relative h-6 bg-gray-100 dark:bg-slate-800 rounded overflow-hidden">
                    {/* Allocated bar (background) - only show if has estimate */}
                    {hasEstimate && (
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-200 dark:bg-blue-900/50 rounded"
                        style={{ width: `${allocatedWidth}%` }}
                      />
                    )}
                    {/* Actual bar (foreground) */}
                    <div
                      className={`absolute inset-y-0 left-0 rounded ${
                        hasEstimate
                          ? row.variance > 0 ? 'bg-red-500' : row.variance < 0 ? 'bg-green-500' : 'bg-blue-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${actualWidth}%` }}
                    />
                    {/* Labels inside */}
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                      <span className="text-xs font-medium text-white drop-shadow">{row.actualHours.toFixed(0)}h</span>
                      {hasEstimate && (
                        <span className="text-xs text-gray-600 dark:text-slate-400">{row.allocatedHours.toFixed(0)}h planned</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {summaryStats?.hasEstimates ? 'All Requests (Top 20 by Variance)' : 'Completed Requests with Time Logged'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Request</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Priority</th>
                {summaryStats?.hasEstimates && (
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Allocated</th>
                )}
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Hours Logged</th>
                {summaryStats?.hasEstimates && (
                  <>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Variance</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Usage %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row: any) => {
                const colors = getPriorityColors(row.priority);
                const hasEstimate = row.allocatedHours > 0;
                return (
                  <tr key={row.requestId} className="border-b border-gray-200 dark:border-slate-800">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">{row.title}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {row.priority}
                      </span>
                    </td>
                    {summaryStats?.hasEstimates && (
                      <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                        {hasEstimate ? `${row.allocatedHours.toFixed(1)}h` : '-'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">{row.actualHours.toFixed(1)}h</td>
                    {summaryStats?.hasEstimates && (
                      <>
                        <td className={`py-3 px-4 text-sm text-right font-medium ${
                          hasEstimate
                            ? row.variance > 0 ? 'text-red-600 dark:text-red-400' : row.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'
                            : 'text-gray-400 dark:text-slate-600'
                        }`}>
                          {hasEstimate ? `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {hasEstimate ? (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              row.usagePercentage > 110
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : row.usagePercentage < 90
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-400'
                            }`}>
                              {row.usagePercentage.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-600">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
