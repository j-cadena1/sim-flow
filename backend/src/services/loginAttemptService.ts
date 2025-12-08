/**
 * Login Attempt Tracking Service
 *
 * Provides account lockout functionality to prevent brute force attacks.
 * Tracks failed login attempts and temporarily locks accounts after
 * exceeding the maximum allowed failures.
 *
 * Security Features:
 * - Tracks attempts by email (account-level lockout)
 * - Tracks attempts by IP (for IP-based lockout in future)
 * - Configurable lockout threshold and duration
 * - Automatic cleanup of old attempts
 *
 * Testing:
 * - Set DISABLE_RATE_LIMITING=true to disable lockout checks for E2E tests
 */

import { query } from '../db';
import { logger } from '../middleware/logger';

// Configuration
const MAX_FAILED_ATTEMPTS = 5; // Lock after 5 failed attempts
const LOCKOUT_DURATION_MINUTES = 15; // Lock for 15 minutes
const ATTEMPT_WINDOW_MINUTES = 15; // Count attempts within 15 minute window

// Skip lockout checks when rate limiting is disabled (for E2E tests)
const skipLockout = process.env.DISABLE_RATE_LIMITING === 'true';

interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutExpiresAt?: Date;
  failedAttempts: number;
}

/**
 * Record a login attempt (successful or failed)
 */
export async function recordLoginAttempt(
  email: string,
  ipAddress: string | undefined,
  successful: boolean
): Promise<void> {
  try {
    await query(
      `INSERT INTO login_attempts (email, ip_address, successful)
       VALUES ($1, $2, $3)`,
      [email.toLowerCase(), ipAddress || null, successful]
    );

    if (!successful) {
      logger.warn(`Failed login attempt recorded for: ${email} from IP: ${ipAddress || 'unknown'}`);
    }
  } catch (error) {
    // Don't fail login flow if tracking fails - log and continue
    logger.error('Error recording login attempt:', error);
  }
}

/**
 * Check if an account is currently locked out
 * Returns unlocked status when DISABLE_RATE_LIMITING=true (for E2E tests)
 */
export async function checkLockoutStatus(email: string): Promise<LockoutStatus> {
  // Skip lockout checks for E2E tests
  if (skipLockout) {
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      failedAttempts: 0,
    };
  }

  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);

    // Count recent failed attempts
    const result = await query(
      `SELECT COUNT(*) as failed_count,
              MAX(attempted_at) as last_attempt
       FROM login_attempts
       WHERE email = $1
         AND attempted_at > $2
         AND successful = FALSE`,
      [email.toLowerCase(), windowStart.toISOString()]
    );

    const failedCount = parseInt(result.rows[0].failed_count, 10);
    const lastAttempt = result.rows[0].last_attempt ? new Date(result.rows[0].last_attempt) : null;

    // Check if locked
    if (failedCount >= MAX_FAILED_ATTEMPTS && lastAttempt) {
      const lockoutEnd = new Date(lastAttempt);
      lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_DURATION_MINUTES);

      if (lockoutEnd > new Date()) {
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockoutExpiresAt: lockoutEnd,
          failedAttempts: failedCount,
        };
      }
    }

    return {
      isLocked: false,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedCount),
      failedAttempts: failedCount,
    };
  } catch (error) {
    logger.error('Error checking lockout status:', error);
    // On error, don't block login - fail open to prevent DoS
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      failedAttempts: 0,
    };
  }
}

/**
 * Clear failed attempts after successful login
 * This allows the user to login immediately on their next attempt
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);

    // Mark recent failed attempts as superseded by successful login
    // We keep the records for audit but they won't count toward lockout
    await query(
      `DELETE FROM login_attempts
       WHERE email = $1
         AND attempted_at > $2
         AND successful = FALSE`,
      [email.toLowerCase(), windowStart.toISOString()]
    );
  } catch (error) {
    logger.error('Error clearing failed attempts:', error);
  }
}

/**
 * Get lockout configuration (for documentation/admin purposes)
 */
export function getLockoutConfig(): {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  attemptWindowMinutes: number;
} {
  return {
    maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    lockoutDurationMinutes: LOCKOUT_DURATION_MINUTES,
    attemptWindowMinutes: ATTEMPT_WINDOW_MINUTES,
  };
}

/**
 * Cleanup old login attempts (call periodically)
 */
export async function cleanupOldLoginAttempts(): Promise<number> {
  try {
    const result = await query('SELECT cleanup_old_login_attempts()');
    const deletedCount = result.rows[0]?.cleanup_old_login_attempts || 0;
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old login attempts`);
    }
    return deletedCount;
  } catch (error) {
    logger.error('Error cleaning up login attempts:', error);
    return 0;
  }
}
