import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { decrypt } from './encryptionService';

interface SSOConfig {
  id: string;
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  authority: string | null;
  scopes: string | null;
  source?: 'database' | 'environment';
}

/**
 * Database-backed PKCE state storage for production multi-instance deployments
 * Stores code verifiers in PostgreSQL with automatic expiration cleanup
 */

/**
 * Store PKCE state in database with 10-minute TTL
 */
async function storePKCEState(state: string, codeVerifier: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await query(
      `INSERT INTO pkce_states (state, code_verifier, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state) DO UPDATE
       SET code_verifier = EXCLUDED.code_verifier,
           expires_at = EXCLUDED.expires_at`,
      [state, codeVerifier, expiresAt.toISOString()]
    );
  } catch (error) {
    logger.error('Error storing PKCE state:', error);
    throw new Error('Failed to store PKCE state');
  }
}

/**
 * Retrieve and delete PKCE code verifier from database
 */
async function consumePKCEState(state: string): Promise<string | null> {
  try {
    const result = await query(
      `DELETE FROM pkce_states
       WHERE state = $1 AND expires_at > NOW()
       RETURNING code_verifier`,
      [state]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].code_verifier;
  } catch (error) {
    logger.error('Error consuming PKCE state:', error);
    return null;
  }
}

/**
 * Cleanup expired PKCE states (called periodically)
 */
export async function cleanupExpiredPKCEStates(): Promise<number> {
  try {
    const result = await query('SELECT cleanup_expired_pkce_states()');
    const count = parseInt(result.rows[0].cleanup_expired_pkce_states, 10);
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired PKCE states`);
    }
    return count;
  } catch (error) {
    logger.error('Error cleaning up PKCE states:', error);
    return 0;
  }
}

/**
 * Get SSO configuration from environment variables
 * Development uses DEV_ENTRA_SSO_* variables, production uses ENTRA_SSO_* variables
 * This serves as a fallback when database config is not available
 */
const getSSOConfigFromEnv = (): SSOConfig | null => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Development uses DEV_ENTRA_SSO_*, production uses ENTRA_SSO_*
  const tenantId = isDevelopment
    ? process.env.DEV_ENTRA_SSO_TENANT_ID
    : process.env.ENTRA_SSO_TENANT_ID;
  const clientId = isDevelopment
    ? process.env.DEV_ENTRA_SSO_CLIENT_ID
    : process.env.ENTRA_SSO_CLIENT_ID;
  const clientSecret = isDevelopment
    ? process.env.DEV_ENTRA_SSO_CLIENT_SECRET
    : process.env.ENTRA_SSO_CLIENT_SECRET;
  const redirectUri = isDevelopment
    ? process.env.DEV_ENTRA_SSO_REDIRECT_URI
    : process.env.ENTRA_SSO_REDIRECT_URI;
  const authority = isDevelopment
    ? process.env.DEV_ENTRA_SSO_AUTHORITY
    : process.env.ENTRA_SSO_AUTHORITY;
  const scopes = isDevelopment
    ? process.env.DEV_ENTRA_SSO_SCOPES
    : process.env.ENTRA_SSO_SCOPES;

  // All required fields must be present
  if (!tenantId || !clientId || !clientSecret || !redirectUri) {
    return null;
  }

  logger.info(`Using Entra SSO configuration from ${isDevelopment ? 'development' : 'production'} environment variables`);

  return {
    id: 'env-config',
    enabled: true,
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    authority: authority || `https://login.microsoftonline.com/${tenantId}`,
    scopes: scopes || 'openid,profile,email',
    source: 'environment',
  };
};

/**
 * Get SSO configuration from database only
 */
export const getSSOConfigFromDB = async (): Promise<SSOConfig | null> => {
  try {
    const result = await query('SELECT * FROM sso_configuration WHERE enabled = true LIMIT 1');

    if (result.rows.length === 0) {
      return null;
    }

    const config = toCamelCase<SSOConfig>(result.rows[0]);

    // Decrypt the client secret if present
    if (config.clientSecret) {
      config.clientSecret = decrypt(config.clientSecret);
    }

    config.source = 'database';
    return config;
  } catch (error) {
    logger.error('Error fetching SSO config from DB:', error);
    return null;
  }
};

/**
 * Get SSO configuration - checks environment variables first, then database
 * Priority: Environment variables > Database config (if enabled)
 */
