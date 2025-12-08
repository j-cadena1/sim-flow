/**
 * @fileoverview Request Sidebar Component
 *
 * Displays request status, assigned engineer, and estimated hours
 * in a compact sidebar layout.
 *
 * @module components/request-detail/RequestSidebar
 */

import React from 'react';
import { RequestStatus } from '../../types';
import { DeletedUserTooltip } from '../DeletedUserTooltip';
import { SimRequest } from '../../types';

/**
 * Props for RequestSidebar component
 */
export interface RequestSidebarProps {
  /** The request object */
  request: SimRequest;
}

/**
 * RequestSidebar component
 *
 * Renders the status sidebar including:
 * - Current request status with visual indicator
 * - Assigned engineer information
 * - Estimated hours allocation
 */
export const RequestSidebar: React.FC<RequestSidebarProps> = ({ request }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider mb-4">
        Current Status
      </h3>
      <div className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
        <div
          className={`w-3 h-3 rounded-full mr-3 ${
            request.status === RequestStatus.ACCEPTED
              ? 'bg-green-500'
              : request.status === RequestStatus.COMPLETED
              ? 'bg-green-500'
              : request.status === RequestStatus.IN_PROGRESS
              ? 'bg-blue-500'
              : request.status === RequestStatus.DENIED
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`}
        />
        {request.status}
      </div>

      {request.assignedToName && (
        <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800 mb-4">
          <div
            className={`w-8 h-8 rounded-full ${
              request.assignedTo ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-200 dark:bg-slate-700'
            } flex items-center justify-center ${
              request.assignedTo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
            } font-bold`}
          >
            {request.assignedToName[0]}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-500">Assigned Engineer</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              <DeletedUserTooltip
                userId={request.assignedTo}
                displayName={request.assignedToName}
                showIcon={true}
              />
            </p>
          </div>
        </div>
      )}

      {request.estimatedHours && (
        <div className="flex items-center justify-between text-sm border-t border-gray-200 dark:border-slate-800 pt-3">
          <span className="text-gray-500 dark:text-slate-400">Estimated Effort</span>
          <span className="text-gray-900 dark:text-white font-mono">{request.estimatedHours} hrs</span>
        </div>
      )}
    </div>
  );
};
