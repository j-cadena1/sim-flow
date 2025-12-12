import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { QueryResult, QueryResultRow } from 'pg';

// Mock dependencies before importing controller
vi.mock('../../db', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../services/auditService', () => ({
  logRequestAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    CREATE_REQUEST: 'CREATE_REQUEST',
    UPDATE_REQUEST: 'UPDATE_REQUEST',
    DELETE_REQUEST: 'DELETE_REQUEST',
    UPDATE_REQUEST_STATUS: 'UPDATE_REQUEST_STATUS',
    ASSIGN_ENGINEER: 'ASSIGN_ENGINEER',
    ADD_COMMENT: 'ADD_COMMENT',
    ADD_TIME_ENTRY: 'ADD_TIME_ENTRY',
    REQUEST_TITLE_CHANGE: 'REQUEST_TITLE_CHANGE',
    APPROVE_TITLE_CHANGE: 'APPROVE_TITLE_CHANGE',
    REJECT_TITLE_CHANGE: 'REJECT_TITLE_CHANGE',
    CREATE_DISCUSSION: 'CREATE_DISCUSSION',
    APPROVE_DISCUSSION: 'APPROVE_DISCUSSION',
    REJECT_DISCUSSION: 'REJECT_DISCUSSION',
  },
  EntityType: {
    REQUEST: 'request',
    COMMENT: 'comment',
    TIME_ENTRY: 'time_entry',
    TITLE_CHANGE: 'title_change',
    DISCUSSION: 'discussion',
  },
}));

vi.mock('../../services/projectHoursService', () => ({
  allocateHoursToRequest: vi.fn().mockResolvedValue({ success: true }),
  deallocateHoursFromRequest: vi.fn().mockResolvedValue({ success: true }),
  finalizeRequestHours: vi.fn().mockResolvedValue({ success: true }),
  validateHourAvailability: vi.fn().mockResolvedValue({ available: true, currentAvailable: 100 }),
}));

vi.mock('../../services/notificationHelpers', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToMultipleUsers: vi.fn().mockResolvedValue(undefined),
}));

import { query, getClient } from '../../db';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequestTitle,
  updateRequestDescription,
  updateRequestStatus,
  assignEngineer,
  addComment,
  deleteRequest,
  getTimeEntries,
  addTimeEntry,
  createDiscussionRequest,
  requestTitleChange,
  reviewTitleChangeRequest,
  reviewDiscussionRequest,
} from '../requestsController';
import { allocateHoursToRequest, validateHourAvailability, deallocateHoursFromRequest } from '../../services/projectHoursService';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockGetClient = getClient as ReturnType<typeof vi.fn>;
const mockAllocateHours = allocateHoursToRequest as ReturnType<typeof vi.fn>;
const mockValidateHours = validateHourAvailability as ReturnType<typeof vi.fn>;
const mockDeallocateHours = deallocateHoursFromRequest as ReturnType<typeof vi.fn>;

// Helper to create mock QueryResult
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

