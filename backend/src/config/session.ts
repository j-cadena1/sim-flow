/**
 * Session Configuration
 * Centralized session settings for cookie-based authentication
 */

// Session cookie name
export const SESSION_COOKIE_NAME = 'sim_session';

// Session expiration in days
export const SESSION_EXPIRATION_DAYS = 7;

// Maximum concurrent sessions per user
export const MAX_SESSIONS_PER_USER = 5;

// Cookie options for secure HttpOnly cookies
// SECURE_COOKIES=true can force secure cookies in non-production environments (e.g., behind HTTPS reverse proxy)
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.SECURE_COOKIES === 'true',
  sameSite: 'strict' as const,
  maxAge: SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000, // Convert to milliseconds
  path: '/',
};
