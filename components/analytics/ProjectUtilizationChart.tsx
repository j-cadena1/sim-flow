import React from 'react';
import { ProjectUtilization } from './types';

/**
 * Props for ProjectUtilizationChart component
 */
interface ProjectUtilizationChartProps {
  /** Project utilization data */
  data: ProjectUtilization[];
  /** Maximum number of projects to display */
  limit?: number;
}

/**
 * Project hour utilization visualization component
 *
 * Features:
 * - Table view of project budget vs actual hours
 * - Progress bars showing utilization percentage
 * - Color-coded indicators (green < 70%, yellow 70-90%, red > 90%)
 * - Project name and code display
 */
const ProjectUtilizationChart: React.FC<ProjectUtilizationChartProps> = ({ data, limit = 10 }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const displayData = data.slice(0, limit);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Project Utilization</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-300 dark:border-slate-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                Project
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                Budget
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">
                Used
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300 w-48">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((project) => (
              <tr key={project.projectId} className="border-b border-gray-200 dark:border-slate-800">
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {project.projectName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-500">{project.projectCode}</div>
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                  {project.totalHours.toFixed(0)}h
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                  {project.usedHours.toFixed(0)}h
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          project.utilizationPercentage > 90
                            ? 'bg-red-500'
                            : project.utilizationPercentage > 70
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(project.utilizationPercentage, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-12 text-right ${
                      project.utilizationPercentage > 90
                        ? 'text-red-600 dark:text-red-400'
                        : project.utilizationPercentage > 70
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}>
                      {project.utilizationPercentage.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectUtilizationChart;
