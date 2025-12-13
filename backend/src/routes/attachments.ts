/**
 * @fileoverview Attachments Routes
 *
 * Defines API routes for file attachment operations on simulation requests.
 *
 * @module routes/attachments
 */

import { Router } from 'express';
import multer from 'multer';
import {
  getAttachments,
  uploadAttachment,
  getDownloadUrl,
  streamDownload,
  deleteAttachment,
  getStorageInfo,
  getProcessingStatus,
  initUpload,
  completeUpload,
  cancelUpload,
} from '../controllers/attachmentsController';
import { authenticate } from '../middleware/authentication';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

// Configure multer for memory storage (streaming to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '3072', 10) * 1024 * 1024,
  },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Attachment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier
 *         requestId:
 *           type: string
 *           format: uuid
 *           description: Associated request ID
 *         fileName:
 *           type: string
 *           description: Sanitized filename in storage
 *         originalFileName:
 *           type: string
 *           description: Original filename as uploaded
 *         contentType:
 *           type: string
 *           description: MIME type of the file
 *         fileSize:
 *           type: integer
 *           description: File size in bytes
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *           description: Signed URL for thumbnail (images/videos only)
 *         uploadedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: User ID who uploaded the file
 *         uploadedByName:
 *           type: string
 *           description: Name of the user who uploaded the file
 *         processingStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           description: Media processing status
 *         processingError:
 *           type: string
 *           nullable: true
 *           description: Error message if processing failed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 *
 *     StorageConfig:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: Whether file storage is available
 *         maxFileSizeMB:
 *           type: integer
 *           description: Maximum file size in megabytes
 *         allowedFileTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Allowed file extensions
 */

/**
 * @swagger
 * /requests/{requestId}/attachments:
 *   get:
 *     summary: Get all attachments for a request
 *     description: |
 *       Returns a list of all file attachments associated with a simulation request.
 *       Includes signed thumbnail URLs for images and videos.
 *
 *       **Permissions:** Request creator, assigned engineer, Manager, Admin
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *     responses:
 *       200:
 *         description: List of attachments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attachments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to view attachments for this request
 *       404:
 *         description: Request not found
 */
router.get('/requests/:requestId/attachments', authenticate, getAttachments);

/**
 * @swagger
 * /requests/{requestId}/attachments:
 *   post:
 *     summary: Upload a file attachment
 *     description: |
 *       Upload a file to attach to a simulation request.
 *
 *       **Permissions:** Request creator, assigned engineer, Manager, Admin
 *
 *       **File limits:**
 *       - Maximum size: 3GB (configurable via MAX_FILE_SIZE_MB)
 *       - Allowed types: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, png, jpg, jpeg, gif, svg, webp, heic, heif, zip, mp4, mov, avi, webm, mkv, m4v
 *
 *       **Media processing:**
 *       - Images: Thumbnails generated automatically (200x200 WebP)
 *       - Videos: Compressed to H.264 720p, thumbnail extracted
 *       - HEIC/HEIF: Converted to JPEG
 *       - Processing happens asynchronously after upload
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *     responses:
 *       201:
 *         description: Attachment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attachment:
 *                   $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to upload to this request
 *       404:
 *         description: Request not found
 *       503:
 *         description: File storage is not available
 */
router.post(
  '/requests/:requestId/attachments',
  authenticate,
  uploadLimiter,
  upload.single('file'),
  uploadAttachment
);

// =============================================================================
// DIRECT S3 UPLOAD ROUTES
// These MUST come BEFORE the /:attachmentId routes to avoid "init", "complete",
// and "cancel" being interpreted as attachment IDs
// =============================================================================

/**
 * @swagger
 * /requests/{requestId}/attachments/init:
 *   post:
 *     summary: Initialize a direct upload to S3
 *     description: |
 *       Get a presigned URL for direct browser-to-S3 upload.
 *       This bypasses the backend for the actual file transfer, eliminating timeout issues for large files.
 *
 *       **Flow:**
 *       1. Call this endpoint with file metadata
 *       2. Upload file directly to S3 using the returned `uploadUrl`
 *       3. Call `/attachments/complete` with the `uploadId` to finalize
 *
 *       **Permissions:** Request creator, assigned engineer, Manager, Admin
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *               - fileSize
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Original filename
 *                 example: report.pdf
 *               contentType:
 *                 type: string
 *                 description: MIME type
 *                 example: application/pdf
 *               fileSize:
 *                 type: integer
 *                 description: File size in bytes
 *                 example: 1048576
 *     responses:
 *       200:
 *         description: Upload initialized - use uploadUrl to upload directly to S3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: string
 *                   format: uuid
 *                   description: Unique identifier for this upload session
 *                 uploadUrl:
 *                   type: string
 *                   format: uri
 *                   description: Presigned URL for direct S3 upload (PUT request)
 *                 storageKey:
 *                   type: string
 *                   description: S3 object key
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the presigned URL expires (1 hour)
 *       400:
 *         description: Invalid file type, size, or missing parameters
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to upload to this request
 *       404:
 *         description: Request not found
 *       503:
 *         description: File storage is not available
 */
