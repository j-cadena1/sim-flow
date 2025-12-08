/**
 * @fileoverview Request Actions Component
 *
 * Provides role-based action buttons and workflows for the request lifecycle.
 * Handles manager, engineer, and user-specific actions based on request status.
 *
 * @module components/request-detail/RequestActions
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  AlertTriangle,
  FolderOpen,
  UserPlus,
} from 'lucide-react';
import { RequestStatus, UserRole, User, Project } from '../../types';
import { RequestActionsProps } from './types';

/**
 * RequestActions component
 *
 * Renders role-specific action panels including:
 * - Manager: Feasibility review, resource allocation, revision approval
 * - Engineer: Accept/complete work, request discussion
 * - User: Accept delivery, request revision
 * - Discussion workflow management
 */
export const RequestActions: React.FC<RequestActionsProps> = ({
  request,
  currentUser,
  project,
  engineers,
  titleChangeRequests,
  discussionRequests,
  onStartManagerReview,
  onDeny,
  onAssign,
  onApproveRevision,
  onDenyRevision,
  onEngineerAccept,
  onEngineerComplete,
  onRequestDiscussion,
  onAccept,
  onRevisionRequest,
  onReviewTitleChange,
  onReviewDiscussion,
}) => {
  const [assignee, setAssignee] = useState('');
  const [hours, setHours] = useState(8);

  useEffect(() => {
    if (engineers && engineers.length > 0 && !assignee) {
      setAssignee(engineers[0]?.id || '');
    }
  }, [engineers, assignee]);

  const renderManagerActions = () => {
    // Discussion Request Review
    if (request.status === RequestStatus.DISCUSSION) {
      const pendingDiscussion = discussionRequests.find((dr) => dr.status === 'Pending');

      if (pendingDiscussion) {
        return (
          <div className="bg-blue-50 dark:bg-slate-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mt-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="text-blue-600 dark:text-blue-400" size={20} />
              Discussion Request from Engineer
            </h3>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-lg mb-4 border border-blue-100 dark:border-slate-800">
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                <strong className="text-gray-900 dark:text-white">{pendingDiscussion.engineerName}</strong>{' '}
                requested discussion:
              </p>
              <p className="text-gray-900 dark:text-white mb-3">{pendingDiscussion.reason}</p>

              <div className="flex items-center justify-between text-sm border-t border-gray-200 dark:border-slate-800 pt-3">
                <span className="text-gray-500 dark:text-slate-400">Current Hours:</span>
                <span className="font-mono text-gray-900 dark:text-white">{request.estimatedHours || 0}h</span>
              </div>

              {pendingDiscussion.suggestedHours && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500 dark:text-slate-400">Engineer Suggests:</span>
                  <span className="font-mono text-green-600 dark:text-green-400 font-bold">
                    {pendingDiscussion.suggestedHours}h
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {pendingDiscussion.suggestedHours && (
                <button
                  onClick={() => onReviewDiscussion(pendingDiscussion, 'approve')}
                  className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Approve Suggested Hours ({pendingDiscussion.suggestedHours}h)
                </button>
              )}

              <button
                onClick={() =>
                  onReviewDiscussion(pendingDiscussion, 'override', request.estimatedHours || 0)
                }
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
              >
                Set Custom Hours
              </button>

              <button
                onClick={() => onReviewDiscussion(pendingDiscussion, 'deny')}
                className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <XCircle size={16} /> Deny - Keep Original Hours
              </button>
            </div>
          </div>
        );
      }
    }

    if (request.status === RequestStatus.REVISION_APPROVAL) {
      return (
        <div className="bg-yellow-50 dark:bg-slate-900 p-4 rounded-lg border border-yellow-300 dark:border-yellow-700 mt-6">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={20} />
            Revision Request Approval
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            The requester has requested revisions to the completed work.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onApproveRevision}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Approve Revision
            </button>
            <button
              onClick={onDenyRevision}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <XCircle size={16} /> Deny Revision
            </button>
          </div>
        </div>
      );
    }

    if (
      request.status === RequestStatus.SUBMITTED ||
      request.status === RequestStatus.REVISION_REQUESTED
    ) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Manager Actions</h3>
          <div className="flex gap-3">
            <button
              onClick={onStartManagerReview}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
            >
              Start Manager Review
            </button>
          </div>
        </div>
      );
    }

    if (request.status === RequestStatus.MANAGER_REVIEW) {
      const availableHours = project ? project.totalHours - project.usedHours : 0;

      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Manager Review</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Review the request feasibility and assign resources.
          </p>

          {/* Project Information */}
          {project && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</span>
                <span className="text-xs text-gray-500 dark:text-slate-500">({project.code})</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400">Available Hours:</span>
                <span
                  className={`font-mono font-semibold ${
                    availableHours > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {availableHours}h / {project.totalHours}h
                </span>
              </div>
            </div>
          )}

          {!project && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle size={14} />
                No project selected for this request
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                Assign Engineer
              </label>
              <select
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                {engineers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                Estimated Hours
                {project && availableHours > 0 && (
                  <span className="ml-2 text-gray-400 dark:text-slate-500">(max: {availableHours}h)</span>
                )}
              </label>
              <input
                type="number"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                max={availableHours}
                min={1}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => onAssign(assignee, hours)}
                disabled={!project || availableHours < 1}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign & Send to Engineering
              </button>
              <button
                onClick={onDeny}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <XCircle size={16} /> Deny
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderEngineerActions = () => {
    if (request.assignedTo !== currentUser.id) return null;

    if (request.status === RequestStatus.ENGINEERING_REVIEW) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">New Assignment</h3>
          <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">
            You have been assigned this task for {request.estimatedHours} hours.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onEngineerAccept}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
            >
              Accept Work
            </button>
            <button
              onClick={onRequestDiscussion}
              className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white px-4 py-2 rounded"
            >
              Request Discussion
            </button>
          </div>
        </div>
      );
    }
    if (request.status === RequestStatus.IN_PROGRESS) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Work In Progress</h3>
          <button
            onClick={onEngineerComplete}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} /> Mark Complete
          </button>
        </div>
      );
    }
    return null;
  };

  const renderUserActions = () => {
    if (request.status === RequestStatus.COMPLETED) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Project Completed</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            Please review the final delivery.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onAccept}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Accept
            </button>
            <button
              onClick={onRevisionRequest}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded"
            >
              Request Revision
            </button>
          </div>
        </div>
      );
    }

    if (request.status === RequestStatus.REVISION_APPROVAL) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Revision Requested</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Your revision request is pending manager approval.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {currentUser.role === UserRole.MANAGER && renderManagerActions()}
      {currentUser.role === UserRole.ENGINEER && renderEngineerActions()}
      {currentUser.role === UserRole.USER && renderUserActions()}
    </>
  );
};
