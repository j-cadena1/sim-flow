/**
 * @fileoverview ProjectStatusModal Component
 *
 * Modal dialog for changing project status with optional reason field.
 * Enforces requirement to provide a reason for certain status changes
 * (on hold, suspended, cancelled, expired).
 *
 * @module components/projects/ProjectStatusModal
 */

import React from 'react';
import { ProjectStatusModalProps } from './types';
import { STATUS_CONFIG } from './config';
import { useToast } from '../Toast';

/**
 * ProjectStatusModal - Status change confirmation modal
 *
 * @param props - Component props
 * @returns React component or null if not active
 */
export const ProjectStatusModal: React.FC<ProjectStatusModalProps> = ({
  project,
  targetStatus,
  reason,
  setReason,
  onConfirm,
  onCancel,
  isUpdating,
}) => {
  const { showToast } = useToast();

  if (!project || !targetStatus) return null;

  const statusConfig = STATUS_CONFIG[targetStatus];

  const handleConfirm = () => {
    if (!reason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }
    onConfirm(project.id, project.name, targetStatus, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Change Status to {statusConfig?.label || targetStatus}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 mb-4">
          Project: <strong>{project.name}</strong>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            rows={3}
            placeholder="Please provide a reason for this status change..."
            autoFocus
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isUpdating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
