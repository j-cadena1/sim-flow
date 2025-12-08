import React from 'react';
import { ChartDataPoint } from './types';

/**
 * Props for StatusDistributionChart component
 */
interface StatusDistributionChartProps {
  /** Chart data points with labels, values, and colors */
  data: ChartDataPoint[];
  /** Size of the donut chart in pixels */
  size?: number;
}

/**
 * Donut chart component displaying request status distribution
 *
 * Features:
 * - Interactive donut chart using SVG
 * - Color-coded segments for each status
 * - Total count displayed in center
 * - Legend showing all statuses with counts
 */
const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({ data, size = 140 }) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Requests by Status</h2>
      <div className="flex items-start gap-6">
        <DonutChart data={data} size={size} />
        <div className="flex-1 space-y-2 max-h-[180px] overflow-y-auto">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 truncate">{item.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Donut chart SVG component
 */
interface DonutChartProps {
  data: ChartDataPoint[];
  size: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, size }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Calculate segments with proper cumulative offsets
  let cumulativePercentage = 0;
  const segments = data.map((item) => {
    const percentage = total > 0 ? item.value / total : 0;
    const segment = {
      ...item,
      percentage,
      offset: cumulativePercentage,
    };
    cumulativePercentage += percentage;
    return segment;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          className="dark:stroke-slate-800"
        />
        {segments.map((segment, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="12"
            strokeDasharray={`${segment.percentage * circumference} ${circumference}`}
            strokeDashoffset={-segment.offset * circumference}
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">{total}</div>
          <div className="text-xs text-gray-500 dark:text-slate-500">Total</div>
        </div>
      </div>
    </div>
  );
};

export default StatusDistributionChart;
