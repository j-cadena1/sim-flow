/**
 * @fileoverview ProjectCard Component
 *
 * Displays an individual project as a card with:
 * - Project name (editable by managers)
 * - Status and priority badges
 * - Deadline information
 * - Hour budget tracking with visual progress bar
 * - Management actions menu
 *
 * @module components/projects/ProjectCard
 */

import React from 'react';
import { ProjectCardProps, VALID_TRANSITIONS } from './types';
import { ProjectStatus } from '../../types';
import {
  Edit2, Check, X, MoreVertical, Trash2,
  Calendar, AlertTriangle, Flag
} from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './config';

/**
 * ProjectCard - Individual project card component
 *
 * @param props - Component props
 * @returns React component
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  canManageProjects,
  editingProjectId,
  editingProjectName,
  projectMenuId,
  onStartEditingName,
  onCancelEditingName,
  onSaveProjectName,
  onStatusChange,
  onDeleteProject,
  setEditingProjectName,
  setProjectMenuId,
  menuRef,
  updateProjectNameMutation,
  deleteProjectMutation,
}) => {
  const usagePercent = (project.usedHours / project.totalHours) * 100;
  const availableHours = project.totalHours - project.usedHours;
  const validActions = VALID_TRANSITIONS[project.status] || [];

  /**
   * Gets deadline status badge
   */
  const getDeadlineStatus = (deadline?: string) => {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return <span className="text-red-600 dark:text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12} /> Overdue</span>;
    } else if (daysUntil <= 7) {
      return <span className="text-orange-600 dark:text-orange-400 text-xs flex items-center gap-1"><Calendar size={12} /> Due in {daysUntil}d</span>;
    } else {
      return <span className="text-gray-500 dark:text-slate-400 text-xs flex items-center gap-1"><Calendar size={12} /> {deadlineDate.toLocaleDateString()}</span>;
    }
  };

  /**
   * Gets status badge component
   */
  const getStatusBadge = (status: ProjectStatus) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[ProjectStatus.PENDING];
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgClass} ${config.colorClass}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  /**
   * Gets priority badge component
   */
  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['medium'];
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgClass} ${config.colorClass}`}>
        <Flag size={12} /> {config.label}
      </span>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {editingProjectId === project.id ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={editingProjectName}
                onChange={(e) => setEditingProjectName(e.target.value)}
                className="flex-1 px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveProjectName(project.id);
                  if (e.key === 'Escape') onCancelEditingName();
                }}
              />
              <button
                onClick={() => onSaveProjectName(project.id)}
                className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                title="Save"
              >
                <Check size={16} />
              </button>
              <button
                onClick={onCancelEditingName}
                className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-gray-900 dark:text-white font-semibold">{project.name}</h3>
              {canManageProjects && (
                <button
                  onClick={() => onStartEditingName(project.id, project.name)}
                  className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  title="Edit project name"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          )}
          <p className="text-gray-500 dark:text-slate-400 text-sm">{project.code}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {getStatusBadge(project.status)}
          {project.priority && getPriorityBadge(project.priority)}
        </div>
      </div>

      {/* Deadline */}
      {project.deadline && (
        <div className="mb-3">
          {getDeadlineStatus(project.deadline)}
        </div>
      )}

      {/* Category */}
      {project.category && (
        <p className="text-gray-500 dark:text-slate-500 text-xs mb-2">{project.category}</p>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-slate-400">Available:</span>
          <span className="text-gray-900 dark:text-white font-semibold">{availableHours}h</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-slate-400">Used:</span>
          <span className="text-gray-500 dark:text-slate-400">{project.usedHours}h</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-slate-400">Total:</span>
          <span className="text-gray-500 dark:text-slate-400">{project.totalHours}h</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{usagePercent.toFixed(1)}% used</p>
        </div>
      </div>

      {canManageProjects && (
        <div className="mt-4 relative" ref={projectMenuId === project.id ? menuRef : null}>
          <button
            onClick={() => setProjectMenuId(projectMenuId === project.id ? null : project.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded text-sm transition-colors"
          >
            <MoreVertical size={16} />
            Manage
          </button>
          {projectMenuId === project.id && (
            <div className="absolute bottom-full mb-2 right-0 w-52 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
              {validActions.map((status) => {
                const config = STATUS_CONFIG[status];
                if (!config) return null;
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setProjectMenuId(null);
                      onStatusChange(project, status as ProjectStatus);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-3 ${config.colorClass} hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors first:rounded-t-lg`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setProjectMenuId(null);
                  onDeleteProject(project);
                }}
                disabled={deleteProjectMutation.isPending}
                className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-600/20 transition-colors rounded-b-lg disabled:opacity-50 border-t border-gray-200 dark:border-slate-700"
              >
                <Trash2 size={16} />
                {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
