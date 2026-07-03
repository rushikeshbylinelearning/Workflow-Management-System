import React, { useState, useEffect } from 'react';
import { Bell, User, LogOut, Settings, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/Button';
import { notificationService } from '../services/apiService';
import notificationServiceRealTime from '../services/notificationService';
import type { RealTimeNotification } from '../services/notificationService';
import { requestTasksListRefresh } from '../utils/taskManagerCache';

export function Header() {
  const { user, signOut } = useAuth();
  const { state, dispatch } = useApp();
  const [notificationCount, setNotificationCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<RealTimeNotification[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadNotificationCount();
      
      // Connect to real-time notification service
      const token = sessionStorage.getItem('access_token');
      if (token) {
        notificationServiceRealTime.connect(token, 'admin');
        
        // Listen for connection status changes
        const unsubscribeConnection = notificationServiceRealTime.onConnectionChange((connected) => {
          setIsConnected(connected);
        });
        
        // Listen for real-time notifications
        const unsubscribeNotifications = notificationServiceRealTime.onNotification((notification) => {
          setRecentNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep last 5
          setNotificationCount(prev => prev + 1);
          if (notification.type === 'task_under_review') {
            requestTasksListRefresh();
          }
        });
        
        // Join project rooms for real-time updates
        // Join a general admin room and also listen for all notifications
        notificationServiceRealTime.joinProject('admin-general');
        
        // Also join specific project rooms if available
        // This will be updated when admin navigates to specific projects
        
        return () => {
          unsubscribeConnection();
          unsubscribeNotifications();
          notificationServiceRealTime.disconnect();
        };
      }
      
      // Refresh notification count every 5 minutes
      const interval = setInterval(loadNotificationCount, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotificationCount = async () => {
    try {
      const response = await notificationService.getAll();
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      const extensions = response?.data?.extensions || [];
      const remarks = response?.data?.remarks || [];
      const completedTasks = response?.data?.completedTasks || [];

      const recentExtensions = extensions.filter((e: any) => new Date(e.created_at) >= cutoff);
      const recentRemarks = remarks.filter((r: any) => new Date(r.created_at) >= cutoff);
      const recentCompletedTasks = completedTasks.filter((t: any) => new Date(t.completed_at) >= cutoff);

      const totalCount = recentExtensions.length + recentRemarks.length + recentCompletedTasks.length;
      setNotificationCount(totalCount);
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const handleNotificationClick = () => {
    // Always clear any selected task when navigating to notifications
    dispatch({ type: 'SET_SELECTED_TASK', payload: null });
    dispatch({ type: 'SET_SELECTED_VIEW', payload: 'notifications' });
    setShowDropdown(false);
  };

  // Function to join specific project room for real-time updates
  const joinProjectRoom = (projectId: string) => {
    if (isConnected) {
      notificationServiceRealTime.joinProject(projectId);
    }
  };

  // Expose the function globally so other components can use it
  useEffect(() => {
    (window as any).joinProjectRoom = joinProjectRoom;
    return () => {
      delete (window as any).joinProjectRoom;
    };
  }, [isConnected]);

  const handleSignOut = () => {
    signOut();
    setShowDropdown(false);
  };

  const handleBack = () => {
    // Clear any selected task
    dispatch({ type: 'SET_SELECTED_TASK', payload: null });
    
    // Navigate to previous view (which is now automatically tracked)
    dispatch({ type: 'SET_SELECTED_VIEW', payload: state.previousView });
  };

  // Show back button when not on dashboard and not viewing a specific task
  const showBackButton = state.selectedView !== 'dashboard' && !state.selectedTaskId;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
          )}
          <h2 className="text-xl font-semibold text-gray-900">Byline Workflow</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2 text-sm">
            {isConnected ? (
              <div className="flex items-center bg-green-500 p-1 rounded-xl text-sm">
                
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600">
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </div>
            )}
          </div>

          {/* Notification Permission Status */}
          {typeof window !== 'undefined' && 'Notification' in window && (
            <div className="flex items-center space-x-2">
              {Notification.permission === 'default' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    Notification.requestPermission().then((permission) => {
                      if (permission === 'granted') {
                        // Force a notification test
                        new Notification('Test Notification', {
                          body: 'Notifications are now enabled!',
                          icon: '/logo.png'
                        });
                      }
                    });
                  }}
                  className="text-xs px-2 py-1 bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                >
                  🔔 Enable Notifications
                </Button>
              )}
              
              {Notification.permission === 'denied' && (
                <div className="flex items-center space-x-1 text-red-600 text-xs">
                  <span>🔔</span>
                  <span>Notifications Disabled</span>
                </div>
              )}
              
            </div>
          )}

          {/* Notification Bell */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNotificationClick}
            className="relative p-2"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </Button>

          {/* User Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>{user?.name || 'User'}</span>
            </Button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <button
                  onClick={() => {
                    // Always clear any selected task when navigating to settings
                    dispatch({ type: 'SET_SELECTED_TASK', payload: null });
                    dispatch({ type: 'SET_SELECTED_VIEW', payload: 'settings' });
                    setShowDropdown(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}