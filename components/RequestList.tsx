import React from 'react';
import { useSimFlow } from '../context/SimFlowContext';
import { RequestStatus, UserRole } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, AlertTriangle, CheckCircle } from 'lucide-react';

export const RequestList: React.FC = () => {
  const { requests, currentUser } = useSimFlow();

  const getStatusColor = (status: RequestStatus) => STATUS_COLORS[status] || 'bg-slate-700 text-slate-300';

  const filteredRequests = requests.filter(req => {
    if (currentUser.role === UserRole.USER) {
      return req.createdBy === currentUser.id;
    }
    if (currentUser.role === UserRole.ENGINEER) {
      // Engineers see unassigned work that is ready for them, or their own work
      return req.assignedTo === currentUser.id || req.status === RequestStatus.ENGINEERING_REVIEW;
    }
    // Managers/Admins see all
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Simulation Requests</h2>
          <p className="text-slate-400">Manage and track engineering workloads</p>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
            <div className="bg-slate-800 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white">No requests found</h3>
            <p className="text-slate-500">There are no active simulation requests visible to you.</p>
          </div>
        ) : (
          filteredRequests.map((req) => (
            <Link 
              key={req.id} 
              to={`/requests/${req.id}`}
              className="block bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl p-5 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(req.status)}`}>
                      {req.status}
                    </span>
                    <span className={`text-xs font-bold ${PRIORITY_COLORS[req.priority]}`}>
                      {req.priority} Priority
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {req.title}
                  </h3>
                </div>
                <div className="text-right text-xs text-slate-500">
                   {new Date(req.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-400 mt-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <UserIcon size={14} />
                    <span>{req.createdByName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs">{req.vendor}</span>
                  </div>
                </div>
                {req.assignedToName && (
                  <div className="flex items-center space-x-1 text-blue-400">
                    <CheckCircle size={14} />
                    <span>Assigned to {req.assignedToName}</span>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};