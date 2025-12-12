import React, { useState, useRef, useCallback } from 'react';
import { useSimRQ } from '../contexts/SimRQContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { useProjects, useStorageConfig, useDirectUpload, DirectUploadProgress } from '../lib/api/hooks';
import { validateNewRequest } from '../utils/validation';
import { Send, AlertCircle, FolderOpen, UserCircle, Upload, X, File, FileText, FileSpreadsheet, FileImage, FileVideo, FileArchive, Paperclip, Loader2 } from 'lucide-react';
import { ProjectStatus, StorageConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api/client';

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
  if (contentType.startsWith('image/')) return <FileImage className="text-green-500" size={16} />;
  if (contentType.startsWith('video/')) return <FileVideo className="text-purple-500" size={16} />;
  if (contentType.includes('pdf')) return <FileText className="text-red-500" size={16} />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv'))
    return <FileSpreadsheet className="text-emerald-500" size={16} />;
  if (contentType.includes('zip') || contentType.includes('archive'))
    return <FileArchive className="text-amber-500" size={16} />;
  if (contentType.includes('document') || contentType.includes('word'))
    return <FileText className="text-blue-500" size={16} />;
  return <File className="text-gray-500" size={16} />;
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
    return { valid: false, error: `File "${file.name}" exceeds maximum size of ${config.maxFileSizeMB}MB` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !config.allowedFileTypes.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }

  return { valid: true };
}

export const NewRequest: React.FC = () => {
  const { addRequestAsync } = useSimRQ();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: storageConfig } = useStorageConfig();
  const { uploadFile } = useDirectUpload();

  const approvedProjects = allProjects.filter(p => p.status === ProjectStatus.ACTIVE && p.totalHours > p.usedHours);
  const isAdmin = user?.role === 'Admin';
  const storageEnabled = storageConfig?.enabled ?? false;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('FANUC');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [projectId, setProjectId] = useState('');
  const [onBehalfOfUserId, setOnBehalfOfUserId] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // File attachment state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [currentUploadProgress, setCurrentUploadProgress] = useState<DirectUploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch users when component mounts (only for admins)
  React.useEffect(() => {
    if (isAdmin) {
      setUsersLoading(true);
      apiClient.get('/users')
        .then(response => {
          setUsers(response.data.users || []);
        })
        .catch(() => {
          // Failed to fetch users for dropdown
        })
        .finally(() => setUsersLoading(false));
    }
  }, [isAdmin]);

  // File handling functions
  const handleAddFiles = useCallback((files: FileList | null) => {
    if (!files || !storageConfig) return;

    const newFiles: File[] = [];
    const validationErrors: string[] = [];

    for (const file of Array.from(files)) {
      const validation = validateFile(file, storageConfig);
      if (!validation.valid) {
        validationErrors.push(validation.error || 'Invalid file');
      } else {
        // Check if file is already in list
        const isDuplicate = pendingFiles.some(
          f => f.name === file.name && f.size === file.size
        );
        if (!isDuplicate) {
          newFiles.push(file);
        }
      }
    }

    if (validationErrors.length > 0) {
      showToast(validationErrors[0], 'error');
    }

    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
  }, [storageConfig, pendingFiles, showToast]);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (storageEnabled) {
      handleAddFiles(e.dataTransfer.files);
    }
  }, [storageEnabled, handleAddFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleAddFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateNewRequest(title, description);

    if (!projectId) {
      validationErrors.project = 'Please select a project';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Please fix the validation errors', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the request first
      const newRequest = await addRequestAsync(title, description, vendor, priority, projectId, onBehalfOfUserId || undefined);

      // Upload attachments using direct S3 upload
      if (pendingFiles.length > 0 && newRequest?.id) {
        for (let i = 0; i < pendingFiles.length; i++) {
          const file = pendingFiles[i];
          setUploadProgress(`Uploading ${file.name} (${i + 1}/${pendingFiles.length})`);

          try {
            await uploadFile(newRequest.id, file, (progress) => {
              setCurrentUploadProgress(progress);
            });
          } catch (uploadError) {
            // Log but continue with other files
            console.error(`Failed to upload ${file.name}:`, uploadError);
          }
        }
        setCurrentUploadProgress(null);
      }

      showToast('Request submitted successfully', 'success');
      navigate('/requests');
    } catch (error) {
      showToast('Failed to submit request', 'error');
      setIsSubmitting(false);
      setUploadProgress(null);
      setCurrentUploadProgress(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Simulation Request</h2>
        <p className="text-gray-500 dark:text-slate-400">Submit a new job for the engineering team.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isAdmin && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <UserCircle size={16} />
                Create on Behalf of User (Optional)
              </label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={onBehalfOfUserId}
                onChange={(e) => setOnBehalfOfUserId(e.target.value)}
                disabled={usersLoading}
              >
                <option value="">Create as myself</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
              {onBehalfOfUserId && (
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  This request will be created on behalf of the selected user
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Request Title</label>
            <input
              type="text"
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="e.g. Robot Cell Cycle Time Analysis"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  const { title, ...rest } = errors;
                  setErrors(rest);
                }
              }}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <FolderOpen size={16} />
              Project (Hour Budget)
            </label>
            <select
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.project ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                if (errors.project) {
                  const { project, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              disabled={projectsLoading}
            >
              <option value="">Select a project...</option>
              {approvedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.code}) - {project.totalHours - project.usedHours}h available
                </option>
              ))}
            </select>
            {errors.project && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.project}
              </p>
            )}
            {approvedProjects.length === 0 && !projectsLoading && (
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertCircle size={14} />
                No projects with available hours. Please create or request a project first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Vendor / Equipment</label>
              <select
                className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              >
                <option value="FANUC">FANUC</option>
                <option value="Siemens">Siemens</option>
                <option value="ABB">ABB</option>
                <option value="Yaskawa">Yaskawa</option>
                <option value="KUKA">KUKA</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Priority Level</label>
              <select
                className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priority}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'Low' || value === 'Medium' || value === 'High') {
                    setPriority(value);
                  }
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Detailed Description</label>
            <textarea
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none`}
              placeholder="Describe the simulation requirements, inputs, and desired outputs..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  const { description, ...rest } = errors;
                  setErrors(rest);
                }
              }}
            />
            {errors.description ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.description}
              </p>
            ) : (
              <div className="mt-2 flex items-start space-x-2 text-xs text-gray-500 dark:text-slate-500">
                <AlertCircle size={14} className="mt-0.5" />
                <span>Please include details about part weight, reach requirements, and cycle time targets for accurate feasibility analysis.</span>
              </div>
            )}
          </div>

          {/* File Attachments Section */}
          {storageEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Paperclip size={16} />
                Attachments (Optional)
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept={storageConfig?.allowedFileTypes.map((t) => `.${t}`).join(',')}
              />

              {/* Drag & Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
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

              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800"
                    >
                      <div className="flex-shrink-0">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="flex-shrink-0 p-1 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-gray-200 dark:hover:bg-slate-800"
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
            {/* Upload Progress Bar */}
            {isSubmitting && currentUploadProgress && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Loader2 className="animate-spin text-blue-500 mr-2" size={16} />
                    <span className="text-sm text-blue-700 dark:text-blue-400">
                      {currentUploadProgress.phase === 'init' && 'Initializing upload...'}
                      {currentUploadProgress.phase === 'uploading' && uploadProgress}
                      {currentUploadProgress.phase === 'completing' && 'Finalizing upload...'}
                    </span>
                  </div>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {currentUploadProgress.percent}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentUploadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{uploadProgress || 'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
