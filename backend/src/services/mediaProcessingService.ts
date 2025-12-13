/**
 * Media Processing Service
 *
 * Handles image and video processing for file attachments:
 * - Image thumbnail generation (200x200 WebP)
 * - Video compression (H.264, 720p max)
 * - Video thumbnail extraction (frame at 1 second)
 * - HEIC/HEIF conversion to JPEG
 * - Apple ProRes/HEVC transcoding
 *
 * Processing happens asynchronously after upload to avoid blocking the request.
 */

import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../middleware/logger';
import { query } from '../db';
import {
  uploadFile,
  generateThumbnailKey,
  deleteFile,
  isImageType,
  isVideoType,
} from './storageService';
import { emitToUser } from './websocketService';

// Thumbnail dimensions
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

// Video compression settings
const VIDEO_MAX_HEIGHT = 720; // 720p max
const VIDEO_CRF = 28; // Quality (lower = better, 28 is reasonable for compression)
const VIDEO_PRESET = 'medium'; // Encoding speed/compression tradeoff

interface ProcessingResult {
  thumbnailKey?: string;
  compressedKey?: string;
  error?: string;
}

/**
 * Notify the uploader of processing progress
 * Throttled to avoid flooding WebSocket with updates
 */
let lastProgressUpdate: Record<string, number> = {};
const PROGRESS_THROTTLE_MS = 1000; // Send updates at most once per second

async function notifyProcessingProgress(
  attachmentId: string,
  requestId: string,
  percent: number,
  uploadedBy: string
): Promise<void> {
  const now = Date.now();
  const lastUpdate = lastProgressUpdate[attachmentId] || 0;

  // Throttle updates (except for 100% which should always be sent)
  if (percent < 100 && now - lastUpdate < PROGRESS_THROTTLE_MS) {
    return;
  }

  lastProgressUpdate[attachmentId] = now;

  try {
    emitToUser(uploadedBy, 'attachment:progress', {
      attachmentId,
      requestId,
      percent: Math.round(percent),
    });
  } catch (error) {
    // Don't fail processing if notification fails
  }
}

/**
 * Notify the uploader that media processing has completed
 * This triggers a UI refresh in the frontend Attachments component
 */
async function notifyProcessingComplete(
  attachmentId: string,
  requestId: string,
  status: 'completed' | 'failed'
): Promise<void> {
  // Clean up progress tracking
  delete lastProgressUpdate[attachmentId];

  try {
    // Get the uploader's user ID
    const result = await query(
      'SELECT uploaded_by FROM attachments WHERE id = $1',
      [attachmentId]
    );

    if (result.rows.length > 0 && result.rows[0].uploaded_by) {
      const uploadedBy = result.rows[0].uploaded_by;
      emitToUser(uploadedBy, 'attachment:processed', {
        attachmentId,
        requestId,
        status,
      });
      logger.debug(`Notified user ${uploadedBy} of attachment processing ${status}`);
    }
  } catch (error) {
    // Don't fail the overall processing if notification fails
    logger.warn('Failed to send attachment processing notification:', error);
  }
}

/**
 * Generate a thumbnail for an image
 */
export async function generateImageThumbnail(buffer: Buffer): Promise<Buffer> {
  try {
    // Handle HEIC/HEIF by converting first
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // If HEIC/HEIF, convert to JPEG first
    if (metadata.format === 'heif') {
      return await sharp(buffer)
        .jpeg()
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer();
    }

    return await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    logger.error('Failed to generate image thumbnail:', error);
    throw error;
  }
}

/**
 * Extract a thumbnail from a video file
 */
async function extractVideoThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'], // 1 second into the video
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`,
      })
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });
}

/**
 * Compress a video file to H.264 720p
 */
async function compressVideo(
  inputPath: string,
  outputPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-crf ${VIDEO_CRF}`,
        `-preset ${VIDEO_PRESET}`,
        `-vf scale=-2:${VIDEO_MAX_HEIGHT}`, // Scale to 720p, maintain aspect ratio
        '-movflags +faststart', // Enable streaming
      ])
      .output(outputPath)
      .on('start', (cmd: string) => logger.debug('ffmpeg command:', cmd))
      .on('progress', (progress: { percent?: number }) => {
        if (progress.percent) {
          logger.debug(`Video compression progress: ${Math.round(progress.percent)}%`);
          onProgress?.(progress.percent);
        }
      })
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

/**
 * Process an image attachment - generate thumbnail
 */
