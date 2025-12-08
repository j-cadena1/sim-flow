/**
 * @fileoverview ProjectTable Component
 *
 * Main table/grid component for displaying projects in various states:
 * - Pending projects (for manager approval)
 * - Paused/suspended projects
 * - Active projects (grid of cards)
 * - Completed/cancelled projects (collapsible)
 * - Archived projects (collapsible)
 *
 * @module components/projects/ProjectTable
 */

import React from 'react';
import { ProjectTableProps } from './types';
import { ProjectStatus } from '../../types';
import { ProjectCard } from './ProjectCard';
import { STATUS_CONFIG } from './config';
import {
  Clock, Pause, CheckCircle, Play, MoreVertical,
  Trash2, RotateCcw
} from 'lucide-react';

/**
 * ProjectTable - Displays categorized project lists
 *
 * @param props - Component props
 * @returns React component
 */
export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  canManageProjects,
  editingProjectId,
  editingProjectName,
  projectMenuId,
  archivedMenuId,
  onStartEditingName,
  onCancelEditingName,
  onSaveProjectName,
  onStatusChange,
  onDeleteProject,
  onRestoreProject,
  onApproveProject,
  onArchiveProject,
  setEditingProjectName,
  setProjectMenuId,
  setArchivedMenuId,
  menuRef,
  archivedMenuRef,
  updateProjectNameMutation,
  deleteProjectMutation,
}) => {
  // Categorize projects
  const activeProjects = projects.filter(p =>
    p.status === ProjectStatus.APPROVED ||
    p.status === ProjectStatus.ACTIVE
  );
  const pendingProjects = projects.filter(p => p.status === ProjectStatus.PENDING);
  const onHoldProjects = projects.filter(p =>
    p.status === ProjectStatus.ON_HOLD ||
    p.status === ProjectStatus.SUSPENDED ||
    p.status === ProjectStatus.EXPIRED
  );
  const completedProjects = projects.filter(p =>
    p.status === ProjectStatus.COMPLETED ||
    p.status === ProjectStatus.CANCELLED
  );
  const archivedProjects = projects.filter(p => p.status === ProjectStatus.ARCHIVED);

  const getStatusBadge = (status: ProjectStatus) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[ProjectStatus.PENDING];
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgClass} ${config.colorClass}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  return (
    <>
      {/* Pending Projects (Managers only) */}
      {canManageProjects && pendingProjects.length > 0 && (
        <div className="bg-yellow-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-yellow-300 dark:border-yellow-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
            Pending Approval ({pendingProjects.length})
          </h2>
          <div className="space-y-3">
            {pendingProjects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-yellow-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold">{project.name}</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Code: {project.code} • {project.totalHours} hours • Created by {project.createdByName}
                  </p>
                  {project.description && (
                    <p className="text-gray-500 dark:text-slate-500 text-sm mt-1 line-clamp-1">{project.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onApproveProject(project.id, project.name)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onStatusChange(project, ProjectStatus.CANCELLED)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On Hold / Suspended / Expired Projects */}
      {onHoldProjects.length > 0 && (
        <div className="bg-orange-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-orange-300 dark:border-orange-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Pause size={20} className="text-orange-600 dark:text-orange-400" />
            Paused / Suspended ({onHoldProjects.length})
          </h2>
          <div className="space-y-3">
            {onHoldProjects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-orange-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-gray-900 dark:text-white font-semibold">{project.name}</h3>
                    {getStatusBadge(project.status)}
                  </div>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Code: {project.code} • {project.usedHours}/{project.totalHours}h used
                  </p>
                </div>
                {canManageProjects && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onStatusChange(project, ProjectStatus.ACTIVE)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                    >
                      <Play size={14} /> Resume
                    </button>
                    <button
                      onClick={() => onArchiveProject(project.id, project.name)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Projects */}
      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Projects ({activeProjects.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManageProjects={canManageProjects}
              editingProjectId={editingProjectId}
              editingProjectName={editingProjectName}
              projectMenuId={projectMenuId}
              onStartEditingName={onStartEditingName}
              onCancelEditingName={onCancelEditingName}
              onSaveProjectName={onSaveProjectName}
              onStatusChange={onStatusChange}
              onDeleteProject={onDeleteProject}
              setEditingProjectName={setEditingProjectName}
              setProjectMenuId={setProjectMenuId}
              menuRef={projectMenuId === project.id ? menuRef : undefined}
              updateProjectNameMutation={updateProjectNameMutation}
              deleteProjectMutation={deleteProjectMutation}
            />
          ))}
        </div>
        {activeProjects.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-slate-500">
            No active projects. Create one to get started!
          </div>
        )}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <details className="bg-blue-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-blue-200 dark:border-slate-800">
          <summary className="text-lg font-semibold text-gray-700 dark:text-slate-300 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2">
            <CheckCircle size={20} className="text-blue-600 dark:text-blue-400" />
            Completed / Cancelled Projects ({completedProjects.length})
          </summary>
          <div className="mt-4 space-y-2">
            {completedProjects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-slate-800/30 p-3 rounded-lg border border-blue-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-slate-300 font-medium">{project.name}</span>
                      {getStatusBadge(project.status)}
                    </div>
                    <span className="text-gray-500 dark:text-slate-500 text-sm">({project.code})</span>
                    <div className="text-gray-500 dark:text-slate-500 text-sm mt-1">
                      {project.usedHours}/{project.totalHours}h used
                    </div>
                  </div>
                  {canManageProjects && (
                    <button
                      onClick={() => onArchiveProject(project.id, project.name)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Archived Projects */}
      {archivedProjects.length > 0 && (
        <details className="bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800">
          <summary className="text-lg font-semibold text-gray-500 dark:text-slate-400 cursor-pointer hover:text-gray-700 dark:hover:text-slate-300 transition-colors">
            Archived Projects ({archivedProjects.length})
          </summary>
          <div className="mt-4 space-y-2">
            {archivedProjects.map((project) => (
              <div key={project.id} className="bg-white dark:bg-slate-800/30 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-gray-700 dark:text-slate-300 font-medium">{project.name}</span>
                    <span className="text-gray-500 dark:text-slate-500 text-sm ml-2">({project.code})</span>
                    <div className="text-gray-500 dark:text-slate-500 text-sm mt-1">
                      {project.usedHours}/{project.totalHours}h used
                    </div>
                  </div>
                  {canManageProjects && (
                    <div className="relative" ref={archivedMenuId === project.id ? archivedMenuRef : null}>
                      <button
                        onClick={() => setArchivedMenuId(archivedMenuId === project.id ? null : project.id)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded text-sm transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {archivedMenuId === project.id && (
                        <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                          <button
                            onClick={() => {
                              setArchivedMenuId(null);
                              onRestoreProject(project.id, project.name);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors rounded-t-lg"
                          >
                            <RotateCcw size={16} />
                            Restore Project
                          </button>
                          <button
                            onClick={() => {
                              setArchivedMenuId(null);
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
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
};
