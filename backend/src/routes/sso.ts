import { Router } from 'express';
import { getSSOConfig, updateSSOConfig, testSSOConfig } from '../controllers/ssoController';
import { requireRole } from '../middleware/authorization';

const router = Router();

// All SSO configuration endpoints are Admin-only
router.get('/config', requireRole(['Admin']), getSSOConfig);
router.put('/config', requireRole(['Admin']), updateSSOConfig);
router.post('/test', requireRole(['Admin']), testSSOConfig);

export default router;
