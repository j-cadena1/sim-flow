import React, { useState } from 'react';
import { useSimFlow } from '../contexts/SimFlowContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { useProjects } from '../lib/api/hooks';
import { validateNewRequest } from '../utils/validation';
import { Send, AlertCircle, FolderOpen, UserCircle } from 'lucide-react';
import { ProjectStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api/client';

export const NewRequest: React.FC = () => {
  const { addRequest } = useSimFlow();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: allProjects = [], isLoading: projectsLoading } = useProjects();

  const approvedProjects = allProjects.filter(p => p.status === ProjectStatus.APPROVED && p.totalHours > p.usedHours);
  const isAdmin = user?.role === 'Admin';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('FANUC');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [projectId, setProjectId] = useState('');
  const [onBehalfOfUserId, setOnBehalfOfUserId] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch users when component mounts (only for admins)
  React.useEffect(() => {
    if (isAdmin) {
      setUsersLoading(true);
      apiClient.get('/users')
        .then(response => {
          setUsers(response.data.users || []);
        })
        .catch(() => {
          // Failed to fetch users for dropdown
        })
        .finally(() => setUsersLoading(false));
    }
  }, [isAdmin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateNewRequest(title, description);

    if (!projectId) {
      validationErrors.project = 'Please select a project';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Please fix the validation errors', 'error');
      return;
    }

    addRequest(title, description, vendor, priority, projectId, onBehalfOfUserId || undefined);
    showToast('Request submitted successfully', 'success');
    navigate('/requests');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Simulation Request</h2>
        <p className="text-gray-500 dark:text-slate-400">Submit a new job for the engineering team.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isAdmin && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <UserCircle size={16} />
                Create on Behalf of User (Optional)
              </label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={onBehalfOfUserId}
                onChange={(e) => setOnBehalfOfUserId(e.target.value)}
                disabled={usersLoading}
              >
                <option value="">Create as myself</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
              {onBehalfOfUserId && (
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  This request will be created on behalf of the selected user
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Project Title</label>
            <input
              type="text"
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="e.g. Robot Cell Cycle Time Analysis"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
              }}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <FolderOpen size={16} />
              Project (Hour Budget)
            </label>
            <select
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.project ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                if (errors.project) setErrors(prev => ({ ...prev, project: undefined }));
              }}
              disabled={projectsLoading}
            >
              <option value="">Select a project...</option>
              {approvedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.code}) - {project.totalHours - project.usedHours}h available
                </option>
              ))}
            </select>
            {errors.project && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.project}
              </p>
            )}
            {approvedProjects.length === 0 && !projectsLoading && (
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertCircle size={14} />
                No projects with available hours. Please create or request a project first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Vendor / Equipment</label>
              <select
                className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              >
                <option value="FANUC">FANUC</option>
                <option value="Siemens">Siemens</option>
                <option value="ABB">ABB</option>
                <option value="Yaskawa">Yaskawa</option>
                <option value="KUKA">KUKA</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Priority Level</label>
              <select
                className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priority}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'Low' || value === 'Medium' || value === 'High') {
                    setPriority(value);
                  }
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Detailed Description</label>
            <textarea
              className={`w-full bg-gray-50 dark:bg-slate-950 border ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'} rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none`}
              placeholder="Describe the simulation requirements, inputs, and desired outputs..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
            />
            {errors.description ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.description}
              </p>
            ) : (
              <div className="mt-2 flex items-start space-x-2 text-xs text-gray-500 dark:text-slate-500">
                <AlertCircle size={14} className="mt-0.5" />
                <span>Please include details about part weight, reach requirements, and cycle time targets for accurate feasibility analysis.</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Send size={18} />
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
