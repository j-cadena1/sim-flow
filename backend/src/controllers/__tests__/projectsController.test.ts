import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { QueryResult, QueryResultRow, PoolClient } from 'pg';

// Mock the database module
vi.mock('../../db', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

// Mock the logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the audit service
vi.mock('../../services/auditService', () => ({
  logRequestAudit: vi.fn(),
  AuditAction: {
    CREATE_PROJECT: 'CREATE_PROJECT',
    UPDATE_PROJECT: 'UPDATE_PROJECT',
    DELETE_PROJECT: 'DELETE_PROJECT',
    ARCHIVE_PROJECT: 'ARCHIVE_PROJECT',
    UPDATE_PROJECT_HOURS: 'UPDATE_PROJECT_HOURS',
  },
  EntityType: {
    PROJECT: 'project',
  },
}));

// Mock project hours service
vi.mock('../../services/projectHoursService', () => ({
  getProjectHourHistory: vi.fn(),
  extendProjectHours: vi.fn(),
  adjustProjectHours: vi.fn(),
}));

// Mock project lifecycle service
vi.mock('../../services/projectLifecycleService', () => ({
  transitionProjectStatus: vi.fn(),
  getProjectStatusHistory: vi.fn(),
  getValidNextStates: vi.fn(),
  requiresReason: vi.fn(),
  checkAndExpireProjects: vi.fn(),
  getProjectsNearDeadline: vi.fn(),
  canProjectAcceptRequests: vi.fn(),
}));

// Mock notification helpers
vi.mock('../../services/notificationHelpers', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

import { query, getClient } from '../../db';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProjectName,
  updateProjectStatus,
  getProjectValidTransitions,
  getProjectHistory,
  expireOverdueProjects,
  getProjectsApproachingDeadline,
  checkProjectAcceptance,
  updateProjectHours,
  deleteProject,
  reassignProjectRequests,
  deleteProjectRequests,
  getProjectHourTransactions,
  extendProjectBudget,
  manualHourAdjustment,
  getProjectHealthMetrics,
  getAllProjectsWithMetrics,
} from '../projectsController';
import {
  transitionProjectStatus,
  getProjectStatusHistory,
  getValidNextStates,
  requiresReason,
  checkAndExpireProjects,
  getProjectsNearDeadline,
  canProjectAcceptRequests,
} from '../../services/projectLifecycleService';
import {
  getProjectHourHistory,
  extendProjectHours,
  adjustProjectHours,
} from '../../services/projectHoursService';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockGetClient = getClient as ReturnType<typeof vi.fn>;
const mockTransitionProjectStatus = transitionProjectStatus as ReturnType<typeof vi.fn>;
const mockGetProjectStatusHistory = getProjectStatusHistory as ReturnType<typeof vi.fn>;
const mockGetValidNextStates = getValidNextStates as ReturnType<typeof vi.fn>;
const mockRequiresReason = requiresReason as ReturnType<typeof vi.fn>;
const mockCheckAndExpireProjects = checkAndExpireProjects as ReturnType<typeof vi.fn>;
const mockGetProjectsNearDeadline = getProjectsNearDeadline as ReturnType<typeof vi.fn>;
const mockCanProjectAcceptRequests = canProjectAcceptRequests as ReturnType<typeof vi.fn>;
const mockGetProjectHourHistory = getProjectHourHistory as ReturnType<typeof vi.fn>;
const mockExtendProjectHours = extendProjectHours as ReturnType<typeof vi.fn>;
const mockAdjustProjectHours = adjustProjectHours as ReturnType<typeof vi.fn>;

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

// Helper to create mock Express request
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    user: {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Manager',
    },
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'Test Agent',
    },
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock Express response
function createMockResponse(): Response & { statusCode?: number } {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    statusCode: 200,
  } as unknown as Response & { statusCode?: number };
  return res;
}

// Helper to create mock pool client
function createMockClient(): PoolClient {
  return {
    query: vi.fn(),
    release: vi.fn(),
  } as unknown as PoolClient;
}

