import React, { useState } from 'react';
import { LogIn, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ArrowUp } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';

interface AuthProps {
  onSwitchToTeam?: () => void;
}

export function Auth({ onSwitchToTeam }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        setError(error.message);
        return;
      }
      if (data?.user) {
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen  grid grid-cols-1 lg:grid-cols-2 bg-[#FFF6EE] w-[100%]">
      {/* Left - Hero image and welcome text */}
      <div
        className="relative hidden lg:block"
        style={{
          backgroundImage:
            "url('/admin_login.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-amber-900/40" />
        <div className="relative z-10 h-full w-full flex items-center justify-center">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-4xl xl:text-5xl font-extrabold drop-shadow-sm">Welcome to Byline</h1>
            <p className="mt-4 text-white/90 text-lg">Manage projects, teams, and tasks efficiently</p>
          </div>
        </div>
      </div>

      {/* Right - Form card */}
      <div className="flex items-center justify-center p-6 sm:p-10 !bg-[#FFF6EE]">
        <div className="w-full max-w-md bg-[#FFF6EE] border-2 border-red-100 py-8 rounded-lg shadow-sm">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <img src="/logo.png" alt="Logo" className="h-24 w-auto" />
          </div>

          <Card className="border-0 bg-[#FFF6EE]">
            <CardHeader className="text-center pb-4 bg-[#FFF6EE]">
              <CardTitle className="text-3xl font-bold text-gray-900">Welcome back Admin!</CardTitle>
              <p className="text-gray-600 mt-2">Sign in to your account to continue</p>
            </CardHeader>

            <CardContent className="space-y-6 bg-[#FFF6EE]">
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 rounded-md border border-amber-200 bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
                      placeholder="Password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
                  loading={loading}
                  icon={loading ? <Loader2 className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                >
                  Log In
                </Button>
              </form>

              
              <Button
                variant="outline"
                className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={onSwitchToTeam}  
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Sign in as Team Member
              </Button>
              
            </CardContent>
            <span className="text-gray-600 text-sm text-center flex items-center justify-center gap-1">Team Member? Click Here <ArrowUp className="w-4 h-4" /></span>

          </Card>
        </div>
      </div>
    </div>
  );
}