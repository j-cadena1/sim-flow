import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, List, Cpu, FolderOpen, LogOut, Settings } from 'lucide-react';
import { useSimFlow } from '../context/SimFlowContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const Sidebar: React.FC = () => {
  const { currentUser } = useSimFlow();
  const { logout } = useAuth();

  const getLinks = () => {
    const links = [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/requests', icon: List, label: 'Requests' },
      { to: '/projects', icon: FolderOpen, label: 'Projects' },
    ];

    if (currentUser.role === UserRole.USER) {
      links.push({ to: '/new', icon: PlusCircle, label: 'New Request' });
    }

    if (currentUser.role === UserRole.ADMIN) {
      links.push({ to: '/settings', icon: Settings, label: 'Settings' });
    }

    return links;
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Cpu className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Sim-Flow</h1>
          <p className="text-xs text-slate-400">Engineering Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {getLinks().map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-900/30 text-blue-400 border border-blue-900'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <link.icon size={20} />
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <img src={currentUser.avatarUrl || currentUser.avatar} alt="User" className="w-8 h-8 rounded-full bg-slate-700" />
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-400 truncate">{currentUser.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-slate-400 hover:bg-red-900/20 hover:text-red-400 border border-transparent hover:border-red-900/30"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};