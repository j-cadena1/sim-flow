import React, { useMemo } from 'react';
import { Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CompletionAnalysis } from './types';
import { getPriorityColors } from './PriorityDistributionChart';

/**
 * Props for CompletionTimeTable component
 */
interface CompletionTimeTableProps {
  /** Completion time analysis data */
  data: CompletionAnalysis[];
  /** Loading state */
  isLoading: boolean;
}

/**
 * Completion time statistics table with visual range charts
 *
 * Features:
 * - Summary statistics (total completed, avg completion, fastest/slowest)
 * - Visual range bars showing min/max/median completion times
 * - Detailed statistics table with priority-based color coding
 * - Empty state when no data available
 */
const CompletionTimeTable: React.FC<CompletionTimeTableProps> = ({ data, isLoading }) => {
  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalRequests = data.reduce((sum, row) => sum + row.totalRequests, 0);
    const weightedAvg = data.reduce((sum, row) => sum + (row.averageDays * row.totalRequests), 0) / totalRequests;
    const fastestPriority = data.reduce((min, row) =>
      !min || row.averageDays < min.averageDays ? row : min, data[0]);
    const slowestPriority = data.reduce((max, row) =>
      !max || row.averageDays > max.averageDays ? row : max, data[0]);
    return { totalRequests, weightedAvg, fastestPriority, slowestPriority };
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">Loading completion analysis...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-12 border border-gray-200 dark:border-slate-800 text-center">
        <Clock className="w-16 h-16 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-slate-400">No completion data available yet.</p>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">Complete some requests to see time analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Total Completed</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.totalRequests}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="text-sm text-gray-600 dark:text-slate-400">Avg. Completion</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summaryStats.weightedAvg.toFixed(1)} days</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-green-500" />
              <div className="text-sm text-gray-600 dark:text-slate-400">Fastest</div>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {summaryStats.fastestPriority.priority}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500">{summaryStats.fastestPriority.averageDays.toFixed(1)} days avg</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
              <div className="text-sm text-gray-600 dark:text-slate-400">Slowest</div>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {summaryStats.slowestPriority.priority}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500">{summaryStats.slowestPriority.averageDays.toFixed(1)} days avg</div>
          </div>
        </div>
      )}

      {/* Visual Comparison */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
          Completion Time by Priority
        </h2>
        <div className="space-y-6">
          {data.map((row) => {
            const maxDays = Math.max(...data.map((d) => d.maxDays));
            const colors = getPriorityColors(row.priority);
            return (
              <div key={row.priority}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {row.priority}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-slate-400">{row.totalRequests} requests</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{row.averageDays.toFixed(1)} days</span>
                </div>
                <div className="relative h-8 bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                  {/* Range bar (min to max) */}
                  <div
                    className="absolute h-full bg-gray-300 dark:bg-slate-700 rounded"
                    style={{
                      left: `${(row.minDays / maxDays) * 100}%`,
                      width: `${((row.maxDays - row.minDays) / maxDays) * 100}%`,
                    }}
                  />
                  {/* Average marker */}
                  <div
                    className={`absolute top-1 bottom-1 w-1 rounded ${
                      row.priority === 'High' ? 'bg-red-500' : row.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ left: `${(row.averageDays / maxDays) * 100}%` }}
                  />
                  {/* Median marker */}
                  <div
                    className="absolute top-2 bottom-2 w-0.5 bg-blue-600 rounded"
                    style={{ left: `${(row.medianDays / maxDays) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-slate-500">
                  <span>Min: {row.minDays.toFixed(1)}d</span>
                  <span>Median: {row.medianDays.toFixed(1)}d</span>
                  <span>Max: {row.maxDays.toFixed(1)}d</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Detailed Statistics</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-300 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Priority</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Requests</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Avg. Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Min Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Max Days</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300">Median Days</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const colors = getPriorityColors(row.priority);
                return (
                  <tr key={row.priority} className="border-b border-gray-200 dark:border-slate-800">
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">{row.totalRequests}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-gray-900 dark:text-white">{row.averageDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.minDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.maxDays.toFixed(1)}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-slate-400">{row.medianDays.toFixed(1)}</td>
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

export default CompletionTimeTable;
