import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getAuditLogsController,
  exportAuditLogsCSV,
  getAuditStats,
} from '../controllers/auditLogController';

const router = Router();

// All audit log endpoints require Admin role
router.get('/', requireRole(['Admin']), getAuditLogsController);
router.get('/export', requireRole(['Admin']), exportAuditLogsCSV);
router.get('/stats', requireRole(['Admin']), getAuditStats);

export default router;
