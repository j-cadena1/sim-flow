/**
 * @fileoverview Attachments Controller
 *
 * Handles file attachment operations for simulation requests:
 * - Upload files (with optional image/video processing)
 * - List attachments for a request
 * - Download files via signed URL
 * - Delete attachments
 *
 * Permissions:
 * - Upload: Request creator, assigned engineer, Manager, Admin
 * - Download: Anyone who can view the request
 * - Delete: Uploader, Manager, Admin
 *
 * @module controllers/attachmentsController
 */

import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';
import { sendNotification } from '../services/notificationHelpers';
import { asyncHandler } from '../middleware/errorHandler';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from '../utils/errors';
import {
  isStorageConnected,
  validateFile,
  generateStorageKey,
  uploadFile,
  getSignedDownloadUrl,
  deleteFiles,
  getStorageConfig,
  isMediaType,
} from '../services/storageService';
import { processMediaAsync } from '../services/mediaProcessingService';

// CamelCase attachment response type
interface AttachmentResponse {
  id: string;
  requestId: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  storageKey: string;
  thumbnailKey: string | null;
  thumbnailUrl?: string | null;
  uploadedBy: string | null;
  uploadedByName: string;
  processingStatus: string;
  processingError: string | null;
  createdAt: string;
}

/**
 * Get all attachments for a request
 *
 * @param req.params.requestId - The request UUID
 * @returns attachments - Array of attachment objects with signed thumbnail URLs
 */
export const getAttachments = asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = req.params;

  const result = await query(
    `SELECT * FROM attachments
     WHERE request_id = $1
     ORDER BY created_at DESC`,
    [requestId]
  );

  // Generate signed URLs for thumbnails
  const attachments = await Promise.all(
    result.rows.map(async (attachment) => {
      const camelCased = toCamelCase(attachment) as AttachmentResponse;
      if (attachment.thumbnail_key && attachment.processing_status === 'completed') {
        try {
          camelCased.thumbnailUrl = await getSignedDownloadUrl(attachment.thumbnail_key);
        } catch {
          camelCased.thumbnailUrl = null;
        }
      }
      return camelCased;
    })
  );

  res.json({ attachments });
});

// Multer file type for memory storage
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Upload a file attachment to a request
 *
 * @param req.params.requestId - The request UUID
 * @param req.file - Multer file object
 * @returns attachment - The created attachment object
 */
