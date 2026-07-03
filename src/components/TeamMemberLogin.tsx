import React, { useState } from 'react';
import { LogIn, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { teamService } from '../services/apiService';
import { clearTaskManagerSessionCache } from '../utils/taskManagerCache';
import type { User as UserType } from '../types';

interface TeamMemberLoginProps {
  onLogin: (user: UserType) => void;
  onBackToAdmin?: () => void;
}

export function TeamMemberLogin({ onLogin, onBackToAdmin }: TeamMemberLoginProps) {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call backend API to authenticate team member
      const response = await teamService.authenticate({ email, passcode });
      
      if (response.success && response.data) {
        clearTaskManagerSessionCache();
        // Store the JWT token, refresh token, and user data in sessionStorage
        if (response.token) {
          sessionStorage.setItem('teamToken', response.token);
        }
        if (response.refresh_token) {
          sessionStorage.setItem('teamRefreshToken', response.refresh_token);
        }
        sessionStorage.setItem('teamUserData', JSON.stringify(response.data));
        onLogin(response.data);
      } else {
        setError('Invalid email or passcode. Please check your credentials.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen  grid grid-cols-1 lg:grid-cols-2 bg-[#FFF6EE] w-[100%]  " >
      {/* Left - Hero image and welcome text */}
      <div
        className="relative hidden lg:block"
        style={{
          backgroundImage:
            "url('/member_login.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-amber-900/40" />
        <div className="relative z-10 h-full w-full flex items-center justify-center ">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-4xl xl:text-5xl font-extrabold drop-shadow-sm">Welcome to Byline</h1>
            <p className="mt-4 text-white/90 text-lg">Access your personalized dashboard and manage your educational journey</p>
          </div>
        </div>
      </div>

      {/* Right - Form card */}
      <div className="flex items-center justify-center p-6 sm:p-10 !bg-[#FFF6EE]">
        <div className="w-full max-w-md bg-[#FFF6EE]">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img src="/logo.png" alt="Logo" className="h-14 w-14" />
          </div>

          <Card className=" border-0 bg-[#FFF6EE]">
            <CardHeader className="text-center pb-4 bg-[#FFF6EE]">
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome back</CardTitle>
              <p className="text-gray-600 mt-2">Sign in to your account to continue</p>
            </CardHeader>

            <CardContent className="space-y-6 bg-[#FFF6EE]">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 rounded-md border border-amber-200 bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
                      placeholder="Email Address"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <a className="text-xs text-amber-600 hover:underline cursor-pointer">Forget Password?</a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPasscode ? 'text' : 'password'}
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-md border border-amber-200 bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <input id="remember" type="checkbox" className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <label htmlFor="remember">Remember me</label>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
                  loading={loading}
                  icon={<LogIn className="w-4 h-4" />}
                >
                  Log In
                </Button>
              </form>

              {onBackToAdmin && (
                <Button
                  variant="outline"
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={onBackToAdmin}
                  icon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Dashboard Selection
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}