/**
 * Analytics components barrel export
 *
 * This module exports all analytics sub-components for easy importing
 * throughout the application.
 */

export { default as AnalyticsHeader } from './AnalyticsHeader';
export { default as MetricsCards } from './MetricsCards';
export { default as StatusDistributionChart } from './StatusDistributionChart';
export { default as PriorityDistributionChart } from './PriorityDistributionChart';
export { default as TrendsChart } from './TrendsChart';
export { default as ProjectUtilizationChart } from './ProjectUtilizationChart';
export { default as EngineerWorkloadChart } from './EngineerWorkloadChart';
export { default as VendorDistributionChart } from './VendorDistributionChart';
export { default as CompletionTimeTable } from './CompletionTimeTable';
export { default as HourAllocationTable } from './HourAllocationTable';

// Export utility function for priority colors
export { getPriorityColors } from './PriorityDistributionChart';

// Export types
export type {
  DateRange,
  AnalyticsTab,
  ChartDataPoint,
  DashboardStats,
  DashboardOverview,
  RequestsByStatus,
  RequestsByPriority,
  AverageMetrics,
  RequestTrend,
  ProjectUtilization,
  EngineerWorkload,
  VendorDistribution,
  CompletionAnalysis,
  AllocationAnalysis,
  StatusColors,
  PriorityColors,
  MetricCardConfig,
} from './types';
