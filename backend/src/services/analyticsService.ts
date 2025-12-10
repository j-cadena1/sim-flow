/**
 * @fileoverview Analytics Service
 *
 * Provides comprehensive analytics and reporting for the Sim RQ dashboard.
 * Aggregates data from requests, projects, users, and time entries.
 *
 * Key Metrics:
 * - Overview statistics (counts, totals)
 * - Request distribution by status and priority
 * - Request trends over time
 * - Project utilization (budget vs. used hours)
 * - Engineer workload distribution
 * - Vendor analysis
 * - Completion time analysis
 * - Hour allocation accuracy
 *
 * @module services/analyticsService
 */

import pool from '../db';
import { logger } from '../middleware/logger';

/**
 * Comprehensive dashboard statistics structure
 */
export interface DashboardStats {
  overview: {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    totalProjects: number;
    activeProjects: number;
    totalUsers: number;
    totalHoursAllocated: number;
    totalHoursUsed: number;
  };
  requestsByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  requestsByPriority: Array<{
    priority: string;
    count: number;
    percentage: number;
  }>;
  requestTrends: Array<{
    date: string;
    created: number;
    completed: number;
    inProgress: number;
  }>;
  projectUtilization: Array<{
    projectId: number;
    projectName: string;
    projectCode: string;
    totalHours: number;
    usedHours: number;
    availableHours: number;
    utilizationPercentage: number;
  }>;
  engineerWorkload: Array<{
    engineerId: string;
    engineerName: string;
    assignedRequests: number;
    completedRequests: number;
    totalHoursAllocated: number;
    totalHoursLogged: number;
    averageCompletionTime: number | null;
  }>;
  topVendors: Array<{
    vendor: string;
    requestCount: number;
    totalHours: number;
  }>;
  averageMetrics: {
    averageCompletionTimeDays: number | null;
    averageHoursPerRequest: number | null;
    averageResponseTime: number | null;
  };
}

/**
 * Get comprehensive dashboard statistics
 *
 * Aggregates data from multiple tables to provide a complete overview
 * of system activity, project utilization, and team performance.
 *
 * @param startDate - Optional start date for filtering requests
 * @param endDate - Optional end date for filtering requests
 * @returns Complete dashboard statistics object
 */
