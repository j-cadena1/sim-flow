/**
 * @fileoverview MetricsDashboard Component
 *
 * Displays project health metrics and analytics:
 * - Summary cards (active projects, total budget, hours used, avg utilization)
 * - Projects nearing deadline alerts
 * - Utilization overview with visual progress bars
 *
 * @module components/projects/MetricsDashboard
 */

import React from 'react';
import { ProjectStatus, ProjectHealthMetrics } from '../../types';
import { Activity, Calendar, TrendingUp } from 'lucide-react';

interface MetricsDashboardProps {
  projectMetrics: ProjectHealthMetrics[];
  nearDeadlineProjects: any[];
}

/**
 * MetricsDashboard - Project health analytics dashboard
 *
 * @param props - Component props
 * @returns React component
 */
export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  projectMetrics,
  nearDeadlineProjects,
}) => {
  const activeCount = projectMetrics.filter((p: ProjectHealthMetrics) =>
    p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.APPROVED
  ).length;
  const totalHours = projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (p.totalHours || 0), 0);
  const usedHours = projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (p.usedHours || 0), 0);
  const avgUtilization = projectMetrics.length > 0
    ? projectMetrics.reduce((sum: number, p: ProjectHealthMetrics) => sum + (Number(p.utilizationPercentage) || 0), 0) / projectMetrics.length
    : 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900/80 dark:to-slate-800/80 p-6 rounded-2xl border border-purple-200 dark:border-purple-800/50 animate-scale-in">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="text-purple-600 dark:text-purple-400" size={24} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Project Health Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
  );
};
