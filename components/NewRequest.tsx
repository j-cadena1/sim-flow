import React, { useState } from 'react';
import { useSimFlow } from '../context/SimFlowContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { validateNewRequest } from '../utils/validation';
import { Send, AlertCircle } from 'lucide-react';

export const NewRequest: React.FC = () => {
  const { addRequest } = useSimFlow();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('FANUC');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateNewRequest(title, description);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Please fix the validation errors', 'error');
      return;
    }

    addRequest(title, description, vendor, priority);
    showToast('Request submitted successfully', 'success');
    navigate('/requests');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">New Simulation Request</h2>
        <p className="text-slate-400">Submit a new job for the engineering team.</p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Project Title</label>
            <input
              type="text"
              className={`w-full bg-slate-950 border ${errors.title ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
              placeholder="e.g. Robot Cell Cycle Time Analysis"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
              }}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Vendor / Equipment</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Priority Level</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Detailed Description</label>
            <textarea
              className={`w-full bg-slate-950 border ${errors.description ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none`}
              placeholder="Describe the simulation requirements, inputs, and desired outputs..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
            />
            {errors.description ? (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.description}
              </p>
            ) : (
              <div className="mt-2 flex items-start space-x-2 text-xs text-slate-500">
                <AlertCircle size={14} className="mt-0.5" />
                <span>Please include details about part weight, reach requirements, and cycle time targets for accurate feasibility analysis.</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
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