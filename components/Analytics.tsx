import React, { useState } from 'react';
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
  Download,
} from 'lucide-react';

const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'completion' | 'allocation'>('overview');

  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats(dateRange);
  const { data: completionAnalysis, isLoading: completionLoading } = useCompletionAnalysis();
  const { data: allocationAnalysis, isLoading: allocationLoading } = useAllocationAnalysis();

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
  };

  const clearDateRange = () => {
    setDateRange({});
  };

  if (statsLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart className="w-8 h-8 text-blue-500" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-600 mt-1">Insights and performance metrics</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-2 items-center">
          <Calendar className="w-5 h-5 text-slate-500" />
          <input
            type="date"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            value={dateRange.startDate || ''}
            onChange={(e) => handleDateRangeChange(e.target.value, dateRange.endDate || '')}
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            value={dateRange.endDate || ''}
            onChange={(e) => handleDateRangeChange(dateRange.startDate || '', e.target.value)}
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <button
              onClick={clearDateRange}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Overview
          {activeTab === 'overview' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('completion')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'completion'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Completion Time
          {activeTab === 'completion' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={`relative px-4 py-2 font-medium transition-colors ${
            activeTab === 'allocation'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Hour Allocation
          {activeTab === 'allocation' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardStats && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Activity className="w-6 h-6" />}
              label="Total Requests"
              value={dashboardStats.overview.totalRequests}
              color="blue"
              subtitle={`${dashboardStats.overview.activeRequests} active`}
            />
            <MetricCard
              icon={<Briefcase className="w-6 h-6" />}
              label="Total Projects"
              value={dashboardStats.overview.totalProjects}
              color="purple"
              subtitle={`${dashboardStats.overview.activeProjects} active`}
            />
            <MetricCard
              icon={<Users className="w-6 h-6" />}
              label="Total Users"
              value={dashboardStats.overview.totalUsers}
              color="green"
            />
            <MetricCard
              icon={<Clock className="w-6 h-6" />}
              label="Hours Allocated"
              value={`${dashboardStats.overview.totalHoursAllocated.toFixed(1)}h`}
              color="orange"
              subtitle={`${dashboardStats.overview.totalHoursUsed.toFixed(1)}h used`}
            />
          </div>

          {/* Average Metrics */}
          {dashboardStats.averageMetrics && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Average Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg. Completion Time</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {dashboardStats.averageMetrics.averageCompletionTimeDays?.toFixed(1) || 'N/A'}{' '}
                    <span className="text-sm text-slate-500">days</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg. Hours per Request</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {dashboardStats.averageMetrics.averageHoursPerRequest?.toFixed(1) || 'N/A'}{' '}
                    <span className="text-sm text-slate-500">hours</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg. Response Time</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {dashboardStats.averageMetrics.averageResponseTime?.toFixed(1) || 'N/A'}{' '}
                    <span className="text-sm text-slate-500">hours</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Requests by Status */}
          {dashboardStats.requestsByStatus && dashboardStats.requestsByStatus.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Requests by Status</h2>
              <div className="space-y-3">
                {dashboardStats.requestsByStatus.map((item) => (
                  <div key={item.status} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium text-slate-700">{item.status}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <div className="text-sm font-medium text-slate-700 w-16 text-right">
                          {item.count} ({item.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests by Priority */}
          {dashboardStats.requestsByPriority && dashboardStats.requestsByPriority.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Requests by Priority</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {dashboardStats.requestsByPriority.map((item) => {
                  const colors = {
                    Critical: 'bg-red-100 text-red-700 border-red-300',
                    High: 'bg-orange-100 text-orange-700 border-orange-300',
                    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                    Low: 'bg-green-100 text-green-700 border-green-300',
                  };
                  return (
                    <div
                      key={item.priority}
                      className={`p-4 rounded-lg border ${colors[item.priority as keyof typeof colors] || 'bg-slate-100 text-slate-700 border-slate-300'}`}
                    >
                      <div className="text-2xl font-bold">{item.count}</div>
                      <div className="text-sm font-medium mt-1">{item.priority}</div>
                      <div className="text-xs mt-1">{item.percentage.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project Utilization */}
          {dashboardStats.projectUtilization && dashboardStats.projectUtilization.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Project Utilization</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        Project
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        Code
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Total Hours
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Used Hours
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Available
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        Utilization
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.projectUtilization.slice(0, 10).map((project) => (
                      <tr key={project.projectId} className="border-b border-slate-100">
                        <td className="py-3 px-4 text-sm text-slate-800">
                          {project.projectName}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {project.projectCode}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {project.totalHours.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {project.usedHours.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {project.availableHours.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden max-w-[100px]">
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
                            <span className="text-sm font-medium text-slate-700 w-12">
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

          {/* Engineer Workload */}
          {dashboardStats.engineerWorkload && dashboardStats.engineerWorkload.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Engineer Workload</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        Engineer
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Active Requests
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Completed
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Hours Allocated
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Hours Logged
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                        Avg. Completion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.engineerWorkload.map((engineer) => (
                      <tr key={engineer.engineerId} className="border-b border-slate-100">
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">
                          {engineer.engineerName}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {engineer.assignedRequests}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {engineer.completedRequests}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {engineer.totalHoursAllocated.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-800">
                          {engineer.totalHoursLogged.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-600">
                          {engineer.averageCompletionTime
                            ? `${engineer.averageCompletionTime.toFixed(1)} days`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Vendors */}
          {dashboardStats.topVendors && dashboardStats.topVendors.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Top Vendors by Requests</h2>
              <div className="space-y-3">
                {dashboardStats.topVendors.slice(0, 5).map((vendor, index) => (
                  <div key={vendor.vendor} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{vendor.vendor}</div>
                      <div className="text-xs text-slate-500">
                        {vendor.requestCount} requests • {vendor.totalHours.toFixed(1)}h total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, subtitle }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
      <div className={`inline-flex p-3 rounded-lg ${colorClasses[color]} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-600 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
};

// Completion Time Analysis Tab
const CompletionTimeTab: React.FC<{ data: any; isLoading: boolean }> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div className="text-center py-12">Loading completion analysis...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 border border-slate-200 text-center">
        <p className="text-slate-600">No completion data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Time-to-Completion Analysis by Priority
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Priority</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Requests
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Avg. Days
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Min Days
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Max Days
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Median Days
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.priority} className="border-b border-slate-100">
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      row.priority === 'Critical'
                        ? 'bg-red-100 text-red-700'
                        : row.priority === 'High'
                          ? 'bg-orange-100 text-orange-700'
                          : row.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {row.priority}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-800">
                  {row.totalRequests}
                </td>
                <td className="py-3 px-4 text-sm text-right font-medium text-slate-800">
                  {row.averageDays.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-600">
                  {row.minDays.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-600">
                  {row.maxDays.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-600">
                  {row.medianDays.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Hour Allocation Analysis Tab
const AllocationAnalysisTab: React.FC<{ data: any; isLoading: boolean }> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="text-center py-12">Loading allocation analysis...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 border border-slate-200 text-center">
        <p className="text-slate-600">No allocation data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Hour Allocation vs Actual Usage (Top 20)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Request</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Priority</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Allocated
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actual</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Variance
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">
                Usage %
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.requestId} className="border-b border-slate-100">
                <td className="py-3 px-4 text-sm text-slate-800 max-w-xs truncate">
                  {row.title}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      row.priority === 'Critical'
                        ? 'bg-red-100 text-red-700'
                        : row.priority === 'High'
                          ? 'bg-orange-100 text-orange-700'
                          : row.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {row.priority}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-800">
                  {row.allocatedHours.toFixed(1)}h
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-800">
                  {row.actualHours.toFixed(1)}h
                </td>
                <td
                  className={`py-3 px-4 text-sm text-right font-medium ${
                    row.variance > 0
                      ? 'text-red-600'
                      : row.variance < 0
                        ? 'text-green-600'
                        : 'text-slate-600'
                  }`}
                >
                  {row.variance > 0 ? '+' : ''}
                  {row.variance.toFixed(1)}h
                </td>
                <td className="py-3 px-4 text-sm text-right text-slate-700">
                  {row.usagePercentage.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Analytics;
