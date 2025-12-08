import React from 'react';
import { Users } from 'lucide-react';
import { EngineerWorkload } from './types';

/**
 * Props for EngineerWorkloadChart component
 */
interface EngineerWorkloadChartProps {
  /** Engineer workload data */
  data: EngineerWorkload[];
  /** Maximum number of engineers to display */
  limit?: number;
}

/**
 * Engineer assignment and workload visualization component
 *
 * Features:
 * - List of engineers with avatar initials
 * - Active and completed request counts
 * - Total hours logged per engineer
 * - Gradient avatar backgrounds
 */
const EngineerWorkloadChart: React.FC<EngineerWorkloadChartProps> = ({ data, limit = 5 }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const displayData = data.slice(0, limit);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600 dark:text-blue-500" />
        Engineer Workload
      </h2>
      <div className="space-y-4">
        {displayData.map((engineer) => (
          <div key={engineer.engineerId} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {engineer.engineerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {engineer.engineerName}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-500">
                {engineer.assignedRequests} active • {engineer.completedRequests} completed
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {engineer.totalHoursLogged.toFixed(0)}h
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-500">logged</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EngineerWorkloadChart;
