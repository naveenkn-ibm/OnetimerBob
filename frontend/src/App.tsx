import React from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Workspace from './pages/Workspace';

const App: React.FC = () => {
  const { isAuthenticated, allowRedirect } = useAuth();

  console.log('🔄 App render - isAuthenticated:', isAuthenticated, 'allowRedirect:', allowRedirect);

  // Render Login or Workspace based on authentication state AND allowRedirect flag
  // This ensures the success dialog has time to display before redirecting
  // Note: We don't check isLoading here because Login.tsx handles its own loading state with progress bar
  return isAuthenticated && allowRedirect ? <Workspace /> : <Login />;
};

export default App;

// Made with Bob
