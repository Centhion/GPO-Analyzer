/**
 * AuthGuard Component
 * 
 * Wraps the application and requires Entra ID authentication.
 * Shows loading state during auth operations and login screen if not authenticated.
 */
import type { ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../../authConfig';
import { LogIn, Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  // Show loading during auth operations
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-5xl mb-4">🏢</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">GPO Analyzer</h1>
            <p className="text-gray-500 text-sm mb-1">Cross-Domain Consolidation Analysis</p>
            <p className="text-gray-600 mb-6">
              Sign in with your organization account to continue
            </p>
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <LogIn className="h-5 w-5" />
              Sign in with Microsoft
            </button>
            <p className="text-xs text-gray-400 mt-6">
              Protected resource • Authorized users only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
