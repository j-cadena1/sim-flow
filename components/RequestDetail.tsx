import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimFlow } from '../context/SimFlowContext';
import { useModal } from './Modal';
import { useToast } from './Toast';
import { RequestStatus, UserRole } from '../types';
import { validateComment } from '../utils/validation';
import { CheckCircle, XCircle, Clock, UserPlus, ArrowLeft, MessageSquare, AlertTriangle, User as UserIcon } from 'lucide-react';

export const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, currentUser, updateRequestStatus, assignEngineer, addComment, getUsersByRole } = useSimFlow();
  const { showConfirm, showPrompt } = useModal();
  const { showToast } = useToast();

  const request = requests.find(r => r.id === id);
  const engineers = getUsersByRole(UserRole.ENGINEER);

  const [assignee, setAssignee] = useState(engineers[0]?.id || '');
  const [hours, setHours] = useState(8);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  if (!request) return <div>Request not found</div>;

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
    assignEngineer(request.id, assignee, hours);
    showToast('Engineer assigned successfully', 'success');
  };

  const handleEngineerAccept = () => {
    updateRequestStatus(request.id, RequestStatus.IN_PROGRESS);
    showToast('Work accepted and started', 'success');
  };

  const handleEngineerComplete = () => {
    updateRequestStatus(request.id, RequestStatus.COMPLETED);
    showToast('Work marked as completed', 'success');
  };

  const handleRevisionRequest = () => {
    showPrompt(
      'Request Revision',
      'Please provide a reason for the revision request:',
      (reason) => {
        if (reason.trim()) {
          addComment(request.id, `REVISION REQUESTED: ${reason}`);
          updateRequestStatus(request.id, RequestStatus.REVISION_REQUESTED);
          showToast('Revision requested', 'success');
        }
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

  // --- RENDER HELPERS ---

  const renderManagerActions = () => {
    if (request.status === RequestStatus.SUBMITTED || request.status === RequestStatus.REVISION_REQUESTED) {
      return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6">
          <h3 className="text-white font-semibold mb-3">Manager Actions</h3>
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
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6 space-y-4">
           <h3 className="text-white font-semibold">Feasibility Review</h3>
          <p className="text-sm text-slate-400">Review the request and determine if it's feasible to proceed.</p>
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
      return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6">
           <h3 className="text-white font-semibold mb-4">Resource Allocation</h3>
           <div className="space-y-4">
             <div>
               <label className="block text-xs text-slate-400 mb-1">Assign Engineer</label>
               <select 
                 className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                 value={assignee}
                 onChange={(e) => setAssignee(e.target.value)}
               >
                 {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs text-slate-400 mb-1">Estimated Hours</label>
               <input
                 type="number"
                 className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                 value={hours}
                 onChange={(e) => setHours(Number(e.target.value))}
               />
             </div>
             <button onClick={handleAssign} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium">
               Assign & Send to Engineering
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
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6">
          <h3 className="text-white font-semibold mb-3">New Assignment</h3>
          <p className="text-slate-400 text-sm mb-4">You have been assigned this task for {request.estimatedHours} hours.</p>
          <div className="flex gap-3">
             <button onClick={handleEngineerAccept} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded">
               Accept Work
             </button>
             <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded">
               Request Discussion
             </button>
          </div>
        </div>
      );
    }
    if (request.status === RequestStatus.IN_PROGRESS) {
      return (
         <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6">
          <h3 className="text-white font-semibold mb-3">Work In Progress</h3>
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
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mt-6">
          <h3 className="text-white font-semibold mb-3">Project Completed</h3>
          <p className="text-sm text-slate-400 mb-4">Please review the final delivery.</p>
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
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN: Details */}
      <div className="lg:col-span-2 space-y-6">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center text-sm mb-2">
          <ArrowLeft size={16} className="mr-1" /> Back
        </button>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex justify-between items-start">
             <h1 className="text-3xl font-bold text-white mb-2">{request.title}</h1>
             <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 font-mono border border-slate-700">
               {request.id.slice(0, 8)}
             </span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-slate-400 mb-6">
            <span className="flex items-center"><UserIcon size={14} className="mr-1" /> {request.createdByName}</span>
            <span className="flex items-center"><Clock size={14} className="mr-1" /> {new Date(request.createdAt).toLocaleDateString()}</span>
            <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900">{request.vendor}</span>
          </div>

          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-slate-200">Description</h3>
            <p className="text-slate-400 whitespace-pre-wrap">{request.description}</p>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <MessageSquare className="mr-2" size={20} /> Project History
          </h3>
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
            {request.comments.length === 0 && <p className="text-slate-500 text-sm italic">No comments yet.</p>}
            {request.comments.map(c => (
              <div key={c.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-sm text-blue-400">{c.authorName} <span className="text-slate-600 text-xs">({c.authorRole})</span></span>
                  <span className="text-xs text-slate-600">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-300 text-sm">{c.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handlePostComment} className="space-y-2">
            <div className="relative">
              <input
                type="text"
                className={`w-full bg-slate-950 border ${commentError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
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
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertTriangle size={14} />
                {commentError}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Status & Actions */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Current Status</h3>
          <div className="text-xl font-bold text-white mb-4 flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              request.status === RequestStatus.ACCEPTED ? 'bg-green-500' :
              request.status === RequestStatus.COMPLETED ? 'bg-green-500' :
              request.status === RequestStatus.IN_PROGRESS ? 'bg-blue-500' :
              request.status === RequestStatus.DENIED ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            {request.status}
          </div>
          
          {request.assignedToName && (
             <div className="flex items-center space-x-3 p-3 bg-slate-950 rounded-lg border border-slate-800 mb-4">
               <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 font-bold">
                 {request.assignedToName[0]}
               </div>
               <div>
                 <p className="text-xs text-slate-500">Assigned Engineer</p>
                 <p className="text-sm font-medium text-white">{request.assignedToName}</p>
               </div>
             </div>
          )}

          {request.estimatedHours && (
            <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-3">
              <span className="text-slate-400">Estimated Effort</span>
              <span className="text-white font-mono">{request.estimatedHours} hrs</span>
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