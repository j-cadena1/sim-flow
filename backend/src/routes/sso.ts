import { Router } from 'express';
import { getSSOConfig, updateSSOConfig, testSSOConfig } from '../controllers/ssoController';
import { requireQAdmin } from '../middleware/authorization';

const router = Router();

// All SSO configuration endpoints are restricted to qAdmin only
// This ensures SSO configuration can only be managed by the local admin account
router.get('/config', requireQAdmin(), getSSOConfig);
router.put('/config', requireQAdmin(), updateSSOConfig);
router.post('/test', requireQAdmin(), testSSOConfig);

export default router;
