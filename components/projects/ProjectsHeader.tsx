/**
 * @fileoverview ProjectsHeader Component
 *
 * Header section for Projects page with:
 * - Page title and description
 * - Metrics dashboard toggle
 * - Create new project button (role-based)
 *
 * @module components/projects/ProjectsHeader
 */

import React from 'react';
import { ProjectsHeaderProps } from './types';
import { FolderOpen, Plus, BarChart3 } from 'lucide-react';

/**
 * ProjectsHeader - Header with title, metrics toggle, and create button
 *
 * @param props - Component props
 * @returns React component
 */
export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({
  showMetricsDashboard,
  setShowMetricsDashboard,
  showCreateForm,
  setShowCreateForm,
  canCreateProjects,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <FolderOpen className="text-blue-600 dark:text-blue-400" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Manage simulation hour buckets</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowMetricsDashboard(!showMetricsDashboard)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            showMetricsDashboard
              ? 'bg-purple-600 text-white'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }`}
        >
          <BarChart3 size={20} />
          {showMetricsDashboard ? 'Hide Metrics' : 'Show Metrics'}
        </button>
        {canCreateProjects && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            New Project
          </button>
        )}
      </div>
    </div>
  );
};
