import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useAuthHook } from '../hooks/useAuth';

// Create the context
const AuthContext = createContext<ReturnType<typeof useAuthHook> | null>(null);

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthHook();
  
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Made with Bob