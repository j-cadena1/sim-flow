import React from 'react';
import {
  Activity,
  CheckCircle2,
  Briefcase,
  Clock,
} from 'lucide-react';
import { DashboardOverview } from './types';

/**
 * Props for MetricsCards component
 */
interface MetricsCardsProps {
  /** Dashboard overview statistics */
  overview: DashboardOverview;
  /** Completion rate percentage */
  completionRate: number;
  /** Trend data for created requests */
  createdTrend?: number[];
  /** Trend data for completed requests */
  completedTrend?: number[];
}

/**
 * Props for individual MetricCard
 */
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange';
  subtitle?: string;
  trend?: React.ReactNode;
  progress?: number;
}

/**
 * Summary metrics cards displayed at the top of the analytics dashboard
 *
 * Displays:
 * - Total and active requests
 * - Completed requests with completion rate
 * - Active/total projects
 * - Hours used vs allocated with progress bar
 */
const MetricsCards: React.FC<MetricsCardsProps> = ({
  overview,
  completionRate,
  createdTrend,
  completedTrend,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={<Activity className="w-6 h-6" />}
        label="Total Requests"
        value={overview.totalRequests}
        color="blue"
        subtitle={`${overview.activeRequests} active`}
        trend={createdTrend && createdTrend.length > 0 ? <MiniBarChart data={createdTrend} color="bg-blue-500" /> : undefined}
      />
      <MetricCard
        icon={<CheckCircle2 className="w-6 h-6" />}
        label="Completed"
        value={overview.completedRequests}
        color="green"
        subtitle={`${completionRate.toFixed(1)}% completion rate`}
        trend={completedTrend && completedTrend.length > 0 ? <MiniBarChart data={completedTrend} color="bg-green-500" /> : undefined}
      />
      <MetricCard
        icon={<Briefcase className="w-6 h-6" />}
        label="Active Projects"
        value={overview.activeProjects}
        color="purple"
        subtitle={`of ${overview.totalProjects} total`}
      />
      <MetricCard
        icon={<Clock className="w-6 h-6" />}
        label="Hours Used"
        value={`${overview.totalHoursUsed.toFixed(0)}h`}
        color="orange"
        subtitle={`of ${overview.totalHoursAllocated.toFixed(0)}h allocated`}
        progress={overview.totalHoursAllocated > 0
          ? (overview.totalHoursUsed / overview.totalHoursAllocated) * 100
          : 0}
      />
    </div>
  );
};

/**
 * Individual metric card component with optional trend and progress visualization
 */
const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, subtitle, trend, progress }) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  };

  const progressColors = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div className={`inline-flex p-2.5 rounded-lg border ${colorClasses[color]}`}>{icon}</div>
        {trend && <div className="ml-2">{trend}</div>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{value}</div>
      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">{subtitle}</div>}
      {progress !== undefined && (
        <div className="mt-3 bg-gray-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`${progressColors[color]} h-full rounded-full transition-all`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Mini bar chart component for displaying trends in metric cards
 */
interface MiniBarChartProps {
  data: number[];
  maxValue?: number;
  color?: string;
}

const MiniBarChart: React.FC<MiniBarChartProps> = ({
  data,
  maxValue,
  color = 'bg-blue-500'
}) => {
  const max = maxValue || Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, i) => (
        <div
          key={i}
          className={`w-1.5 ${color} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '2px' : '0' }}
          title={`${value}`}
        />
      ))}
    </div>
  );
};

export default MetricsCards;
