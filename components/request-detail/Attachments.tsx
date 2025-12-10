/**
 * @fileoverview Attachments Component
 *
 * Displays file attachments for a request with upload, download, and delete
 * functionality. Supports drag-and-drop upload and thumbnail previews.
 *
 * @module components/request-detail/Attachments
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileArchive,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Attachment, User, UserRole, StorageConfig } from '../../types';
import {
  useAttachments,
  useStorageConfig,
  useUploadAttachment,
  useDownloadAttachment,
  useDeleteAttachment,
} from '../../lib/api/hooks';

interface AttachmentsProps {
  requestId: string;
  currentUser: User;
  requestCreatedBy?: string | null;
  assignedTo?: string | null;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get icon component for a file type
 */
function getFileIcon(contentType: string): React.ReactNode {
  if (contentType.startsWith('image/')) return <FileImage className="text-green-500" size={20} />;
  if (contentType.startsWith('video/')) return <FileVideo className="text-purple-500" size={20} />;
  if (contentType.includes('pdf')) return <FileText className="text-red-500" size={20} />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv'))
    return <FileSpreadsheet className="text-emerald-500" size={20} />;
  if (contentType.includes('zip') || contentType.includes('archive'))
    return <FileArchive className="text-amber-500" size={20} />;
  if (contentType.includes('document') || contentType.includes('word'))
    return <FileText className="text-blue-500" size={20} />;
  return <File className="text-gray-500" size={20} />;
}

/**
 * Check if user can upload attachments
 */
function canUpload(
  currentUser: User,
  requestCreatedBy?: string | null,
  assignedTo?: string | null
): boolean {
  const role = currentUser.role;
  if (role === UserRole.ADMIN || role === UserRole.MANAGER) return true;
  if (currentUser.id === requestCreatedBy) return true;
  if (currentUser.id === assignedTo) return true;
  return false;
}

/**
 * Check if user can delete an attachment
 */
function canDelete(currentUser: User, uploadedBy?: string | null): boolean {
  const role = currentUser.role;
  if (role === UserRole.ADMIN || role === UserRole.MANAGER) return true;
  if (currentUser.id === uploadedBy) return true;
  return false;
}

/**
 * Validate file before upload
 */
function validateFile(
  file: File,
  config: StorageConfig
): { valid: boolean; error?: string } {
  const maxBytes = config.maxFileSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `File exceeds maximum size of ${config.maxFileSizeMB}MB` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !config.allowedFileTypes.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }

  return { valid: true };
}

/**
 * Attachments component
 */
export const Attachments: React.FC<AttachmentsProps> = ({
  requestId,
  currentUser,
  requestCreatedBy,
  assignedTo,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [], isLoading: isLoadingAttachments } = useAttachments(requestId);
  const { data: storageConfig, isLoading: isLoadingConfig } = useStorageConfig();
  const uploadMutation = useUploadAttachment();
  const downloadMutation = useDownloadAttachment();
  const deleteMutation = useDeleteAttachment();

  const userCanUpload = canUpload(currentUser, requestCreatedBy, assignedTo);
  const storageEnabled = storageConfig?.enabled ?? false;

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !storageConfig) return;
      setUploadError(null);

      for (const file of Array.from(files)) {
        const validation = validateFile(file, storageConfig);
        if (!validation.valid) {
          setUploadError(validation.error || 'Invalid file');
          continue;
        }

        try {
          await uploadMutation.mutateAsync({ requestId, file });
        } catch {
          setUploadError(`Failed to upload ${file.name}`);
        }
      }
    },
    [requestId, storageConfig, uploadMutation]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (userCanUpload && storageEnabled) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [userCanUpload, storageEnabled, handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleUpload(e.target.files);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleUpload]
  );

  const handleDownload = useCallback(
    async (attachment: Attachment) => {
      try {
        const result = await downloadMutation.mutateAsync({
          requestId,
          attachmentId: attachment.id,
        });
        // Open the signed URL in a new tab
        window.open(result.downloadUrl, '_blank');
      } catch {
        // Error handled by mutation
      }
    },
    [requestId, downloadMutation]
  );

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      try {
        await deleteMutation.mutateAsync({ requestId, attachmentId });
        setDeleteConfirm(null);
      } catch {
        // Error handled by mutation
      }
    },
    [requestId, deleteMutation]
  );

  if (isLoadingConfig) {
    return (
      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </div>
    );
  }

  if (!storageEnabled) {
    return null; // Don't render if storage is disabled
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Paperclip className="mr-2" size={20} /> Attachments
        {attachments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">
            ({attachments.length})
          </span>
        )}
      </h3>

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center text-red-700 dark:text-red-400">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
            <span className="text-sm">{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      {userCanUpload && (
        <div
          className={`mb-4 border-2 border-dashed rounded-lg p-4 transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept={storageConfig?.allowedFileTypes.map((t) => `.${t}`).join(',')}
          />
          <div className="flex flex-col items-center justify-center py-2">
            <Upload
              className={`mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`}
              size={24}
            />
            <p className="text-sm text-gray-600 dark:text-slate-400 text-center">
              {isDragOver ? (
                'Drop files here'
              ) : (
                <>
                  Drag and drop files here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    browse
                  </button>
                </>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              Max {storageConfig?.maxFileSizeMB}MB per file
            </p>
          </div>
        </div>
      )}

      {/* Uploading Indicator */}
      {uploadMutation.isPending && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center">
          <Loader2 className="animate-spin text-blue-500 mr-2" size={16} />
          <span className="text-sm text-blue-700 dark:text-blue-400">Uploading...</span>
        </div>
      )}

      {/* Attachments List */}
      <div className="space-y-2">
        {isLoadingAttachments ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin text-gray-400" size={20} />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-gray-500 dark:text-slate-500 text-sm italic text-center py-4">
            No attachments yet.
          </p>
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800 group"
            >
              {/* Thumbnail or Icon */}
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                {attachment.thumbnailUrl ? (
                  <img
                    src={attachment.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  getFileIcon(attachment.contentType)
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {attachment.originalFileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {formatFileSize(attachment.fileSize)} &middot; {attachment.uploadedByName}
                  {attachment.processingStatus === 'processing' && (
                    <span className="ml-2 text-blue-500">
                      <Loader2 className="inline animate-spin" size={12} /> Processing...
                    </span>
                  )}
                  {attachment.processingStatus === 'failed' && (
                    <span className="ml-2 text-red-500" title={attachment.processingError || undefined}>
                      <AlertCircle className="inline" size={12} /> Processing failed
                    </span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(attachment)}
                  disabled={downloadMutation.isPending}
                  className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded hover:bg-gray-200 dark:hover:bg-slate-800"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                {canDelete(currentUser, attachment.uploadedBy) && (
                  <>
                    {deleteConfirm === attachment.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(attachment.id)}
                          disabled={deleteMutation.isPending}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(attachment.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-gray-200 dark:hover:bg-slate-800"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
