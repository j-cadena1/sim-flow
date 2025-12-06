import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getDashboardStatistics,
  getCompletionAnalysis,
  getAllocationAnalysis,
} from '../controllers/analyticsController';

const router = Router();

// All analytics endpoints require Admin or Manager role
router.get('/dashboard', requireRole(['Admin', 'Manager']), getDashboardStatistics);
router.get('/completion-time', requireRole(['Admin', 'Manager']), getCompletionAnalysis);
router.get('/hour-allocation', requireRole(['Admin', 'Manager']), getAllocationAnalysis);

export default router;
