import React, { useState, useEffect } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import apiClient from '../lib/api/client';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, error, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Check if SSO is enabled on mount
  useEffect(() => {
    const checkSSOStatus = async () => {
      try {
        const response = await apiClient.get('/auth/sso/status');
        setSsoEnabled(response.data.enabled);
      } catch (error) {
        console.error('Error checking SSO status:', error);
      }
    };

    checkSSOStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      await onLogin(email, password);
    } catch (err) {
      // Error will be handled by parent component
    }
  };

  const handleSSOLogin = async () => {
    try {
      setSsoLoading(true);
      setLocalError('');

      const response = await apiClient.get('/auth/sso/login');

      if (response.data.authUrl) {
        // Redirect to Microsoft login
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('SSO login error:', error);
      setLocalError('Failed to initiate SSO login. Please try again.');
      setSsoLoading(false);
    }
  };

  const errorMessage = error || localError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-xl">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Sim-Flow</h1>
          <p className="text-gray-500 dark:text-slate-400">Sign in to continue</p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="qadmin@simflow.local"
                disabled={isLoading}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* SSO Section */}
          {ssoEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400">Or continue with</span>
                </div>
              </div>

              <button
                onClick={handleSSOLogin}
                disabled={ssoLoading}
                className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-300"
              >
                {ssoLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-900 rounded-full animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                      <path d="M0 0h11v11H0z" fill="#f25022"/>
                      <path d="M12 0h11v11H12z" fill="#00a4ef"/>
                      <path d="M0 12h11v11H0z" fill="#7fba00"/>
                      <path d="M12 12h11v11H12z" fill="#ffb900"/>
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 dark:text-slate-500 text-sm mt-6">
          Sim-Flow &copy; 2025 - Simulated Workflow Management
        </p>
      </div>
    </div>
  );
};

export default Login;
