/**
 * @fileoverview Deleted User Tooltip Component
 *
 * Displays a tooltip with archived user information when hovering over
 * a "Deleted User" indicator. Used to preserve historical context for
 * requests and other entities that were created by users who have since
 * been permanently deleted from the system.
 *
 * The tooltip fetches data from the deleted_users archive table which
 * preserves the identity of hard-deleted users for audit and historical purposes.
 *
 * @module components/DeletedUserTooltip
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserX, Info } from 'lucide-react';
import apiClient from '../lib/api/client';
import { useAuth } from '../contexts/AuthContext';

interface DeletedUserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  deletedAt: string;
  deletedByName?: string;
  deletionReason?: string;
  originalCreatedAt?: string;
}

interface DeletedUserTooltipProps {
  /** The user ID to look up (if null/undefined, shows deleted indicator) */
  userId?: string | null;
  /** The display name to show (preserved from when user existed) */
  displayName: string;
  /** Optional className for the container */
  className?: string;
  /** Whether to show the icon inline with the name */
  showIcon?: boolean;
}

/**
 * Component that displays a user name with a tooltip showing archived info
 * for deleted users. If the userId is present, shows the name normally.
 * If userId is null but displayName exists, shows "Deleted User" with a
 * tooltip that admins can hover to see the original user details.
 */
export const DeletedUserTooltip: React.FC<DeletedUserTooltipProps> = ({
  userId,
  displayName,
  className = '',
  showIcon = true,
}) => {
  const { user: currentUser } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);
  const [deletedUserInfo, setDeletedUserInfo] = useState<DeletedUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // If userId exists, user is not deleted - just show the name
  if (userId) {
    return <span className={className}>{displayName}</span>;
  }

  // User is deleted (userId is null but we have a name)
  const isAdmin = currentUser?.role === 'Admin';

  const fetchDeletedUserInfo = async () => {
    if (!isAdmin || deletedUserInfo || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Search for deleted user by name (since we don't have their ID anymore)
      const response = await apiClient.post('/users/management/deleted/batch', {
        names: [displayName],
      });

      if (response.data.users && response.data.users[displayName]) {
        setDeletedUserInfo(response.data.users[displayName]);
      } else {
        setError('User info not found in archive');
      }
    } catch (err: any) {
      console.error('Failed to fetch deleted user info:', err);
      setError('Failed to load user info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (isAdmin && !deletedUserInfo && !error) {
      fetchDeletedUserInfo();
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showIcon && <UserX size={14} className="text-gray-400 dark:text-slate-500" />}
      <span className="text-gray-500 dark:text-slate-400 italic">
        {displayName}
        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">(deleted)</span>
      </span>

      {/* Tooltip - only show for admins who can see archived info */}
      {showTooltip && isAdmin && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-3 text-sm"
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-slate-700">
            <Info size={14} className="text-blue-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Archived User Info</span>
          </div>

          {isLoading && (
            <div className="text-gray-500 dark:text-slate-400 text-center py-2">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto" />
            </div>
          )}

          {error && (
            <p className="text-gray-500 dark:text-slate-400 text-center py-2">{error}</p>
          )}

          {deletedUserInfo && (
            <div className="space-y-1.5">
              <div>
                <span className="text-gray-500 dark:text-slate-400">Name: </span>
                <span className="text-gray-900 dark:text-white font-medium">{deletedUserInfo.name}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">Email: </span>
                <span className="text-gray-700 dark:text-slate-300">{deletedUserInfo.email}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">Role: </span>
                <span className="text-gray-700 dark:text-slate-300">{deletedUserInfo.role}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-slate-400">Deleted: </span>
                <span className="text-gray-700 dark:text-slate-300">
                  {new Date(deletedUserInfo.deletedAt).toLocaleDateString()}
                </span>
              </div>
              {deletedUserInfo.deletedByName && (
                <div>
                  <span className="text-gray-500 dark:text-slate-400">By: </span>
                  <span className="text-gray-700 dark:text-slate-300">{deletedUserInfo.deletedByName}</span>
                </div>
              )}
              {deletedUserInfo.deletionReason && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                  <span className="text-gray-500 dark:text-slate-400">Reason: </span>
                  <span className="text-gray-700 dark:text-slate-300">{deletedUserInfo.deletionReason}</span>
                </div>
              )}
            </div>
          )}

          {/* Tooltip arrow */}
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-gray-200 dark:border-slate-700 transform rotate-45" />
        </div>
      )}

      {/* Simple tooltip for non-admins */}
      {showTooltip && !isAdmin && (
        <div className="absolute z-50 bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 dark:bg-slate-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
          This user has been removed from the system
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-800 dark:bg-slate-900 transform rotate-45" />
        </div>
      )}
    </span>
  );
};

export default DeletedUserTooltip;
