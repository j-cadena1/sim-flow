/**
 * @fileoverview Request Info Component
 *
 * Displays request description with inline editing capabilities.
 * Provides a clean interface for viewing and editing request details.
 *
 * @module components/request-detail/RequestInfo
 */

import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { RequestInfoProps } from './types';

/**
 * RequestInfo component
 *
 * Renders the description section of a request with optional inline editing.
 * Supports markdown-style formatting and provides clear editing controls.
 */
export const RequestInfo: React.FC<RequestInfoProps> = ({
  request,
  canEditDescription,
  onDescriptionUpdate,
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const handleStartEditingDescription = () => {
    setEditedDescription(request.description);
    setIsEditingDescription(true);
  };

  const handleCancelEditingDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  const handleSaveDescription = () => {
    if (!editedDescription.trim() || editedDescription.trim().length < 10) {
      return;
    }
    onDescriptionUpdate(editedDescription);
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-200">Description</h3>
          {!isEditingDescription && canEditDescription && (
            <button
              onClick={handleStartEditingDescription}
              className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>
          )}
        </div>
        {isEditingDescription ? (
          <div className="space-y-2">
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32 resize-y"
              placeholder="Enter request description..."
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveDescription}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                <Check size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancelEditingDescription}
                className="flex items-center space-x-1 bg-gray-500 hover:bg-gray-400 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-slate-400 whitespace-pre-wrap">{request.description}</p>
        )}
      </div>
    </div>
  );
};
