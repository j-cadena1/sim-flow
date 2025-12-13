/**
 * Environment configuration utilities
 * Handles dev/prod environment-specific configuration
 */

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get the frontend/CORS origin URL based on environment
 * Uses DEV_CORS_ORIGIN in development, CORS_ORIGIN in production
 */
export function getCorsOrigin(): string {
  if (isDevelopment()) {
    return process.env.DEV_CORS_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173';
  }
  return process.env.CORS_ORIGIN || 'http://localhost:8080';
}

/**
 * Get the frontend URL for redirects and links
 * Alias for getCorsOrigin() for semantic clarity
 */
export function getFrontendUrl(): string {
  return getCorsOrigin();
}

/**
 * Validate that a redirect URL is safe (matches configured CORS origin)
 * Prevents open redirect vulnerabilities in SSO callbacks
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const corsUrl = new URL(getCorsOrigin());
    return parsedUrl.host === corsUrl.host;
  } catch {
    return false;
  }
}
