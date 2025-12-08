/**
 * @fileoverview Configuration constants for Projects module
 *
 * Defines visual configurations for project statuses and priorities.
 *
 * @module components/projects/config
 */

import React from 'react';
import { ProjectStatus, ProjectPriority } from '../../types';
import { StatusConfig, PriorityConfig } from './types';
import {
  CheckCircle, XCircle, Clock, Archive, Pause, Play,
  Ban, AlertTriangle, Flag
} from 'lucide-react';

/**
 * Visual configuration for each project status
 * Maps status enum values to display labels, icons, and styling classes
 */
export const STATUS_CONFIG: Record<string, StatusConfig> = {
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

/**
 * Visual configuration for each project priority level
 * Maps priority enum values to display labels and styling classes
 */
export const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
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
