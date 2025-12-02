import React, { useMemo } from 'react';
import { useSimFlow } from '../context/SimFlowContext';
import { RequestStatus } from '../types';
import { CHART_COLORS, STATUS_INDICATOR_COLORS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Clock, CheckCircle, AlertOctagon } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { requests } = useSimFlow();

  // Memoize stats calculations
  const stats = useMemo(() => {
    const total = requests.length;
    const inProgress = requests.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
    const completed = requests.filter(r => r.status === RequestStatus.COMPLETED || r.status === RequestStatus.ACCEPTED).length;
    const pending = requests.filter(r => [RequestStatus.SUBMITTED, RequestStatus.FEASIBILITY_REVIEW, RequestStatus.RESOURCE_ALLOCATION].includes(r.status)).length;
    const denied = requests.filter(r => r.status === RequestStatus.DENIED).length;

    return { total, inProgress, completed, pending, denied };
  }, [requests]);

  // Memoize chart data
  const statusData = useMemo(() => [
    { name: 'Pending', value: stats.pending, color: CHART_COLORS.pending },
    { name: 'Engineering', value: stats.inProgress, color: CHART_COLORS.engineering },
    { name: 'Completed', value: stats.completed, color: CHART_COLORS.completed },
    { name: 'Denied', value: stats.denied, color: CHART_COLORS.denied },
  ], [stats]);

  interface StatCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ size?: number }>;
    color: string;
  }

  const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon size={64} />
      </div>
      <div className="relative z-10">
        <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-slate-400">Real-time overview of simulation throughput.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Requests" value={stats.total} icon={Activity} color="text-blue-500" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} color="text-indigo-500" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="text-green-500" />
        <StatCard label="Pending Review" value={stats.pending} icon={AlertOctagon} color="text-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-[400px]">
          <h3 className="text-lg font-semibold text-white mb-6">Request Status Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                cursor={{ fill: '#1e293b' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
           <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
           <div className="space-y-4">
             {requests.slice(0, 5).map(req => {
               const statusColor = STATUS_INDICATOR_COLORS[req.status] || STATUS_INDICATOR_COLORS.DEFAULT;
               return (
                 <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/50">
                   <div className="flex items-center space-x-3">
                     <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                     <div>
                       <p className="text-sm font-medium text-white">{req.title}</p>
                       <p className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</p>
                     </div>
                   </div>
                   <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">{req.status}</span>
                 </div>
               );
             })}
             {requests.length === 0 && <p className="text-slate-500 text-sm">No recent activity.</p>}
           </div>
        </div>
      </div>
    </div>
  );
};