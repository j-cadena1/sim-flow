import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';

interface SSOConfig {
  id: string;
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  authority: string | null;
  scopes: string | null;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

/**
 * Get current SSO configuration
 * Admin only - returns config without sensitive data (client_secret masked)
 */
export const getSSOConfig = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM sso_configuration LIMIT 1');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const config = toCamelCase<SSOConfig>(result.rows[0]);

    // Mask the client secret for security
    const safeConfig = {
      ...config,
      clientSecret: config.clientSecret ? '***MASKED***' : null,
    };

    logger.info('Retrieved SSO configuration');
    res.json({ config: safeConfig });
  } catch (error) {
    logger.error('Error fetching SSO configuration:', error);
    res.status(500).json({ error: 'Failed to fetch SSO configuration' });
  }
};

/**
 * Update SSO configuration
 * Admin only - updates all SSO settings
 */
export const updateSSOConfig = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const {
      enabled,
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
      authority,
      scopes,
    } = req.body;

    // Validation
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled field is required and must be boolean' });
    }

    if (enabled) {
      // If SSO is enabled, require all fields
      if (!tenantId || !clientId || !redirectUri) {
        return res.status(400).json({
          error: 'When SSO is enabled, tenantId, clientId, and redirectUri are required',
        });
      }
    }

    // Get current config to check if we're updating the secret
    const currentResult = await query('SELECT * FROM sso_configuration LIMIT 1');
    let secretToSave = currentResult.rows[0]?.client_secret;

    // Only update client_secret if a new one is provided (not masked)
    if (clientSecret && clientSecret !== '***MASKED***') {
      secretToSave = clientSecret;
      // TODO: In production, encrypt this before storing
    }

    // Construct authority if not provided
    const authorityToSave = authority || (tenantId ? `https://login.microsoftonline.com/${tenantId}` : null);

    // Update or insert configuration
    const result = await query(
      `UPDATE sso_configuration
       SET enabled = $1,
           tenant_id = $2,
           client_id = $3,
           client_secret = $4,
           redirect_uri = $5,
           authority = $6,
           scopes = $7,
           updated_by = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM sso_configuration LIMIT 1)
       RETURNING *`,
      [
        enabled,
        tenantId || null,
        clientId || null,
        secretToSave,
        redirectUri || null,
        authorityToSave,
        scopes || 'openid,profile,email',
        user?.userId || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSO configuration not found' });
    }

    const config = toCamelCase<SSOConfig>(result.rows[0]);

    // Mask the client secret in response
    const safeConfig = {
      ...config,
      clientSecret: config.clientSecret ? '***MASKED***' : null,
    };

    logger.info(`SSO configuration updated by user ${user?.userId}. SSO enabled: ${enabled}`);
    res.json({ config: safeConfig, message: 'SSO configuration updated successfully' });
  } catch (error) {
    logger.error('Error updating SSO configuration:', error);
    res.status(500).json({ error: 'Failed to update SSO configuration' });
  }
};

/**
 * Test SSO connection
 * Admin only - validates SSO configuration without saving
 */
export const testSSOConfig = async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        error: 'tenantId, clientId, and clientSecret are required for testing',
      });
    }

    // TODO: Implement actual connection test to Entra ID
    // For now, just validate the format
    const tenantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const clientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!tenantIdPattern.test(tenantId)) {
      return res.status(400).json({
        error: 'Invalid tenant ID format. Expected UUID format.',
      });
    }

    if (!clientIdPattern.test(clientId)) {
      return res.status(400).json({
        error: 'Invalid client ID format. Expected UUID format.',
      });
    }

    logger.info('SSO configuration test passed (basic validation)');
    res.json({
      success: true,
      message: 'SSO configuration validated successfully',
      note: 'Full connection test will be implemented in next phase',
    });
  } catch (error) {
    logger.error('Error testing SSO configuration:', error);
    res.status(500).json({ error: 'Failed to test SSO configuration' });
  }
};
