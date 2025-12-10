/**
 * @fileoverview Projects Management Component
 *
 * Provides full project lifecycle management including creation, status
 * transitions, hour budget management, and deletion workflows.
 *
 * Features:
 * - Project list with health metrics and deadline warnings
 * - Status filtering and visual indicators
 * - Create new projects with hour budgets and deadlines
 * - Status transitions with lifecycle state machine
 * - Project deletion with request reassignment options
 * - Hour utilization tracking
 * - Projects nearing deadline alerts
 *
 * Project Lifecycle:
 * Pending → Approved/Active → On Hold/Suspended → Completed/Cancelled → Archived
 *
 * @module components/Projects
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSimRQ } from '../contexts/SimRQContext';
import {
  useProjects,
  useCreateProject,
  useUpdateProjectName,
  useUpdateProjectStatus,
  useDeleteProject,
  useProjectsWithMetrics,
  useProjectsNearDeadline,
  useReassignProjectRequests,
  useDeleteProjectRequests,
} from '../lib/api/hooks';
import { useModal } from './Modal';
import { useToast } from './Toast';
import { ProjectStatus, ProjectPriority, UserRole, Project } from '../types';
import {
  ProjectsHeader,
  ProjectForm,
  ProjectStatusModal,
  ProjectDetailsModal,
  ProjectTable,
  MetricsDashboard,
  ProjectFormData,
  REQUIRES_REASON,
  STATUS_CONFIG,
} from './projects/index';

export const Projects: React.FC = () => {
  const { currentUser } = useSimRQ();
  const { data: projects = [], isLoading } = useProjects();
  const { data: projectMetrics = [] } = useProjectsWithMetrics();
  const { data: nearDeadlineProjects = [] } = useProjectsNearDeadline(14);
  const createProjectMutation = useCreateProject();
  const updateProjectNameMutation = useUpdateProjectName();
  const updateProjectStatusMutation = useUpdateProjectStatus();
  const deleteProjectMutation = useDeleteProject();
  const reassignRequestsMutation = useReassignProjectRequests();
  const deleteRequestsMutation = useDeleteProjectRequests();
  const { showPrompt, showConfirm } = useModal();
  const { showToast } = useToast();

  // UI State
  const [showMetricsDashboard, setShowMetricsDashboard] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState<ProjectFormData>({
    name: '',
    description: '',
    totalHours: 100,
    priority: ProjectPriority.MEDIUM,
    category: '',
    deadline: '',
  });

  // Project editing state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [archivedMenuId, setArchivedMenuId] = useState<string | null>(null);

  // Modal state
  const [statusChangeModal, setStatusChangeModal] = useState<{
    project: Project;
    targetStatus: ProjectStatus;
  } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [deleteModal, setDeleteModal] = useState<{
    project: Project;
    requests: { id: string; title: string; status: string }[];
  } | null>(null);
  const [selectedTargetProject, setSelectedTargetProject] = useState<string>('');

  // Refs
  const menuRef = useRef<HTMLDivElement>(null);
  const archivedMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProjectMenuId(null);
      }
      if (archivedMenuRef.current && !archivedMenuRef.current.contains(event.target as Node)) {
        setArchivedMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canManageProjects = currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN;
  const canCreateProjects = currentUser.role === UserRole.USER || canManageProjects;

  /**
   * Handles project creation
   */
  const handleCreateProject = () => {
    if (!newProject.name) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (newProject.totalHours < 1) {
      showToast('Total hours must be at least 1', 'error');
      return;
    }

    // Manager creates as Active, User creates as Pending
    const status = canManageProjects ? ProjectStatus.ACTIVE : ProjectStatus.PENDING;

    createProjectMutation.mutate({
      name: newProject.name,
      description: newProject.description || undefined,
      totalHours: newProject.totalHours,
      priority: newProject.priority,
      category: newProject.category || undefined,
      deadline: newProject.deadline || undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      status,
    }, {
      onSuccess: () => {
        showToast(`Project created${canManageProjects ? '' : ' (pending approval)'}`, 'success');
        setNewProject({ name: '', description: '', totalHours: 100, priority: ProjectPriority.MEDIUM, category: '', deadline: '' });
        setShowCreateForm(false);
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || 'Failed to create project', 'error');
      },
    });
  };

  /**
   * Handles status change initiation
   */
  const handleStatusChange = (project: Project, targetStatus: ProjectStatus) => {
    // Check if reason is required
    if (REQUIRES_REASON.includes(targetStatus)) {
      setStatusChangeModal({ project, targetStatus });
      setStatusChangeReason('');
    } else {
      executeStatusChange(project.id, project.name, targetStatus);
    }
  };

  /**
   * Executes the status change
   */
  const executeStatusChange = (id: string, name: string, status: ProjectStatus, reason?: string) => {
    const statusConfig = STATUS_CONFIG[status];
    const actionLabel = statusConfig?.label || status;

    updateProjectStatusMutation.mutate(
      { id, status, reason },
      {
        onSuccess: () => {
          showToast(`Project ${actionLabel.toLowerCase()}`, 'success');
          setStatusChangeModal(null);
          setStatusChangeReason('');
          setProjectMenuId(null);
          setArchivedMenuId(null);
        },
        onError: (error: any) => {
          showToast(error.response?.data?.error || `Failed to ${actionLabel.toLowerCase()} project`, 'error');
        },
      }
    );
  };

  /**
   * Handles project approval
   */
  const handleApproveProject = (id: string, name: string) => {
    showPrompt(
      'Approve Project',
      `Approve project "${name}"?`,
      () => executeStatusChange(id, name, ProjectStatus.ACTIVE)
    );
  };

  /**
   * Handles project archival
   */
  const handleArchiveProject = (id: string, name: string) => {
    showPrompt(
      'Archive Project',
      `Archive project "${name}"? This will hide it from active projects.`,
      () => executeStatusChange(id, name, ProjectStatus.ARCHIVED)
    );
  };

  /**
   * Handles project deletion
   */
  const handleDeleteProject = (project: Project) => {
    deleteProjectMutation.mutate(project.id, {
      onSuccess: () => {
        showToast('Project deleted successfully', 'success');
        setProjectMenuId(null);
        setArchivedMenuId(null);
      },
      onError: (error: any) => {
        // Check if error is due to associated requests
        if (error.response?.status === 409 && error.response?.data?.hasRequests) {
          setDeleteModal({
            project,
            requests: error.response.data.requests || [],
          });
          setProjectMenuId(null);
          setArchivedMenuId(null);
        } else {
          showToast(error.response?.data?.error || 'Failed to delete project', 'error');
        }
      },
    });
  };

  /**
   * Handles reassigning requests and deleting project
   */
  const handleReassignAndDelete = () => {
    if (!deleteModal || !selectedTargetProject) {
      showToast('Please select a target project', 'error');
      return;
    }

    reassignRequestsMutation.mutate(
      { projectId: deleteModal.project.id, targetProjectId: selectedTargetProject },
      {
        onSuccess: () => {
          // Now delete the project
          deleteProjectMutation.mutate(deleteModal.project.id, {
            onSuccess: () => {
              showToast('Requests reassigned and project deleted successfully', 'success');
              setDeleteModal(null);
              setSelectedTargetProject('');
            },
            onError: () => {
              showToast('Requests reassigned but failed to delete project', 'error');
              setDeleteModal(null);
              setSelectedTargetProject('');
            },
          });
        },
        onError: (error: any) => {
          showToast(error.response?.data?.error || 'Failed to reassign requests', 'error');
        },
      }
    );
  };

  /**
   * Handles deleting all requests and the project
   */
  const handleDeleteRequestsAndProject = () => {
    if (!deleteModal) return;

    showConfirm(
      'Delete All Requests',
      `This will permanently delete ${deleteModal.requests.length} request(s) and the project. This cannot be undone. Continue?`,
      () => {
        deleteRequestsMutation.mutate(deleteModal.project.id, {
          onSuccess: () => {
            // Now delete the project
            deleteProjectMutation.mutate(deleteModal.project.id, {
              onSuccess: () => {
                showToast('Requests and project deleted successfully', 'success');
                setDeleteModal(null);
              },
              onError: () => {
                showToast('Requests deleted but failed to delete project', 'error');
                setDeleteModal(null);
              },
            });
          },
          onError: (error: any) => {
            showToast(error.response?.data?.error || 'Failed to delete requests', 'error');
          },
        });
      }
    );
  };

  /**
   * Handles restoring archived project
   */
  const handleRestoreProject = (id: string, name: string) => {
    showConfirm(
      'Restore Project',
      `Restore project "${name}" to active projects?`,
      () => executeStatusChange(id, name, ProjectStatus.ACTIVE)
    );
  };

  /**
   * Initiates project name editing
   */
  const handleStartEditingName = (id: string, currentName: string) => {
    setEditingProjectId(id);
    setEditingProjectName(currentName);
  };

  /**
   * Cancels project name editing
   */
  const handleCancelEditingName = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  /**
   * Saves edited project name
   */
  const handleSaveProjectName = (id: string) => {
    if (!editingProjectName.trim()) {
      showToast('Project name cannot be empty', 'error');
      return;
    }

    updateProjectNameMutation.mutate(
      { id, name: editingProjectName },
      {
        onSuccess: () => {
          showToast('Project name updated', 'success');
          setEditingProjectId(null);
          setEditingProjectName('');
        },
        onError: (error: any) => {
          showToast(error.response?.data?.error || 'Failed to update project name', 'error');
        },
      }
    );
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600 dark:text-slate-400">Loading projects...</div>;
  }

  // Categorize projects for deletion modal
  const activeProjects = projects.filter(p =>
    p.status === ProjectStatus.ACTIVE
  );

  return (
    <div className="space-y-6">
      {/* Status Change Modal */}
      <ProjectStatusModal
        project={statusChangeModal?.project || null}
        targetStatus={statusChangeModal?.targetStatus || null}
        reason={statusChangeReason}
        setReason={setStatusChangeReason}
        onConfirm={executeStatusChange}
        onCancel={() => {
          setStatusChangeModal(null);
          setStatusChangeReason('');
        }}
        isUpdating={updateProjectStatusMutation.isPending}
      />

      {/* Delete Project Modal - Shows when project has associated requests */}
      <ProjectDetailsModal
        project={deleteModal?.project || null}
        requests={deleteModal?.requests || []}
        activeProjects={activeProjects}
        selectedTargetProject={selectedTargetProject}
        setSelectedTargetProject={setSelectedTargetProject}
        onReassignAndDelete={handleReassignAndDelete}
        onDeleteRequestsAndProject={handleDeleteRequestsAndProject}
        onCancel={() => {
          setDeleteModal(null);
          setSelectedTargetProject('');
        }}
        isReassigning={reassignRequestsMutation.isPending}
        isDeleting={deleteRequestsMutation.isPending}
      />

      {/* Header */}
      <ProjectsHeader
        showMetricsDashboard={showMetricsDashboard}
        setShowMetricsDashboard={setShowMetricsDashboard}
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        canCreateProjects={canCreateProjects}
      />

      {/* Metrics Dashboard */}
      {showMetricsDashboard && (
        <MetricsDashboard
          projectMetrics={projectMetrics}
          nearDeadlineProjects={nearDeadlineProjects}
        />
      )}

      {/* Create Form */}
      {showCreateForm && (
        <ProjectForm
          newProject={newProject}
          setNewProject={setNewProject}
          onCreateProject={handleCreateProject}
          onCancel={() => setShowCreateForm(false)}
          canManageProjects={canManageProjects}
          isCreating={createProjectMutation.isPending}
        />
      )}

      {/* Project Tables */}
      <ProjectTable
        projects={projects}
        canManageProjects={canManageProjects}
        currentUserId={currentUser.id}
        editingProjectId={editingProjectId}
        editingProjectName={editingProjectName}
        projectMenuId={projectMenuId}
        archivedMenuId={archivedMenuId}
        onStartEditingName={handleStartEditingName}
        onCancelEditingName={handleCancelEditingName}
        onSaveProjectName={handleSaveProjectName}
        onStatusChange={handleStatusChange}
        onDeleteProject={handleDeleteProject}
        onRestoreProject={handleRestoreProject}
        onApproveProject={handleApproveProject}
        onArchiveProject={handleArchiveProject}
        setEditingProjectName={setEditingProjectName}
        setProjectMenuId={setProjectMenuId}
        setArchivedMenuId={setArchivedMenuId}
        menuRef={menuRef}
        archivedMenuRef={archivedMenuRef}
        updateProjectNameMutation={updateProjectNameMutation}
        deleteProjectMutation={deleteProjectMutation}
      />
    </div>
  );
};
