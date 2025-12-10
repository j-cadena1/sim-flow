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

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimRQ } from '../contexts/SimRQContext';
import { useModal } from './Modal';
import { useToast } from './Toast';
import {
  useRequest,
  useProject,
  useUpdateProjectHours,
  useDeleteRequest,
  useTimeEntries,
  useAddTimeEntry,
  useUpdateRequestTitle,
  useUpdateRequestDescription,
  useRequestTitleChange,
  useTitleChangeRequests,
  useReviewTitleChange,
  useDiscussionRequests,
  useCreateDiscussionRequest,
  useReviewDiscussionRequest,
  useUpdateRequestRequester,
  useUsers,
  useAssignEngineer,
} from '../lib/api/hooks';
import { RequestStatus, UserRole, TitleChangeRequest, DiscussionRequest } from '../types';
import { validateComment } from '../utils/validation';
import { ArrowLeft } from 'lucide-react';
import {
  RequestHeader,
  RequestInfo,
  RequestComments,
  RequestActions,
  RequestSidebar,
  TimeTracking,
  TitleChangeRequests,
  Attachments,
} from './request-detail';

/**
 * Request Detail page component
 *
 * Fetches request data from API and renders appropriate UI based on
 * request status and current user's role.
 */
export const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, updateRequestStatus, addComment, getUsersByRole } =
    useSimRQ();
  const { showConfirm, showPrompt, showDiscussionRequest } = useModal();
  const { showToast } = useToast();

  const { data, isLoading, isError } = useRequest(id!);
  const request = data?.request;
  const comments = data?.comments || [];

  const { data: project } = useProject(request?.projectId || '');
  const updateProjectHoursMutation = useUpdateProjectHours();
  const assignEngineerMutation = useAssignEngineer();
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

  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [visibleToRequester, setVisibleToRequester] = useState(false); // Default to internal (not visible)

  if (isLoading)
    return <div className="text-gray-600 dark:text-slate-400">Loading...</div>;
  if (isError || !request)
    return <div className="text-gray-600 dark:text-slate-400">Request not found</div>;

  // --- ACTIONS ---

  const handleStartManagerReview = () => {
    updateRequestStatus(request.id, RequestStatus.MANAGER_REVIEW);
    showToast('Manager review started', 'success');
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

  const handleAssign = (engineerId: string, hours: number) => {
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

    // Backend handles hour allocation atomically within a transaction
    assignEngineerMutation.mutate(
      { id: request.id, engineerId, estimatedHours: hours },
      {
        onSuccess: () => {
          showToast('Engineer assigned and hours allocated', 'success');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Failed to assign engineer';
          showToast(message, 'error');
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
            addComment(
              request.id,
              `DISCUSSION REQUESTED: ${reason}${
                suggestedHours ? ` (Suggested hours: ${suggestedHours})` : ''
              }`,
              true
            );
            showToast('Discussion request sent to manager', 'success');
          },
          onError: (error: any) => {
            showToast(
              error.response?.data?.error || 'Failed to request discussion',
              'error'
            );
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
          addComment(request.id, `REVISION REQUESTED: ${reason}`, true);
          updateRequestStatus(request.id, RequestStatus.REVISION_APPROVAL);
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
        addComment(request.id, 'Manager approved revision request - returned to engineering', true);
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
        addComment(request.id, 'Manager denied revision request - marked as completed', true);
        updateRequestStatus(request.id, RequestStatus.COMPLETED);
        showToast('Revision denied - marked as completed', 'success');
      }
    );
  };

  const handleAccept = () => {
    addComment(request.id, 'Work accepted by requester.', true);
    updateRequestStatus(request.id, RequestStatus.ACCEPTED);
    showToast('Work accepted successfully', 'success');
  };

  const handlePostComment = () => {
    setCommentError('');

    const validation = validateComment(comment);
    if (!validation.isValid) {
      setCommentError(validation.error || 'Invalid comment');
      return;
    }

    addComment(request.id, comment, visibleToRequester);
    setComment('');
    setVisibleToRequester(false); // Reset to default (internal) after posting
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

  const handleTitleEdit = (newTitle: string) => {
    // Engineers request title changes, others can update directly
    if (currentUser.role === UserRole.ENGINEER) {
      requestTitleChangeMutation.mutate(
        { id: request.id, proposedTitle: newTitle },
        {
          onSuccess: () => {
            showToast('Title change request submitted for approval', 'success');
          },
          onError: (error: any) => {
            showToast(
              error.response?.data?.error || 'Failed to submit title change request',
              'error'
            );
          },
        }
      );
    } else {
      updateRequestTitleMutation.mutate(
        { id: request.id, title: newTitle },
        {
          onSuccess: () => {
            showToast('Request title updated', 'success');
          },
          onError: (error: any) => {
            showToast(error.response?.data?.error || 'Failed to update title', 'error');
          },
        }
      );
    }
  };

  const handleDescriptionUpdate = (newDescription: string) => {
    updateRequestDescriptionMutation.mutate(
      { id: request.id, description: newDescription },
      {
        onSuccess: () => {
          showToast('Request description updated', 'success');
        },
        onError: (error: any) => {
          showToast(
            error.response?.data?.error || 'Failed to update description',
            'error'
          );
        },
      }
    );
  };

  const handleRequesterChange = (newRequesterId: string) => {
    updateRequestRequesterMutation.mutate(
      { id: request.id, newRequesterId },
      {
        onSuccess: () => {
          showToast('Request requester updated successfully', 'success');
        },
        onError: (error: any) => {
          showToast(
            error.response?.data?.error || 'Failed to update requester',
            'error'
          );
        },
      }
    );
  };

  const handleReviewTitleChange = (
    titleChangeRequest: TitleChangeRequest,
    approved: boolean
  ) => {
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
              showToast(
                error.response?.data?.error || `Failed to ${action} title change`,
                'error'
              );
            },
          }
        );
      }
    );
  };

  const handleReviewDiscussion = (
    discussionRequest: DiscussionRequest,
    action: 'approve' | 'deny' | 'override',
    allocatedHours?: number,
    managerResponse?: string
  ) => {
    if (action === 'approve') {
      showConfirm(
        'Approve Suggested Hours',
        `Accept the engineer's suggestion of ${discussionRequest.suggestedHours} hours?`,
        () => {
          reviewDiscussionRequestMutation.mutate(
            {
              id: discussionRequest.id,
              requestId: request.id,
              action: 'approve',
            },
            {
              onSuccess: () => {
                showToast('Discussion approved - hours updated', 'success');
              },
              onError: (error: any) => {
                showToast(
                  error.response?.data?.error || 'Failed to approve discussion',
                  'error'
                );
              },
            }
          );
        }
      );
    } else if (action === 'override') {
      showPrompt(
        'Set Custom Hours',
        `Enter the number of hours you want to allocate:\n\nCurrent: ${request.estimatedHours}h\nSuggested: ${discussionRequest.suggestedHours || 'None'}h`,
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
                  id: discussionRequest.id,
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
                    showToast(
                      error.response?.data?.error || 'Failed to update hours',
                      'error'
                    );
                  },
                }
              );
            },
            ''
          );
        },
        String(discussionRequest.suggestedHours || request.estimatedHours || '')
      );
    } else {
      showConfirm(
        'Deny Discussion Request',
        `Keep the original allocation of ${request.estimatedHours}h and send back to Engineering Review?`,
        () => {
          reviewDiscussionRequestMutation.mutate(
            {
              id: discussionRequest.id,
              requestId: request.id,
              action: 'deny',
            },
            {
              onSuccess: () => {
                showToast('Discussion denied - keeping original hours', 'success');
              },
              onError: (error: any) => {
                showToast(
                  error.response?.data?.error || 'Failed to deny discussion',
                  'error'
                );
              },
            }
          );
        }
      );
    }
  };

  const handleLogTime = (hours: number, description: string) => {
    if (hours < 0.25) {
      showToast('Time must be at least 0.25 hours', 'error');
      return;
    }

    addTimeEntryMutation.mutate(
      { requestId: request.id, hours, description },
      {
        onSuccess: () => {
          showToast('Time logged successfully', 'success');
        },
        onError: () => {
          showToast('Failed to log time', 'error');
        },
      }
    );
  };

  // Permission checks
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

  const canEditDescription = () => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (currentUser.role === UserRole.USER && request.createdBy === currentUser.id) {
      return true;
    }
    return false;
  };

  const canReviewTitleChange = () => {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      return true;
    }
    if (request.createdBy === currentUser.id) {
      return true;
    }
    return false;
  };

  const showAdminOptions =
    currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN: Details */}
      <div className="lg:col-span-2 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center text-sm mb-2"
        >
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>

        <RequestHeader
          request={request}
          currentUser={currentUser}
          canEditTitle={canEditTitle()}
          canDirectlyEditTitle={canDirectlyEditTitle()}
          showAdminOptions={showAdminOptions}
          onDelete={handleDelete}
          onTitleEdit={handleTitleEdit}
          onRequesterChange={handleRequesterChange}
          allUsers={allUsers}
        />

        <RequestInfo
          request={request}
          canEditDescription={canEditDescription()}
          onDescriptionUpdate={handleDescriptionUpdate}
        />

        <TitleChangeRequests
          titleChangeRequests={titleChangeRequests}
          canReview={canReviewTitleChange()}
          onReview={handleReviewTitleChange}
          isReviewing={reviewTitleChangeMutation.isPending}
        />

        <Attachments
          requestId={request.id}
          currentUser={currentUser}
          requestCreatedBy={request.createdBy}
          assignedTo={request.assignedTo}
        />

        <RequestComments
          comments={comments}
          comment={comment}
          commentError={commentError}
          showVisibilityCheckbox={['Engineer', 'Manager', 'Admin'].includes(currentUser.role)}
          visibleToRequester={visibleToRequester}
          onCommentChange={(value) => {
            setComment(value);
            if (commentError) setCommentError('');
          }}
          onVisibilityChange={setVisibleToRequester}
          onCommentSubmit={handlePostComment}
        />

        {/* Time Tracking Section - Only show after engineer accepts work */}
        {request.assignedTo &&
          (request.status === RequestStatus.IN_PROGRESS ||
            request.status === RequestStatus.COMPLETED ||
            request.status === RequestStatus.ACCEPTED) && (
            <TimeTracking
              request={request}
              currentUser={currentUser}
              timeEntries={timeEntries}
              onLogTime={handleLogTime}
              isLoggingTime={addTimeEntryMutation.isPending}
            />
          )}
      </div>

      {/* RIGHT COLUMN: Status & Actions */}
      <div className="lg:col-span-1 space-y-6">
        <RequestSidebar request={request} />

        {/* Dynamic Actions based on Role */}
        <RequestActions
          request={request}
          currentUser={currentUser}
          project={project}
          engineers={engineers}
          titleChangeRequests={titleChangeRequests}
          discussionRequests={discussionRequests}
          onStartManagerReview={handleStartManagerReview}
          onDeny={handleDeny}
          onAssign={handleAssign}
          onApproveRevision={handleApproveRevision}
          onDenyRevision={handleDenyRevision}
          onEngineerAccept={handleEngineerAccept}
          onEngineerComplete={handleEngineerComplete}
          onRequestDiscussion={handleRequestDiscussion}
          onAccept={handleAccept}
          onRevisionRequest={handleRevisionRequest}
          onReviewTitleChange={handleReviewTitleChange}
          onReviewDiscussion={handleReviewDiscussion}
        />
      </div>
    </div>
  );
};
