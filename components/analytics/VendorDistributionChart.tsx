import React from 'react';
import { VendorDistribution } from './types';

/**
 * Props for VendorDistributionChart component
 */
interface VendorDistributionChartProps {
  /** Vendor distribution data */
  data: VendorDistribution[];
  /** Maximum number of vendors to display */
  limit?: number;
}

/**
 * Top vendors chart component with horizontal progress bars
 *
 * Features:
 * - Ranked list of vendors by request count
 * - Horizontal bar chart visualization
 * - Percentage-based bar widths relative to top vendor
 * - Request count display
 */
const VendorDistributionChart: React.FC<VendorDistributionChartProps> = ({ data, limit = 5 }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const displayData = data.slice(0, limit);
  const maxCount = displayData[0].requestCount;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Vendors</h2>
      <div className="space-y-3">
        {displayData.map((vendor, index) => {
          const percentage = (vendor.requestCount / maxCount) * 100;
          return (
            <div key={vendor.vendor}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-600 w-4">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {vendor.vendor}
                  </span>
                </div>
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  {vendor.requestCount} requests
                </span>
              </div>
              <div className="ml-6 bg-gray-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VendorDistributionChart;
