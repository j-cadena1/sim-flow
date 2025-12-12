import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';

// Mock the database module
vi.mock('../../db', () => ({
  default: { query: vi.fn() },
}));

// Mock the logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import pool from '../../db';
import {
  getDashboardStats,
  getTimeToCompletionAnalysis,
  getHourAllocationAnalysis,
} from '../analyticsService';

const mockPoolQuery = pool.query as ReturnType<typeof vi.fn>;

// Helper to create a mock QueryResult
function mockResult<T extends QueryResultRow>(
  data: { rows?: T[]; rowCount?: number }
): QueryResult<T> {
  return {
    rows: data.rows ?? [],
    rowCount: data.rowCount ?? (data.rows?.length ?? 0),
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Mock all the parallel queries in order they're called
      mockPoolQuery
        // Overview query
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ total_requests: '50', active_requests: '15', completed_requests: '30' }],
          })
        )
        // Projects query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                total_projects: '10',
                active_projects: '5',
                total_hours_budget: '1000',
                total_hours_used: '450',
              },
            ],
          })
        )
        // Users query
        .mockResolvedValueOnce(mockResult({ rows: [{ total_users: '25' }] }))
        // Status query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              { status: 'Completed', count: '30', percentage: '60.00' },
              { status: 'In Progress', count: '10', percentage: '20.00' },
              { status: 'Submitted', count: '10', percentage: '20.00' },
            ],
          })
        )
        // Priority query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              { priority: 'High', count: '10', percentage: '20.00' },
              { priority: 'Medium', count: '25', percentage: '50.00' },
              { priority: 'Low', count: '15', percentage: '30.00' },
            ],
          })
        )
        // Trends query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              { date: '2024-01-15', created: '3', completed: '2', in_progress: '5' },
              { date: '2024-01-14', created: '2', completed: '1', in_progress: '6' },
            ],
          })
        )
        // Utilization query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                project_id: 1,
                project_name: 'Project A',
                project_code: '123456-1234',
                total_hours: 200,
                used_hours: 150,
                available_hours: 50,
                utilization_percentage: '75.00',
              },
            ],
          })
        )
        // Workload query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                engineer_id: 'eng-1',
                engineer_name: 'Alice Engineer',
                assigned_requests: '5',
                completed_requests: '10',
                total_hours_allocated: '40',
                total_hours_logged: '35',
                avg_completion_days: '3.5',
              },
            ],
          })
        )
        // Vendors query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              { vendor: 'FANUC', request_count: '20', total_hours: '150' },
              { vendor: 'ABB', request_count: '15', total_hours: '100' },
            ],
          })
        )
        // Metrics query
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                avg_completion_days: '4.5',
                avg_hours_per_request: '8.5',
                avg_response_hours: '2.3',
              },
            ],
          })
        );

      const stats = await getDashboardStats();

      // Verify overview
      expect(stats.overview.totalRequests).toBe(50);
      expect(stats.overview.activeRequests).toBe(15);
      expect(stats.overview.completedRequests).toBe(30);
      expect(stats.overview.totalProjects).toBe(10);
      expect(stats.overview.activeProjects).toBe(5);
      expect(stats.overview.totalUsers).toBe(25);
      expect(stats.overview.totalHoursAllocated).toBe(1000);
      expect(stats.overview.totalHoursUsed).toBe(450);

      // Verify requests by status
      expect(stats.requestsByStatus).toHaveLength(3);
      expect(stats.requestsByStatus[0].status).toBe('Completed');
      expect(stats.requestsByStatus[0].count).toBe(30);
      expect(stats.requestsByStatus[0].percentage).toBe(60);

      // Verify requests by priority
      expect(stats.requestsByPriority).toHaveLength(3);
      expect(stats.requestsByPriority[0].priority).toBe('High');

      // Verify trends
      expect(stats.requestTrends).toHaveLength(2);
      expect(stats.requestTrends[0].created).toBe(3);

      // Verify project utilization
      expect(stats.projectUtilization).toHaveLength(1);
      expect(stats.projectUtilization[0].projectName).toBe('Project A');
      expect(stats.projectUtilization[0].utilizationPercentage).toBe(75);

      // Verify engineer workload
      expect(stats.engineerWorkload).toHaveLength(1);
      expect(stats.engineerWorkload[0].engineerName).toBe('Alice Engineer');
      expect(stats.engineerWorkload[0].averageCompletionTime).toBe(3.5);

      // Verify top vendors
      expect(stats.topVendors).toHaveLength(2);
      expect(stats.topVendors[0].vendor).toBe('FANUC');
      expect(stats.topVendors[0].requestCount).toBe(20);

      // Verify average metrics
      expect(stats.averageMetrics.averageCompletionTimeDays).toBe(4.5);
      expect(stats.averageMetrics.averageHoursPerRequest).toBe(8.5);
      expect(stats.averageMetrics.averageResponseTime).toBe(2.3);
    });

    it('should handle empty database gracefully', async () => {
      mockPoolQuery
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ total_requests: '0', active_requests: '0', completed_requests: '0' }],
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                total_projects: '0',
                active_projects: '0',
                total_hours_budget: null,
                total_hours_used: null,
              },
            ],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ total_users: '0' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(
          mockResult({
            rows: [
              {
                avg_completion_days: null,
                avg_hours_per_request: null,
                avg_response_hours: null,
              },
            ],
          })
        );

      const stats = await getDashboardStats();

      expect(stats.overview.totalRequests).toBe(0);
      expect(stats.overview.totalHoursAllocated).toBe(0);
      expect(stats.requestsByStatus).toHaveLength(0);
      expect(stats.requestsByPriority).toHaveLength(0);
      expect(stats.averageMetrics.averageCompletionTimeDays).toBeNull();
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock all queries with date filter
      mockPoolQuery
        .mockResolvedValue(
          mockResult({
            rows: [{ total_requests: '10', active_requests: '5', completed_requests: '5' }],
          })
        );

      await getDashboardStats(startDate, endDate);

      // Verify date parameters were passed
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('BETWEEN $1 AND $2'),
        [startDate, endDate]
      );
    });

    it('should throw on database error', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(getDashboardStats()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getTimeToCompletionAnalysis', () => {
    it('should return completion time statistics by priority', async () => {
      mockPoolQuery.mockResolvedValueOnce(
        mockResult({
          rows: [
            {
              priority: 'High',
              total_requests: '15',
              avg_days: '2.5',
              min_days: '0.5',
              max_days: '5.0',
              median_days: '2.0',
            },
            {
              priority: 'Medium',
              total_requests: '30',
              avg_days: '4.0',
              min_days: '1.0',
              max_days: '10.0',
              median_days: '3.5',
            },
            {
              priority: 'Low',
              total_requests: '20',
              avg_days: '7.0',
              min_days: '2.0',
              max_days: '14.0',
              median_days: '6.0',
            },
          ],
        })
      );

      const result = await getTimeToCompletionAnalysis();

      expect(result).toHaveLength(3);

      // High priority
      expect(result[0].priority).toBe('High');
      expect(result[0].totalRequests).toBe(15);
      expect(result[0].averageDays).toBe(2.5);
      expect(result[0].minDays).toBe(0.5);
      expect(result[0].maxDays).toBe(5);
      expect(result[0].medianDays).toBe(2);

      // Medium priority
      expect(result[1].priority).toBe('Medium');
      expect(result[1].averageDays).toBe(4);

      // Low priority
      expect(result[2].priority).toBe('Low');
      expect(result[2].averageDays).toBe(7);
    });

    it('should handle no completed requests', async () => {
      mockPoolQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      const result = await getTimeToCompletionAnalysis();

      expect(result).toHaveLength(0);
    });

    it('should handle null values in statistics', async () => {
      mockPoolQuery.mockResolvedValueOnce(
        mockResult({
          rows: [
            {
              priority: 'High',
              total_requests: '1',
              avg_days: null,
              min_days: null,
              max_days: null,
              median_days: null,
            },
          ],
        })
      );

      const result = await getTimeToCompletionAnalysis();

      expect(result[0].averageDays).toBe(0);
      expect(result[0].minDays).toBe(0);
      expect(result[0].maxDays).toBe(0);
      expect(result[0].medianDays).toBe(0);
    });
  });

  describe('getHourAllocationAnalysis', () => {
    it('should return hour allocation vs actual usage analysis', async () => {
      mockPoolQuery.mockResolvedValueOnce(
        mockResult({
          rows: [
            {
              request_id: 'req-1',
              title: 'Request One',
              priority: 'High',
              allocated_hours: '10',
              actual_hours: '8',
              variance: '-2',
              usage_percentage: '80.00',
            },
            {
              request_id: 'req-2',
              title: 'Request Two',
              priority: 'Medium',
              allocated_hours: '20',
              actual_hours: '25',
              variance: '5',
              usage_percentage: '125.00',
            },
          ],
        })
      );

      const result = await getHourAllocationAnalysis();

      expect(result).toHaveLength(2);

      // First request - under budget
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].title).toBe('Request One');
      expect(result[0].allocatedHours).toBe(10);
      expect(result[0].actualHours).toBe(8);
      expect(result[0].variance).toBe(-2);
      expect(result[0].usagePercentage).toBe(80);

      // Second request - over budget
      expect(result[1].requestId).toBe('req-2');
      expect(result[1].allocatedHours).toBe(20);
      expect(result[1].actualHours).toBe(25);
      expect(result[1].variance).toBe(5);
      expect(result[1].usagePercentage).toBe(125);
    });

    it('should handle requests with no time entries', async () => {
      mockPoolQuery.mockResolvedValueOnce(
        mockResult({
          rows: [
            {
              request_id: 'req-1',
              title: 'Request One',
              priority: 'High',
              allocated_hours: '10',
              actual_hours: '0',
              variance: '0',
              usage_percentage: '0.00',
            },
          ],
        })
      );

      const result = await getHourAllocationAnalysis();

      expect(result[0].actualHours).toBe(0);
      expect(result[0].variance).toBe(0);
    });

    it('should handle requests with no estimated hours', async () => {
      mockPoolQuery.mockResolvedValueOnce(
        mockResult({
          rows: [
            {
              request_id: 'req-1',
              title: 'Request One',
              priority: 'Medium',
              allocated_hours: '0',
              actual_hours: '5',
              variance: '0',
              usage_percentage: '100',
            },
          ],
        })
      );

      const result = await getHourAllocationAnalysis();

      expect(result[0].allocatedHours).toBe(0);
      expect(result[0].actualHours).toBe(5);
    });

    it('should handle empty result set', async () => {
      mockPoolQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      const result = await getHourAllocationAnalysis();

      expect(result).toHaveLength(0);
    });

    it('should limit results to 20 entries', async () => {
      // The function uses LIMIT 20 in the query
      mockPoolQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getHourAllocationAnalysis();

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 20')
      );
    });
  });
});
