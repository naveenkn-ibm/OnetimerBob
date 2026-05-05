import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import { Eye, EyeOff, Lock, User, Server, CheckCircle } from 'lucide-react';

const Login: React.FC = () => {
  // Auto-populate from environment variables if available (development only)
  const [tsoId, setTsoId] = useState(import.meta.env.VITE_TSO_ID || '');
  const [password, setPassword] = useState(import.meta.env.VITE_TSO_PASSWORD || '');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);

  const { login, isLoading, error, progress, clearError, isAuthenticated, setAllowRedirect } = useAuth();

  // Show success dialog when authentication completes, then auto-redirect after 2 seconds
  useEffect(() => {
    if (isAuthenticated && !authCompleted && progress?.status === 'completed') {
      console.log('✅ Authentication complete, showing dialog...');
      setShowSuccessDialog(true);
      setAuthCompleted(true);
      
      // Auto-close dialog and allow redirect after 2 seconds
      const timer = setTimeout(() => {
        console.log('⏰ Auto-closing dialog after 2 seconds...');
        setShowSuccessDialog(false);
        setAllowRedirect(true); // This now calls the useAuth method
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, progress, authCompleted]);

  const handleSuccessDialogClose = () => {
    console.log('🚀 Dialog closed manually by user');
    setShowSuccessDialog(false);
    setAllowRedirect(true); // This now calls the useAuth method
  };

  // Show success dialog when authenticated (App.tsx will handle redirect based on allowRedirect flag)
  if (isAuthenticated && showSuccessDialog) {
    // Keep showing login page with dialog
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
        {/* Success Dialog Modal */}
        {showSuccessDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass rounded-2xl shadow-2xl p-8 max-w-md w-full transform animate-scaleIn">
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center animate-bounce-once">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
              </div>

              {/* Success Message */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-3">
                  Authentication Successful!
                </h2>
                <p className="text-slate-300 mb-2">
                  Welcome back, <span className="font-semibold text-blue-400">{tsoId}</span>
                </p>
                <p className="text-sm text-slate-400">
                  You have been successfully authenticated to the mainframe system.
                </p>
              </div>

              {/* Connection Details */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Session Status:</span>
                  <span className="text-green-400 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-400">Mainframe:</span>
                  <span className="text-slate-300 font-mono text-xs">204.90.115.200</span>
                </div>
              </div>

              {/* OK Button */}
              <button
                onClick={handleSuccessDialogClose}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const validateInputs = (): boolean => {
    // TSO ID validation: Must start with 'Z' followed by 5 alphanumeric characters
    const tsoIdPattern = /^Z[0-9A-Z]{5}$/i;
    
    if (!tsoId.trim()) {
      setValidationError('TSO ID is required');
      return false;
    }

    if (!tsoIdPattern.test(tsoId.toUpperCase())) {
      setValidationError('TSO ID must be in format Z##### (e.g., Z90035, ZQ1788)');
      return false;
    }

    if (!password.trim()) {
      setValidationError('Password is required');
      return false;
    }

    if (password.length < 4) {
      setValidationError('Password must be at least 4 characters');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous errors before new attempt
    if (error) clearError();
    if (validationError) setValidationError('');
    
    if (!validateInputs()) {
      return;
    }

    await login({
      tsoId: tsoId.toUpperCase(),
      password,
    });
  };

  const handleTsoIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Only allow alphanumeric characters and limit to 6 characters
    if (/^[Z0-9A-Z]{0,6}$/.test(value)) {
      setTsoId(value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="glass rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
              <Server className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">OneTimer Bob</h1>
            <p className="text-slate-400 text-sm">
              AI-Powered One-timer Process Modernization
            </p>
          </div>

          {/* Connection Info */}
          <div className="mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Server className="w-4 h-4" />
              <span>Mainframe: 204.90.115.200:10443</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* TSO ID Input */}
            <div>
              <label htmlFor="tsoId" className="block text-sm font-medium text-slate-300 mb-2">
                TSO ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="tsoId"
                  type="text"
                  value={tsoId}
                  onChange={handleTsoIdChange}
                  placeholder="Z#####"
                  disabled={isLoading}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  autoComplete="username"
                  maxLength={6}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Format: Z followed by 5 characters (e.g., Z90035)
              </p>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="block w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Messages */}
            {(error || validationError) && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400">{error || validationError}</p>
              </div>
            )}

            {/* Progress Bar - Show during loading OR if there's an error with progress */}
            {progress && (isLoading || progress.status === 'error') && (
              <div className="mt-6">
                <ProgressBar progress={progress} />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !tsoId || !password}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Connect to Mainframe'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Secure connection via z/OSMF REST API
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            IBM Z Mainframe Authentication • Enterprise Grade Security
          </p>
        </div>
      </div>

      {/* Success Dialog Modal */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass rounded-2xl shadow-2xl p-8 max-w-md w-full transform animate-scaleIn">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center animate-bounce-once">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">
                Authentication Successful!
              </h2>
              <p className="text-slate-300 mb-2">
                Welcome back, <span className="font-semibold text-blue-400">{tsoId}</span>
              </p>
              <p className="text-sm text-slate-400">
                You have been successfully authenticated to the mainframe system.
              </p>
            </div>

            {/* Connection Details */}
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Session Status:</span>
                <span className="text-green-400 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-400">Mainframe:</span>
                <span className="text-slate-300 font-mono text-xs">204.90.115.200</span>
              </div>
            </div>

            {/* OK Button */}
            <button
              onClick={handleSuccessDialogClose}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

// Made with Bob
