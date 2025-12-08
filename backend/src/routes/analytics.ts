import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getDashboardStatistics,
  getCompletionAnalysis,
  getAllocationAnalysis,
} from '../controllers/analyticsController';

const router = Router();

// All analytics endpoints require Admin or Manager role

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard statistics (Admin/Manager only)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter data from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter data until this date
 *     responses:
 *       200:
 *         description: Dashboard metrics including request counts, trends, and distributions
 *       403:
 *         description: Requires Admin or Manager role
 */
router.get('/dashboard', requireRole(['Admin', 'Manager']), getDashboardStatistics);

/**
 * @swagger
 * /analytics/completion-time:
 *   get:
 *     summary: Get completion time analysis (Admin/Manager only)
 *     tags: [Analytics]
 *     description: Returns average, min, max completion times by priority and status
 *     responses:
 *       200:
 *         description: Completion time statistics
 *       403:
 *         description: Requires Admin or Manager role
 */
router.get('/completion-time', requireRole(['Admin', 'Manager']), getCompletionAnalysis);

/**
 * @swagger
 * /analytics/hour-allocation:
 *   get:
 *     summary: Get hour allocation variance analysis (Admin/Manager only)
 *     tags: [Analytics]
 *     description: Compares estimated vs actual hours for completed requests
 *     responses:
 *       200:
 *         description: Hour allocation variance statistics
 *       403:
 *         description: Requires Admin or Manager role
 */
router.get('/hour-allocation', requireRole(['Admin', 'Manager']), getAllocationAnalysis);

export default router;
