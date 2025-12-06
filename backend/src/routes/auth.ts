import { Router } from 'express';
import {
  login,
  verifySession,
  getSSOStatus,
  initiateSSO,
  handleSSOCallback,
  logout,
  logoutAll,
  logoutOthers,
  getSessions,
  revokeSessionById,
} from '../controllers/authController';
import { authLimiter, ssoLimiter } from '../middleware/rateLimiter';
import { authenticate, optionalAuthenticate } from '../middleware/authentication';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful, session cookie set
 *         headers:
 *           Set-Cookie:
 *             description: Session cookie (HttpOnly, Secure, SameSite=Strict)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verify session and get current user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Session is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 valid:
 *                   type: boolean
 *       401:
 *         description: Session invalid or expired
 */
router.get('/verify', verifySession);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and clear session
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully, cookie cleared
 *         headers:
 *           Set-Cookie:
 *             description: Clears the session cookie
 *             schema:
 *               type: string
 */
router.post('/logout', optionalAuthenticate, logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: All sessions revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 revokedCount:
 *                   type: integer
 */
router.post('/logout-all', authenticate, logoutAll);

/**
 * @swagger
 * /auth/logout-others:
 *   post:
 *     summary: Logout from all other devices (keep current session)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Other sessions revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 revokedCount:
 *                   type: integer
 */
router.post('/logout-others', authenticate, logoutOthers);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get active sessions for current user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: List of active sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 */
router.get('/sessions', authenticate, getSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session revoked
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', authenticate, revokeSessionById);

/**
 * @swagger
 * /auth/sso/status:
 *   get:
 *     summary: Check if SSO is enabled
 *     tags: [SSO]
 *     security: []
 *     responses:
 *       200:
 *         description: SSO status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 */
router.get('/sso/status', getSSOStatus);

/**
 * @swagger
 * /auth/sso/login:
 *   get:
 *     summary: Initiate SSO login flow
 *     tags: [SSO]
 *     security: []
 *     responses:
 *       200:
 *         description: Authorization URL for SSO
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *                   format: uri
 *       400:
 *         description: SSO not enabled
 */
router.get('/sso/login', ssoLimiter, initiateSSO);

/**
 * @swagger
 * /auth/sso/callback:
 *   get:
 *     summary: Handle SSO callback from identity provider
 *     tags: [SSO]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SSO login successful, session cookie set
 *         headers:
 *           Set-Cookie:
 *             description: Session cookie (HttpOnly, Secure, SameSite=Strict)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 method:
 *                   type: string
 *                   example: sso
 *       400:
 *         description: Invalid callback parameters
 */
router.get('/sso/callback', ssoLimiter, handleSSOCallback);

export default router;
