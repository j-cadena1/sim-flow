import { Router } from 'express';
import { getSSOConfig, updateSSOConfig, testSSOConfig } from '../controllers/ssoController';
import { requireQAdmin } from '../middleware/authorization';

const router = Router();

// All SSO configuration endpoints are restricted to qAdmin only
// This ensures SSO configuration can only be managed by the local admin account

/**
 * @swagger
 * /sso/config:
 *   get:
 *     summary: Get SSO configuration (qAdmin only)
 *     tags: [SSO]
 *     description: Returns current Microsoft Entra ID SSO configuration (client secret is redacted)
 *     responses:
 *       200:
 *         description: SSO configuration
 *       403:
 *         description: Requires qAdmin account (qadmin@sim-rq.local)
 */
router.get('/config', requireQAdmin(), getSSOConfig);

/**
 * @swagger
 * /sso/config:
 *   put:
 *     summary: Update SSO configuration (qAdmin only)
 *     tags: [SSO]
 *     description: Configure Microsoft Entra ID integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled, tenantId, clientId, clientSecret, redirectUri]
 *             properties:
 *               enabled:
 *                 type: boolean
 *               tenantId:
 *                 type: string
 *                 description: Microsoft Entra ID tenant ID
 *               clientId:
 *                 type: string
 *                 description: Application (client) ID
 *               clientSecret:
 *                 type: string
 *                 description: Client secret value
 *               redirectUri:
 *                 type: string
 *                 format: uri
 *                 description: OAuth callback URL
 *     responses:
 *       200:
 *         description: SSO configuration updated
 *       400:
 *         description: Invalid configuration
 *       403:
 *         description: Requires qAdmin account
 */
router.put('/config', requireQAdmin(), updateSSOConfig);

/**
 * @swagger
 * /sso/test:
 *   post:
 *     summary: Test SSO connection (qAdmin only)
 *     tags: [SSO]
 *     description: Validates SSO configuration by testing connection to Microsoft
 *     responses:
 *       200:
 *         description: SSO connection successful
 *       400:
 *         description: SSO configuration invalid or connection failed
 *       403:
 *         description: Requires qAdmin account
 */
router.post('/test', requireQAdmin(), testSSOConfig);

export default router;
