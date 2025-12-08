import React from 'react';
import { TrendingUp, Timer, Target, Zap } from 'lucide-react';
import { AverageMetrics } from './types';

/**
 * Props for TrendsChart component
 */
interface TrendsChartProps {
  /** Average performance metrics */
  metrics: AverageMetrics;
}

/**
 * Performance metrics display component (formerly part of the trends section)
 *
 * Features:
 * - Average completion time in days
 * - Average hours per request
 * - Average response time in hours
 * - Icon-based visual hierarchy
 */
const TrendsChart: React.FC<TrendsChartProps> = ({ metrics }) => {
  if (!metrics) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-500" />
        Performance Metrics
      </h2>
      <div className="grid grid-cols-1 gap-4">
        <MetricRow
          icon={<Timer className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label="Avg. Completion Time"
          value={`${metrics.averageCompletionTimeDays?.toFixed(1) || 'N/A'} days`}
          bgColor="bg-blue-100 dark:bg-blue-900/30"
        />
        <MetricRow
          icon={<Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          label="Avg. Hours per Request"
          value={`${metrics.averageHoursPerRequest?.toFixed(1) || 'N/A'}h`}
          bgColor="bg-purple-100 dark:bg-purple-900/30"
        />
        <MetricRow
          icon={<Zap className="w-5 h-5 text-green-600 dark:text-green-400" />}
          label="Avg. Response Time"
          value={`${metrics.averageResponseTime?.toFixed(1) || 'N/A'}h`}
          bgColor="bg-green-100 dark:bg-green-900/30"
        />
      </div>
    </div>
  );
};

/**
 * Individual metric row component
 */
interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
}

const MetricRow: React.FC<MetricRowProps> = ({ icon, label, value, bgColor }) => (
  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bgColor}`}>
        {icon}
      </div>
      <span className="text-sm text-gray-600 dark:text-slate-400">{label}</span>
    </div>
    <span className="text-lg font-bold text-gray-900 dark:text-white">
      {value}
    </span>
  </div>
);

export default TrendsChart;
