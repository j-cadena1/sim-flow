/**
 * @fileoverview Request Header Component
 *
 * Displays the request title, ID badge, status indicator, and metadata
 * including requester, creation date, and vendor information.
 * Provides inline editing for title and requester reassignment.
 *
 * @module components/request-detail/RequestHeader
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2, Clock, User as UserIcon, Check, X, UserCog } from 'lucide-react';
import { UserRole } from '../../types';
import { DeletedUserTooltip } from '../DeletedUserTooltip';
import { RequestHeaderProps } from './types';

/**
 * RequestHeader component
 *
 * Renders the header section of a request detail page including:
 * - Request title with inline editing
 * - Request ID badge
 * - Metadata (requester, creation date, vendor)
 * - Admin options menu (edit, delete, reassign)
 */
export const RequestHeader: React.FC<RequestHeaderProps> = ({
  request,
  currentUser,
  canEditTitle,
  canDirectlyEditTitle,
  showAdminOptions,
  onDelete,
  onTitleEdit,
  onRequesterChange,
  allUsers,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isChangingRequester, setIsChangingRequester] = useState(false);
  const [selectedRequesterId, setSelectedRequesterId] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartEditingTitle = () => {
    setEditedTitle(request.title);
    setIsEditingTitle(true);
    setShowMenu(false);
  };

  const handleCancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const handleSaveTitle = () => {
    if (!editedTitle.trim() || editedTitle.trim().length < 3) {
      return;
    }
    onTitleEdit(editedTitle);
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const handleStartChangingRequester = () => {
    setSelectedRequesterId(request.createdBy || '');
    setIsChangingRequester(true);
    setShowMenu(false);
  };

  const handleCancelChangingRequester = () => {
    setIsChangingRequester(false);
    setSelectedRequesterId('');
  };

  const handleSaveRequester = () => {
    if (!selectedRequesterId || selectedRequesterId === request.createdBy) {
      setIsChangingRequester(false);
      return;
    }
    onRequesterChange(selectedRequesterId);
    setIsChangingRequester(false);
    setSelectedRequesterId('');
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-start">
        {isEditingTitle ? (
          <div className="flex-1 flex items-center gap-2 mb-2">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="flex-1 text-3xl font-bold bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelEditingTitle();
              }}
            />
            <button
              onClick={handleSaveTitle}
              className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              title="Save"
            >
              <Check size={24} />
            </button>
            <button
              onClick={handleCancelEditingTitle}
              className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              title="Cancel"
            >
              <X size={24} />
            </button>
          </div>
        ) : (
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{request.title}</h1>
        )}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-xs text-gray-600 dark:text-slate-300 font-mono border border-gray-200 dark:border-slate-700">
            {request.id.slice(0, 8)}
          </span>
          {(canEditTitle || showAdminOptions) && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <MoreVertical size={20} className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                  {canEditTitle && (
                    <button
                      onClick={handleStartEditingTitle}
                      className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors rounded-t-lg"
                    >
                      <Edit2 size={16} />
                      Edit Title
                    </button>
                  )}
                  {showAdminOptions && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-600/20 transition-colors rounded-b-lg border-t border-gray-200 dark:border-slate-700"
                    >
                      <Trash2 size={16} />
                      Delete Request
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-slate-400 mb-6">
        {isChangingRequester ? (
          <div className="flex items-center gap-2">
            <UserIcon size={14} />
            <select
              value={selectedRequesterId}
              onChange={(e) => setSelectedRequesterId(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-900 dark:text-white text-sm"
            >
              <option value="">Select a user...</option>
              {allUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveRequester}
              className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={handleCancelChangingRequester}
              className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <span className="flex items-center">
            <UserIcon size={14} className="mr-1" />
            <DeletedUserTooltip
              userId={request.createdBy}
              displayName={request.createdByName}
              showIcon={false}
            />
            {request.createdByAdminName && (
              <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                Created by{' '}
                <DeletedUserTooltip
                  userId={request.createdByAdminId}
                  displayName={request.createdByAdminName}
                  showIcon={false}
                />
                {' '}(Admin)
              </span>
            )}
            {currentUser.role === UserRole.ADMIN && request.createdBy && (
              <button
                onClick={handleStartChangingRequester}
                className="ml-2 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                title="Change requester"
              >
                <UserCog size={14} />
              </button>
            )}
          </span>
        )}
        <span className="flex items-center">
          <Clock size={14} className="mr-1" />
          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
        </span>
        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
          {request.vendor}
        </span>
      </div>
    </div>
  );
};
