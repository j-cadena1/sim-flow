import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryResult, QueryResultRow, PoolClient } from 'pg';

// Mock the database module
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../db', () => ({
  default: { query: vi.fn() },
  query: vi.fn(),
  getClient: vi.fn(() => Promise.resolve(mockClient)),
}));

// Mock the logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { query, getClient } from '../../db';
import {
  recordHourTransaction,
  allocateHoursToRequest,
  deallocateHoursFromRequest,
  adjustProjectHours,
  finalizeRequestHours,
  extendProjectHours,
  getProjectHourHistory,
  getRequestAllocatedHours,
  validateHourAvailability,
} from '../projectHoursService';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockGetClient = getClient as ReturnType<typeof vi.fn>;

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

describe('ProjectHoursService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClient.mockResolvedValue(mockClient);
  });

  describe('recordHourTransaction', () => {
    it('should record a valid hour allocation', async () => {
      // Mock: BEGIN, SELECT FOR UPDATE, INSERT, UPDATE, COMMIT
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 20, status: 'Active' }],
          })
        ) // SELECT FOR UPDATE
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] })) // INSERT transaction
        .mockResolvedValueOnce(mockResult({})) // UPDATE project
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await recordHourTransaction({
        projectId: 'proj-1',
        requestId: 'req-1',
        transactionType: 'ALLOCATION',
        hours: 10,
        performedById: 'user-1',
        performedByName: 'Test User',
        notes: 'Test allocation',
      });

      expect(result.success).toBe(true);
      expect(result.balanceBefore).toBe(20);
      expect(result.balanceAfter).toBe(30);
      expect(result.availableHours).toBe(70);
      expect(result.transactionId).toBe('txn-1');
    });

    it('should reject allocation if project not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(mockResult({ rows: [] })) // SELECT FOR UPDATE - no rows
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await recordHourTransaction({
        projectId: 'nonexistent',
        transactionType: 'ALLOCATION',
        hours: 10,
        performedByName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should reject allocation exceeding available hours', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 95, status: 'Active' }],
          })
        ) // SELECT FOR UPDATE
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await recordHourTransaction({
        projectId: 'proj-1',
        transactionType: 'ALLOCATION',
        hours: 10, // Only 5 available
        performedByName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient hours');
      expect(result.availableHours).toBe(5);
    });

    it('should reject deallocation below zero', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 20, status: 'Active' }],
          })
        ) // SELECT FOR UPDATE
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await recordHourTransaction({
        projectId: 'proj-1',
        transactionType: 'DEALLOCATION',
        hours: -30, // Only 20 used
        performedByName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot deallocate more hours than used');
    });

    it('should reject allocation to non-Active project', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 20, status: 'On Hold' }],
          })
        ) // SELECT FOR UPDATE
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await recordHourTransaction({
        projectId: 'proj-1',
        transactionType: 'ALLOCATION',
        hours: 10,
        performedByName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("status 'On Hold'");
      expect(result.error).toContain('must be Active');
    });

    it('should use existing client if provided', async () => {
      const existingClient = {
        query: vi.fn()
          .mockResolvedValueOnce(
            mockResult({
              rows: [{ id: 'proj-1', total_hours: 100, used_hours: 20, status: 'Active' }],
            })
          )
          .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
          .mockResolvedValueOnce(mockResult({})),
        release: vi.fn(),
      } as unknown as PoolClient;

      const result = await recordHourTransaction(
        {
          projectId: 'proj-1',
          transactionType: 'ALLOCATION',
          hours: 5,
          performedByName: 'Test User',
        },
        existingClient
      );

      expect(result.success).toBe(true);
      // Should NOT call BEGIN/COMMIT when using existing client
      expect(existingClient.query).not.toHaveBeenCalledWith('BEGIN');
      expect(existingClient.release).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')) // SELECT fails
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await recordHourTransaction({
        projectId: 'proj-1',
        transactionType: 'ALLOCATION',
        hours: 10,
        performedByName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to record hour transaction');
    });
  });

  describe('allocateHoursToRequest', () => {
    it('should allocate hours with ALLOCATION type', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 0, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await allocateHoursToRequest(
        'proj-1',
        'req-1',
        15,
        'user-1',
        'Test User'
      );

      expect(result.success).toBe(true);
      expect(result.balanceAfter).toBe(15);
    });

    it('should reject zero or negative hours', async () => {
      const result = await allocateHoursToRequest(
        'proj-1',
        'req-1',
        0,
        'user-1',
        'Test User'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hours to allocate must be positive');
    });

    it('should reject negative hours', async () => {
      const result = await allocateHoursToRequest(
        'proj-1',
        'req-1',
        -5,
        'user-1',
        'Test User'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hours to allocate must be positive');
    });
  });

  describe('deallocateHoursFromRequest', () => {
    it('should deallocate hours with negative value', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 30, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await deallocateHoursFromRequest(
        'proj-1',
        'req-1',
        10,
        'user-1',
        'Test User',
        'Request cancelled'
      );

      expect(result.success).toBe(true);
      expect(result.balanceBefore).toBe(30);
      expect(result.balanceAfter).toBe(20); // 30 - 10
    });

    it('should reject zero or negative hours', async () => {
      const result = await deallocateHoursFromRequest(
        'proj-1',
        'req-1',
        0,
        'user-1',
        'Test User',
        'Reason'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hours to deallocate must be positive');
    });
  });

  describe('adjustProjectHours', () => {
    it('should allow positive adjustment', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 50, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await adjustProjectHours(
        'proj-1',
        5,
        'user-1',
        'Admin User',
        'Manual correction'
      );

      expect(result.success).toBe(true);
      expect(result.balanceAfter).toBe(55);
    });

    it('should allow negative adjustment', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 50, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await adjustProjectHours(
        'proj-1',
        -10,
        'user-1',
        'Admin User',
        'Overbilled correction'
      );

      expect(result.success).toBe(true);
      expect(result.balanceAfter).toBe(40);
    });
  });

  describe('finalizeRequestHours', () => {
    it('should return excess hours when actual < allocated', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 50, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await finalizeRequestHours(
        'proj-1',
        'req-1',
        20, // allocated
        15, // actual
        'user-1',
        'Engineer'
      );

      expect(result.success).toBe(true);
      // Should return 5 hours (allocated - actual = 20 - 15 = 5)
      // Transaction hours should be -5 (negative of difference)
    });

    it('should do nothing when actual equals allocated', async () => {
      const result = await finalizeRequestHours(
        'proj-1',
        'req-1',
        20, // allocated
        20, // actual - same
        'user-1',
        'Engineer'
      );

      expect(result.success).toBe(true);
      // No database calls needed
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should charge extra hours when actual > allocated', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ id: 'proj-1', total_hours: 100, used_hours: 50, status: 'Active' }],
          })
        )
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'txn-1' }] }))
        .mockResolvedValueOnce(mockResult({}))
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await finalizeRequestHours(
        'proj-1',
        'req-1',
        15, // allocated
        20, // actual - more than allocated
        'user-1',
        'Engineer'
      );

      expect(result.success).toBe(true);
      // Should add 5 hours (actual - allocated = 20 - 15 = 5)
    });
  });

  describe('extendProjectHours', () => {
    it('should increase total_hours and record transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(
          mockResult({
            rows: [{ total_hours: 150, used_hours: 80 }],
          })
        ) // UPDATE RETURNING
        .mockResolvedValueOnce(mockResult({})) // INSERT transaction
        .mockResolvedValueOnce(mockResult({})); // COMMIT

      const result = await extendProjectHours(
        'proj-1',
        50, // additional hours
        'user-1',
        'Manager',
        'Budget extension approved'
      );

      expect(result.success).toBe(true);
      expect(result.availableHours).toBe(70); // 150 - 80
    });

    it('should reject zero or negative hours', async () => {
      const result = await extendProjectHours(
        'proj-1',
        0,
        'user-1',
        'Manager',
        'Invalid'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Additional hours must be positive');
    });

    it('should handle project not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(mockResult({})) // BEGIN
        .mockResolvedValueOnce(mockResult({ rows: [] })) // UPDATE RETURNING - no rows
        .mockResolvedValueOnce(mockResult({})); // ROLLBACK

      const result = await extendProjectHours(
        'nonexistent',
        50,
        'user-1',
        'Manager',
        'Extension'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('getProjectHourHistory', () => {
    it('should return transaction history with pagination', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          project_id: 'proj-1',
          transaction_type: 'ALLOCATION',
          hours: 10,
          request_title: 'Test Request',
        },
        {
          id: 'txn-2',
          project_id: 'proj-1',
          transaction_type: 'DEALLOCATION',
          hours: -5,
          request_title: 'Another Request',
        },
      ];

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: mockTransactions }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '15' }] }));

      const result = await getProjectHourHistory('proj-1', 10, 0);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(15);
    });

    it('should use default pagination values', async () => {
      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '0' }] }));

      await getProjectHourHistory('proj-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        ['proj-1', 50, 0]
      );
    });
  });

  describe('getRequestAllocatedHours', () => {
    it('should return sum of hours for a request', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult({ rows: [{ allocated_hours: '25' }] })
      );

      const hours = await getRequestAllocatedHours('proj-1', 'req-1');

      expect(hours).toBe(25);
    });

    it('should return 0 if no transactions found', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult({ rows: [{ allocated_hours: '0' }] })
      );

      const hours = await getRequestAllocatedHours('proj-1', 'req-new');

      expect(hours).toBe(0);
    });

    it('should return 0 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const hours = await getRequestAllocatedHours('proj-1', 'req-1');

      expect(hours).toBe(0);
    });
  });

  describe('validateHourAvailability', () => {
    it('should return available=true when hours are sufficient and project is Active', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult({
          rows: [{ total_hours: 100, used_hours: 30, status: 'Active' }],
        })
      );

      const result = await validateHourAvailability('proj-1', 50);

      expect(result.available).toBe(true);
      expect(result.currentAvailable).toBe(70);
      expect(result.totalHours).toBe(100);
      expect(result.usedHours).toBe(30);
    });

    it('should return available=false when hours are insufficient', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult({
          rows: [{ total_hours: 100, used_hours: 90, status: 'Active' }],
        })
      );

      const result = await validateHourAvailability('proj-1', 20);

      expect(result.available).toBe(false);
      expect(result.currentAvailable).toBe(10);
    });

    it('should return available=false when project is not Active', async () => {
      mockQuery.mockResolvedValueOnce(
        mockResult({
          rows: [{ total_hours: 100, used_hours: 0, status: 'On Hold' }],
        })
      );

      const result = await validateHourAvailability('proj-1', 10);

      expect(result.available).toBe(false);
    });

    it('should return available=false for nonexistent project', async () => {
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      const result = await validateHourAvailability('nonexistent', 10);

      expect(result.available).toBe(false);
      expect(result.currentAvailable).toBe(0);
      expect(result.totalHours).toBe(0);
      expect(result.usedHours).toBe(0);
    });

    it('should return available=false on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const result = await validateHourAvailability('proj-1', 10);

      expect(result.available).toBe(false);
    });
  });
});
