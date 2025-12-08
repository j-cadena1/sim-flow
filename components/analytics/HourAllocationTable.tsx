import React, { useMemo } from 'react';
import { BarChart, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { AllocationAnalysis } from './types';
import { getPriorityColors } from './PriorityDistributionChart';

/**
 * Props for HourAllocationTable component
 */
interface HourAllocationTableProps {
  /** Hour allocation analysis data */
  data: AllocationAnalysis[];
  /** Loading state */
  isLoading: boolean;
}

/**
 * Hour allocation variance table with visual comparison charts
 *
 * Features:
 * - Summary statistics (total hours, avg per request, estimation accuracy)
 * - Visual bar charts comparing allocated vs actual hours
 * - Detailed table with variance and usage percentage
 * - Supports both estimated and non-estimated requests
 */
const HourAllocationTable: React.FC<HourAllocationTableProps> = ({ data, isLoading }) => {
  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalAllocated = data.reduce((sum, row) => sum + row.allocatedHours, 0);
    const totalActual = data.reduce((sum, row) => sum + row.actualHours, 0);
    const hasEstimates = totalAllocated > 0;
    const overBudget = data.filter((row) => row.variance > 0).length;
    const underBudget = data.filter((row) => row.variance < 0).length;
    const onTarget = data.filter((row) => row.variance === 0 && row.allocatedHours > 0).length;
    const avgAccuracy = totalAllocated > 0 ? (totalActual / totalAllocated) * 100 : 0;
    const requestCount = data.length;
    const avgHoursPerRequest = requestCount > 0 ? totalActual / requestCount : 0;
    return { totalAllocated, totalActual, overBudget, underBudget, onTarget, avgAccuracy, hasEstimates, requestCount, avgHoursPerRequest };
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">Loading allocation analysis...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-12 border border-gray-200 dark:border-slate-800 text-center">
        <BarChart className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-slate-400">No allocation data available yet.</p>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">Complete requests with time entries to see hour allocation analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Total Hours Logged</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {summaryStats.totalActual.toFixed(0)}h
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500 mt-1">across {summaryStats.requestCount} requests</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Avg Hours per Request</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {summaryStats.avgHoursPerRequest.toFixed(1)}h
            </div>
          </div>
          {summaryStats.hasEstimates ? (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="text-sm text-gray-600 dark:text-slate-400">Estimation Accuracy</div>
                <div className={`text-2xl font-bold mt-1 ${
                  summaryStats.avgAccuracy >= 90 && summaryStats.avgAccuracy <= 110
                    ? 'text-green-600 dark:text-green-400'
                    : summaryStats.avgAccuracy >= 80 && summaryStats.avgAccuracy <= 120
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {summaryStats.avgAccuracy.toFixed(0)}%
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  <div className="text-sm text-gray-600 dark:text-slate-400">Over Budget</div>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{summaryStats.overBudget}</div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="text-sm text-gray-600 dark:text-slate-400">Completed Requests</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {summaryStats.requestCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <div className="text-sm text-gray-600 dark:text-slate-400">No Estimates</div>
                </div>
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">Add estimates to track accuracy</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Visual Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
          {summaryStats?.hasEstimates ? 'Allocated vs Actual Hours' : 'Hours Logged by Request'}
        </h2>
        <div className="space-y-4">
          {(() => {
            const maxActual = Math.max(...data.slice(0, 10).map((r) => r.actualHours), 1);
            return data.slice(0, 10).map((row) => {
              const hasEstimate = row.allocatedHours > 0;
              const maxHours = hasEstimate ? Math.max(row.allocatedHours, row.actualHours) : maxActual;
              const allocatedWidth = hasEstimate ? (row.allocatedHours / maxHours) * 100 : 0;
              const actualWidth = (row.actualHours / maxHours) * 100;
              return (
                <div key={row.requestId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-md">{row.title}</span>
                    {hasEstimate ? (
                      <span className={`text-sm font-medium ${
                        row.variance > 0 ? 'text-red-600 dark:text-red-400' : row.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'
                      }`}>
                        {row.variance > 0 ? '+' : ''}{row.variance.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {row.actualHours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                  <div className="relative h-6 bg-gray-100 dark:bg-slate-800 rounded overflow-hidden">
                    {/* Allocated bar (background) - only show if has estimate */}
                    {hasEstimate && (
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-200 dark:bg-blue-900/50 rounded"
                        style={{ width: `${allocatedWidth}%` }}
                      />
                    )}
                    {/* Actual bar (foreground) */}
                    <div
                      className={`absolute inset-y-0 left-0 rounded ${
                        hasEstimate
                          ? row.variance > 0 ? 'bg-red-500' : row.variance < 0 ? 'bg-green-500' : 'bg-blue-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${actualWidth}%` }}
                    />
                    {/* Labels inside */}
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                      <span className="text-xs font-medium text-white drop-shadow">{row.actualHours.toFixed(0)}h</span>
                      {hasEstimate && (
                        <span className="text-xs text-gray-600 dark:text-slate-400">{row.allocatedHours.toFixed(0)}h planned</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {summaryStats?.hasEstimates ? 'All Requests (Top 20 by Variance)' : 'Completed Requests with Time Logged'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Request</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Priority</th>
                {summaryStats?.hasEstimates && (
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Allocated</th>
                )}
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Hours Logged</th>
                {summaryStats?.hasEstimates && (
                  <>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Variance</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Usage %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const colors = getPriorityColors(row.priority);
                const hasEstimate = row.allocatedHours > 0;
                return (
                  <tr key={row.requestId} className="border-b border-gray-200 dark:border-slate-800">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">{row.title}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {row.priority}
                      </span>
                    </td>
                    {summaryStats?.hasEstimates && (
                      <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                        {hasEstimate ? `${row.allocatedHours.toFixed(1)}h` : '-'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">{row.actualHours.toFixed(1)}h</td>
                    {summaryStats?.hasEstimates && (
                      <>
                        <td className={`py-3 px-4 text-sm text-right font-medium ${
                          hasEstimate
                            ? row.variance > 0 ? 'text-red-600 dark:text-red-400' : row.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'
                            : 'text-gray-400 dark:text-slate-600'
                        }`}>
                          {hasEstimate ? `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {hasEstimate ? (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              row.usagePercentage > 110
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : row.usagePercentage < 90
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-400'
                            }`}>
                              {row.usagePercentage.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-600">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HourAllocationTable;
