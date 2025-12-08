import React from 'react';
import { BarChart, Calendar } from 'lucide-react';
import { DateRange, AnalyticsTab } from './types';

/**
 * Props for AnalyticsHeader component
 */
interface AnalyticsHeaderProps {
  /** Current date range filter */
  dateRange: DateRange;
  /** Active tab selection */
  activeTab: AnalyticsTab;
  /** Callback when date range changes */
  onDateRangeChange: (startDate: string, endDate: string) => void;
  /** Callback to clear date range filter */
  onClearDateRange: () => void;
  /** Callback when tab changes */
  onTabChange: (tab: AnalyticsTab) => void;
}

/**
 * Analytics header component with title, date range filter, and tab navigation
 *
 * Features:
 * - Date range selector with start/end dates
 * - Tab navigation for different analytics views
 * - Clear button to reset date filters
 */
const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  dateRange,
  activeTab,
  onDateRangeChange,
  onClearDateRange,
  onTabChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Header with Title and Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Insights and performance metrics</p>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <input
            type="date"
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            value={dateRange.startDate || ''}
            onChange={(e) => onDateRangeChange(e.target.value, dateRange.endDate || '')}
          />
          <span className="text-gray-600 dark:text-slate-400">to</span>
          <input
            type="date"
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            value={dateRange.endDate || ''}
            onChange={(e) => onDateRangeChange(dateRange.startDate || '', e.target.value)}
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <button
              onClick={onClearDateRange}
              className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-300 dark:border-slate-700">
        <TabButton
          label="Overview"
          active={activeTab === 'overview'}
          onClick={() => onTabChange('overview')}
        />
        <TabButton
          label="Completion Time"
          active={activeTab === 'completion'}
          onClick={() => onTabChange('completion')}
        />
        <TabButton
          label="Hour Allocation"
          active={activeTab === 'allocation'}
          onClick={() => onTabChange('allocation')}
        />
      </div>
    </div>
  );
};

/**
 * Individual tab button component
 */
interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`relative px-4 py-2 font-medium transition-colors ${
      active
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
    }`}
  >
    {label}
    {active && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
    )}
  </button>
);

export default AnalyticsHeader;
