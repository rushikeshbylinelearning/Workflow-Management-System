import React, { memo, useState } from 'react';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Users, 
  CheckSquare, 
  BarChart3,
  Calendar,
  Settings,
  TrendingUp,
  Bell,
  Trophy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { name: 'Projects', icon: FolderOpen, key: 'projects' },
  { name: 'Teams', icon: Users, key: 'teams' },
  { name: 'Tasks', icon: CheckSquare, key: 'tasks' },
  { name: 'Allocations', icon: Calendar, key: 'allocations' },
  { name: 'Top Performers', icon: Trophy, key: 'top-performers' },
  { name: 'Analytics', icon: BarChart3, key: 'analytics' },
  { name: 'Core Analytics', icon: TrendingUp, key: 'core-analytics' },
  { name: 'Manage Extensions', icon: Bell, key: 'notifications' },
  { name: 'Settings', icon: Settings, key: 'settings' },
];

export const Sidebar = memo(function Sidebar() {
  const { state, dispatch } = useApp();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('sidebar_state');
    return saved === 'expanded' ? false : true; // default collapsed
  });

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    sessionStorage.setItem('sidebar_state', next ? 'collapsed' : 'expanded');
  };

  return (
    <div
      className="bg-white shadow-sm border-r border-gray-200 flex flex-col flex-shrink-0"
      style={{
        width: collapsed ? '68px' : '240px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className={`p-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`} style={{ minHeight: '64px' }}>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">Byline Workflow</h1>
            <p className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">Project Management</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
        {navigation.map((item) => {
          const isActive = state.selectedView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                dispatch({ type: 'SET_SELECTED_TASK', payload: null });
                dispatch({ type: 'SET_SELECTED_VIEW', payload: item.key as any });
              }}
              title={collapsed ? item.name : undefined}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`h-5 w-5 flex-shrink-0 ${collapsed ? '' : 'mr-3'} ${isActive ? 'text-blue-700' : 'text-gray-400'}`}
              />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});