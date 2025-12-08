/**
 * Shared types and interfaces for Analytics components
 */

/**
 * Request status with associated display colors
 */
export interface StatusColors {
  bg: string;
  bar: string;
  text: string;
}

/**
 * Priority level with associated display colors
 */
export interface PriorityColors {
  bg: string;
  text: string;
  border: string;
}

/**
 * Dashboard overview statistics
 */
export interface DashboardOverview {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  activeProjects: number;
  totalProjects: number;
  totalHoursUsed: number;
  totalHoursAllocated: number;
}

/**
 * Request count by status
 */
export interface RequestsByStatus {
  status: string;
  count: number;
}

/**
 * Request count by priority level
 */
export interface RequestsByPriority {
  priority: string;
  count: number;
  percentage: number;
}

/**
 * Average performance metrics
 */
export interface AverageMetrics {
  averageCompletionTimeDays?: number;
  averageHoursPerRequest?: number;
  averageResponseTime?: number;
}

/**
 * Request trend data point
 */
export interface RequestTrend {
  date: string;
  created: number;
  completed: number;
}

/**
 * Project hour utilization
 */
export interface ProjectUtilization {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalHours: number;
  usedHours: number;
  utilizationPercentage: number;
}

/**
 * Engineer workload statistics
 */
export interface EngineerWorkload {
  engineerId: string;
  engineerName: string;
  assignedRequests: number;
  completedRequests: number;
  totalHoursLogged: number;
}

/**
 * Vendor request count
 */
export interface VendorDistribution {
  vendor: string;
  requestCount: number;
}

/**
 * Complete dashboard statistics
 */
export interface DashboardStats {
  overview: DashboardOverview;
  requestsByStatus: RequestsByStatus[];
  requestsByPriority: RequestsByPriority[];
  averageMetrics: AverageMetrics;
  requestTrends: RequestTrend[];
  projectUtilization: ProjectUtilization[];
  engineerWorkload: EngineerWorkload[];
  topVendors: VendorDistribution[];
}

/**
 * Completion time analysis by priority
 */
export interface CompletionAnalysis {
  priority: string;
  totalRequests: number;
  averageDays: number;
  minDays: number;
  maxDays: number;
  medianDays: number;
}

/**
 * Hour allocation variance analysis
 */
export interface AllocationAnalysis {
  requestId: string;
  title: string;
  priority: string;
  allocatedHours: number;
  actualHours: number;
  variance: number;
  usagePercentage: number;
}

/**
 * Date range filter
 */
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Chart data point for donut/pie charts
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  color: string;
}

/**
 * Metric card configuration
 */
export interface MetricCardConfig {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange';
  subtitle?: string;
  trend?: React.ReactNode;
  progress?: number;
}

/**
 * Tab type for analytics view
 */
export type AnalyticsTab = 'overview' | 'completion' | 'allocation';
