import React from 'react';
import { AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { RequestsByPriority, PriorityColors } from './types';

/**
 * Props for PriorityDistributionChart component
 */
interface PriorityDistributionChartProps {
  /** Priority distribution data */
  data: RequestsByPriority[];
}

/**
 * Priority color mapping
 */
const PRIORITY_COLORS: Record<string, PriorityColors> = {
  High: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-800' },
  Medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-800' },
  Low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-800' },
};

/**
 * Get priority colors with fallback
 */
const getPriorityColors = (priority: string): PriorityColors => {
  return PRIORITY_COLORS[priority] || { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-400', border: 'border-gray-300 dark:border-slate-700' };
};

/**
 * Bar chart component displaying request priority distribution
 *
 * Features:
 * - Color-coded cards for each priority level
 * - Count and percentage display
 * - Priority-specific icons (High, Medium, Low)
 */
const PriorityDistributionChart: React.FC<PriorityDistributionChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Requests by Priority</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.map((item) => {
          const colors = getPriorityColors(item.priority);
          const Icon = item.priority === 'High' ? AlertTriangle : item.priority === 'Medium' ? Minus : CheckCircle2;
          return (
            <div
              key={item.priority}
              className={`p-4 rounded-lg border ${colors.bg} ${colors.border} ${colors.text}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium opacity-80">{item.percentage.toFixed(1)}%</span>
              </div>
              <div className="text-3xl font-bold mt-2">{item.count}</div>
              <div className="text-sm font-medium mt-1">{item.priority} Priority</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriorityDistributionChart;
export { getPriorityColors };
