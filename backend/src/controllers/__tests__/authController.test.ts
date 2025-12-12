import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { QueryResult, QueryResultRow } from 'pg';

// Mock dependencies before importing controller
vi.mock('../../db', () => ({
  query: vi.fn(),
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../services/auditService', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    SSO_LOGIN: 'SSO_LOGIN',
  },
  EntityType: {
    AUTH: 'auth',
  },
  getIpFromRequest: vi.fn().mockReturnValue('127.0.0.1'),
  getUserAgentFromRequest: vi.fn().mockReturnValue('Mozilla/5.0 Test'),
}));

vi.mock('../../services/sessionService', () => ({
  generateSessionId: vi.fn().mockReturnValue('test-session-id'),
  storeSession: vi.fn().mockResolvedValue(undefined),
  validateSession: vi.fn(),
  revokeSession: vi.fn().mockResolvedValue(true),
  revokeAllUserSessions: vi.fn().mockResolvedValue(3),
  revokeOtherUserSessions: vi.fn().mockResolvedValue(2),
  getUserSessions: vi.fn().mockResolvedValue([]),
  revokeSessionById: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/loginAttemptService', () => ({
  checkLockoutStatus: vi.fn().mockResolvedValue({ isLocked: false }),
  recordLoginAttempt: vi.fn().mockResolvedValue(undefined),
  clearFailedAttempts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/systemSettingsService', () => ({
  isQAdminDisabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../services/msalService', () => ({
  isSSOEnabled: vi.fn().mockResolvedValue(false),
  getSSOConfig: vi.fn().mockResolvedValue(null),
  getAuthorizationUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  extractUserInfo: vi.fn(),
}));