describe('ProjectsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllProjects', () => {
    it('should return all projects', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', status: 'Active', total_hours: 100 },
        { id: 'proj-2', name: 'Project 2', status: 'Pending', total_hours: 50 },
      ];

      mockQuery.mockResolvedValueOnce(mockResult({ rows: mockProjects }));

      await getAllProjects(req, res);

      expect(res.json).toHaveBeenCalledWith({
        projects: expect.arrayContaining([
          expect.objectContaining({ id: 'proj-1', name: 'Project 1' }),
          expect.objectContaining({ id: 'proj-2', name: 'Project 2' }),
        ]),
      });
    });

    it('should filter by status when provided', async () => {
      const req = createMockRequest({ query: { status: 'Active' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getAllProjects(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['Active']
      );
    });

    it('should return 500 on database error', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await getAllProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch projects' });
    });
  });

  describe('getProjectById', () => {
    it('should return project when found', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', name: 'Test Project', status: 'Active' }],
      }));

      await getProjectById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.objectContaining({ id: 'proj-123', name: 'Test Project' }),
      });
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });
  });

  describe('createProject', () => {
    it('should create project with auto-generated code', async () => {
      const req = createMockRequest({
        body: {
          name: 'New Project',
          totalHours: 100,
          createdBy: 'user-123',
          createdByName: 'Test User',
        },
        user: { userId: 'user-123', name: 'Test User', role: 'Manager', email: 'test@example.com' },
      });
      const res = createMockResponse();

      // Mock code lookup (no existing codes)
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));
      // Mock project insert
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'proj-new',
          name: 'New Project',
          code: `100001-${new Date().getFullYear()}`,
          total_hours: 100,
          status: 'Active',
        }],
      }));

      await createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        project: expect.objectContaining({
          id: 'proj-new',
          name: 'New Project',
        }),
      });
    });

    it('should return 400 when missing required fields', async () => {
      const req = createMockRequest({
        body: { name: 'Incomplete Project' }, // Missing totalHours, createdBy, createdByName
      });
      const res = createMockResponse();

      await createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('should return 400 for negative total hours', async () => {
      const req = createMockRequest({
        body: {
          name: 'Project',
          totalHours: -10,
          createdBy: 'user-123',
          createdByName: 'User',
        },
      });
      const res = createMockResponse();

      await createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Total hours must be non-negative' });
    });

    it('should increment project code based on existing codes', async () => {
      const currentYear = new Date().getFullYear();
      const req = createMockRequest({
        body: {
          name: 'New Project',
          totalHours: 100,
          createdBy: 'user-123',
          createdByName: 'Test User',
        },
        user: { userId: 'user-123', name: 'Test User', role: 'Manager', email: 'test@example.com' },
      });
      const res = createMockResponse();

      // Mock existing codes
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [
          { code: `100001-${currentYear}` },
          { code: `100002-${currentYear}` },
          { code: `100005-${currentYear}` },
        ],
      }));
      // Mock project insert
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'proj-new',
          name: 'New Project',
          code: `100006-${currentYear}`,
          total_hours: 100,
          status: 'Active',
        }],
      }));

      await createProject(req, res);

      // Verify insert was called with code 100006 (highest + 1)
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.arrayContaining([`100006-${currentYear}`])
      );
    });
  });

  describe('updateProjectName', () => {
    it('should update project name', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { name: 'Updated Name' },
      });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', name: 'Updated Name' }],
      }));

      await updateProjectName(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.objectContaining({ name: 'Updated Name' }),
      });
    });

    it('should return 400 when name is empty', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { name: '   ' },
      });
      const res = createMockResponse();

      await updateProjectName(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project name is required' });
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({
        params: { id: 'nonexistent' },
        body: { name: 'New Name' },
      });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await updateProjectName(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateProjectStatus', () => {
    it('should update project status via lifecycle service', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { status: 'Active' },
        user: { userId: 'user-123', name: 'Test User', role: 'Manager', email: 'test@example.com' },
      });
      const res = createMockResponse();

      mockTransitionProjectStatus.mockResolvedValueOnce({
        success: true,
        project: { id: 'proj-123', name: 'Test', status: 'Active', owner_id: null, created_by: 'user-123' },
        historyId: 'history-1',
      });
      mockGetValidNextStates.mockReturnValue(['On Hold', 'Completed']);
      // Mock query for engineers assigned to requests in this project
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await updateProjectStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.objectContaining({ status: 'Active' }),
        transition: expect.objectContaining({
          historyId: 'history-1',
          validNextStates: ['On Hold', 'Completed'],
        }),
      });
    });

    it('should return 400 for invalid status', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { status: 'InvalidStatus' },
      });
      const res = createMockResponse();

      await updateProjectStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid status',
      }));
    });

    it('should return 400 when transition fails', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { status: 'Completed' },
        user: { userId: 'user-123', name: 'Test User', role: 'Manager', email: 'test@example.com' },
      });
      const res = createMockResponse();

      mockTransitionProjectStatus.mockResolvedValueOnce({
        success: false,
        error: 'Cannot transition from Pending to Completed',
      });

      await updateProjectStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot transition from Pending to Completed',
      });
    });
  });

  describe('getProjectValidTransitions', () => {
    it('should return valid transitions for project', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ status: 'Active' }],
      }));
      mockGetValidNextStates.mockReturnValue(['On Hold', 'Suspended', 'Completed']);
      mockRequiresReason.mockImplementation((s: string) => ['On Hold', 'Suspended'].includes(s));

      await getProjectValidTransitions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        currentStatus: 'Active',
        validNextStates: ['On Hold', 'Suspended', 'Completed'],
        requiresReason: ['On Hold', 'Suspended'],
      });
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getProjectValidTransitions(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getProjectHistory', () => {
    it('should return project status history', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockGetProjectStatusHistory.mockResolvedValueOnce({
        history: [
          { id: 'h1', from_status: 'Pending', to_status: 'Active' },
          { id: 'h2', from_status: 'Active', to_status: 'Completed' },
        ],
        total: 2,
      });

      await getProjectHistory(req, res);

      expect(res.json).toHaveBeenCalledWith({
        history: expect.arrayContaining([
          expect.objectContaining({ fromStatus: 'Pending', toStatus: 'Active' }),
        ]),
        pagination: expect.objectContaining({
          total: 2,
          limit: 50,
          offset: 0,
        }),
      });
    });

    it('should respect pagination parameters', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        query: { limit: '10', offset: '5' },
      });
      const res = createMockResponse();

      mockGetProjectStatusHistory.mockResolvedValueOnce({
        history: [],
        total: 0,
      });

      await getProjectHistory(req, res);

      expect(mockGetProjectStatusHistory).toHaveBeenCalledWith('proj-123', 10, 5);
    });
  });

  describe('expireOverdueProjects', () => {
    it('should expire overdue projects', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockCheckAndExpireProjects.mockResolvedValueOnce({
        expired: 2,
        projects: ['proj-1', 'proj-2'],
      });

      await expireOverdueProjects(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: '2 project(s) expired',
        expiredProjects: ['proj-1', 'proj-2'],
      });
    });
  });

  describe('getProjectsApproachingDeadline', () => {
    it('should return projects near deadline', async () => {
      const req = createMockRequest({ query: { days: '14' } });
      const res = createMockResponse();

      mockGetProjectsNearDeadline.mockResolvedValueOnce([
        { id: 'proj-1', name: 'Urgent Project', deadline: '2024-01-20' },
      ]);

      await getProjectsApproachingDeadline(req, res);

      expect(mockGetProjectsNearDeadline).toHaveBeenCalledWith(14);
      expect(res.json).toHaveBeenCalledWith({
        projects: expect.any(Array),
        daysAhead: 14,
      });
    });

    it('should default to 7 days', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockGetProjectsNearDeadline.mockResolvedValueOnce([]);

      await getProjectsApproachingDeadline(req, res);

      expect(mockGetProjectsNearDeadline).toHaveBeenCalledWith(7);
    });
  });

  describe('checkProjectAcceptance', () => {
    it('should return acceptance status', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockCanProjectAcceptRequests.mockResolvedValueOnce({
        canAccept: true,
      });

      await checkProjectAcceptance(req, res);

      expect(res.json).toHaveBeenCalledWith({ canAccept: true });
    });

    it('should return reason when cannot accept', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockCanProjectAcceptRequests.mockResolvedValueOnce({
        canAccept: false,
        reason: 'Project is suspended',
      });

      await checkProjectAcceptance(req, res);

      expect(res.json).toHaveBeenCalledWith({
        canAccept: false,
        reason: 'Project is suspended',
      });
    });
  });

  describe('updateProjectHours', () => {
    it('should update project hours with transaction', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { hoursToAdd: 10 },
      });
      const res = createMockResponse();

      const mockClient = createMockClient();
      mockGetClient.mockResolvedValueOnce(mockClient);

      const clientQuery = mockClient.query as ReturnType<typeof vi.fn>;
      // BEGIN
      clientQuery.mockResolvedValueOnce(mockResult({ rows: [] }));
      // SELECT FOR UPDATE
      clientQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', total_hours: 100, used_hours: 30 }],
      }));
      // UPDATE
      clientQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', total_hours: 100, used_hours: 40 }],
      }));
      // COMMIT
      clientQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await updateProjectHours(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.objectContaining({ usedHours: 40 }),
      });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 400 when hoursToAdd is not a number', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { hoursToAdd: 'ten' },
      });
      const res = createMockResponse();

      const mockClient = createMockClient();
      mockGetClient.mockResolvedValueOnce(mockClient);

      await updateProjectHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'hoursToAdd must be a number' });
    });

    it('should return 400 when insufficient hours', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { hoursToAdd: 80 },
      });
      const res = createMockResponse();

      const mockClient = createMockClient();
      mockGetClient.mockResolvedValueOnce(mockClient);

      const clientQuery = mockClient.query as ReturnType<typeof vi.fn>;
      clientQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // BEGIN
      clientQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', total_hours: 100, used_hours: 50 }],
      })); // SELECT FOR UPDATE

      await updateProjectHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient hours in project bucket',
      }));
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({
        params: { id: 'nonexistent' },
        body: { hoursToAdd: 10 },
      });
      const res = createMockResponse();

      const mockClient = createMockClient();
      mockGetClient.mockResolvedValueOnce(mockClient);

      const clientQuery = mockClient.query as ReturnType<typeof vi.fn>;
      clientQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // BEGIN
      clientQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // SELECT FOR UPDATE

      await updateProjectHours(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteProject', () => {
    it('should delete project without requests', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      // No requests associated
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));
      // Delete returns row
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123' }],
      }));

      await deleteProject(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Project deleted successfully',
        id: 'proj-123',
      });
    });

    it('should return 409 when project has requests', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [
          { id: 'req-1', title: 'Request 1', status: 'In Progress' },
          { id: 'req-2', title: 'Request 2', status: 'Completed' },
        ],
      }));

      await deleteProject(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Cannot delete project with associated requests',
        hasRequests: true,
        requestCount: 2,
      }));
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // No requests
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // Delete returns nothing

      await deleteProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('reassignProjectRequests', () => {
    it('should reassign requests to target project', async () => {
      const req = createMockRequest({
        params: { id: 'proj-source' },
        body: { targetProjectId: 'proj-target' },
      });
      const res = createMockResponse();

      // Source project exists
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-source', name: 'Source' }],
      }));
      // Target project exists and active
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-target', name: 'Target', status: 'Active' }],
      }));
      // Reassign returns updated request IDs
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'req-1' }, { id: 'req-2' }],
      }));

      await reassignProjectRequests(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Successfully reassigned 2 request(s) to Target',
        reassignedCount: 2,
      });
    });

    it('should return 400 when target project is not active', async () => {
      const req = createMockRequest({
        params: { id: 'proj-source' },
        body: { targetProjectId: 'proj-target' },
      });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-source' }],
      }));
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-target', name: 'Target', status: 'Pending' }],
      }));

      await reassignProjectRequests(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Target project must be active to accept requests',
      });
    });

    it('should return 400 when targetProjectId missing', async () => {
      const req = createMockRequest({
        params: { id: 'proj-source' },
        body: {},
      });
      const res = createMockResponse();

      await reassignProjectRequests(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteProjectRequests', () => {
    it('should delete all project requests', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', name: 'Test Project' }],
      }));
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'req-1' }, { id: 'req-2' }, { id: 'req-3' }],
      }));

      await deleteProjectRequests(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Successfully deleted 3 request(s) from Test Project',
        deletedCount: 3,
      });
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await deleteProjectRequests(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getProjectHourTransactions', () => {
    it('should return hour transactions', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockGetProjectHourHistory.mockResolvedValueOnce({
        transactions: [
          { id: 't1', type: 'allocation', hours: 10 },
          { id: 't2', type: 'extension', hours: 20 },
        ],
        total: 2,
      });

      await getProjectHourTransactions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        transactions: expect.any(Array),
        pagination: expect.objectContaining({
          total: 2,
          limit: 50,
          offset: 0,
        }),
      });
    });
  });

  describe('extendProjectBudget', () => {
    it('should extend project budget', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { additionalHours: 50, reason: 'Additional scope' },
        user: { userId: 'user-123', name: 'Manager', role: 'Manager', email: 'test@example.com' },
      });
      const res = createMockResponse();

      mockExtendProjectHours.mockResolvedValueOnce({
        success: true,
        availableHours: 80,
      });
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', total_hours: 150, used_hours: 70 }],
      }));

      await extendProjectBudget(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.any(Object),
        extension: {
          additionalHours: 50,
          availableHours: 80,
        },
      });
    });

    it('should return 400 for invalid additional hours', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { additionalHours: -10, reason: 'Test' },
      });
      const res = createMockResponse();

      await extendProjectBudget(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Additional hours must be a positive number',
      });
    });

    it('should return 400 when reason too short', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { additionalHours: 10, reason: 'ab' },
      });
      const res = createMockResponse();

      await extendProjectBudget(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Reason is required (minimum 3 characters)',
      });
    });
  });

  describe('manualHourAdjustment', () => {
    it('should adjust project hours', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { adjustment: -5, reason: 'Data correction' },
        user: { userId: 'admin-1', name: 'Admin', role: 'Admin', email: 'admin@example.com' },
      });
      const res = createMockResponse();

      mockAdjustProjectHours.mockResolvedValueOnce({
        success: true,
        balanceBefore: 50,
        balanceAfter: 45,
        availableHours: 55,
      });
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{ id: 'proj-123', total_hours: 100, used_hours: 45 }],
      }));

      await manualHourAdjustment(req, res);

      expect(res.json).toHaveBeenCalledWith({
        project: expect.any(Object),
        adjustment: {
          hours: -5,
          balanceBefore: 50,
          balanceAfter: 45,
          availableHours: 55,
        },
      });
    });

    it('should return 400 for zero adjustment', async () => {
      const req = createMockRequest({
        params: { id: 'proj-123' },
        body: { adjustment: 0, reason: 'No change' },
      });
      const res = createMockResponse();

      await manualHourAdjustment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Adjustment must be a non-zero number',
      });
    });
  });

  describe('getProjectHealthMetrics', () => {
    it('should return health metrics', async () => {
      const req = createMockRequest({ params: { id: 'proj-123' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'proj-123',
          name: 'Test Project',
          utilization_percentage: 75,
          total_requests: 10,
          completed_requests: 7,
        }],
      }));

      await getProjectHealthMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        metrics: expect.objectContaining({
          id: 'proj-123',
          utilizationPercentage: 75,
        }),
      });
    });

    it('should return 404 when project not found', async () => {
      const req = createMockRequest({ params: { id: 'nonexistent' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getProjectHealthMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAllProjectsWithMetrics', () => {
    it('should return all projects with metrics', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [
          { id: 'proj-1', name: 'Project 1', utilization_percentage: 50 },
          { id: 'proj-2', name: 'Project 2', utilization_percentage: 80 },
        ],
      }));

      await getAllProjectsWithMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        projects: expect.arrayContaining([
          expect.objectContaining({ id: 'proj-1' }),
          expect.objectContaining({ id: 'proj-2' }),
        ]),
      });
    });

    it('should filter by status when provided', async () => {
      const req = createMockRequest({ query: { status: 'Active' } });
      const res = createMockResponse();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      await getAllProjectsWithMetrics(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['Active']
      );
    });
  });
});
