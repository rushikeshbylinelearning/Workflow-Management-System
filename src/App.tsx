import React, { useEffect } from 'react';
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ProjectManager } from './components/ProjectManager';
import { TeamManager } from './components/TeamManager';
import { TaskManager } from './components/TaskManager';
import { TeamMemberLogin } from './components/TeamMemberLogin';
import { TeamMemberPortal } from './components/TeamMemberPortal';
import { SSOLogin } from './components/SSOLogin';
import { Loader2 } from 'lucide-react';
import type { User as UserType } from './types';
import tokenService from './services/tokenService';

import { MainApp } from './components/MainApp';
import { ToastProvider } from './components/ui/Toast';
import { clearTaskManagerSessionCache } from './utils/taskManagerCache';

function App() {
  const { user, loading } = useAuth();
  const [teamMemberUser, setTeamMemberUser] = useState<UserType | null>(null);
  const [showTeamPortal, setShowTeamPortal] = useState(false);
  const [teamSessionLoading, setTeamSessionLoading] = useState(true);

  // Check if this is an SSO login redirect
  const urlParams = new URLSearchParams(window.location.search);
  const ssoToken = urlParams.get('token');
  const isSSOLogin = ssoToken !== null;

  // Restore team member session on page load
  useEffect(() => {
    const restoreTeamSession = () => {
      try {
        const teamToken = sessionStorage.getItem('teamToken');
        const teamUserData = sessionStorage.getItem('teamUserData');
        
        if (teamToken && teamUserData) {
          // Check if team token is expired
          if (tokenService.isTeamTokenExpired()) {
            console.log('🚨 Team member token expired, clearing session...');
            sessionStorage.removeItem('teamToken');
            sessionStorage.removeItem('teamUserData');
            sessionStorage.removeItem('teamRefreshToken');
            setTeamMemberUser(null);
            setShowTeamPortal(false);
          } else {
            const parsedUser = JSON.parse(teamUserData);
            setTeamMemberUser(parsedUser);
            setShowTeamPortal(true);
          }
        }
      } catch (error) {
        // Clear invalid data
        sessionStorage.removeItem('teamToken');
        sessionStorage.removeItem('teamUserData');
        sessionStorage.removeItem('teamRefreshToken');
        setTeamMemberUser(null);
        setShowTeamPortal(false);
      } finally {
        setTeamSessionLoading(false);
      }
    };

    restoreTeamSession();
  }, []);

  // Initialize token auto-refresh for admin users
  useEffect(() => {
    if (user) {
      console.log('🔐 Initializing token auto-refresh for admin user...');
      tokenService.initializeAutoRefresh();
      
      return () => {
        console.log('🧹 Cleaning up token service...');
        tokenService.cleanup();
      };
    }
  }, [user]);

  // Initialize token auto-refresh for team members
  useEffect(() => {
    if (teamMemberUser) {
      console.log('🔐 Initializing token auto-refresh for team member...');
      tokenService.initializeTeamAutoRefresh();
      
      // Set up periodic token expiration checking for team members
      const checkTokenExpiration = () => {
        if (tokenService.isTeamTokenExpired()) {
          console.log('🚨 Team member token expired during session, logging out...');
          sessionStorage.removeItem('teamToken');
          sessionStorage.removeItem('teamUserData');
          sessionStorage.removeItem('teamRefreshToken');
          setTeamMemberUser(null);
          setShowTeamPortal(false);
        }
      };
      
      // Check token expiration every 5 minutes
      const expirationCheckInterval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
      
      return () => {
        console.log('🧹 Cleaning up team token service...');
        tokenService.cleanup();
        clearInterval(expirationCheckInterval);
      };
    }
  }, [teamMemberUser]);

  // Handle SSO login redirect
  if (isSSOLogin) {
    return <SSOLogin />;
  }

  if (loading || teamSessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Team Member Portal Flow
  if (showTeamPortal) {
    if (!teamMemberUser) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
          <TeamMemberLogin 
            onLogin={(user) => setTeamMemberUser(user)}
            onBackToAdmin={() => setShowTeamPortal(false)}
          />
        </div>
      );
    }
    
    return (
      <ToastProvider>
        <TeamMemberPortal 
          user={teamMemberUser} 
          onLogout={() => {
            clearTaskManagerSessionCache();
            setTeamMemberUser(null);
            setShowTeamPortal(false);
          }} 
        />
      </ToastProvider>
    );
  }

  // Admin/Manager Login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Auth onSwitchToTeam={() => setShowTeamPortal(true)} />
      </div>
    );
  }

  return (
    <MainApp />
  );
}

export default App;