import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, List, Cpu, FolderOpen, LogOut, Settings, BarChart, Menu, X, Sun, Moon, Monitor } from 'lucide-react';
import { useSimFlow } from '../contexts/SimFlowContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { UserRole } from '../types';

export const Sidebar: React.FC = () => {
  const { currentUser } = useSimFlow();
  const { logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getLinks = () => {
    const links = [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/requests', icon: List, label: 'Requests' },
      { to: '/projects', icon: FolderOpen, label: 'Projects' },
    ];

    // Analytics visible to Admin and Manager
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
      links.push({ to: '/analytics', icon: BarChart, label: 'Analytics' });
    }

    // Settings visible to all users (for Sessions and Notification preferences)
    // Admin sees all tabs, End-Users see only Sessions and Notifications
    links.push({ to: '/settings', icon: Settings, label: 'Settings' });

    return links;
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors shadow-lg"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-40
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 flex items-center space-x-3 border-b border-gray-200 dark:border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Cpu className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Sim RQ</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">Engineering Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {getLinks().map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                }`
              }
            >
              <link.icon size={20} />
              <span className="font-medium">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-3 bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border border-gray-200 dark:border-slate-800">
            <img src={currentUser.avatarUrl} alt="User" className="w-8 h-8 rounded-full bg-gray-300 dark:bg-slate-700" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser.name}</p>
              {currentUser.role === UserRole.ADMIN && (
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{currentUser.role}</p>
              )}
            </div>
          </div>

          {/* Theme Slider */}
          <div className="bg-gray-100 dark:bg-slate-950 p-1 rounded-lg border border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-1 relative">
              {/* Sliding background indicator */}
              <div
                className="absolute inset-y-1 bg-white dark:bg-slate-800 rounded-md shadow-sm transition-all duration-200 ease-in-out border border-gray-300 dark:border-slate-700"
                style={{
                  width: 'calc(33.333% - 0.25rem)',
                  transform: `translateX(${
                    mode === 'light' ? '0%' :
                    mode === 'dark' ? 'calc(100% + 0.25rem)' :
                    'calc(200% + 0.5rem)'
                  })`
                }}
              />

              {/* Light mode button */}
              <button
                onClick={() => setMode('light')}
                className={`relative z-10 flex items-center justify-center px-3 py-2 rounded-md transition-colors ${
                  mode === 'light'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-400'
                }`}
                aria-label="Light mode"
                title="Light mode"
              >
                <Sun size={16} />
              </button>

              {/* Dark mode button */}
              <button
                onClick={() => setMode('dark')}
                className={`relative z-10 flex items-center justify-center px-3 py-2 rounded-md transition-colors ${
                  mode === 'dark'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-400'
                }`}
                aria-label="Dark mode"
                title="Dark mode"
              >
                <Moon size={16} />
              </button>

              {/* System mode button */}
              <button
                onClick={() => setMode('system')}
                className={`relative z-10 flex items-center justify-center px-3 py-2 rounded-md transition-colors ${
                  mode === 'system'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-400'
                }`}
                aria-label="System preference"
                title="System preference"
              >
                <Monitor size={16} />
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              closeMobileMenu();
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
