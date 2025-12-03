import { Router } from 'express';
import {
  login,
  verifyToken,
  getSSOStatus,
  initiateSSO,
  handleSSOCallback,
} from '../controllers/authController';

const router = Router();

// Public routes - no authentication required
router.post('/login', login);
router.get('/verify', verifyToken);

// SSO routes
router.get('/sso/status', getSSOStatus);
router.get('/sso/login', initiateSSO);
router.get('/sso/callback', handleSSOCallback);

export default router;
