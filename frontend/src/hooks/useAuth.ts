import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, LoginRequest, handleApiError } from '../utils/api';

export interface AuthProgress {
  step: number;
  totalSteps: number;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

export interface AuthState {
  isAuthenticated: boolean;
  allowRedirect: boolean;
  isLoading: boolean;
  error: string | null;
  user: {
    tsoId: string;
    sessionId: string;
  } | null;
  progress: AuthProgress | null;
}

// Use empty string to connect to same origin (Vite dev server will proxy to backend)
const WS_URL = import.meta.env.VITE_WS_URL || '';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    allowRedirect: false,
    isLoading: false,
    error: null,
    user: null,
    progress: null,
  });

  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(WS_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('auth:progress', (data: AuthProgress) => {
      setAuthState((prev) => ({
        ...prev,
        progress: data,
      }));
    });

    socket.on('auth:success', (data: { user: { tsoId: string; sessionId: string } }) => {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: true,
        user: data.user,
        error: null,
        progress: {
          step: 5,
          totalSteps: 5,
          message: 'Authentication successful',
          status: 'completed',
        },
      }));
    });

    socket.on('auth:error', (data: { message: string }) => {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: data.message,
        progress: {
          step: 0,
          totalSteps: 5,
          message: data.message,
          status: 'error',
        },
      }));
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setAuthState((prev) => ({
        ...prev,
        error: 'Failed to connect to server. Please try again.',
      }));
    });

    return () => {
      socket.off('auth:progress');
      socket.off('auth:success');
      socket.off('auth:error');
      socket.off('connect_error');
    };
  }, [socket]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          const result = await api.validateSession();
          if (result.valid) {
            setAuthState({
              isAuthenticated: true,
              allowRedirect: true,
              isLoading: false,
              error: null,
              user: JSON.parse(userData),
              progress: null,
            });
          } else {
            // Session invalid, clear storage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
        }
      }
    };

    checkSession();
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      if (!socket) {
        setAuthState((prev) => ({
          ...prev,
          error: 'Connection not established. Please refresh the page.',
        }));
        return;
      }

      setAuthState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        progress: {
          step: 0,
          totalSteps: 5,
          message: 'Initializing connection...',
          status: 'pending',
        },
      }));

      // Connect socket if not connected
      if (!socket.connected) {
        socket.connect();
        // Wait for socket to connect before proceeding
        await new Promise<void>((resolve) => {
          if (socket.connected) {
            resolve();
          } else {
            socket.once('connect', () => {
              console.log('✅ WebSocket connected with ID:', socket.id);
              resolve();
            });
          }
        });
      }

      try {
        console.log('🔐 Attempting login with socket ID:', socket.id);
        const response = await api.login(credentials, socket.id);
        console.log('📥 Login response received:', response);

        if (response.success) {
          console.log('✅ Login successful, storing auth data...');
          // Store auth data
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('user_data', JSON.stringify(response.user));
          console.log('💾 Auth data stored in localStorage');

          console.log('🔄 Setting auth state to authenticated...');
          setAuthState({
            isAuthenticated: true,
            allowRedirect: false, // Don't allow redirect yet - Login component will set this after 2 seconds
            isLoading: false,
            error: null,
            user: response.user,
            progress: {
              step: 5,
              totalSteps: 5,
              message: 'Authentication successful',
              status: 'completed',
            },
          });
          console.log('✨ Auth state updated, should redirect now');
        } else {
          console.error('❌ Login failed:', response.message);
          throw new Error(response.message || 'Authentication failed');
        }
      } catch (error) {
        const apiError = handleApiError(error);
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: apiError.message,
          progress: {
            step: 0,
            totalSteps: 5,
            message: apiError.message,
            status: 'error',
          },
        }));
      }
    },
    [socket]
  );

  const logout = useCallback(async () => {
    try {
      console.log('🚪 Logout initiated - cleaning up resources...');
      
      // Call backend logout endpoint
      await api.logout();
      console.log('✅ Backend logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      // Disconnect WebSocket
      if (socket) {
        console.log('🔌 Disconnecting WebSocket...');
        socket.disconnect();
        socket.close();
      }
      
      // Clear all localStorage data
      console.log('🧹 Clearing localStorage...');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      localStorage.clear(); // Clear any other cached data
      
      // Clear sessionStorage
      console.log('🧹 Clearing sessionStorage...');
      sessionStorage.clear();
      
      // Reset auth state
      console.log('🔄 Resetting auth state...');
      setAuthState({
        isAuthenticated: false,
        allowRedirect: false,
        isLoading: false,
        error: null,
        user: null,
        progress: null,
      });
      
      console.log('✨ Logout complete - all resources cleaned up');
    }
  }, [socket]);

  const clearError = useCallback(() => {
    setAuthState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  const setAllowRedirect = useCallback((allow: boolean) => {
    setAuthState((prev) => ({
      ...prev,
      allowRedirect: allow,
    }));
  }, []);

  return {
    ...authState,
    login,
    logout,
    clearError,
    setAllowRedirect,
  };
};

// Made with Bob
