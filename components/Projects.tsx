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
import { useSimFlow } from '../contexts/SimFlowContext';
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
import { ProjectStatus, ProjectPriority, UserRole, Project, ProjectHealthMetrics } from '../types';
import {
  FolderOpen, Plus, CheckCircle, XCircle, Clock, Archive, Edit2, Check, X,
  MoreVertical, Trash2, RotateCcw, Pause, Play, Ban, Calendar, AlertTriangle,
  Flag, ChevronDown, ChevronUp, History, TrendingUp, BarChart3, Activity
} from 'lucide-react';

/** Visual configuration for each project status */
const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string }> = {
  [ProjectStatus.PENDING]: {
    label: 'Pending',
    icon: <Clock size={14} />,
    colorClass: 'text-yellow-600 dark:text-yellow-400',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  [ProjectStatus.APPROVED]: {
    label: 'Approved',
    icon: <CheckCircle size={14} />,
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  [ProjectStatus.ACTIVE]: {
    label: 'Active',
    icon: <Play size={14} />,
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  [ProjectStatus.ON_HOLD]: {
    label: 'On Hold',
    icon: <Pause size={14} />,
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  [ProjectStatus.SUSPENDED]: {
    label: 'Suspended',
    icon: <Ban size={14} />,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  [ProjectStatus.COMPLETED]: {
    label: 'Completed',
    icon: <CheckCircle size={14} />,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  [ProjectStatus.CANCELLED]: {
    label: 'Cancelled',
    icon: <XCircle size={14} />,
    colorClass: 'text-gray-600 dark:text-gray-400',
    bgClass: 'bg-gray-100 dark:bg-gray-900/30',
  },
  [ProjectStatus.EXPIRED]: {
    label: 'Expired',
    icon: <AlertTriangle size={14} />,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  [ProjectStatus.ARCHIVED]: {
    label: 'Archived',
    icon: <Archive size={14} />,
    colorClass: 'text-gray-500 dark:text-slate-500',
    bgClass: 'bg-gray-100 dark:bg-slate-800',
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  [ProjectPriority.LOW]: {
    label: 'Low',
    colorClass: 'text-gray-600 dark:text-gray-400',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
  },
  [ProjectPriority.MEDIUM]: {
    label: 'Medium',
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  [ProjectPriority.HIGH]: {
    label: 'High',
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  [ProjectPriority.CRITICAL]: {
    label: 'Critical',
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
};

// Valid transitions from each state
const VALID_TRANSITIONS: Record<string, string[]> = {
  [ProjectStatus.PENDING]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.APPROVED]: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.SUSPENDED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.SUSPENDED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.EXPIRED, ProjectStatus.ARCHIVED],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.SUSPENDED, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.SUSPENDED]: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.CANCELLED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.EXPIRED]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [],
};

// States that require a reason
const REQUIRES_REASON = [ProjectStatus.ON_HOLD, ProjectStatus.SUSPENDED, ProjectStatus.CANCELLED, ProjectStatus.EXPIRED];

export const Projects: React.FC = () => {
  const { currentUser } = useSimFlow();
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

  const [showMetricsDashboard, setShowMetricsDashboard] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    totalHours: 100,
    priority: ProjectPriority.MEDIUM,
    category: '',
    deadline: '',
  });
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [archivedMenuId, setArchivedMenuId] = useState<string | null>(null);
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
        setShowAdvancedOptions(false);
      },
      onError: (error: any) => {
        showToast(error.response?.data?.error || 'Failed to create project', 'error');
      },
    });
  };

  const handleStatusChange = (project: Project, targetStatus: ProjectStatus) => {
    // Check if reason is required
    if (REQUIRES_REASON.includes(targetStatus)) {
      setStatusChangeModal({ project, targetStatus });
      setStatusChangeReason('');
    } else {
      executeStatusChange(project.id, project.name, targetStatus);
    }
  };

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

  const handleApproveProject = (id: string, name: string) => {
    showPrompt(
      'Approve Project',
      `Approve project "${name}"?`,
      () => executeStatusChange(id, name, ProjectStatus.ACTIVE)
    );
  };

  const handleArchiveProject = (id: string, name: string) => {
    showPrompt(
      'Archive Project',
      `Archive project "${name}"? This will hide it from active projects.`,
      () => executeStatusChange(id, name, ProjectStatus.ARCHIVED)
    );
  };

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

  const handleRestoreProject = (id: string, name: string) => {
    showConfirm(
      'Restore Project',
      `Restore project "${name}" to active projects?`,
      () => executeStatusChange(id, name, ProjectStatus.ACTIVE)
    );
  };

  const handleStartEditingName = (id: string, currentName: string) => {
    setEditingProjectId(id);
    setEditingProjectName(currentName);
  };

  const handleCancelEditingName = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

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

  const getStatusBadge = (status: ProjectStatus) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[ProjectStatus.PENDING];
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgClass} ${config.colorClass}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: ProjectPriority) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[ProjectPriority.MEDIUM];
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.bgClass} ${config.colorClass}`}>
        <Flag size={12} /> {config.label}
      </span>
    );
  };

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

  const getValidActions = (project: Project) => {
    const validTargets = VALID_TRANSITIONS[project.status] || [];
    return validTargets.map(status => ({
      status,
      config: STATUS_CONFIG[status],
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600 dark:text-slate-400">Loading projects...</div>;
  }

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

  return (
    <div className="space-y-6">
      {/* Status Change Modal */}
      {statusChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Status to {STATUS_CONFIG[statusChangeModal.targetStatus]?.label}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              Project: <strong>{statusChangeModal.project.name}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                rows={3}
                placeholder="Please provide a reason for this status change..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setStatusChangeModal(null);
                  setStatusChangeReason('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!statusChangeReason.trim()) {
                    showToast('Please provide a reason', 'error');
                    return;
                  }
                  executeStatusChange(
                    statusChangeModal.project.id,
                    statusChangeModal.project.name,
                    statusChangeModal.targetStatus,
                    statusChangeReason
                  );
                }}
                disabled={updateProjectStatusMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {updateProjectStatusMutation.isPending ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal - Shows when project has associated requests */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 max-w-lg w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="text-yellow-500" size={20} />
              Cannot Delete Project
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              <strong>{deleteModal.project.name}</strong> has {deleteModal.requests.length} associated request(s).
              You must either reassign them to another project or delete them first.
            </p>

            {/* List of requests */}
            <div className="mb-4 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Associated Requests:</p>
              <div className="space-y-1">
                {deleteModal.requests.map((req) => (
                  <div key={req.id} className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded">
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
                  .filter((p) => p.id !== deleteModal.project.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) - {p.totalHours - p.usedHours}h available
                    </option>
                  ))}
              </select>
              <button
                onClick={handleReassignAndDelete}
                disabled={!selectedTargetProject || reassignRequestsMutation.isPending || deleteProjectMutation.isPending}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {reassignRequestsMutation.isPending ? 'Reassigning...' : 'Reassign & Delete Project'}
              </button>
            </div>

            {/* Option 2: Delete all requests */}
            <div className="mb-4 p-4 border border-red-200 dark:border-red-800/50 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                Option 2: Delete all requests and the project
              </p>
              <button
                onClick={handleDeleteRequestsAndProject}
                disabled={deleteRequestsMutation.isPending || deleteProjectMutation.isPending}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteRequestsMutation.isPending ? 'Deleting...' : 'Delete All Requests & Project'}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setSelectedTargetProject('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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

      {/* Metrics Dashboard */}
      {showMetricsDashboard && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900/80 dark:to-slate-800/80 p-6 rounded-2xl border border-purple-200 dark:border-purple-800/50 animate-scale-in">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-purple-600 dark:text-purple-400" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Project Health Dashboard</h2>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {(() => {
              const activeCount = projectMetrics.filter((p: ProjectHealthMetrics) =>
                p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.APPROVED
              ).length;
              const totalHours = projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (p.totalHours || 0), 0);
              const usedHours = projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (p.usedHours || 0), 0);
              const avgUtilization = projectMetrics.length > 0
                ? projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (Number(p.utilizationPercentage) || 0), 0) / projectMetrics.length
                : 0;

              return (
                <>
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="text-sm text-gray-500 dark:text-slate-400">Active Projects</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="text-sm text-gray-500 dark:text-slate-400">Total Budget</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalHours.toLocaleString()}h</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="text-sm text-gray-500 dark:text-slate-400">Hours Used</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{usedHours.toLocaleString()}h</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="text-sm text-gray-500 dark:text-slate-400">Avg. Utilization</div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{avgUtilization.toFixed(1)}%</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Projects Near Deadline */}
          {nearDeadlineProjects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="text-red-500" size={18} />
                Approaching Deadline ({nearDeadlineProjects.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {nearDeadlineProjects.slice(0, 6).map((project: any) => (
                  <div
                    key={project.id}
                    className="bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-red-200 dark:border-red-800/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-sm truncate">{project.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        project.days_until_deadline <= 3
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                      }`}>
                        {project.days_until_deadline}d left
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {project.code} • {project.used_hours || 0}/{project.total_hours || 0}h
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ((project.used_hours || 0) / (project.total_hours || 1)) * 100 > 80
                            ? 'bg-red-500'
                            : ((project.used_hours || 0) / (project.total_hours || 1)) * 100 > 50
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, ((project.used_hours || 0) / (project.total_hours || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Utilization Overview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={18} />
              Utilization by Project
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projectMetrics
                .filter((p: ProjectHealthMetrics) => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.APPROVED)
                .sort((a: ProjectHealthMetrics, b: ProjectHealthMetrics) => (Number(b.utilizationPercentage) || 0) - (Number(a.utilizationPercentage) || 0))
                .slice(0, 10)
                .map((project: ProjectHealthMetrics) => {
                  const utilization = Number(project.utilizationPercentage) || 0;
                  return (
                    <div key={project.id} className="bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{project.name}</span>
                          <span className="text-xs text-gray-500 dark:text-slate-500">{project.code}</span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {project.usedHours}/{project.totalHours}h ({utilization.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            utilization > 90
                              ? 'bg-red-500'
                              : utilization > 70
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {projectMetrics.filter((p: ProjectHealthMetrics) => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.APPROVED).length === 0 && (
                <p className="text-gray-500 dark:text-slate-400 text-sm text-center py-4">No active projects</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 animate-scale-in shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Project Name *</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                placeholder="e.g., Kimberly-Clark Robot Cell Modernization"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Total Hours *</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  rows={2}
                  placeholder="Project description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Priority</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Category</label>
                <input
                  type="text"
                  value={newProject.category}
                  onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Manufacturing, Automation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Deadline</label>
                <input
                  type="date"
                  value={newProject.deadline}
                  onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Project code will be auto-generated (e.g., 100001-2025)</p>
          <div className="flex gap-3">
            <button
              onClick={handleCreateProject}
              disabled={createProjectMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setShowAdvancedOptions(false);
              }}
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
      )}

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
                    onClick={() => handleApproveProject(project.id, project.name)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange(project, ProjectStatus.CANCELLED)}
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
                      onClick={() => handleStatusChange(project, ProjectStatus.ACTIVE)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                    >
                      <Play size={14} /> Resume
                    </button>
                    <button
                      onClick={() => handleArchiveProject(project.id, project.name)}
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
          {activeProjects.map((project) => {
            const usagePercent = (project.usedHours / project.totalHours) * 100;
            const availableHours = project.totalHours - project.usedHours;
            const validActions = getValidActions(project);

            return (
              <div key={project.id} className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors">
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
                            if (e.key === 'Enter') handleSaveProjectName(project.id);
                            if (e.key === 'Escape') handleCancelEditingName();
                          }}
                        />
                        <button
                          onClick={() => handleSaveProjectName(project.id)}
                          className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancelEditingName}
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
                            onClick={() => handleStartEditingName(project.id, project.name)}
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
                        {validActions.map(({ status, config }) => (
                          <button
                            key={status}
                            onClick={() => {
                              setProjectMenuId(null);
                              handleStatusChange(project, status as ProjectStatus);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-3 ${config.colorClass} hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors first:rounded-t-lg`}
                          >
                            {config.icon}
                            {config.label}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setProjectMenuId(null);
                            handleDeleteProject(project);
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
          })}
        </div>
        {activeProjects.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-slate-500">
            No active projects. {canCreateProjects && 'Create one to get started!'}
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
                      onClick={() => handleArchiveProject(project.id, project.name)}
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
                              handleRestoreProject(project.id, project.name);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors rounded-t-lg"
                          >
                            <RotateCcw size={16} />
                            Restore Project
                          </button>
                          <button
                            onClick={() => {
                              setArchivedMenuId(null);
                              handleDeleteProject(project);
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
    </div>
  );
};