router.post('/requests/:requestId/attachments/init', authenticate, uploadLimiter, initUpload);

/**
 * @swagger
 * /requests/{requestId}/attachments/complete:
 *   post:
 *     summary: Complete a direct upload
 *     description: |
 *       Verify the file was uploaded to S3 and create the attachment record.
 *       Must be called after successfully uploading to the presigned URL from `/init`.
 *
 *       **Verification:**
 *       - Checks file exists in S3
 *       - Verifies file size matches expected
 *       - Triggers media processing for images/videos
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 format: uuid
 *                 description: Upload session ID from /init response
 *     responses:
 *       201:
 *         description: Attachment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attachment:
 *                   $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: File not found in storage, size mismatch, or upload expired
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Upload session not found
 *       410:
 *         description: Upload expired - must re-initialize
 */
router.post('/requests/:requestId/attachments/complete', authenticate, uploadLimiter, completeUpload);

/**
 * @swagger
 * /requests/{requestId}/attachments/cancel:
 *   delete:
 *     summary: Cancel an in-progress upload
 *     description: |
 *       Cancel a pending direct upload and clean up any partially uploaded files.
 *       Useful when user cancels upload or navigates away.
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 format: uuid
 *                 description: Upload session ID from /init response
 *     responses:
 *       200:
 *         description: Upload cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Not authenticated
 */
router.delete('/requests/:requestId/attachments/cancel', authenticate, uploadLimiter, cancelUpload);

// =============================================================================
// DYNAMIC :attachmentId ROUTES
// These must come AFTER the static routes above
// =============================================================================

/**
 * @swagger
 * /requests/{requestId}/attachments/{attachmentId}/download:
 *   get:
 *     summary: Get signed download URL for an attachment
 *     description: Returns a pre-signed URL to download the attachment directly from storage. The URL is valid for 1 hour.
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The attachment UUID
 *     responses:
 *       200:
 *         description: Signed download URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloadUrl:
 *                   type: string
 *                   format: uri
 *                   description: Pre-signed URL for download
 *                 fileName:
 *                   type: string
 *                   description: Original filename
 *                 contentType:
 *                   type: string
 *                   description: MIME type
 *                 expiresIn:
 *                   type: integer
 *                   description: URL validity in seconds
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Attachment not found
 */
router.get(
  '/requests/:requestId/attachments/:attachmentId/download',
  authenticate,
  getDownloadUrl
);

/**
 * @swagger
 * /requests/{requestId}/attachments/{attachmentId}/stream:
 *   get:
 *     summary: Stream download an attachment
 *     description: |
 *       Download a file attachment by streaming it through the backend.
 *       Use this when presigned URLs don't work (e.g., behind reverse proxy).
 *
 *       **Permissions:** Request creator, assigned engineer, Manager, Admin
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The attachment UUID
 *     responses:
 *       200:
 *         description: File content streamed
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to download this file
 *       404:
 *         description: Attachment not found
 */
router.get(
  '/requests/:requestId/attachments/:attachmentId/stream',
  authenticate,
  streamDownload
);

/**
 * @swagger
 * /requests/{requestId}/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete an attachment
 *     description: |
 *       Delete a file attachment from a simulation request.
 *
 *       **Permissions:** Original uploader, Manager, Admin
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The request UUID
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The attachment UUID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Attachment deleted successfully
 *                 id:
 *                   type: string
 *                   format: uuid
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to delete this attachment
 *       404:
 *         description: Attachment not found
 */
router.delete(
  '/requests/:requestId/attachments/:attachmentId',
  authenticate,
  deleteAttachment
);

/**
 * @swagger
 * /storage/config:
 *   get:
 *     summary: Get storage configuration
 *     description: Returns file storage configuration including limits and allowed file types. Used by frontend to display upload constraints.
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Storage configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorageConfig'
 *       401:
 *         description: Not authenticated
 */
router.get('/storage/config', authenticate, getStorageInfo);

/**
 * @swagger
 * /attachments/{attachmentId}/status:
 *   get:
 *     summary: Get processing status of an attachment
 *     description: Returns the current media processing status for images and videos. Useful for polling to check when thumbnail is ready.
 *     tags: [Attachments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The attachment UUID
 *     responses:
 *       200:
 *         description: Processing status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processingStatus:
 *                   type: string
 *                   enum: [pending, processing, completed, failed]
 *                 processingError:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Attachment not found
 */
router.get('/attachments/:attachmentId/status', authenticate, getProcessingStatus);

export default router;