// Helper to create mock Request
function createMockRequest(overrides: Record<string, unknown> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    user: {
      id: 'user-123',
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Manager',
    },
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock Response
function createMockResponse(): Response {
  const res: Partial<Response> = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

// Helper to create mock NextFunction that captures errors
function createMockNext(): NextFunction & { error?: Error } {
  const next = vi.fn((err?: unknown) => {
    if (err) (next as NextFunction & { error?: Error }).error = err as Error;
  }) as unknown as NextFunction & { error?: Error };
  return next;
}

describe('RequestsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllRequests', () => {
    it('should return paginated requests with default values', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      const mockRequests = [
        { id: 'req-1', title: 'Request 1', status: 'Submitted', project_name: 'Project A' },
        { id: 'req-2', title: 'Request 2', status: 'In Progress', project_name: 'Project B' },
      ];

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: mockRequests }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '10' }] }));

      await getAllRequests(req, res);

      expect(res.json).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          expect.objectContaining({ id: 'req-1' }),
          expect.objectContaining({ id: 'req-2' }),
        ]),
        pagination: {
          total: 10,
          limit: 100,
          offset: 0,
          hasMore: true,
        },
      });
    });

    it('should filter by status when provided', async () => {
      const req = createMockRequest({ query: { status: 'Submitted' } });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '0' }] }));

      await getAllRequests(req, res);

      // Verify status filter was applied
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE r.status = $1'),
        expect.arrayContaining(['Submitted'])
      );
    });

    it('should apply pagination limits correctly', async () => {
      const req = createMockRequest({ query: { limit: '50', offset: '20' } });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '100' }] }));

      await getAllRequests(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            limit: 50,
            offset: 20,
          }),
        })
      );
    });

    it('should cap limit at MAX_LIMIT (1000)', async () => {
      const req = createMockRequest({ query: { limit: '5000' } });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ count: '0' }] }));

      await getAllRequests(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            limit: 1000,
          }),
        })
      );
    });

    it('should handle database errors', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await getAllRequests(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch requests' });
    });
  });

  describe('getRequestById', () => {
    it('should return request with comments', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        user: { userId: 'user-1', role: 'Manager', name: 'Manager User', email: 'manager@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockRequest = {
        id: 'req-123',
        title: 'Test Request',
        status: 'In Progress',
        project_name: 'Project A',
      };
      const mockComments = [
        { id: 'comment-1', content: 'Comment 1', visible_to_requester: true },
        { id: 'comment-2', content: 'Internal Comment', visible_to_requester: false },
      ];

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [mockRequest] }))
        .mockResolvedValueOnce(mockResult({ rows: mockComments }));

      getRequestById(req, res, next);

      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith({
          request: expect.objectContaining({ id: 'req-123', title: 'Test Request' }),
          comments: expect.arrayContaining([
            expect.objectContaining({ id: 'comment-1' }),
            expect.objectContaining({ id: 'comment-2' }),
          ]),
        });
      });
    });

    it('should filter internal comments for End-Users', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        user: { userId: 'user-1', role: 'End-User', name: 'End User', email: 'user@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [] }));

      getRequestById(req, res, next);

      await vi.waitFor(() => {
        // Verify comments query filters visible_to_requester
        expect(mockQuery.mock.calls[1][0]).toContain('visible_to_requester = true');
      });
    });

    it('should call next with NotFoundError when request does not exist', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      getRequestById(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('createRequest', () => {
    it('should create a new request', async () => {
      const req = createMockRequest({
        body: {
          title: 'New Request',
          description: 'Description',
          vendor: 'FANUC',
          priority: 'High',
        },
        user: { userId: 'user-123', name: 'Test User', role: 'End-User', email: 'user@test.com' },
      });
      const res = createMockResponse();

      const newRequest = {
        id: 'req-new',
        title: 'New Request',
        status: 'Submitted',
        created_by: 'user-123',
      };

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [newRequest] })) // INSERT request
        .mockResolvedValueOnce(mockResult({ rows: [] })) // INSERT activity_log
        .mockResolvedValueOnce(mockResult({ rows: [] })); // SELECT managers

      await createRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        request: expect.objectContaining({ id: 'req-new' }),
      });
    });

    it('should allow admin to create request on behalf of another user', async () => {
      const req = createMockRequest({
        body: {
          title: 'Request for User',
          description: 'Description',
          vendor: 'ABB',
          priority: 'Medium',
          onBehalfOfUserId: 'other-user',
        },
        user: { userId: 'admin-123', name: 'Admin User', role: 'Admin', email: 'admin@test.com' },
      });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'other-user', name: 'Other User' }] })) // Get user
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-new' }] })) // INSERT
        .mockResolvedValueOnce(mockResult({ rows: [] })) // Activity log
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Managers

      await createRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should reject non-admin trying to create on behalf of another user', async () => {
      const req = createMockRequest({
        body: {
          title: 'Request',
          description: 'Description',
          vendor: 'ABB',
          priority: 'Low',
          onBehalfOfUserId: 'other-user',
        },
        user: { userId: 'user-123', name: 'User', role: 'End-User', email: 'user@test.com' },
      });
      const res = createMockResponse();

      await createRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only admins can create requests on behalf of other users',
      });
    });
  });

  describe('updateRequestTitle', () => {
    it('should update request title successfully', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { title: 'Updated Title' },
        user: { userId: 'user-123', name: 'User', role: 'Manager', email: 'user@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123', title: 'Old Title' }] })) // Get current
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123', title: 'Updated Title' }] })) // UPDATE
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Activity log

      updateRequestTitle(req, res, next);

      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith({
          request: expect.objectContaining({ title: 'Updated Title' }),
        });
      });
    });

    it('should call next with ValidationError for title too short', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { title: 'ab' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      updateRequestTitle(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Title must be at least 3 characters');
      });
    });

    it('should call next with NotFoundError when request does not exist', async () => {
      const req = createMockRequest({
        params: { id: 'nonexistent' },
        body: { title: 'Valid Title' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      updateRequestTitle(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('updateRequestDescription', () => {
    it('should update description with transaction', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { description: 'This is a much longer updated description for the request' },
        user: { userId: 'user-123', role: 'Manager', name: 'Manager', email: 'manager@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce(mockResult({})) // BEGIN
          .mockResolvedValueOnce(mockResult({ rows: [{ created_by: 'user-123' }] })) // SELECT FOR UPDATE
          .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123' }] })) // UPDATE
          .mockResolvedValueOnce(mockResult({ rows: [] })) // Activity log
          .mockResolvedValueOnce(mockResult({})), // COMMIT
        release: vi.fn(),
      };
      mockGetClient.mockResolvedValueOnce(mockClient);

      updateRequestDescription(req, res, next);

      await vi.waitFor(() => {
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    it('should call next with ValidationError for description too short', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { description: 'Short' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      updateRequestDescription(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Description must be at least 10 characters');
      });
    });
  });

  describe('updateRequestStatus', () => {
    it('should update status successfully', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { status: 'In Progress' },
        user: { userId: 'user-123', name: 'User', role: 'Engineer', email: 'user@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ project_id: null, allocated_hours: 0, current_status: 'Engineering Review' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123', status: 'In Progress' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Activity log

      updateRequestStatus(req, res, next);

      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith({
          request: expect.objectContaining({ status: 'In Progress' }),
        });
      });
    });

    it('should deallocate hours when request is denied', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { status: 'Denied' },
        user: { userId: 'manager-1', name: 'Manager', role: 'Manager', email: 'manager@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({
          rows: [{ project_id: 'proj-1', allocated_hours: 10, current_status: 'Manager Review' }],
        }))
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123', status: 'Denied' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Activity log

      updateRequestStatus(req, res, next);

      await vi.waitFor(() => {
        expect(mockDeallocateHours).toHaveBeenCalledWith(
          'proj-1',
          'req-123',
          10,
          'manager-1',
          'Manager',
          expect.stringContaining('Request denied')
        );
      });
    });
  });

  describe('assignEngineer', () => {
    it('should assign engineer with hours allocation', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { engineerId: 'eng-456', estimatedHours: 20 },
        user: { userId: 'manager-1', name: 'Manager', role: 'Manager', email: 'manager@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ name: 'Engineer Name' }] })) // Get engineer
        .mockResolvedValueOnce(mockResult({ rows: [{ project_id: 'proj-1', allocated_hours: 0 }] })) // Get request
        .mockResolvedValueOnce(mockResult({
          rows: [{
            id: 'req-123',
            assigned_to: 'eng-456',
            estimated_hours: 20,
            status: 'Engineering Review',
            created_by: 'user-1',
          }],
        })) // UPDATE
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Activity log

      assignEngineer(req, res, next);

      await vi.waitFor(() => {
        expect(mockValidateHours).toHaveBeenCalledWith('proj-1', 20);
        expect(mockAllocateHours).toHaveBeenCalledWith('proj-1', 'req-123', 20, 'manager-1', 'Manager');
        expect(res.json).toHaveBeenCalledWith({
          request: expect.objectContaining({ assignedTo: 'eng-456' }),
        });
      });
    });

    it('should call next with ValidationError for negative hours', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { engineerId: 'eng-456', estimatedHours: -5 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      assignEngineer(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Estimated hours must be a non-negative number');
      });
    });

    it('should call next with ValidationError when insufficient project hours', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { engineerId: 'eng-456', estimatedHours: 100 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [{ name: 'Engineer' }] }))
        .mockResolvedValueOnce(mockResult({ rows: [{ project_id: 'proj-1', allocated_hours: 0 }] }));

      mockValidateHours.mockResolvedValueOnce({ available: false, currentAvailable: 50 });

      assignEngineer(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Insufficient project hours');
      });
    });
  });

  describe('addComment', () => {
    it('should add a comment to request', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { content: 'Test comment', visibleToRequester: true },
        user: { userId: 'user-1', name: 'User', role: 'Engineer', email: 'user@test.com' },
      });
      const res = createMockResponse();

      const newComment = {
        id: 'comment-new',
        content: 'Test comment',
        author_id: 'user-1',
        visible_to_requester: true,
      };

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [newComment] })) // INSERT
        .mockResolvedValueOnce(mockResult({
          rows: [{ title: 'Request', created_by: 'other-user', assigned_to: null }],
        })); // Get request for notifications

      await addComment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        comment: expect.objectContaining({ content: 'Test comment' }),
      });
    });

    it('should add internal comment (not visible to requester)', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { content: 'Internal note', visibleToRequester: false },
        user: { userId: 'eng-1', name: 'Engineer', role: 'Engineer', email: 'eng@test.com' },
      });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({
          rows: [{ id: 'comment-1', visible_to_requester: false }],
        }))
        .mockResolvedValueOnce(mockResult({ rows: [{ title: 'Request', created_by: 'user-1' }] }));

      await addComment(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comments'),
        expect.arrayContaining([false])
      );
    });
  });

  describe('deleteRequest', () => {
    it('should delete request and its comments', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        user: { userId: 'admin-1', role: 'Admin', name: 'Admin', email: 'admin@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] })) // DELETE comments
        .mockResolvedValueOnce(mockResult({ rows: [{ id: 'req-123' }] })); // DELETE request

      deleteRequest(req, res, next);

      // Wait for async operations to complete
      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith({
          message: 'Request deleted successfully',
          id: 'req-123',
        });
      });
    });

    it('should call next with NotFoundError when request does not exist', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [] })) // DELETE comments
        .mockResolvedValueOnce(mockResult({ rows: [] })); // DELETE request (not found)

      deleteRequest(req, res, next);

      // Wait for async operations to complete
      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('getTimeEntries', () => {
    it('should return time entries for a request', async () => {
      const req = createMockRequest({ params: { id: 'req-123' } });
      const res = createMockResponse();

      const mockEntries = [
        { id: 'te-1', hours: 4, user_name: 'Engineer 1' },
        { id: 'te-2', hours: 2.5, user_name: 'Engineer 2' },
      ];

      mockQuery.mockResolvedValueOnce(mockResult({ rows: mockEntries }));

      await getTimeEntries(req, res);

      expect(res.json).toHaveBeenCalledWith({
        timeEntries: expect.arrayContaining([
          expect.objectContaining({ hours: 4 }),
          expect.objectContaining({ hours: 2.5 }),
        ]),
      });
    });
  });

  describe('addTimeEntry', () => {
    it('should add a time entry', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { hours: 3.5, description: 'Development work' },
        user: { userId: 'eng-1', name: 'Engineer', role: 'Engineer', email: 'eng@test.com' },
      });
      const res = createMockResponse();

      const newEntry = {
        id: 'te-new',
        hours: 3.5,
        description: 'Development work',
        user_id: 'eng-1',
      };

      mockQuery
        .mockResolvedValueOnce(mockResult({ rows: [newEntry] })) // INSERT
        .mockResolvedValueOnce(mockResult({
          rows: [{ title: 'Request', created_by: 'user-1', project_id: 'proj-1' }],
        })); // Get request

      await addTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        timeEntry: expect.objectContaining({ hours: 3.5 }),
      });
    });

    it('should reject invalid hours (zero or negative)', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { hours: 0 },
      });
      const res = createMockResponse();

      await addTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Hours must be a positive number',
        details: { field: 'hours', min: 0.01 },
      });
    });
  });

  describe('createDiscussionRequest', () => {
    it('should call next with ValidationError for reason too short', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { reason: 'abc' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      createDiscussionRequest(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Reason must be at least 5 characters');
      });
    });

    it('should call next with ValidationError for missing reason', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      createDiscussionRequest(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Reason must be at least 5 characters');
      });
    });
  });

  describe('requestTitleChange', () => {
    it('should call next with ValidationError for proposed title too short', async () => {
      const req = createMockRequest({
        params: { id: 'req-123' },
        body: { proposedTitle: 'ab' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestTitleChange(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Title must be at least 3 characters');
      });
    });

    it('should call next with NotFoundError when request does not exist', async () => {
      const req = createMockRequest({
        params: { id: 'nonexistent' },
        body: { proposedTitle: 'Valid New Title' },
        user: { userId: 'eng-1', name: 'Engineer', role: 'Engineer', email: 'eng@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      requestTitleChange(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('reviewTitleChangeRequest', () => {
    it('should approve title change and update request', async () => {
      const req = createMockRequest({
        params: { id: 'tcr-123' },
        body: { approved: true },
        user: { userId: 'manager-1', name: 'Manager', role: 'Manager', email: 'manager@test.com' },
      });
      const res = createMockResponse();

      mockQuery
        .mockResolvedValueOnce(mockResult({
          rows: [{
            id: 'tcr-123',
            request_id: 'req-123',
            proposed_title: 'New Title',
            current_title: 'Old Title',
            requested_by: 'eng-1',
          }],
        })) // Get TCR
        .mockResolvedValueOnce(mockResult({ rows: [] })) // UPDATE TCR status
        .mockResolvedValueOnce(mockResult({ rows: [] })) // UPDATE request title
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Activity log

      await reviewTitleChangeRequest(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Title change approved',
      });
    });

    it('should deny title change', async () => {
      const req = createMockRequest({
        params: { id: 'tcr-123' },
        body: { approved: false },
        user: { userId: 'manager-1', name: 'Manager', role: 'Manager', email: 'manager@test.com' },
      });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'tcr-123',
          request_id: 'req-123',
          proposed_title: 'New Title',
          requested_by: 'eng-1',
        }],
      }));
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // UPDATE TCR

      await reviewTitleChangeRequest(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Title change denied',
      });
    });
  });

  describe('reviewDiscussionRequest', () => {
    it('should call next with NotFoundError when discussion does not exist', async () => {
      const req = createMockRequest({
        params: { id: 'nonexistent' },
        body: { action: 'approve' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      reviewDiscussionRequest(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('should call next with NotFoundError when request does not exist', async () => {
      const req = createMockRequest({
        params: { id: 'disc-123' },
        body: { action: 'approve' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery
        .mockResolvedValueOnce(mockResult({
          rows: [{ id: 'disc-123', request_id: 'req-123', suggested_hours: 30 }],
        }))
        .mockResolvedValueOnce(mockResult({ rows: [] })); // Request not found

      reviewDiscussionRequest(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });
});
