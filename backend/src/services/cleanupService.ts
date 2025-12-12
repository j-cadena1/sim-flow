/**
 * Cleanup Service
 *
 * Handles cleanup of expired pending uploads and orphaned S3 files.
 * Runs periodically (every hour by default) to clean up:
 * - Expired pending_uploads records
 * - Associated S3 files that were never completed
 *
 * @module services/cleanupService
 */

import { query } from '../db';
import { deleteFile, isStorageConnected } from './storageService';
import { logger } from '../middleware/logger';

// Cleanup interval in milliseconds (1 hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Clean up expired pending uploads and their associated S3 files
 *
 * @returns Number of cleaned up records
 */
export async function cleanupExpiredPendingUploads(): Promise<number> {
  if (!isStorageConnected()) {
    logger.debug('Storage not connected, skipping pending uploads cleanup');
    return 0;
  }

  try {
    // Delete expired pending uploads and get their storage keys
    const result = await query(
      `DELETE FROM pending_uploads
       WHERE expires_at < NOW()
       RETURNING storage_key`
    );

    if (result.rows.length === 0) {
      return 0;
    }

    let cleanedCount = 0;
    const failedKeys: string[] = [];

    // Delete associated S3 files
    for (const row of result.rows) {
      try {
        await deleteFile(row.storage_key);
        cleanedCount++;
      } catch (error) {
        // File may not exist if upload never completed, that's OK
        // But log other errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!errorMessage.includes('NoSuchKey') && !errorMessage.includes('NotFound')) {
          failedKeys.push(row.storage_key);
          logger.warn(`Failed to delete orphaned file: ${row.storage_key}`, error);
        } else {
          // File didn't exist, still count as cleaned
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired pending uploads`);
    }

    if (failedKeys.length > 0) {
      logger.warn(`Failed to delete ${failedKeys.length} orphaned files`);
    }

    return cleanedCount;
  } catch (error) {
    logger.error('Failed to clean up expired pending uploads:', error);
    return 0;
  }
}

/**
 * Start the cleanup interval
 */
export function startCleanupInterval(): void {
  if (cleanupInterval) {
    logger.warn('Cleanup interval already running');
    return;
  }

  // Run immediately on startup
  cleanupExpiredPendingUploads().catch((error) => {
    logger.error('Initial cleanup failed:', error);
  });

  // Then run periodically
  cleanupInterval = setInterval(() => {
    cleanupExpiredPendingUploads().catch((error) => {
      logger.error('Scheduled cleanup failed:', error);
    });
  }, CLEANUP_INTERVAL);

  logger.info(`Pending uploads cleanup scheduled (every ${CLEANUP_INTERVAL / 60000} minutes)`);
}

/**
 * Stop the cleanup interval
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Pending uploads cleanup stopped');
  }
}

/**
 * Get cleanup status
 */
export function getCleanupStatus(): { running: boolean; intervalMs: number } {
  return {
    running: cleanupInterval !== null,
    intervalMs: CLEANUP_INTERVAL,
  };
}
