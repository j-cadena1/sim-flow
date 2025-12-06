/**
 * @fileoverview Request Detail Component
 *
 * Displays full details of a simulation request and provides role-based
 * action controls for the request lifecycle.
 *
 * Features:
 * - Request metadata display (title, description, priority, vendor)
 * - Project and hour allocation information
 * - Status-specific action buttons based on user role
 * - Comment thread with add/view functionality
 * - Time entry logging (for engineers)
 * - Title change workflow (request/approve/deny)
 * - Discussion workflow for hour disputes
 * - Admin requester reassignment
 *
 * Role-Based Actions:
 * - Admin: All actions, delete, reassign requester
 * - Manager: Approve, deny, assign engineer, review discussions
 * - Engineer: Accept, complete, log time, request discussion
 * - End-User: View only, mark complete after review
 *
 * @module components/RequestDetail
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimFlow } from '../contexts/SimFlowContext';
import { useModal } from './Modal';
import { useToast } from './Toast';
import { useRequest, useProject, useUpdateProjectHours, useDeleteRequest, useTimeEntries, useAddTimeEntry, useUpdateRequestTitle, useUpdateRequestDescription, useRequestTitleChange, useTitleChangeRequests, useReviewTitleChange, useDiscussionRequests, useCreateDiscussionRequest, useReviewDiscussionRequest, useUpdateRequestRequester, useUsers } from '../lib/api/hooks';
import { RequestStatus, UserRole, TitleChangeRequest, DiscussionRequest } from '../types';
import { validateComment } from '../utils/validation';
import { CheckCircle, XCircle, Clock, UserPlus, ArrowLeft, MessageSquare, AlertTriangle, User as UserIcon, FolderOpen, Trash2, Timer, MoreVertical, Edit2, Check, X, UserCog } from 'lucide-react';

/**
 * Request Detail page component
 *
 * Fetches request data from API and renders appropriate UI based on
 * request status and current user's role.
 */