export const getDashboardStats = async (
  startDate?: Date,
  endDate?: Date
): Promise<DashboardStats> => {
  try {
    const dateFilter = startDate && endDate
      ? `WHERE created_at BETWEEN $1 AND $2`
      : '';
    const dateParams = startDate && endDate ? [startDate, endDate] : [];

    // Overview stats
    const overviewQuery = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status NOT IN ('Completed', 'Cancelled')) as active_requests,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed_requests
      FROM requests
      ${dateFilter}
    `;

    const projectsQuery = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'Active') as active_projects,
        COALESCE(SUM(total_hours), 0) as total_hours_budget,
        COALESCE(SUM(used_hours), 0) as total_hours_used
      FROM projects
    `;

    const usersQuery = `SELECT COUNT(*) as total_users FROM users`;

    const [overviewResult, projectsResult, usersResult] = await Promise.all([
      pool.query(overviewQuery, dateParams),
      pool.query(projectsQuery),
      pool.query(usersQuery),
    ]);

    const overview = {
      totalRequests: parseInt(overviewResult.rows[0].total_requests) || 0,
      activeRequests: parseInt(overviewResult.rows[0].active_requests) || 0,
      completedRequests: parseInt(overviewResult.rows[0].completed_requests) || 0,
      totalProjects: parseInt(projectsResult.rows[0].total_projects) || 0,
      activeProjects: parseInt(projectsResult.rows[0].active_projects) || 0,
      totalUsers: parseInt(usersResult.rows[0].total_users) || 0,
      totalHoursAllocated: parseFloat(projectsResult.rows[0].total_hours_budget) || 0,
      totalHoursUsed: parseFloat(projectsResult.rows[0].total_hours_used) || 0,
    };

    // Requests by status
    const statusQuery = `
      SELECT
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM requests ${dateFilter}), 0), 2) as percentage
      FROM requests
      ${dateFilter}
      GROUP BY status
      ORDER BY count DESC
    `;
    const statusResult = await pool.query(statusQuery, dateParams);
    const requestsByStatus = statusResult.rows.map((row) => ({
      status: row.status,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage) || 0,
    }));

    // Requests by priority
    const priorityQuery = `
      SELECT
        priority,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM requests ${dateFilter}), 0), 2) as percentage
      FROM requests
      ${dateFilter}
      GROUP BY priority
      ORDER BY
        CASE priority
          WHEN 'High' THEN 1
          WHEN 'Medium' THEN 2
          WHEN 'Low' THEN 3
        END
    `;
    const priorityResult = await pool.query(priorityQuery, dateParams);
    const requestsByPriority = priorityResult.rows.map((row) => ({
      priority: row.priority,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage) || 0,
    }));

    // Request trends (last 30 days)
    const trendsQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status != 'Completed') as created,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed,
        COUNT(*) FILTER (WHERE status IN ('Engineering Review', 'In Progress', 'Discussion')) as in_progress
      FROM requests
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;
    const trendsResult = await pool.query(trendsQuery);
    const requestTrends = trendsResult.rows.map((row) => ({
      date: row.date,
      created: parseInt(row.created) || 0,
      completed: parseInt(row.completed) || 0,
      inProgress: parseInt(row.in_progress) || 0,
    }));

    // Project utilization
    const utilizationQuery = `
      SELECT
        id as project_id,
        name as project_name,
        code as project_code,
        total_hours,
        used_hours,
        (total_hours - used_hours) as available_hours,
        CASE
          WHEN total_hours > 0 THEN ROUND((used_hours * 100.0 / total_hours), 2)
          ELSE 0
        END as utilization_percentage
      FROM projects
      WHERE status = 'Active'
      ORDER BY utilization_percentage DESC
    `;
    const utilizationResult = await pool.query(utilizationQuery);
    const projectUtilization = utilizationResult.rows.map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      projectCode: row.project_code,
      totalHours: parseFloat(row.total_hours) || 0,
      usedHours: parseFloat(row.used_hours) || 0,
      availableHours: parseFloat(row.available_hours) || 0,
      utilizationPercentage: parseFloat(row.utilization_percentage) || 0,
    }));

    // Engineer workload
    const workloadQuery = `
      SELECT
        u.id as engineer_id,
        u.name as engineer_name,
        COUNT(r.id) FILTER (WHERE r.status NOT IN ('Completed', 'Cancelled', 'Denied')) as assigned_requests,
        COUNT(r.id) FILTER (WHERE r.status = 'Completed') as completed_requests,
        COALESCE(SUM(r.estimated_hours) FILTER (WHERE r.status NOT IN ('Completed', 'Cancelled', 'Denied')), 0) as total_hours_allocated,
        COALESCE(SUM(te.hours), 0) as total_hours_logged,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 86400) FILTER (WHERE r.status = 'Completed') as avg_completion_days
      FROM users u
      LEFT JOIN requests r ON r.assigned_to = u.id
      LEFT JOIN time_entries te ON te.user_id = u.id
      WHERE u.role = 'Engineer'
      GROUP BY u.id, u.name
      HAVING COUNT(r.id) > 0
      ORDER BY assigned_requests DESC
    `;
    const workloadResult = await pool.query(workloadQuery);
    const engineerWorkload = workloadResult.rows.map((row) => ({
      engineerId: row.engineer_id,
      engineerName: row.engineer_name,
      assignedRequests: parseInt(row.assigned_requests) || 0,
      completedRequests: parseInt(row.completed_requests) || 0,
      totalHoursAllocated: parseFloat(row.total_hours_allocated) || 0,
      totalHoursLogged: parseFloat(row.total_hours_logged) || 0,
      averageCompletionTime: row.avg_completion_days ? parseFloat(row.avg_completion_days) : null,
    }));

    // Top vendors
    const vendorsQuery = `
      SELECT
        vendor,
        COUNT(*) as request_count,
        COALESCE(SUM(estimated_hours), 0) as total_hours
      FROM requests
      ${dateFilter}
      GROUP BY vendor
      ORDER BY request_count DESC
      LIMIT 10
    `;
    const vendorsResult = await pool.query(vendorsQuery, dateParams);
    const topVendors = vendorsResult.rows.map((row) => ({
      vendor: row.vendor,
      requestCount: parseInt(row.request_count) || 0,
      totalHours: parseFloat(row.total_hours) || 0,
    }));

    // Average metrics
    const metricsQuery = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) FILTER (WHERE status = 'Completed') as avg_completion_days,
        AVG(estimated_hours) as avg_hours_per_request,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status != 'Pending') as avg_response_hours
      FROM requests
      ${dateFilter}
    `;
    const metricsResult = await pool.query(metricsQuery, dateParams);
    const averageMetrics = {
      averageCompletionTimeDays: metricsResult.rows[0].avg_completion_days
        ? parseFloat(metricsResult.rows[0].avg_completion_days)
        : null,
      averageHoursPerRequest: metricsResult.rows[0].avg_hours_per_request
        ? parseFloat(metricsResult.rows[0].avg_hours_per_request)
        : null,
      averageResponseTime: metricsResult.rows[0].avg_response_hours
        ? parseFloat(metricsResult.rows[0].avg_response_hours)
        : null,
    };

    return {
      overview,
      requestsByStatus,
      requestsByPriority,
      requestTrends,
      projectUtilization,
      engineerWorkload,
      topVendors,
      averageMetrics,
    };
  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    throw error;
  }
};

/**
 * Get time-to-completion analysis by priority
 *
 * Analyzes completed requests to understand how long requests take
 * to complete based on priority level. Includes statistical measures.
 *
 * @returns Array of completion time statistics grouped by priority
 */
interface CompletionTimeStats {
  priority: string;
  totalRequests: number;
  averageDays: number;
  minDays: number;
  maxDays: number;
  medianDays: number;
}

export const getTimeToCompletionAnalysis = async (): Promise<CompletionTimeStats[]> => {
  const query = `
    SELECT
      priority,
      COUNT(*) as total_requests,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days,
      MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as min_days,
      MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as max_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as median_days
    FROM requests
    WHERE status IN ('Completed', 'Accepted')
    GROUP BY priority
    ORDER BY
      CASE priority
        WHEN 'High' THEN 1
        WHEN 'Medium' THEN 2
        WHEN 'Low' THEN 3
      END
  `;

  const result = await pool.query(query);
  return result.rows.map((row) => ({
    priority: row.priority,
    totalRequests: parseInt(row.total_requests),
    averageDays: parseFloat(row.avg_days) || 0,
    minDays: parseFloat(row.min_days) || 0,
    maxDays: parseFloat(row.max_days) || 0,
    medianDays: parseFloat(row.median_days) || 0,
  }));
};

/**
 * Get hour allocation vs actual usage analysis
 *
 * Compares estimated hours against actual logged time to identify
 * estimation accuracy and trends. Helps improve future estimations.
 *
 * @returns Array of completed requests with variance analysis
 */
interface HourAllocationStats {
  requestId: string;
  title: string;
  priority: string;
  allocatedHours: number;
  actualHours: number;
  variance: number;
  usagePercentage: number;
}

export const getHourAllocationAnalysis = async (): Promise<HourAllocationStats[]> => {
  // Query completed requests, showing all completed requests regardless of time entries
  // If estimated_hours is null, use 0 as allocated hours
  const query = `
    SELECT
      r.id as request_id,
      r.title,
      r.priority,
      COALESCE(r.estimated_hours, 0) as allocated_hours,
      COALESCE(SUM(te.hours), 0) as actual_hours,
      CASE
        WHEN r.estimated_hours IS NOT NULL AND r.estimated_hours > 0 THEN COALESCE(SUM(te.hours), 0) - r.estimated_hours
        ELSE 0
      END as variance,
      CASE
        WHEN r.estimated_hours IS NOT NULL AND r.estimated_hours > 0 THEN ROUND((COALESCE(SUM(te.hours), 0) * 100.0 / r.estimated_hours), 2)
        ELSE 100
      END as usage_percentage
    FROM requests r
    LEFT JOIN time_entries te ON te.request_id = r.id
    WHERE r.status IN ('Completed', 'Accepted')
    GROUP BY r.id, r.title, r.priority, r.estimated_hours
    ORDER BY COALESCE(SUM(te.hours), 0) DESC
    LIMIT 20
  `;

  const result = await pool.query(query);
  return result.rows.map((row) => ({
    requestId: row.request_id,
    title: row.title,
    priority: row.priority,
    allocatedHours: parseFloat(row.allocated_hours) || 0,
    actualHours: parseFloat(row.actual_hours) || 0,
    variance: parseFloat(row.variance) || 0,
    usagePercentage: parseFloat(row.usage_percentage) || 0,
  }));
};