export const getSSOConfig = async (): Promise<SSOConfig | null> => {
  // First check environment variables - they take precedence
  const envConfig = getSSOConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // Fall back to database config
  const dbConfig = await getSSOConfigFromDB();
  if (dbConfig && dbConfig.enabled && dbConfig.tenantId && dbConfig.clientId && dbConfig.clientSecret) {
    return dbConfig;
  }

  return null;
};

/**
 * Check if SSO is enabled and configured (from either source)
 */
export const isSSOEnabled = async (): Promise<boolean> => {
  const config = await getSSOConfig();
  return !!(config && config.enabled && config.tenantId && config.clientId && config.clientSecret);
};

/**
 * Get MSAL Confidential Client Application
 * Returns null if SSO is not properly configured
 */
export const getMSALClient = async (): Promise<ConfidentialClientApplication | null> => {
  try {
    const config = await getSSOConfig();

    if (!config || !config.enabled || !config.tenantId || !config.clientId || !config.clientSecret) {
      logger.warn('SSO is not enabled or not fully configured');
      return null;
    }

    const msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: config.authority || `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: number, message: string, containsPii: boolean) => {
            if (containsPii) {
              return;
            }
            switch (level) {
              case 1: // Error
                logger.error('MSAL:', message);
                break;
              case 2: // Warning
                logger.warn('MSAL:', message);
                break;
              case 3: // Info
                logger.info('MSAL:', message);
                break;
              default:
                logger.debug('MSAL:', message);
                break;
            }
          },
        },
      },
    };

    return new ConfidentialClientApplication(msalConfig);
  } catch (error) {
    logger.error('Error creating MSAL client:', error);
    return null;
  }
};

/**
 * Generate OAuth authorization URL with PKCE
 */
export const getAuthorizationUrl = async (): Promise<string | null> => {
  try {
    const config = await getSSOConfig();
    const msalClient = await getMSALClient();

    if (!msalClient || !config || !config.redirectUri) {
      logger.error('Cannot generate auth URL: SSO not configured');
      return null;
    }

    const cryptoProvider = new CryptoProvider();

    // Generate state parameter
    const state = cryptoProvider.base64Encode(
      cryptoProvider.createNewGuid()
    );

    // Generate PKCE challenge and verifier
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

    // Store the verifier in database for later retrieval
    await storePKCEState(state, verifier);

    const authCodeUrlParameters = {
      scopes: config.scopes?.split(',') || ['openid', 'profile', 'email'],
      redirectUri: config.redirectUri,
      state: state,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    };

    const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);

    logger.info('Generated OAuth authorization URL with PKCE');
    return authUrl;
  } catch (error) {
    logger.error('Error generating authorization URL:', error);
    return null;
  }
};

interface TokenResponse {
  idTokenClaims?: {
    email?: string;
    preferred_username?: string;
    upn?: string;
    name?: string;
    given_name?: string;
    oid?: string;
    sub?: string;
  };
  accessToken?: string;
  idToken?: string;
}

/**
 * Exchange authorization code for tokens using PKCE
 */
export const exchangeCodeForTokens = async (code: string, state: string): Promise<TokenResponse | null> => {
  try {
    const config = await getSSOConfig();
    const msalClient = await getMSALClient();

    if (!msalClient || !config || !config.redirectUri) {
      throw new Error('SSO not configured');
    }

    // Retrieve and consume the code verifier from database
    const codeVerifier = await consumePKCEState(state);

    if (!codeVerifier) {
      logger.error('Code verifier not found or expired for state:', state);
      throw new Error('Invalid state parameter or PKCE code expired');
    }

    const tokenRequest = {
      code: code,
      scopes: config.scopes?.split(',') || ['openid', 'profile', 'email'],
      redirectUri: config.redirectUri,
      codeVerifier: codeVerifier,
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);

    logger.info('Successfully exchanged code for tokens with PKCE');
    return response;
  } catch (error) {
    logger.error('Error exchanging code for tokens:', error);
    throw error;
  }
};

/**
 * Extract user info from ID token
 */
export const extractUserInfo = (tokenResponse: TokenResponse | null): {
  email: string;
  name: string;
  oid: string; // Object ID from Entra ID
} | null => {
  try {
    if (!tokenResponse || !tokenResponse.idTokenClaims) {
      logger.error('No ID token claims found');
      return null;
    }

    const claims = tokenResponse.idTokenClaims;

    return {
      email: claims.email || claims.preferred_username || claims.upn || '',
      name: claims.name || claims.given_name || claims.email || '',
      oid: claims.oid || claims.sub || '',
    };
  } catch (error) {
    logger.error('Error extracting user info from token:', error);
    return null;
  }
};
