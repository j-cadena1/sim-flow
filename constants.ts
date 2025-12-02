import { RequestStatus } from './types';

// Storage keys
export const STORAGE_KEYS = {
  REQUESTS: 'sim-flow-requests',
} as const;

// Status colors for consistent styling
export const STATUS_COLORS = {
  [RequestStatus.SUBMITTED]: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  [RequestStatus.FEASIBILITY_REVIEW]: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  [RequestStatus.RESOURCE_ALLOCATION]: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  [RequestStatus.ENGINEERING_REVIEW]: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  [RequestStatus.IN_PROGRESS]: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  [RequestStatus.COMPLETED]: 'bg-green-500/10 text-green-500 border-green-500/20',
  [RequestStatus.ACCEPTED]: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  [RequestStatus.DENIED]: 'bg-red-500/10 text-red-500 border-red-500/20',
  [RequestStatus.REVISION_REQUESTED]: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
} as const;

// Status indicator colors (for dots/badges)
export const STATUS_INDICATOR_COLORS = {
  [RequestStatus.ACCEPTED]: 'bg-green-500',
  [RequestStatus.COMPLETED]: 'bg-green-500',
  [RequestStatus.IN_PROGRESS]: 'bg-blue-500',
  [RequestStatus.DENIED]: 'bg-red-500',
  DEFAULT: 'bg-yellow-500',
} as const;

// Priority colors
export const PRIORITY_COLORS = {
  High: 'text-red-400',
  Medium: 'text-yellow-400',
  Low: 'text-green-400',
} as const;

// Vendor options
export const VENDORS = [
  'FANUC',
  'Siemens',
  'ABB',
  'Yaskawa',
  'KUKA',
  'Other',
] as const;

// Priority levels
export const PRIORITY_LEVELS = ['Low', 'Medium', 'High'] as const;

// Chart colors
export const CHART_COLORS = {
  pending: '#eab308',
  engineering: '#3b82f6',
  completed: '#22c55e',
  denied: '#ef4444',
} as const;
