/**
 * @fileoverview Shared types and constants for Projects module
 *
 * Defines interfaces, enums, and configuration objects used across
 * project management components.
 *
 * @module components/projects/types
 */

import { Project, ProjectStatus, ProjectPriority } from '../../types';
import React from 'react';

/**
 * Configuration for visual display of project statuses
 */
export interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

/**
 * Configuration for visual display of project priorities
 */
export interface PriorityConfig {
  label: string;
  colorClass: string;
  bgClass: string;
}

/**
 * Form data structure for creating/editing projects
 */
export interface ProjectFormData {
  name: string;
  description: string;
  totalHours: number;
  priority: ProjectPriority;
  category: string;
  deadline: string;
}

/**
 * Props for ProjectCard component
 */
export interface ProjectCardProps {
  project: Project;
  canManageProjects: boolean;
  editingProjectId: string | null;
  editingProjectName: string;
  projectMenuId: string | null;
  onStartEditingName: (id: string, currentName: string) => void;
  onCancelEditingName: () => void;
  onSaveProjectName: (id: string) => void;
  onStatusChange: (project: Project, targetStatus: ProjectStatus) => void;
  onDeleteProject: (project: Project) => void;
  setEditingProjectName: (name: string) => void;
  setProjectMenuId: (id: string | null) => void;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  updateProjectNameMutation: any;
  deleteProjectMutation: any;
}

/**
 * Props for ProjectForm component
 */
export interface ProjectFormProps {
  newProject: ProjectFormData;
  setNewProject: (project: ProjectFormData) => void;
  onCreateProject: () => void;
  onCancel: () => void;
  canManageProjects: boolean;
  isCreating: boolean;
}

/**
 * Props for ProjectStatusModal component
 */
export interface ProjectStatusModalProps {
  project: Project | null;
  targetStatus: ProjectStatus | null;
  reason: string;
  setReason: (reason: string) => void;
  onConfirm: (id: string, name: string, status: ProjectStatus, reason?: string) => void;
  onCancel: () => void;
  isUpdating: boolean;
}

/**
 * Props for ProjectDetailsModal (deletion workflow)
 */
export interface ProjectDetailsModalProps {
  project: Project | null;
  requests: { id: string; title: string; status: string }[];
  activeProjects: Project[];
  selectedTargetProject: string;
  setSelectedTargetProject: (id: string) => void;
  onReassignAndDelete: () => void;
  onDeleteRequestsAndProject: () => void;
  onCancel: () => void;
  isReassigning: boolean;
  isDeleting: boolean;
}

/**
 * Props for ProjectsHeader component
 */
export interface ProjectsHeaderProps {
  showMetricsDashboard: boolean;
  setShowMetricsDashboard: (show: boolean) => void;
  showCreateForm: boolean;
  setShowCreateForm: (show: boolean) => void;
  canCreateProjects: boolean;
}

/**
 * Props for ProjectTable component
 */
export interface ProjectTableProps {
  projects: Project[];
  canManageProjects: boolean;
  editingProjectId: string | null;
  editingProjectName: string;
  projectMenuId: string | null;
  archivedMenuId: string | null;
  onStartEditingName: (id: string, currentName: string) => void;
  onCancelEditingName: () => void;
  onSaveProjectName: (id: string) => void;
  onStatusChange: (project: Project, targetStatus: ProjectStatus) => void;
  onDeleteProject: (project: Project) => void;
  onRestoreProject: (id: string, name: string) => void;
  onApproveProject: (id: string, name: string) => void;
  onArchiveProject: (id: string, name: string) => void;
  setEditingProjectName: (name: string) => void;
  setProjectMenuId: (id: string | null) => void;
  setArchivedMenuId: (id: string | null) => void;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  archivedMenuRef?: React.RefObject<HTMLDivElement | null>;
  updateProjectNameMutation: any;
  deleteProjectMutation: any;
}

/**
 * Valid project status transition state machine
 * Defines which statuses a project can transition to from its current state
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  [ProjectStatus.PENDING]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.SUSPENDED, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.EXPIRED, ProjectStatus.ARCHIVED],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.SUSPENDED, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.SUSPENDED]: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED],
  [ProjectStatus.COMPLETED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.CANCELLED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.EXPIRED]: [ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [],
};

/**
 * Project statuses that require a reason to be provided
 */
export const REQUIRES_REASON = [
  ProjectStatus.ON_HOLD,
  ProjectStatus.SUSPENDED,
  ProjectStatus.CANCELLED,
  ProjectStatus.EXPIRED
];
