import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getAuditLogsController,
  exportAuditLogsCSV,
  getAuditStats,
} from '../controllers/auditLogController';

const router = Router();

// All audit log endpoints require Admin role

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Get audit logs with filtering (Admin only)
 *     tags: [Audit Logs]
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type (e.g., LOGIN, CREATE_REQUEST)
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type (e.g., Request, Project, User)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this timestamp
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this timestamp
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *       403:
 *         description: Requires Admin role
 */
router.get('/', requireRole(['Admin']), getAuditLogsController);

/**
 * @swagger
 * /audit-logs/export:
 *   get:
 *     summary: Export audit logs to CSV (Admin only)
 *     tags: [Audit Logs]
 *     description: Downloads audit logs as CSV file with same filtering options
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       403:
 *         description: Requires Admin role
 */
router.get('/export', requireRole(['Admin']), exportAuditLogsCSV);

/**
 * @swagger
 * /audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics (Admin only)
 *     tags: [Audit Logs]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Statistics including total events, unique users, top actions
 *       403:
 *         description: Requires Admin role
 */
router.get('/stats', requireRole(['Admin']), getAuditStats);

export default router;
