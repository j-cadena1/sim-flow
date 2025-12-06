import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';
import { encrypt, isEncrypted, migrateToEncrypted } from '../services/encryptionService';

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
      // Encrypt the client secret before storing
      secretToSave = encrypt(clientSecret);
      logger.info('SSO client secret encrypted before storage');
    } else if (secretToSave && !isEncrypted(secretToSave)) {
      // Migrate existing plaintext secret to encrypted
      const { encrypted, wasPlaintext } = migrateToEncrypted(secretToSave);
      if (wasPlaintext) {
        secretToSave = encrypted;
        logger.info('Migrated existing SSO client secret to encrypted format');
      }
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

    // Audit log - use specific action based on enabled state
    const auditAction = enabled ? AuditAction.ENABLE_SSO : AuditAction.DISABLE_SSO;
    await logRequestAudit(
      req,
      auditAction,
      EntityType.SSO_CONFIG,
      undefined,
      {
        enabled,
        tenantId: tenantId || null,
        clientId: clientId || null,
        redirectUri: redirectUri || null,
      }
    );

    res.json({ config: safeConfig, message: 'SSO configuration updated successfully' });
  } catch (error) {
    logger.error('Error updating SSO configuration:', error);
    res.status(500).json({ error: 'Failed to update SSO configuration' });
  }
};

/**
 * Test SSO connection
 * Admin only - validates SSO configuration by attempting to authenticate with Entra ID
 */
export const testSSOConfig = async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        error: 'tenantId, clientId, and clientSecret are required for testing',
      });
    }

    // Validate UUID format first
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(tenantId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID format. Expected UUID format.',
      });
    }

    if (!uuidPattern.test(clientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid client ID format. Expected UUID format.',
      });
    }

    // Attempt to get a token using client credentials flow
    // This validates the tenant, client ID, and client secret are all correct
    const { ConfidentialClientApplication } = await import('@azure/msal-node');

    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret: clientSecret,
      },
    };

    const msalClient = new ConfidentialClientApplication(msalConfig);

    // Request a token for Microsoft Graph (standard scope for testing)
    // Using client_credentials flow - this doesn't require user interaction
    const tokenRequest = {
      scopes: ['https://graph.microsoft.com/.default'],
    };

    const tokenResponse = await msalClient.acquireTokenByClientCredential(tokenRequest);

    if (tokenResponse && tokenResponse.accessToken) {
      logger.info('SSO configuration test passed - successfully authenticated with Entra ID');
      res.json({
        success: true,
        message: 'Successfully connected to Microsoft Entra ID',
        details: {
          tenantId: tenantId,
          clientId: clientId,
          tokenType: tokenResponse.tokenType,
          expiresOn: tokenResponse.expiresOn,
        },
      });
    } else {
      logger.warn('SSO configuration test: token response was empty');
      res.status(400).json({
        success: false,
        error: 'Connection succeeded but no token was returned. Check app permissions in Azure.',
      });
    }
  } catch (error: any) {
    logger.error('SSO configuration test failed:', error);

    // Parse MSAL error messages for user-friendly feedback
    let errorMessage = 'Failed to connect to Microsoft Entra ID';
    let errorDetails: string | undefined;

    if (error.errorCode) {
      switch (error.errorCode) {
        case 'invalid_client':
          errorMessage = 'Invalid client credentials';
          errorDetails = 'The client secret is incorrect or has expired.';
          break;
        case 'unauthorized_client':
          errorMessage = 'Unauthorized client';
          errorDetails = 'This application is not authorized for client credentials flow. Check Azure app registration.';
          break;
        case 'invalid_request':
          errorMessage = 'Invalid request';
          errorDetails = error.errorMessage || 'Check tenant ID and client ID are correct.';
          break;
        case 'tenant_not_found':
        case 'invalid_tenant':
          errorMessage = 'Tenant not found';
          errorDetails = 'The specified tenant ID does not exist or is not accessible.';
          break;
        default:
          errorDetails = error.errorMessage || error.message;
      }
    } else if (error.message) {
      errorDetails = error.message;
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
    });
  }
};
