/**
 * @fileoverview Time Tracking Component
 *
 * Displays time entries logged against a request and provides
 * time logging functionality for assigned engineers.
 *
 * @module components/request-detail/TimeTracking
 */

import React, { useState } from 'react';
import { Timer } from 'lucide-react';
import { TimeTrackingProps } from './types';

/**
 * TimeTracking component
 *
 * Renders the time tracking section including:
 * - Total logged hours vs estimated hours
 * - Progress bar visualization
 * - Time entry history
 * - Time logging form (for assigned engineer)
 */
export const TimeTracking: React.FC<TimeTrackingProps> = ({
  request,
  currentUser,
  timeEntries,
  onLogTime,
  isLoggingTime = false,
}) => {
  const [timeHours, setTimeHours] = useState(1);
  const [timeDescription, setTimeDescription] = useState('');

  const totalLoggedHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const isAssignedEngineer = currentUser.id === request.assignedTo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (timeHours < 0.25) {
      return;
    }
    onLogTime(timeHours, timeDescription);
    setTimeHours(1);
    setTimeDescription('');
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Timer className="mr-2" size={20} /> Time Tracking
      </h3>

      {/* Time Summary */}
      <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">Logged Hours:</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {totalLoggedHours.toFixed(2)}h
          </span>
        </div>
        {request.estimatedHours && (
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500 dark:text-slate-400">Estimated Hours:</span>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {request.estimatedHours}h
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (totalLoggedHours / request.estimatedHours) > 1 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min((totalLoggedHours / request.estimatedHours) * 100, 100)}%`,
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Time Entries List */}
      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
        {timeEntries.length === 0 ? (
          <p className="text-gray-500 dark:text-slate-500 text-sm italic">No time logged yet.</p>
        ) : (
          timeEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                  {entry.engineerName}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-600">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {entry.description || 'No description'}
                </p>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.hours}h</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Log Time Form - Only for assigned engineer */}
      {isAssignedEngineer && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-gray-200 dark:border-slate-800">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Hours Worked</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              value={timeHours}
              onChange={(e) => setTimeHours(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              Description (optional)
            </label>
            <textarea
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm h-16 resize-none"
              placeholder="What did you work on?"
              value={timeDescription}
              onChange={(e) => setTimeDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoggingTime}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
          >
            {isLoggingTime ? 'Logging...' : 'Log Time'}
          </button>
        </form>
      )}
    </div>
  );
};
