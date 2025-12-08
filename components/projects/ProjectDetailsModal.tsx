/**
 * @fileoverview ProjectDetailsModal Component
 *
 * Modal for handling project deletion when the project has associated requests.
 * Provides two options:
 * 1. Reassign requests to another project and then delete
 * 2. Delete all requests and the project (with confirmation)
 *
 * @module components/projects/ProjectDetailsModal
 */

import React from 'react';
import { ProjectDetailsModalProps } from './types';
import { AlertTriangle } from 'lucide-react';
import { useModal } from '../Modal';

/**
 * ProjectDetailsModal - Deletion workflow modal for projects with requests
 *
 * @param props - Component props
 * @returns React component or null if not active
 */
export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  requests,
  activeProjects,
  selectedTargetProject,
  setSelectedTargetProject,
  onReassignAndDelete,
  onDeleteRequestsAndProject,
  onCancel,
  isReassigning,
  isDeleting,
}) => {
  if (!project) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <AlertTriangle className="text-yellow-500" size={20} />
          Cannot Delete Project
        </h3>
        <p className="text-gray-600 dark:text-slate-400 mb-4">
          <strong>{project.name}</strong> has {requests.length} associated request(s).
          You must either reassign them to another project or delete them first.
        </p>

        {/* List of requests */}
        <div className="mb-4 max-h-40 overflow-y-auto">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Associated Requests:
          </p>
          <div className="space-y-1">
            {requests.map((req) => (
              <div
                key={req.id}
                className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded"
              >
                {req.title} <span className="text-xs text-gray-400">({req.status})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Option 1: Reassign to another project */}
        <div className="mb-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Option 1: Reassign requests to another project
          </p>
          <select
            value={selectedTargetProject}
            onChange={(e) => setSelectedTargetProject(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 mb-2"
          >
            <option value="">Select a project...</option>
            {activeProjects
              .filter((p) => p.id !== project.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) - {p.totalHours - p.usedHours}h available
                </option>
              ))}
          </select>
          <button
            onClick={onReassignAndDelete}
            disabled={!selectedTargetProject || isReassigning || isDeleting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isReassigning ? 'Reassigning...' : 'Reassign & Delete Project'}
          </button>
        </div>

        {/* Option 2: Delete all requests */}
        <div className="mb-4 p-4 border border-red-200 dark:border-red-800/50 rounded-lg bg-red-50 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
            Option 2: Delete all requests and the project
          </p>
          <button
            onClick={onDeleteRequestsAndProject}
            disabled={isDeleting || isReassigning}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete All Requests & Project'}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
