import React, { useState, useMemo } from 'react';
import {
  useDashboardStats,
  useCompletionAnalysis,
  useAllocationAnalysis,
} from '../lib/api/hooks';
import { AlertTriangle } from 'lucide-react';
import {
  AnalyticsHeader,
  MetricsCards,
  StatusDistributionChart,
  PriorityDistributionChart,
  TrendsChart,
  ProjectUtilizationChart,
  EngineerWorkloadChart,
  VendorDistributionChart,
  CompletionTimeTable,
  HourAllocationTable,
  DateRange,
  AnalyticsTab,
  ChartDataPoint,
} from './analytics/index';

/**
 * Status color mapping for chart visualization
 */
const STATUS_COLOR_MAP: Record<string, string> = {
  Submitted: '#eab308',        // yellow
  'Manager Review': '#f97316', // orange
  'Engineering Review': '#3b82f6', // blue
  Discussion: '#06b6d4',       // cyan
  'In Progress': '#8b5cf6',    // violet
  Completed: '#22c55e',        // green
  'Revision Requested': '#f59e0b', // amber
  'Revision Approval': '#a3e635', // lime
  Accepted: '#10b981',         // emerald
  Denied: '#ef4444',           // red
};

/**
 * Main Analytics Dashboard Component
 *
 * Displays comprehensive analytics including:
 * - Overview metrics and trends
 * - Completion time analysis
 * - Hour allocation variance
 */
const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

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
    // Filter out "Accepted" status as it's only relevant for end-users
    return dashboardStats.requestsByStatus
      .filter((item: { status: string; count: number }) => item.status !== 'Accepted')
      .map((item: { status: string; count: number }): ChartDataPoint => ({
        label: item.status,
        value: item.count,
        color: STATUS_COLOR_MAP[item.status] || '#6b7280',
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
      <AnalyticsHeader
        dateRange={dateRange}
        activeTab={activeTab}
        onDateRangeChange={handleDateRangeChange}
        onClearDateRange={clearDateRange}
        onTabChange={setActiveTab}
      />

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardStats && (
        <div className="space-y-6">
          {/* Key Metrics Cards with Trends */}
          <MetricsCards
            overview={dashboardStats.overview}
            completionRate={completionRate}
            createdTrend={trendData.created}
            completedTrend={trendData.completed}
          />

          {/* Two Column Layout for Status and Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusDistributionChart data={statusChartData} />
            <TrendsChart metrics={dashboardStats.averageMetrics} />
          </div>

          {/* Requests by Priority */}
          <PriorityDistributionChart data={dashboardStats.requestsByPriority} />

          {/* Project Utilization */}
          <ProjectUtilizationChart data={dashboardStats.projectUtilization} limit={10} />

          {/* Two Column Layout for Engineer Workload and Top Vendors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EngineerWorkloadChart data={dashboardStats.engineerWorkload} limit={5} />
            <VendorDistributionChart data={dashboardStats.topVendors} limit={5} />
          </div>
        </div>
      )}

      {/* Completion Time Analysis Tab */}
      {activeTab === 'completion' && (
        <CompletionTimeTable data={completionAnalysis} isLoading={completionLoading} />
      )}

      {/* Hour Allocation Analysis Tab */}
      {activeTab === 'allocation' && (
        <HourAllocationTable data={allocationAnalysis} isLoading={allocationLoading} />
      )}
    </div>
  );
};

export default Analytics;
