import axios from 'axios';
import { logger } from '../middleware/logger';
import { getSSOConfigFromDB } from './msalService';

interface EntraUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
}

/**
 * Get access token for Microsoft Graph API
 * Uses client credentials flow
 */
const getGraphAccessToken = async (): Promise<string | null> => {
  try {
    const config = await getSSOConfigFromDB();

    if (!config || !config.tenantId || !config.clientId || !config.clientSecret) {
      logger.error('SSO not configured for Graph API access');
      return null;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

    const response = await axios.post(
      tokenEndpoint,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    logger.error('Error getting Graph API access token:', error);
    return null;
  }
};

/**
 * Get all users from Entra ID directory
 * Requires User.Read.All permission in Azure app registration
 */
export const getDirectoryUsers = async (): Promise<EntraUser[]> => {
  try {
    const accessToken = await getGraphAccessToken();

    if (!accessToken) {
      throw new Error('Failed to get access token for Graph API');
    }

    const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        $select: 'id,displayName,mail,userPrincipalName,jobTitle,department',
        $top: 999, // Get up to 999 users
      },
    });

    logger.info(`Retrieved ${response.data.value.length} users from Entra ID directory`);
    return response.data.value;
  } catch (error: any) {
    if (error.response) {
      logger.error('Graph API error:', error.response.data);
    } else {
      logger.error('Error fetching directory users:', error);
    }
    throw error;
  }
};

/**
 * Get a specific user from Entra ID by email
 */
export const getDirectoryUserByEmail = async (email: string): Promise<EntraUser | null> => {
  try {
    const accessToken = await getGraphAccessToken();

    if (!accessToken) {
      throw new Error('Failed to get access token for Graph API');
    }

    const response = await axios.get(`https://graph.microsoft.com/v1.0/users/${email}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        $select: 'id,displayName,mail,userPrincipalName,jobTitle,department',
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('Error fetching directory user:', error);
    throw error;
  }
};

/**
 * Get a user's profile photo from Entra ID
 * Returns a data URL (base64 encoded image)
 */
export const getUserPhoto = async (email: string): Promise<string | null> => {
  try {
    const accessToken = await getGraphAccessToken();

    if (!accessToken) {
      throw new Error('Failed to get access token for Graph API');
    }

    const response = await axios.get(`https://graph.microsoft.com/v1.0/users/${email}/photo/$value`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });

    // Convert image buffer to base64 data URL
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    return dataUrl;
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.info(`No profile photo found for user ${email}`);
      return null;
    }
    logger.error('Error fetching user photo:', error);
    return null;
  }
};

/**
 * Sync a user's information from Entra ID
 */
export const syncUserFromDirectory = async (email: string): Promise<{
  name: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
} | null> => {
  try {
    const directoryUser = await getDirectoryUserByEmail(email);

    if (!directoryUser) {
      logger.warn(`User ${email} not found in Entra ID directory`);
      return null;
    }

    // Try to fetch user's profile photo
    const photoUrl = await getUserPhoto(email);

    return {
      name: directoryUser.displayName,
      email: directoryUser.mail || directoryUser.userPrincipalName,
      avatarUrl: photoUrl || undefined,
      jobTitle: directoryUser.jobTitle,
      department: directoryUser.department,
    };
  } catch (error) {
    logger.error('Error syncing user from directory:', error);
    return null;
  }
};