export const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, updateRequestStatus, assignEngineer, addComment, getUsersByRole } = useSimFlow();
  const { showConfirm, showPrompt, showDiscussionRequest } = useModal();
  const { showToast } = useToast();

  const { data, isLoading, isError } = useRequest(id!);
  const request = data?.request;
  const comments = data?.comments || [];

  const { data: project } = useProject(request?.projectId || '');
  const updateProjectHoursMutation = useUpdateProjectHours();
  const deleteRequestMutation = useDeleteRequest();
  const { data: timeEntries = [] } = useTimeEntries(id!);
  const addTimeEntryMutation = useAddTimeEntry();
  const updateRequestTitleMutation = useUpdateRequestTitle();
  const updateRequestDescriptionMutation = useUpdateRequestDescription();
  const requestTitleChangeMutation = useRequestTitleChange();
  const { data: titleChangeRequests = [] } = useTitleChangeRequests(id!);
  const reviewTitleChangeMutation = useReviewTitleChange();
  const { data: discussionRequests = [] } = useDiscussionRequests(id!);
  const createDiscussionRequestMutation = useCreateDiscussionRequest();
  const reviewDiscussionRequestMutation = useReviewDiscussionRequest();
  const updateRequestRequesterMutation = useUpdateRequestRequester();
  const { data: allUsers = [] } = useUsers();

  const engineers = getUsersByRole(UserRole.ENGINEER);

  const [assignee, setAssignee] = useState('');
  const [hours, setHours] = useState(8);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [timeHours, setTimeHours] = useState(1);
  const [timeDescription, setTimeDescription] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isChangingRequester, setIsChangingRequester] = useState(false);
  const [selectedRequesterId, setSelectedRequesterId] = useState('');

  useEffect(() => {
    if (engineers && engineers.length > 0 && !assignee) {
      setAssignee(engineers[0].id);
    }
  }, [engineers, assignee]);

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

  if (isLoading) return <div className="text-gray-600 dark:text-slate-400">Loading...</div>;
  if (isError || !request) return <div className="text-gray-600 dark:text-slate-400">Request not found</div>;

  // --- ACTIONS ---

  const handleApproveFeasibility = () => {
    updateRequestStatus(request.id, RequestStatus.RESOURCE_ALLOCATION);
    showToast('Request approved for resource allocation', 'success');
  };

  const handleDeny = () => {
    showConfirm(
      'Deny Request',
      'Are you sure you want to deny this request? This action cannot be undone.',
      () => {
        updateRequestStatus(request.id, RequestStatus.DENIED);
        showToast('Request denied', 'success');
      }
    );
  };

  const handleAssign = () => {
    if (hours < 1) {
      showToast('Estimated hours must be at least 1', 'error');
      return;
    }

    if (!project) {
      showToast('Project information not available', 'error');
      return;
    }

    const availableHours = project.totalHours - project.usedHours;
    if (hours > availableHours) {
      showToast(`Insufficient project hours. Available: ${availableHours}h`, 'error');
      return;
    }

    // Deduct hours from project
    updateProjectHoursMutation.mutate(
      { id: project.id, hoursToAdd: hours },
      {
        onSuccess: () => {
          assignEngineer(request.id, assignee, hours);
          showToast('Engineer assigned and hours allocated', 'success');
        },
        onError: () => {
          showToast('Failed to allocate project hours', 'error');
        },
      }
    );
  };

  const handleEngineerAccept = () => {
    updateRequestStatus(request.id, RequestStatus.IN_PROGRESS);
    showToast('Work accepted and started', 'success');
  };

  const handleEngineerComplete = () => {
    updateRequestStatus(request.id, RequestStatus.COMPLETED);
    showToast('Work marked as completed', 'success');
  };

  const handleRequestDiscussion = () => {
    showDiscussionRequest(request.estimatedHours || 0, (reason, suggestedHours) => {
      createDiscussionRequestMutation.mutate(
        { requestId: request.id, reason, suggestedHours },
        {
          onSuccess: () => {
            addComment(request.id, `DISCUSSION REQUESTED: ${reason}${suggestedHours ? ` (Suggested hours: ${suggestedHours})` : ''}`);
            showToast('Discussion request sent to manager', 'success');
          },
          onError: (error: any) => {
            showToast(error.response?.data?.error || 'Failed to request discussion', 'error');
          },
        }
      );
    });
  };

  const handleRevisionRequest = () => {
    showPrompt(
      'Request Revision',
      'Please provide a reason for the revision request:',
      (reason) => {
        if (reason.trim()) {
          addComment(request.id, `REVISION REQUESTED: ${reason}`);
          updateRequestStatus(request.id, RequestStatus.REVISION_APPROVAL); // Goes to manager for approval
          showToast('Revision requested - pending manager approval', 'success');
        }
      }
    );
  };

  const handleApproveRevision = () => {
    showConfirm(
      'Approve Revision',
      'Send this request back to engineering for revisions?',
      () => {
        addComment(request.id, 'Manager approved revision request - returned to engineering');
        updateRequestStatus(request.id, RequestStatus.IN_PROGRESS);
        showToast('Revision approved - returned to engineering', 'success');
      }
    );
  };

  const handleDenyRevision = () => {
    showConfirm(
      'Deny Revision',
      'Close this request as completed without changes?',
      () => {
        addComment(request.id, 'Manager denied revision request - marked as completed');
        updateRequestStatus(request.id, RequestStatus.COMPLETED);
        showToast('Revision denied - marked as completed', 'success');
      }
    );
  };

  const handleAccept = () => {
    addComment(request.id, 'Work accepted by requester.');
    updateRequestStatus(request.id, RequestStatus.ACCEPTED);
    showToast('Work accepted successfully', 'success');
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError('');

    const validation = validateComment(comment);
    if (!validation.isValid) {
      setCommentError(validation.error || 'Invalid comment');
      return;
    }

    addComment(request.id, comment);
    setComment('');
    showToast('Comment added', 'success');
  };

  const handleDelete = () => {
    showConfirm(
      'Delete Request',
      'Are you sure you want to permanently delete this request? This action cannot be undone.',
      () => {
        deleteRequestMutation.mutate(request.id, {
          onSuccess: () => {
            showToast('Request deleted successfully', 'success');
            navigate('/requests');
          },
          onError: () => {
            showToast('Failed to delete request', 'error');
          },
        });
      }
    );
  };

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
      showToast('Title must be at least 3 characters', 'error');
      return;
    }

    // Engineers request title changes, others can update directly
    if (currentUser.role === UserRole.ENGINEER) {
      requestTitleChangeMutation.mutate(
        { id: request.id, proposedTitle: editedTitle },
        {
          onSuccess: () => {
            showToast('Title change request submitted for approval', 'success');
            setIsEditingTitle(false);
            setEditedTitle('');
          },
          onError: (error: any) => {
            showToast(error.response?.data?.error || 'Failed to submit title change request', 'error');
          },
        }
      );
    } else {
      updateRequestTitleMutation.mutate(
        { id: request.id, title: editedTitle },
        {
          onSuccess: () => {
            showToast('Request title updated', 'success');
            setIsEditingTitle(false);
            setEditedTitle('');
          },
          onError: (error: any) => {
            showToast(error.response?.data?.error || 'Failed to update title', 'error');
          },
        }
      );
    }
  };

  // Check if current user can edit the request title
  const canEditTitle = () => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (currentUser.role === UserRole.USER && request.createdBy === currentUser.id) {
      return true;
    }
    if (currentUser.role === UserRole.ENGINEER) {
      return true; // Engineers can request title changes
    }
    return false;
  };

  const canDirectlyEditTitle = () => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (currentUser.role === UserRole.USER && request.createdBy === currentUser.id) {
      return true;
    }
    return false;
  };

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
      showToast('Description must be at least 10 characters', 'error');
      return;
    }

    updateRequestDescriptionMutation.mutate(
      { id: request.id, description: editedDescription },
      {
        onSuccess: () => {
          showToast('Request description updated', 'success');
          setIsEditingDescription(false);
          setEditedDescription('');
        },
        onError: (error: any) => {
          showToast(error.response?.data?.error || 'Failed to update description', 'error');
        },
      }
    );
  };

  const canEditDescription = () => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (currentUser.role === UserRole.USER && request.createdBy === currentUser.id) {
      return true;
    }
    return false;
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
    if (!selectedRequesterId) {
      showToast('Please select a user', 'error');
      return;
    }

    if (selectedRequesterId === request.createdBy) {
      setIsChangingRequester(false);
      return;
    }

    updateRequestRequesterMutation.mutate(
      { id: request.id, newRequesterId: selectedRequesterId },
      {
        onSuccess: () => {
          showToast('Request requester updated successfully', 'success');
          setIsChangingRequester(false);
          setSelectedRequesterId('');
        },
        onError: (error: any) => {
          showToast(error.response?.data?.error || 'Failed to update requester', 'error');
        },
      }
    );
  };

  const handleReviewTitleChange = (titleChangeRequest: TitleChangeRequest, approved: boolean) => {
    const action = approved ? 'approve' : 'deny';
    showConfirm(
      `${approved ? 'Approve' : 'Deny'} Title Change`,
      `Are you sure you want to ${action} this title change?\n\nCurrent: "${titleChangeRequest.currentTitle}"\nProposed: "${titleChangeRequest.proposedTitle}"`,
      () => {
        reviewTitleChangeMutation.mutate(
          { id: titleChangeRequest.id, approved, requestId: request.id },
          {
            onSuccess: () => {
              showToast(`Title change ${approved ? 'approved' : 'denied'}`, 'success');
            },
            onError: (error: any) => {
              showToast(error.response?.data?.error || `Failed to ${action} title change`, 'error');
            },
          }
        );
      }
    );
  };

  const canReviewTitleChange = () => {
    // Managers/Admins can review, or the original requester
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (request.createdBy === currentUser.id) {
      return true;
    }
    return false;
  };

  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();

    if (timeHours < 0.25) {
      showToast('Time must be at least 0.25 hours', 'error');
      return;
    }

    addTimeEntryMutation.mutate(
      { requestId: request.id, hours: timeHours, description: timeDescription },
      {
        onSuccess: () => {
          showToast('Time logged successfully', 'success');
          setTimeHours(1);
          setTimeDescription('');
        },
        onError: () => {
          showToast('Failed to log time', 'error');
        },
      }
    );
  };

  // --- RENDER HELPERS ---

  const renderManagerActions = () => {
    // Discussion Request Review
    if (request.status === RequestStatus.DISCUSSION) {
      const pendingDiscussion = discussionRequests.find(dr => dr.status === 'Pending');

      if (pendingDiscussion) {
        return (
          <div className="bg-blue-50 dark:bg-slate-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mt-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="text-blue-600 dark:text-blue-400" size={20} />
              Discussion Request from Engineer
            </h3>

            <div className="bg-white dark:bg-slate-950 p-4 rounded-lg mb-4 border border-blue-100 dark:border-slate-800">
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                <strong className="text-gray-900 dark:text-white">{pendingDiscussion.engineerName}</strong> requested discussion:
              </p>
              <p className="text-gray-900 dark:text-white mb-3">{pendingDiscussion.reason}</p>

              <div className="flex items-center justify-between text-sm border-t border-gray-200 dark:border-slate-800 pt-3">
                <span className="text-gray-500 dark:text-slate-400">Current Hours:</span>
                <span className="font-mono text-gray-900 dark:text-white">{request.estimatedHours || 0}h</span>
              </div>

              {pendingDiscussion.suggestedHours && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500 dark:text-slate-400">Engineer Suggests:</span>
                  <span className="font-mono text-green-600 dark:text-green-400 font-bold">{pendingDiscussion.suggestedHours}h</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {pendingDiscussion.suggestedHours && (
                <button
                  onClick={() => {
                    showConfirm(
                      'Approve Suggested Hours',
                      `Accept the engineer's suggestion of ${pendingDiscussion.suggestedHours} hours?`,
                      () => {
                        reviewDiscussionRequestMutation.mutate(
                          {
                            id: pendingDiscussion.id,
                            requestId: request.id,
                            action: 'approve',
                          },
                          {
                            onSuccess: () => {
                              showToast('Discussion approved - hours updated', 'success');
                            },
                            onError: (error: any) => {
                              showToast(error.response?.data?.error || 'Failed to approve discussion', 'error');
                            },
                          }
                        );
                      }
                    );
                  }}
                  disabled={reviewDiscussionRequestMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle size={16} /> Approve Suggested Hours ({pendingDiscussion.suggestedHours}h)
                </button>
              )}

              <button
                onClick={() => {
                  showPrompt(
                    'Set Custom Hours',
                    `Enter the number of hours you want to allocate:\n\nCurrent: ${request.estimatedHours}h\nSuggested: ${pendingDiscussion.suggestedHours || 'None'}h`,
                    (hoursStr) => {
                      const hours = Number(hoursStr);
                      if (isNaN(hours) || hours < 1) {
                        showToast('Please enter a valid number of hours (at least 1)', 'error');
                        return;
                      }

                      showPrompt(
                        'Response to Engineer',
                        'Optional: Add a message to the engineer about your decision:',
                        (response) => {
                          reviewDiscussionRequestMutation.mutate(
                            {
                              id: pendingDiscussion.id,
                              requestId: request.id,
                              action: 'override',
                              allocatedHours: hours,
                              managerResponse: response.trim() || undefined,
                            },
                            {
                              onSuccess: () => {
                                showToast(`Hours updated to ${hours}h`, 'success');
                              },
                              onError: (error: any) => {
                                showToast(error.response?.data?.error || 'Failed to update hours', 'error');
                              },
                            }
                          );
                        },
                        ''
                      );
                    },
                    String(pendingDiscussion.suggestedHours || request.estimatedHours || '')
                  );
                }}
                disabled={reviewDiscussionRequestMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Set Custom Hours
              </button>

              <button
                onClick={() => {
                  showConfirm(
                    'Deny Discussion Request',
                    `Keep the original allocation of ${request.estimatedHours}h and send back to Engineering Review?`,
                    () => {
                      reviewDiscussionRequestMutation.mutate(
                        {
                          id: pendingDiscussion.id,
                          requestId: request.id,
                          action: 'deny',
                        },
                        {
                          onSuccess: () => {
                            showToast('Discussion denied - keeping original hours', 'success');
                          },
                          onError: (error: any) => {
                            showToast(error.response?.data?.error || 'Failed to deny discussion', 'error');
                          },
                        }
                      );
                    }
                  );
                }}
                disabled={reviewDiscussionRequestMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50"
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
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">The requester has requested revisions to the completed work.</p>
          <div className="flex gap-3">
            <button
              onClick={handleApproveRevision}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Approve Revision
            </button>
            <button
              onClick={handleDenyRevision}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
            >
              <XCircle size={16} /> Deny Revision
            </button>
          </div>
        </div>
      );
    }

    if (request.status === RequestStatus.SUBMITTED || request.status === RequestStatus.REVISION_REQUESTED) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-3">Manager Actions</h3>
          <div className="flex gap-3">
             <button
                onClick={() => updateRequestStatus(request.id, RequestStatus.FEASIBILITY_REVIEW)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
             >
                Start Feasibility Review
             </button>
          </div>
        </div>
      );
    }

    if (request.status === RequestStatus.FEASIBILITY_REVIEW) {
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 space-y-4 shadow-sm">
           <h3 className="text-gray-900 dark:text-white font-semibold">Feasibility Review</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">Review the request and determine if it's feasible to proceed.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={handleApproveFeasibility} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Approve Feasibility
            </button>
            <button onClick={handleDeny} className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2">
              <XCircle size={16} /> Deny Request
            </button>
          </div>
        </div>
      )
    }

    if (request.status === RequestStatus.RESOURCE_ALLOCATION) {
      const availableHours = project ? project.totalHours - project.usedHours : 0;

      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-6 shadow-sm">
           <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Resource Allocation</h3>

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
                 <span className={`font-mono font-semibold ${availableHours > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
               <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Assign Engineer</label>
               <select
                 className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                 value={assignee}
                 onChange={(e) => setAssignee(e.target.value)}
               >
                 {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
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
             <button
               onClick={handleAssign}
               disabled={!project || availableHours < 1 || updateProjectHoursMutation.isPending}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {updateProjectHoursMutation.isPending ? 'Allocating...' : 'Assign & Send to Engineering'}
             </button>
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
          <p className="text-gray-600 dark:text-slate-400 text-sm mb-4">You have been assigned this task for {request.estimatedHours} hours.</p>
          <div className="flex gap-3">
             <button onClick={handleEngineerAccept} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded">
               Accept Work
             </button>
             <button onClick={handleRequestDiscussion} className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white px-4 py-2 rounded">
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
          <button onClick={handleEngineerComplete} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2">
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
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Please review the final delivery.</p>
          <div className="flex gap-3">
             <button onClick={handleAccept} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2">
               <CheckCircle size={16} /> Accept
             </button>
             <button onClick={handleRevisionRequest} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded">
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
          <p className="text-sm text-gray-600 dark:text-slate-400">Your revision request is pending manager approval.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN: Details */}
      <div className="lg:col-span-2 space-y-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center text-sm mb-2">
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>

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
               {(canEditTitle() || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                 <div className="relative" ref={menuRef}>
                   <button
                     onClick={() => setShowMenu(!showMenu)}
                     className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                   >
                     <MoreVertical size={20} className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white" />
                   </button>
                   {showMenu && (
                     <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                       {canEditTitle() && (
                         <button
                           onClick={handleStartEditingTitle}
                           className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors rounded-t-lg"
                         >
                           <Edit2 size={16} />
                           Edit Title
                         </button>
                       )}
                       {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                         <button
                           onClick={() => {
                             setShowMenu(false);
                             handleDelete();
                           }}
                           disabled={deleteRequestMutation.isPending}
                           className="w-full flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-600/20 transition-colors rounded-b-lg disabled:opacity-50 border-t border-gray-200 dark:border-slate-700"
                         >
                           <Trash2 size={16} />
                           {deleteRequestMutation.isPending ? 'Deleting...' : 'Delete Request'}
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
                  disabled={updateRequestRequesterMutation.isPending}
                  className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
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
                {request.createdByName}
                {request.createdByAdminName && (
                  <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    Created by {request.createdByAdminName} (Admin)
                  </span>
                )}
                {currentUser.role === UserRole.ADMIN && (
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
            <span className="flex items-center"><Clock size={14} className="mr-1" /> {new Date(request.createdAt).toLocaleDateString()}</span>
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">{request.vendor}</span>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-200">Description</h3>
              {!isEditingDescription && canEditDescription() && (
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

        {/* Title Change Requests Section */}
        {canReviewTitleChange() && titleChangeRequests.filter(tcr => tcr.status === 'Pending').length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-300 dark:border-amber-700/50">
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-4 flex items-center">
              <AlertTriangle className="mr-2" size={20} /> Pending Title Change Request
            </h3>
            {titleChangeRequests
              .filter(tcr => tcr.status === 'Pending')
              .map(tcr => (
                <div key={tcr.id} className="bg-white dark:bg-slate-950/50 p-4 rounded-lg border border-amber-200 dark:border-slate-700 mb-4 last:mb-0">
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Requested by {tcr.requestedByName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-3">{new Date(tcr.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-500 dark:text-slate-500 font-semibold min-w-[80px] mt-1">Current:</span>
                      <p className="text-gray-500 dark:text-slate-300 flex-1 line-through opacity-60">{tcr.currentTitle}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-green-600 dark:text-green-500 font-semibold min-w-[80px] mt-1">Proposed:</span>
                      <p className="text-gray-900 dark:text-white flex-1 font-semibold">{tcr.proposedTitle}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReviewTitleChange(tcr, true)}
                      disabled={reviewTitleChangeMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReviewTitleChange(tcr, false)}
                      disabled={reviewTitleChangeMutation.isPending}
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

        {/* Show status of approved/denied title changes to everyone */}
        {titleChangeRequests.filter(tcr => tcr.status !== 'Pending').length > 0 && (
          <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Edit2 className="mr-2" size={20} /> Title Change History
            </h3>
            <div className="space-y-3">
              {titleChangeRequests
                .filter(tcr => tcr.status !== 'Pending')
                .map(tcr => (
                  <div key={tcr.id} className="bg-gray-50 dark:bg-slate-950/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
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
                      <span className={`text-xs px-2 py-1 rounded ${
                        tcr.status === 'Approved'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900'
                      }`}>
                        {tcr.status}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-600 dark:text-slate-400">
                        <span className="line-through opacity-60">{tcr.currentTitle}</span>
                        {tcr.status === 'Approved' && (
                          <> → <span className="text-gray-900 dark:text-white font-medium">{tcr.proposedTitle}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <MessageSquare className="mr-2" size={20} /> Project History
          </h3>
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
            {comments.length === 0 && <p className="text-gray-500 dark:text-slate-500 text-sm italic">No comments yet.</p>}
            {comments.map(c => (
              <div key={c.id} className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">{c.authorName} <span className="text-gray-500 dark:text-slate-600 text-xs">({c.authorRole})</span></span>
                  <span className="text-xs text-gray-500 dark:text-slate-600">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-gray-700 dark:text-slate-300 text-sm">{c.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handlePostComment} className="space-y-2">
            <div className="relative">
              <input
                type="text"
                className={`w-full bg-gray-50 dark:bg-slate-950 border ${commentError ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-3 text-gray-900 dark:text-white pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                placeholder="Add a comment..."
                value={comment}
                onChange={e => {
                  setComment(e.target.value);
                  if (commentError) setCommentError('');
                }}
              />
              <button type="submit" className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-500">
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

        {/* Time Tracking Section - Only show after engineer accepts work */}
        {request.assignedTo && (request.status === RequestStatus.IN_PROGRESS || request.status === RequestStatus.COMPLETED || request.status === RequestStatus.ACCEPTED) && (
          <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Timer className="mr-2" size={20} /> Time Tracking
            </h3>

            {/* Time Summary */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500 dark:text-slate-400">Logged Hours:</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0).toFixed(2)}h
                </span>
              </div>
              {request.estimatedHours && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-500 dark:text-slate-400">Estimated Hours:</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{request.estimatedHours}h</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0) / request.estimatedHours) > 1
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          (timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0) / request.estimatedHours) * 100,
                          100
                        )}%`,
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
                  <div key={entry.id} className="bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">{entry.engineerName}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-600">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500 dark:text-slate-400">{entry.description || 'No description'}</p>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.hours}h</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Log Time Form - Only for assigned engineer */}
            {currentUser.id === request.assignedTo && (
              <form onSubmit={handleLogTime} className="space-y-3 pt-3 border-t border-gray-200 dark:border-slate-800">
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
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Description (optional)</label>
                  <textarea
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm h-16 resize-none"
                    placeholder="What did you work on?"
                    value={timeDescription}
                    onChange={(e) => setTimeDescription(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={addTimeEntryMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                >
                  {addTimeEntryMutation.isPending ? 'Logging...' : 'Log Time'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Status & Actions */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider mb-4">Current Status</h3>
          <div className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              request.status === RequestStatus.ACCEPTED ? 'bg-green-500' :
              request.status === RequestStatus.COMPLETED ? 'bg-green-500' :
              request.status === RequestStatus.IN_PROGRESS ? 'bg-blue-500' :
              request.status === RequestStatus.DENIED ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            {request.status}
          </div>

          {request.assignedToName && (
             <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800 mb-4">
               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                 {request.assignedToName[0]}
               </div>
               <div>
                 <p className="text-xs text-gray-500 dark:text-slate-500">Assigned Engineer</p>
                 <p className="text-sm font-medium text-gray-900 dark:text-white">{request.assignedToName}</p>
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

        {/* Dynamic Actions based on Role */}
        {currentUser.role === UserRole.MANAGER && renderManagerActions()}
        {currentUser.role === UserRole.ENGINEER && renderEngineerActions()}
        {currentUser.role === UserRole.USER && renderUserActions()}
        {/* Admin sees all actions typically, but for this demo we simplify */}
      </div>
    </div>
  );
};