export async function processImage(
  attachmentId: string,
  requestId: string,
  fileBuffer: Buffer,
  originalFileName: string
): Promise<ProcessingResult> {
  try {
    // Update status to processing
    await query(
      "UPDATE attachments SET processing_status = 'processing' WHERE id = $1",
      [attachmentId]
    );

    // Generate thumbnail
    const thumbnailBuffer = await generateImageThumbnail(fileBuffer);
    const thumbnailKey = generateThumbnailKey(requestId, originalFileName);

    await uploadFile(thumbnailKey, thumbnailBuffer, 'image/webp', thumbnailBuffer.length);

    // Update database with thumbnail key
    await query(
      "UPDATE attachments SET thumbnail_key = $1, processing_status = 'completed' WHERE id = $2",
      [thumbnailKey, attachmentId]
    );

    logger.info(`Image processing completed for attachment ${attachmentId}`);

    // Notify the uploader via WebSocket
    await notifyProcessingComplete(attachmentId, requestId, 'completed');

    return { thumbnailKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Image processing failed for attachment ${attachmentId}:`, error);

    await query(
      "UPDATE attachments SET processing_status = 'failed', processing_error = $1 WHERE id = $2",
      [errorMessage, attachmentId]
    );

    // Notify the uploader of failure
    await notifyProcessingComplete(attachmentId, requestId, 'failed');

    return { error: errorMessage };
  }
}

/**
 * Process a video attachment - compress and generate thumbnail
 */
export async function processVideo(
  attachmentId: string,
  requestId: string,
  fileBuffer: Buffer,
  originalFileName: string,
  storageKey: string
): Promise<ProcessingResult> {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${attachmentId}-${originalFileName}`);
  const outputPath = path.join(tempDir, `output-${attachmentId}.mp4`);
  const thumbnailPath = path.join(tempDir, `thumb-${attachmentId}.png`);

  // Get uploader ID for progress notifications
  let uploadedBy: string | null = null;
  try {
    const result = await query('SELECT uploaded_by FROM attachments WHERE id = $1', [attachmentId]);
    uploadedBy = result.rows[0]?.uploaded_by || null;
  } catch {
    // Continue without progress notifications
  }

  try {
    // Update status to processing
    await query(
      "UPDATE attachments SET processing_status = 'processing' WHERE id = $1",
      [attachmentId]
    );

    // Write buffer to temp file
    await fs.writeFile(inputPath, fileBuffer);

    // Extract thumbnail (roughly 10% of processing)
    if (uploadedBy) {
      notifyProcessingProgress(attachmentId, requestId, 5, uploadedBy);
    }
    await extractVideoThumbnail(inputPath, thumbnailPath);

    // Read thumbnail and convert to WebP
    const thumbnailPngBuffer = await fs.readFile(thumbnailPath);
    const thumbnailWebpBuffer = await sharp(thumbnailPngBuffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbnailKey = generateThumbnailKey(requestId, originalFileName);
    await uploadFile(thumbnailKey, thumbnailWebpBuffer, 'image/webp', thumbnailWebpBuffer.length);

    if (uploadedBy) {
      notifyProcessingProgress(attachmentId, requestId, 10, uploadedBy);
    }

    // Compress video (90% of processing time)
    await compressVideo(inputPath, outputPath, (percent) => {
      if (uploadedBy) {
        // Scale ffmpeg progress (0-100) to our range (10-95)
        const scaledPercent = 10 + (percent * 0.85);
        notifyProcessingProgress(attachmentId, requestId, scaledPercent, uploadedBy);
      }
    });

    // Read compressed video and upload, replacing original
    const compressedBuffer = await fs.readFile(outputPath);
    const compressedStats = await fs.stat(outputPath);

    // Delete original and upload compressed
    await deleteFile(storageKey);
    await uploadFile(storageKey, compressedBuffer, 'video/mp4', compressedStats.size);

    // Update database
    await query(
      `UPDATE attachments SET
        thumbnail_key = $1,
        file_size = $2,
        content_type = 'video/mp4',
        processing_status = 'completed'
      WHERE id = $3`,
      [thumbnailKey, compressedStats.size, attachmentId]
    );

    logger.info(`Video processing completed for attachment ${attachmentId}`);

    // Notify the uploader via WebSocket
    await notifyProcessingComplete(attachmentId, requestId, 'completed');

    return { thumbnailKey, compressedKey: storageKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Video processing failed for attachment ${attachmentId}:`, error);

    await query(
      "UPDATE attachments SET processing_status = 'failed', processing_error = $1 WHERE id = $2",
      [errorMessage, attachmentId]
    );

    // Notify the uploader of failure
    await notifyProcessingComplete(attachmentId, requestId, 'failed');

    return { error: errorMessage };
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(thumbnailPath).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Process a media file (image or video) asynchronously
 * This should be called after the file has been uploaded
 */
export async function processMediaAsync(
  attachmentId: string,
  requestId: string,
  fileBuffer: Buffer,
  originalFileName: string,
  contentType: string,
  storageKey: string
): Promise<void> {
  // Process asynchronously - don't await
  setImmediate(async () => {
    try {
      if (isImageType(contentType)) {
        await processImage(attachmentId, requestId, fileBuffer, originalFileName);
      } else if (isVideoType(contentType)) {
        await processVideo(attachmentId, requestId, fileBuffer, originalFileName, storageKey);
      } else {
        // Non-media file, mark as completed
        await query(
          "UPDATE attachments SET processing_status = 'completed' WHERE id = $1",
          [attachmentId]
        );
      }
    } catch (error) {
      logger.error(`Media processing failed for attachment ${attachmentId}:`, error);
    }
  });
}

/**
 * Get the processing status of an attachment
 */
export async function getProcessingStatus(
  attachmentId: string
): Promise<{ status: string; error?: string }> {
  const result = await query(
    'SELECT processing_status, processing_error FROM attachments WHERE id = $1',
    [attachmentId]
  );

  if (result.rows.length === 0) {
    return { status: 'not_found' };
  }

  return {
    status: result.rows[0].processing_status,
    error: result.rows[0].processing_error,
  };
}

/**
 * Retry failed processing
 */
export async function retryProcessing(attachmentId: string): Promise<boolean> {
  const result = await query(
    `SELECT a.*, r.id as req_id
     FROM attachments a
     JOIN requests r ON a.request_id = r.id
     WHERE a.id = $1 AND a.processing_status = 'failed'`,
    [attachmentId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Note: We have the attachment row but can't retry without the original buffer
  // Just mark as pending - the user would need to re-upload
  await query(
    "UPDATE attachments SET processing_status = 'pending', processing_error = NULL WHERE id = $1",
    [attachmentId]
  );

  logger.info(`Marked attachment ${attachmentId} for reprocessing`);
  return true;
}
