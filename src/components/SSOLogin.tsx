import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';
const SSO_DASHBOARD_URL = import.meta.env.VITE_SSO_DASHBOARD_URL || 'https://sso.bylinelms.com/dashboard';

export function SSOLogin() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  const redirectToSSODashboard = () => {
    try {
      if (window !== window.top && window.top) {
        window.top.location.href = SSO_DASHBOARD_URL;
      } else {
        window.location.href = SSO_DASHBOARD_URL;
      }
    } catch (error) {
      console.error('⚠️ Unable to redirect parent window, using fallback redirect.', error);
      window.location.href = SSO_DASHBOARD_URL;
    }
  };

  useEffect(() => {
    const handleSSOLogin = async () => {
      try {
        // Extract token from URL query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
          console.error('❌ SSO login failed: No token in URL. Redirecting to SSO dashboard.');
          setStatus('error');
          setMessage('SSO token not found. Redirecting to SSO dashboard...');
          redirectToSSODashboard();
          return;
        }


        // Send token to backend
        const response = await fetch(`${API_URL}/auth/sso-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setStatus('error');
          // Show user-friendly error message
          const errorMessage = result.message || 'SSO login failed';
          setMessage(errorMessage.includes('No account found') 
            ? 'SSO Login failed. No matching account found.' 
            : errorMessage);
          console.error('❌ SSO login failed:', result.message);
          if (result.redirectToSSO) {
            redirectToSSODashboard();
          }
          return;
        }


        // Store local app token and user data
        const { user, access_token, refresh_token, expires_in } = result.data;

        sessionStorage.setItem('access_token', access_token);
        sessionStorage.setItem('user_data', JSON.stringify(user));
        if (refresh_token) {
          sessionStorage.setItem('refresh_token', refresh_token);
        }

        // If team member, also store team token
        if (user.type === 'team') {
          sessionStorage.setItem('teamToken', access_token);
          sessionStorage.setItem('teamUserData', JSON.stringify(user));
          if (refresh_token) {
            sessionStorage.setItem('teamRefreshToken', refresh_token);
          }
        }

        setStatus('success');
        setMessage('Login successful! Redirecting...');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          // Reload the page to trigger App.tsx to recognize the new session
          // Remove token from URL to prevent re-processing
          window.location.href = window.location.pathname;
        }, 1500);

      } catch (error: any) {
        console.error('❌ SSO login error:', error);
        setStatus('error');
        setMessage(error.message || 'An error occurred during SSO login');
        redirectToSSODashboard();
      }
    };

    handleSSOLogin();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authenticating...</h2>
            <p className="text-gray-600">Please wait while we verify your SSO credentials</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Successful!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">SSO Login Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500 mb-4">
              Please contact your administrator if you believe you should have access.
            </p>
            <button
              onClick={() => {
                // Remove token from URL and redirect to home/login page
                redirectToSSODashboard();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to SSO Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

