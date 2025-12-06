import React, { useState, useMemo } from 'react';
import { useSimFlow } from '../contexts/SimFlowContext';
import { RequestStatus, UserRole } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, AlertTriangle, CheckCircle, Archive, Search, Filter, Plus } from 'lucide-react';

export const RequestList: React.FC = () => {
  const { requests, currentUser } = useSimFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all');

  const getStatusColor = (status: RequestStatus) => STATUS_COLORS[status] || 'bg-slate-700 text-slate-300';

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Guard: ensure currentUser exists
      if (!currentUser) return false;

      // Role-based filtering
      if (currentUser.role === UserRole.USER) {
        if (req.createdBy !== currentUser.id) return false;
      }
      if (currentUser.role === UserRole.ENGINEER) {
        // Engineers see unassigned work that is ready for them, or their own work
        if (req.assignedTo !== currentUser.id && req.status !== RequestStatus.ENGINEERING_REVIEW) {
          return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesTitle = req.title.toLowerCase().includes(searchLower);
        const matchesVendor = req.vendor.toLowerCase().includes(searchLower);
        const matchesCreator = req.createdByName.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesVendor && !matchesCreator) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && req.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [requests, currentUser, searchTerm, statusFilter, priorityFilter]);

  // Separate active and archived requests (archived = older than 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activeRequests = filteredRequests.filter(req => new Date(req.createdAt) >= thirtyDaysAgo);
  const archivedRequests = filteredRequests.filter(req => new Date(req.createdAt) < thirtyDaysAgo);

  const renderRequestCard = (req: typeof filteredRequests[0]) => (
    <Link
      key={req.id}
      to={`/requests/${req.id}`}
      className="block bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/80 border border-gray-200 dark:border-slate-800 hover:border-blue-500/50 rounded-xl p-5 transition-all group shadow-sm"
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {req.title}
          </h3>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-slate-500">
           {new Date(req.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mt-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <UserIcon size={14} />
            <span>{req.createdByName}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{req.vendor}</span>
          </div>
        </div>
        {req.assignedToName && (
          <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
            <CheckCircle size={14} />
            <span>Assigned to {req.assignedToName}</span>
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Simulation Requests</h2>
          <p className="text-gray-500 dark:text-slate-400">Manage and track engineering workloads</p>
        </div>
        <Link
          to="/new"
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus size={18} />
          <span>New Request</span>
        </Link>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="md:col-span-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by title, vendor, or creator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-1">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400" size={18} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value={RequestStatus.SUBMITTED}>Submitted</option>
                <option value={RequestStatus.FEASIBILITY_REVIEW}>Feasibility Review</option>
                <option value={RequestStatus.RESOURCE_ALLOCATION}>Resource Allocation</option>
                <option value={RequestStatus.ENGINEERING_REVIEW}>Engineering Review</option>
                <option value={RequestStatus.DISCUSSION}>Discussion</option>
                <option value={RequestStatus.IN_PROGRESS}>In Progress</option>
                <option value={RequestStatus.COMPLETED}>Completed</option>
                <option value={RequestStatus.ACCEPTED}>Accepted</option>
                <option value={RequestStatus.DENIED}>Denied</option>
              </select>
            </div>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-1">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'Low' | 'Medium' | 'High')}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>
          </div>
        </div>

        {/* Active Filter Pills */}
        {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-slate-800">
            <span className="text-xs text-gray-500 dark:text-slate-400">Active filters:</span>
            {searchTerm && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                Search: "{searchTerm}"
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                Status: {statusFilter}
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full border border-orange-200 dark:border-orange-800">
                Priority: {priorityFilter}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white ml-auto"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Active Requests */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Requests ({activeRequests.length})</h3>
        <div className="grid gap-4">
          {activeRequests.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm">
              <div className="bg-gray-100 dark:bg-slate-800 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-gray-400 dark:text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No active requests</h3>
              <p className="text-gray-500 dark:text-slate-500">There are no active simulation requests visible to you.</p>
            </div>
          ) : (
            activeRequests.map(renderRequestCard)
          )}
        </div>
      </div>

      {/* Archived Requests */}
      {archivedRequests.length > 0 && (
        <details className="bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-800">
          <summary className="cursor-pointer p-4 text-lg font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2">
            <Archive size={20} />
            Archived Requests ({archivedRequests.length})
            <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">(older than 30 days)</span>
          </summary>
          <div className="p-4 pt-0 space-y-3">
            {archivedRequests.map(renderRequestCard)}
          </div>
        </details>
      )}
    </div>
  );
};