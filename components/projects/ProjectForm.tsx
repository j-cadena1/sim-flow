/**
 * @fileoverview ProjectForm Component
 *
 * Form for creating new projects with:
 * - Required fields: name, total hours
 * - Optional advanced fields: description, priority, category, deadline
 * - Collapsible advanced options section
 * - Role-based status assignment (Managers create Active, Users create Pending)
 *
 * @module components/projects/ProjectForm
 */

import React, { useState } from 'react';
import { ProjectFormProps } from './types';
import { ProjectPriority } from '../../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ProjectForm - Create/edit project form component
 *
 * @param props - Component props
 * @returns React component
 */
export const ProjectForm: React.FC<ProjectFormProps> = ({
  newProject,
  setNewProject,
  onCreateProject,
  onCancel,
  canManageProjects,
  isCreating,
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 animate-scale-in shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Project</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            placeholder="e.g., Kimberly-Clark Robot Cell Modernization"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Total Hours *
          </label>
          <input
            type="number"
            value={newProject.totalHours}
            onChange={(e) => setNewProject({ ...newProject, totalHours: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            min="1"
          />
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
      >
        {showAdvancedOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
      </button>

      {showAdvancedOptions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              rows={2}
              placeholder="Project description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Priority
            </label>
            <select
              value={newProject.priority}
              onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as ProjectPriority })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value={ProjectPriority.LOW}>Low</option>
              <option value={ProjectPriority.MEDIUM}>Medium</option>
              <option value={ProjectPriority.HIGH}>High</option>
              <option value={ProjectPriority.CRITICAL}>Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Category
            </label>
            <input
              type="text"
              value={newProject.category}
              onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g., Manufacturing, Automation"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Deadline
            </label>
            <input
              type="date"
              value={newProject.deadline}
              onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Project code will be auto-generated (e.g., 100001-2025)
      </p>

      <div className="flex gap-3">
        <button
          onClick={onCreateProject}
          disabled={isCreating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>

      {!canManageProjects && (
        <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-3">
          Note: Your project will require manager approval before it can be used.
        </p>
      )}
    </div>
  );
};
