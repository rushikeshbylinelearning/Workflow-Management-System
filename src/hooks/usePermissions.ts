import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

export interface TeamMemberPermissions {
  view_dashboard: boolean;
  view_projects: boolean;
  view_tasks: boolean;
  view_team: boolean;
  view_analytics: boolean;
  view_allocations: boolean;
  view_top_performers: boolean;
  view_notifications: boolean;
  [key: string]: boolean;
}

export interface TeamMemberAccessInfo {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'project_manager';
  permissions: TeamMemberPermissions;
}

const DEFAULT_EMPLOYEE_PERMISSIONS: TeamMemberPermissions = {
  view_dashboard: false,
  view_tasks: true,
  view_notifications: true,
  view_projects: false,
  view_team: false,
  view_analytics: false,
  view_allocations: false,
  view_top_performers: false,
};

const DEFAULT_PM_PERMISSIONS: TeamMemberPermissions = {
  view_dashboard: true,
  view_tasks: true,
  view_notifications: true,
  view_projects: true,
  view_team: true,
  view_analytics: true,
  view_allocations: true,
  view_top_performers: true,
};

// Fallback: derive permissions from role stored in sessionStorage
function getFallbackAccessInfo(): TeamMemberAccessInfo | null {
  try {
    const teamUserData = sessionStorage.getItem('teamUserData');
    if (!teamUserData) return null;
    const user = JSON.parse(teamUserData);
    const role: 'employee' | 'project_manager' =
      user.role === 'project_manager' ? 'project_manager' : 'employee';
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      permissions: role === 'project_manager' ? DEFAULT_PM_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS,
    };
  } catch {
    return null;
  }
}

export function usePermissions() {
  const [accessInfo, setAccessInfo] = useState<TeamMemberAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);

    const teamToken = sessionStorage.getItem('teamToken');
    if (!teamToken) {
      // Not a team member — no permissions needed
      setAccessInfo(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/access/my-permissions`, {
        headers: {
          Authorization: `Bearer ${teamToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAccessInfo(result.data);
          setLoading(false);
          return;
        }
      }

      // API failed (e.g., migration not yet run) → use fallback from sessionStorage
      const fallback = getFallbackAccessInfo();
      setAccessInfo(fallback);
    } catch {
      // Network error → use fallback
      const fallback = getFallbackAccessInfo();
      setAccessInfo(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch fresh on mount — never use stale module-level cache
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback(
    (permission: keyof TeamMemberPermissions): boolean => {
      if (!accessInfo) return false;
      return accessInfo.permissions[permission] === true;
    },
    [accessInfo]
  );

  const isProjectManager = accessInfo?.role === 'project_manager';

  return {
    accessInfo,
    loading,
    can,
    isProjectManager,
    /** Call this to re-fetch permissions from the server (e.g., after admin changes them) */
    refetch: fetchPermissions,
  };
}

export { DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_PM_PERMISSIONS };
