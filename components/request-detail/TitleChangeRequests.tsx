/**
 * @fileoverview Title Change Requests Component
 *
 * Displays pending and historical title change requests for a simulation request.
 * Provides approval/denial workflow for managers and request originators.
 *
 * @module components/request-detail/TitleChangeRequests
 */

import React from 'react';
import { AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { TitleChangeRequestsProps } from './types';

/**
 * TitleChangeRequests component
 *
 * Renders title change requests including:
 * - Pending requests requiring review
 * - Historical approved/denied requests
 * - Comparison of current vs proposed titles
 * - Approval/denial controls
 */
export const TitleChangeRequests: React.FC<TitleChangeRequestsProps> = ({
  titleChangeRequests,
  canReview,
  onReview,
  isReviewing = false,
}) => {
  const pendingRequests = titleChangeRequests.filter((tcr) => tcr.status === 'Pending');
  const historicalRequests = titleChangeRequests.filter((tcr) => tcr.status !== 'Pending');

  return (
    <>
      {/* Pending Title Change Requests */}
      {canReview && pendingRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-300 dark:border-amber-700/50">
          <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-4 flex items-center">
            <AlertTriangle className="mr-2" size={20} /> Pending Title Change Request
          </h3>
          {pendingRequests.map((tcr) => (
            <div
              key={tcr.id}
              className="bg-white dark:bg-slate-950/50 p-4 rounded-lg border border-amber-200 dark:border-slate-700 mb-4 last:mb-0"
            >
              <div className="mb-3">
                <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">
                  Requested by {tcr.requestedByName}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">
                  {new Date(tcr.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 dark:text-slate-500 font-semibold min-w-[80px] mt-1">
                    Current:
                  </span>
                  <p className="text-gray-500 dark:text-slate-300 flex-1 line-through opacity-60">
                    {tcr.currentTitle}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-green-600 dark:text-green-500 font-semibold min-w-[80px] mt-1">
                    Proposed:
                  </span>
                  <p className="text-gray-900 dark:text-white flex-1 font-semibold">{tcr.proposedTitle}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => onReview(tcr, true)}
                  disabled={isReviewing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  Approve
                </button>
                <button
                  onClick={() => onReview(tcr, false)}
                  disabled={isReviewing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={16} />
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historical Title Changes */}
      {historicalRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Edit2 className="mr-2" size={20} /> Title Change History
          </h3>
          <div className="space-y-3">
            {historicalRequests.map((tcr) => (
              <div
                key={tcr.id}
                className="bg-gray-50 dark:bg-slate-950/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-500">
                      Requested by {tcr.requestedByName} • {new Date(tcr.createdAt).toLocaleDateString()}
                    </p>
                    {tcr.reviewedByName && (
                      <p className="text-xs text-gray-500 dark:text-slate-500">
                        {tcr.status === 'Approved' ? 'Approved' : 'Denied'} by {tcr.reviewedByName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tcr.status === 'Approved'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900'
                    }`}
                  >
                    {tcr.status}
                  </span>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600 dark:text-slate-400">
                    <span className="line-through opacity-60">{tcr.currentTitle}</span>
                    {tcr.status === 'Approved' && (
                      <>
                        {' → '}
                        <span className="text-gray-900 dark:text-white font-medium">{tcr.proposedTitle}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
