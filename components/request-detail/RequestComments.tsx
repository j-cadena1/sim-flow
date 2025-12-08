/**
 * @fileoverview Request Comments Component
 *
 * Displays the comment thread for a request with add/view functionality.
 * Provides a scrollable history view and inline comment submission.
 *
 * @module components/request-detail/RequestComments
 */

import React from 'react';
import { MessageSquare, ArrowLeft, AlertTriangle } from 'lucide-react';
import { RequestCommentsProps } from './types';

/**
 * RequestComments component
 *
 * Renders the comments/history section including:
 * - Scrollable comment history
 * - Inline comment submission form
 * - User attribution and timestamps
 * - Validation feedback
 */
export const RequestComments: React.FC<RequestCommentsProps> = ({
  comments,
  comment,
  commentError,
  onCommentChange,
  onCommentSubmit,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCommentSubmit();
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <MessageSquare className="mr-2" size={20} /> Request History
      </h3>
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
        {comments.length === 0 && (
          <p className="text-gray-500 dark:text-slate-500 text-sm italic">No comments yet.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                {c.authorName}{' '}
                <span className="text-gray-500 dark:text-slate-600 text-xs">({c.authorRole})</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-600">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <p className="text-gray-700 dark:text-slate-300 text-sm">{c.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            type="text"
            className={`w-full bg-gray-50 dark:bg-slate-950 border ${
              commentError ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'
            } rounded-lg px-4 py-3 text-gray-900 dark:text-white pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
          />
          <button
            type="submit"
            className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-500"
          >
            <ArrowLeft size={16} className="rotate-180" />
          </button>
        </div>
        {commentError && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle size={14} />
            {commentError}
          </p>
        )}
      </form>
    </div>
  );
};
