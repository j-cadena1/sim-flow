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
}

// In-memory store for PKCE code verifiers (maps state -> code_verifier)
// In production, consider using Redis or a database with TTL
const pkceStore = new Map<string, string>();

// Clean up old PKCE codes after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pkceStore.entries()) {
    const timestamp = parseInt(key.split(':')[1] || '0');
    if (now - timestamp > 600000) { // 10 minutes
      pkceStore.delete(key);
    }
  }
}, 60000); // Run every minute

/**
 * Get SSO configuration from database
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

    return config;
  } catch (error) {
    logger.error('Error fetching SSO config from DB:', error);
    return null;
  }
};

/**
 * Check if SSO is enabled and configured
 */
export const isSSOEnabled = async (): Promise<boolean> => {
  const config = await getSSOConfigFromDB();
  return !!(config && config.enabled && config.tenantId && config.clientId && config.clientSecret);
};

/**
 * Get MSAL Confidential Client Application
 * Returns null if SSO is not properly configured
 */
export const getMSALClient = async (): Promise<ConfidentialClientApplication | null> => {
  try {
    const config = await getSSOConfigFromDB();

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
          loggerCallback: (level: any, message: string, containsPii: boolean) => {
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
    const config = await getSSOConfigFromDB();
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

    // Store the verifier with timestamp for later retrieval
    const storeKey = `${state}:${Date.now()}`;
    pkceStore.set(storeKey, verifier);

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

/**
 * Exchange authorization code for tokens using PKCE
 */
export const exchangeCodeForTokens = async (code: string, state: string): Promise<any> => {
  try {
    const config = await getSSOConfigFromDB();
    const msalClient = await getMSALClient();

    if (!msalClient || !config || !config.redirectUri) {
      throw new Error('SSO not configured');
    }

    // Find the code verifier for this state
    let codeVerifier: string | undefined;
    for (const [key, value] of pkceStore.entries()) {
      if (key.startsWith(state + ':')) {
        codeVerifier = value;
        pkceStore.delete(key); // Remove after use
        break;
      }
    }

    if (!codeVerifier) {
      logger.error('Code verifier not found for state:', state);
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
export const extractUserInfo = (tokenResponse: any): {
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
      email: claims.email || claims.preferred_username || claims.upn,
      name: claims.name || claims.given_name || claims.email,
      oid: claims.oid || claims.sub,
    };
  } catch (error) {
    logger.error('Error extracting user info from token:', error);
    return null;
  }
};