vi.mock('../../services/graphService', () => ({
  getUserPhoto: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../config/session', () => ({
  SESSION_COOKIE_NAME: 'session',
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';
import { query } from '../../db';
import {
  login,
  verifySession,
  logout,
  logoutAll,
  logoutOthers,
  getSessions,
  revokeSessionById,
  getSSOStatus,
  initiateSSO,
  handleSSOCallback,
} from '../authController';
import {
  validateSession,
  revokeAllUserSessions,
  revokeOtherUserSessions,
  getUserSessions,
  revokeSessionById as revokeSessionByDbId,
} from '../../services/sessionService';
import { checkLockoutStatus } from '../../services/loginAttemptService';
import { isQAdminDisabled } from '../../services/systemSettingsService';
import { isSSOEnabled, getSSOConfig, getAuthorizationUrl, exchangeCodeForTokens, extractUserInfo } from '../../services/msalService';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockBcryptCompare = bcrypt.compare as ReturnType<typeof vi.fn>;
const mockValidateSession = validateSession as ReturnType<typeof vi.fn>;
const mockCheckLockout = checkLockoutStatus as ReturnType<typeof vi.fn>;
const mockIsQAdminDisabled = isQAdminDisabled as ReturnType<typeof vi.fn>;
const mockIsSSOEnabled = isSSOEnabled as ReturnType<typeof vi.fn>;
const mockGetSSOConfig = getSSOConfig as ReturnType<typeof vi.fn>;
const mockGetAuthUrl = getAuthorizationUrl as ReturnType<typeof vi.fn>;
const mockExchangeCode = exchangeCodeForTokens as ReturnType<typeof vi.fn>;
const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
const mockRevokeAllSessions = revokeAllUserSessions as ReturnType<typeof vi.fn>;
const mockRevokeOtherSessions = revokeOtherUserSessions as ReturnType<typeof vi.fn>;
const mockGetUserSessions = getUserSessions as ReturnType<typeof vi.fn>;
const mockRevokeSessionByDbId = revokeSessionByDbId as ReturnType<typeof vi.fn>;

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
    body: {},
    params: {},
    query: {},
    cookies: {},
    user: undefined,
    sessionId: undefined,
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock Response
function createMockResponse(): Response {
  const res: Partial<Response> = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
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

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const req = createMockRequest({
        body: { email: 'user@test.com', password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'user@test.com',
        password_hash: 'hashed-password',
        role: 'End-User',
        avatar_url: 'https://example.com/avatar.png',
        deleted_at: null,
      };

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [mockUser] }));
      mockBcryptCompare.mockResolvedValueOnce(true);

      login(req, res, next);

      await vi.waitFor(() => {
        expect(res.cookie).toHaveBeenCalledWith('session', 'test-session-id', expect.any(Object));
        expect(res.json).toHaveBeenCalled();
      });
    });

    it('should call next with ValidationError when email is missing', async () => {
      const req = createMockRequest({
        body: { password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await login(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.error?.message).toContain('Email and password are required');
    });

    it('should call next with ValidationError when password is missing', async () => {
      const req = createMockRequest({
        body: { email: 'user@test.com' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await login(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.error?.message).toContain('Email and password are required');
    });

    it('should call next with AuthenticationError for invalid email', async () => {
      const req = createMockRequest({
        body: { email: 'nonexistent@test.com', password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      login(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Invalid email or password');
      });
    });

    it('should call next with AuthenticationError for invalid password', async () => {
      const req = createMockRequest({
        body: { email: 'user@test.com', password: 'wrongpassword' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'user-123',
          email: 'user@test.com',
          password_hash: 'hashed',
          deleted_at: null,
        }],
      }));
      mockBcryptCompare.mockResolvedValueOnce(false);

      login(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Invalid email or password');
      });
    });

    it('should call next with AuthenticationError when account is locked', async () => {
      const req = createMockRequest({
        body: { email: 'locked@test.com', password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockCheckLockout.mockResolvedValueOnce({
        isLocked: true,
        lockoutExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      login(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Account temporarily locked');
      });
    });

    it('should call next with AuthenticationError for deactivated user', async () => {
      const req = createMockRequest({
        body: { email: 'deactivated@test.com', password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'user-123',
          email: 'deactivated@test.com',
          password_hash: 'hashed',
          deleted_at: '2024-01-15',
        }],
      }));

      login(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('account has been deactivated');
      });
    });

    it('should call next with AuthenticationError when qAdmin is disabled', async () => {
      const req = createMockRequest({
        body: { email: 'qadmin@sim-rq.local', password: 'admin123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'qadmin-id',
          email: 'qadmin@sim-rq.local',
          password_hash: 'hashed',
          deleted_at: null,
        }],
      }));
      mockIsQAdminDisabled.mockResolvedValueOnce(true);

      login(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toContain('Local admin account has been disabled');
      });
    });

    it('should normalize email to lowercase', async () => {
      const req = createMockRequest({
        body: { email: 'USER@TEST.COM', password: 'password123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'user-123',
          name: 'User',
          email: 'user@test.com',
          password_hash: 'hashed',
          role: 'End-User',
          avatar_url: null,
          deleted_at: null,
        }],
      }));
      mockBcryptCompare.mockResolvedValueOnce(true);

      login(req, res, next);

      await vi.waitFor(() => {
        expect(mockQuery).toHaveBeenCalledWith(
          expect.any(String),
          ['user@test.com']
        );
      });
    });
  });

  describe('verifySession', () => {
    it('should return user info for valid session', async () => {
      const req = createMockRequest({
        cookies: { session: 'valid-session-id' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockValidateSession.mockResolvedValueOnce({
        id: 'user-123',
        email: 'user@test.com',
        name: 'User',
        role: 'End-User',
      });
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'user-123',
          name: 'User',
          email: 'user@test.com',
          role: 'End-User',
          avatar_url: 'https://avatar.url',
        }],
      }));

      verifySession(req, res, next);

      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            valid: true,
          })
        );
      });
    });

    it('should call next with AuthenticationError when no session cookie', async () => {
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();
      const next = createMockNext();

      verifySession(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('No session');
      });
    });

    it('should clear cookie and call next with error for invalid session', async () => {
      const req = createMockRequest({
        cookies: { session: 'invalid-session-id' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockValidateSession.mockResolvedValueOnce(null);

      verifySession(req, res, next);

      await vi.waitFor(() => {
        expect(res.clearCookie).toHaveBeenCalledWith('session', { path: '/' });
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Invalid session');
      });
    });

    it('should call next with error when user not found in database', async () => {
      const req = createMockRequest({
        cookies: { session: 'valid-session-id' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockValidateSession.mockResolvedValueOnce({ id: 'deleted-user' });
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] }));

      verifySession(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('User not found');
      });
    });
  });

  describe('logout', () => {
    it('should revoke session and clear cookie', async () => {
      const req = createMockRequest({
        cookies: { session: 'session-to-revoke' },
        user: { id: 'user-123', email: 'user@test.com', name: 'User' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      logout(req, res, next);

      await vi.waitFor(() => {
        expect(res.clearCookie).toHaveBeenCalledWith('session', { path: '/' });
        expect(res.json).toHaveBeenCalledWith({ success: true });
      });
    });

    it('should succeed even without session cookie', async () => {
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();
      const next = createMockNext();

      logout(req, res, next);

      await vi.waitFor(() => {
        expect(res.json).toHaveBeenCalledWith({ success: true });
      });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user sessions', async () => {
      const req = createMockRequest({
        user: { id: 'user-123', email: 'user@test.com', name: 'User' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      logoutAll(req, res, next);

      await vi.waitFor(() => {
        expect(mockRevokeAllSessions).toHaveBeenCalledWith('user-123', 'logout_all');
        expect(res.clearCookie).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, revokedCount: 3 });
      });
    });

    it('should call next with AuthenticationError when not authenticated', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      logoutAll(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Authentication required');
      });
    });
  });

  describe('logoutOthers', () => {
    it('should revoke other sessions but keep current', async () => {
      const req = createMockRequest({
        user: { id: 'user-123', email: 'user@test.com', name: 'User' },
        sessionId: 'current-session',
      });
      const res = createMockResponse();
      const next = createMockNext();

      logoutOthers(req, res, next);

      await vi.waitFor(() => {
        expect(mockRevokeOtherSessions).toHaveBeenCalledWith('user-123', 'current-session', 'logout_others');
        expect(res.json).toHaveBeenCalledWith({ success: true, revokedCount: 2 });
      });
    });

    it('should call next with error when no sessionId', async () => {
      const req = createMockRequest({
        user: { id: 'user-123' },
        sessionId: undefined,
      });
      const res = createMockResponse();
      const next = createMockNext();

      logoutOthers(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Authentication required');
      });
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const req = createMockRequest({
        user: { id: 'user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const mockSessions = [
        { id: 'sess-1', createdAt: new Date(), userAgent: 'Chrome' },
        { id: 'sess-2', createdAt: new Date(), userAgent: 'Firefox' },
      ];
      mockGetUserSessions.mockResolvedValueOnce(mockSessions);

      getSessions(req, res, next);

      await vi.waitFor(() => {
        expect(mockGetUserSessions).toHaveBeenCalledWith('user-123');
        expect(res.json).toHaveBeenCalledWith({ sessions: mockSessions });
      });
    });

    it('should call next with AuthenticationError when not authenticated', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      getSessions(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
        expect(next.error?.message).toBe('Authentication required');
      });
    });
  });

  describe('revokeSessionById', () => {
    it('should revoke specific session', async () => {
      const req = createMockRequest({
        params: { sessionId: 'sess-to-revoke' },
        user: { id: 'user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      revokeSessionById(req, res, next);

      await vi.waitFor(() => {
        expect(mockRevokeSessionByDbId).toHaveBeenCalledWith('sess-to-revoke', 'user-123');
        expect(res.json).toHaveBeenCalledWith({ success: true });
      });
    });

    it('should call next with ValidationError when session not found', async () => {
      const req = createMockRequest({
        params: { sessionId: 'nonexistent' },
        user: { id: 'user-123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockRevokeSessionByDbId.mockResolvedValueOnce(false);

      revokeSessionById(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('getSSOStatus', () => {
    it('should return enabled: false when SSO not configured', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockGetSSOConfig.mockResolvedValueOnce(null);

      await getSSOStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: false,
        source: null,
      });
    });

    it('should return enabled: true when SSO fully configured', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockGetSSOConfig.mockResolvedValueOnce({
        enabled: true,
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret',
        source: 'database',
      });

      await getSSOStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: true,
        source: 'database',
      });
    });

    it('should return enabled: false when config incomplete', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockGetSSOConfig.mockResolvedValueOnce({
        enabled: true,
        tenantId: 'tenant-123',
        clientId: null, // Missing
        clientSecret: 'secret',
      });

      await getSSOStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: false,
        source: null,
      });
    });
  });

  describe('initiateSSO', () => {
    it('should return authorization URL when SSO enabled', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockIsSSOEnabled.mockResolvedValueOnce(true);
      mockGetAuthUrl.mockResolvedValueOnce('https://login.microsoftonline.com/auth');

      await initiateSSO(req, res);

      expect(res.json).toHaveBeenCalledWith({
        authUrl: 'https://login.microsoftonline.com/auth',
      });
    });

    it('should return error when SSO not enabled', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockIsSSOEnabled.mockResolvedValueOnce(false);

      await initiateSSO(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'SSO is not enabled' });
    });

    it('should return error when authorization URL generation fails', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      mockIsSSOEnabled.mockResolvedValueOnce(true);
      mockGetAuthUrl.mockResolvedValueOnce(null);

      await initiateSSO(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to generate authorization URL' });
    });
  });

  describe('handleSSOCallback', () => {
    it('should create new user from SSO and redirect', async () => {
      const req = createMockRequest({
        query: { code: 'auth-code', state: 'state-param' },
      });
      const res = createMockResponse();

      mockExchangeCode.mockResolvedValueOnce({ idToken: 'id-token', accessToken: 'access-token' });
      mockExtractUserInfo.mockReturnValueOnce({
        email: 'newuser@company.com',
        name: 'New User',
        oid: 'entra-oid',
      });
      mockQuery.mockResolvedValueOnce(mockResult({ rows: [] })); // User not found
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'new-user-id',
          name: 'New User',
          email: 'newuser@company.com',
          role: 'End-User',
          avatar_url: 'https://avatar.url',
        }],
      })); // INSERT new user

      await handleSSOCallback(req, res);

      expect(res.cookie).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalled();
    });

    it('should update existing user from SSO', async () => {
      const req = createMockRequest({
        body: { code: 'auth-code', state: 'state-param' },
      });
      const res = createMockResponse();

      mockExchangeCode.mockResolvedValueOnce({ idToken: 'id-token' });
      mockExtractUserInfo.mockReturnValueOnce({
        email: 'existing@company.com',
        name: 'Updated Name',
        oid: 'entra-oid',
      });
      mockQuery
        .mockResolvedValueOnce(mockResult({
          rows: [{
            id: 'existing-user',
            email: 'existing@company.com',
            deleted_at: null,
          }],
        })) // User found
        .mockResolvedValueOnce(mockResult({ rows: [] })) // UPDATE user
        .mockResolvedValueOnce(mockResult({
          rows: [{
            id: 'existing-user',
            name: 'Updated Name',
            email: 'existing@company.com',
            role: 'Manager',
            avatar_url: 'https://avatar.url',
          }],
        })); // Fetch updated

      await handleSSOCallback(req, res);

      expect(res.redirect).toHaveBeenCalled();
    });

    it('should reject deactivated user via SSO', async () => {
      const req = createMockRequest({
        query: { code: 'auth-code', state: 'state-param' },
      });
      const res = createMockResponse();

      mockExchangeCode.mockResolvedValueOnce({ idToken: 'id-token' });
      mockExtractUserInfo.mockReturnValueOnce({
        email: 'deactivated@company.com',
        name: 'Deactivated User',
        oid: 'entra-oid',
      });
      mockQuery.mockResolvedValueOnce(mockResult({
        rows: [{
          id: 'deactivated-user',
          email: 'deactivated@company.com',
          deleted_at: '2024-01-15',
        }],
      }));

      await handleSSOCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return error when code is missing', async () => {
      const req = createMockRequest({
        query: { state: 'state-only' },
      });
      const res = createMockResponse();

      await handleSSOCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error when state is missing', async () => {
      const req = createMockRequest({
        query: { code: 'code-only' },
      });
      const res = createMockResponse();

      await handleSSOCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return error when user info extraction fails', async () => {
      const req = createMockRequest({
        query: { code: 'auth-code', state: 'state' },
      });
      const res = createMockResponse();

      mockExchangeCode.mockResolvedValueOnce({ idToken: 'invalid-token' });
      mockExtractUserInfo.mockReturnValueOnce(null);

      await handleSSOCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should redirect with error on exception', async () => {
      const req = createMockRequest({
        query: { code: 'auth-code', state: 'state' },
      });
      const res = createMockResponse();

      mockExchangeCode.mockRejectedValueOnce(new Error('Token exchange failed'));

      await handleSSOCallback(req, res);

      expect(res.redirect).toHaveBeenCalled();
    });
  });
});