export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = req.params;
  const userId = req.user?.userId || '';
  const userName = req.user?.name || 'Unknown';
  const userRole = req.user?.role;

  if (!isStorageConnected()) {
    throw new ValidationError('File storage is not available');
  }

  // Verify request exists and user has permission
  const requestResult = await query(
    'SELECT created_by, assigned_to, title FROM requests WHERE id = $1',
    [requestId]
  );

  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request', requestId);
  }

  const request = requestResult.rows[0];

  // Permission check: creator, assigned engineer, managers, admins
  const canUpload =
    userRole === 'Admin' ||
    userRole === 'Manager' ||
    request.created_by === userId ||
    request.assigned_to === userId;

  if (!canUpload) {
    throw new AuthorizationError('You do not have permission to upload files to this request');
  }

  // File should be provided by multer middleware
  // Using type assertion since Express.Multer.File is the global type from @types/multer
  const file = (req as unknown as { file?: MulterFile }).file;
  if (!file) {
    throw new ValidationError('No file provided');
  }

  // Validate file
  const validation = validateFile(file.originalname, file.mimetype, file.size);
  if (!validation.valid) {
    throw new ValidationError(validation.error || 'Invalid file');
  }

  // Generate storage key and upload
  const storageKey = generateStorageKey(requestId, file.originalname);
  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

  await uploadFile(storageKey, file.buffer, file.mimetype, file.size);

  // Save to database
  const result = await query(
    `INSERT INTO attachments (
      request_id, file_name, original_file_name, content_type,
      file_size, storage_key, uploaded_by, uploaded_by_name, processing_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      requestId,
      sanitizedFileName,
      file.originalname,
      file.mimetype,
      file.size,
      storageKey,
      userId,
      userName,
      isMediaType(file.mimetype) ? 'pending' : 'completed',
    ]
  );

  const attachment = result.rows[0];

  // Start async media processing if needed
  if (isMediaType(file.mimetype)) {
    processMediaAsync(
      attachment.id,
      requestId,
      file.buffer,
      file.originalname,
      file.mimetype,
      storageKey
    );
  }

  // Audit log
  await logRequestAudit(
    req,
    AuditAction.ADD_ATTACHMENT,
    EntityType.ATTACHMENT,
    attachment.id,
    {
      requestId,
      fileName: file.originalname,
      fileSize: file.size,
      contentType: file.mimetype,
    }
  );

  // Notify relevant users (reusing REQUEST_COMMENT_ADDED type)
  const notifyUsers = new Set<string>();
  if (request.created_by && request.created_by !== userId) {
    notifyUsers.add(request.created_by);
  }
  if (request.assigned_to && request.assigned_to !== userId) {
    notifyUsers.add(request.assigned_to);
  }

  for (const notifyUserId of notifyUsers) {
    sendNotification({
      userId: notifyUserId,
      type: 'REQUEST_COMMENT_ADDED',
      title: 'New File Attached',
      message: `${userName} attached "${file.originalname}" to request "${request.title}"`,
      link: `/requests/${requestId}`,
      entityType: 'Request',
      entityId: requestId,
      triggeredBy: userId,
    }).catch((err) => logger.error('Failed to send attachment notification:', err));
  }

  res.status(201).json({ attachment: toCamelCase(attachment) });
});

/**
 * Get a signed download URL for an attachment
 *
 * @param req.params.requestId - The request UUID
 * @param req.params.attachmentId - The attachment UUID
 * @returns downloadUrl, fileName, contentType, expiresIn
 */
export const getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { requestId, attachmentId } = req.params;

  // Verify attachment exists and belongs to request
  const result = await query(
    `SELECT a.*, r.id as req_id
     FROM attachments a
     JOIN requests r ON a.request_id = r.id
     WHERE a.id = $1 AND a.request_id = $2`,
    [attachmentId, requestId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Attachment', attachmentId);
  }

  const attachment = result.rows[0];

  // Generate signed URL with original filename for download
  const signedUrl = await getSignedDownloadUrl(
    attachment.storage_key,
    attachment.original_file_name
  );

  res.json({
    downloadUrl: signedUrl,
    fileName: attachment.original_file_name,
    contentType: attachment.content_type,
    expiresIn: 3600, // seconds
  });
});

/**
 * Delete an attachment
 *
 * @param req.params.requestId - The request UUID
 * @param req.params.attachmentId - The attachment UUID
 * @returns message, id
 */
export const deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { requestId, attachmentId } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  // Get attachment and verify ownership
  const result = await query(
    `SELECT a.*, r.title as request_title
     FROM attachments a
     JOIN requests r ON a.request_id = r.id
     WHERE a.id = $1 AND a.request_id = $2`,
    [attachmentId, requestId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Attachment', attachmentId);
  }

  const attachment = result.rows[0];

  // Permission check: uploader, managers, admins
  const canDelete =
    userRole === 'Admin' ||
    userRole === 'Manager' ||
    attachment.uploaded_by === userId;

  if (!canDelete) {
    throw new AuthorizationError('You do not have permission to delete this attachment');
  }

  // Delete from storage (both file and thumbnail)
  const keysToDelete = [attachment.storage_key];
  if (attachment.thumbnail_key) {
    keysToDelete.push(attachment.thumbnail_key);
  }
  await deleteFiles(keysToDelete);

  // Delete from database
  await query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

  // Audit log
  await logRequestAudit(
    req,
    AuditAction.DELETE_ATTACHMENT,
    EntityType.ATTACHMENT,
    attachmentId,
    {
      requestId,
      fileName: attachment.original_file_name,
    }
  );

  res.json({ message: 'Attachment deleted successfully', id: attachmentId });
});

/**
 * Get storage configuration (for frontend)
 *
 * @returns enabled, maxFileSizeMB, allowedFileTypes
 */
export const getStorageInfo = asyncHandler(async (_req: Request, res: Response) => {
  const config = getStorageConfig();
  res.json({
    enabled: config.enabled,
    maxFileSizeMB: Math.round(config.maxFileSize / 1024 / 1024),
    allowedFileTypes: config.allowedFileTypes,
  });
});

/**
 * Get processing status of an attachment
 *
 * @param req.params.attachmentId - The attachment UUID
 * @returns processingStatus, processingError
 */
export const getProcessingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { attachmentId } = req.params;

  const result = await query(
    'SELECT processing_status, processing_error FROM attachments WHERE id = $1',
    [attachmentId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Attachment', attachmentId);
  }

  res.json({
    processingStatus: result.rows[0].processing_status,
    processingError: result.rows[0].processing_error,
  });
});
