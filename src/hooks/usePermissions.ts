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
  write_access: boolean;
  all_teams_access: boolean;
  [key: string]: boolean;
}

export interface TeamMemberAccessInfo {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'project_manager';
  access_level?: 'read' | 'write';
  write_access?: boolean;
  all_teams_access?: boolean;
  access_team_ids?: number[];
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
  write_access: false,
  all_teams_access: false,
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
  write_access: true,
  all_teams_access: true,
};

function getFallbackAccessInfo(): TeamMemberAccessInfo | null {
  try {
    const teamUserData = sessionStorage.getItem('teamUserData');
    if (!teamUserData) return null;
    const user = JSON.parse(teamUserData);
    const role: 'employee' | 'project_manager' =
      user.role === 'project_manager' ? 'project_manager' : 'employee';
    const permissions = role === 'project_manager' ? DEFAULT_PM_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      access_level: permissions.write_access ? 'write' : 'read',
      write_access: permissions.write_access,
      all_teams_access: permissions.all_teams_access,
      access_team_ids: [],
      permissions,
    };
  } catch {
    return null;
  }
}

function normalizeAccessInfo(data: TeamMemberAccessInfo): TeamMemberAccessInfo {
  const permissions = {
    ...(data.role === 'project_manager' ? DEFAULT_PM_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS),
    ...(data.permissions || {}),
  };
  const writeAccess = data.write_access === true || permissions.write_access === true;
  const allTeamsAccess = data.all_teams_access === true || permissions.all_teams_access === true;
  return {
    ...data,
    permissions,
    write_access: writeAccess,
    all_teams_access: allTeamsAccess,
    access_level: writeAccess ? 'write' : 'read',
    access_team_ids: Array.isArray(data.access_team_ids) ? data.access_team_ids : [],
  };
}

export function usePermissions() {
  const [accessInfo, setAccessInfo] = useState<TeamMemberAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);

    const teamToken = sessionStorage.getItem('teamToken');
    if (!teamToken) {
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
          setAccessInfo(normalizeAccessInfo(result.data));
          setLoading(false);
          return;
        }
      }

      const fallback = getFallbackAccessInfo();
      setAccessInfo(fallback);
    } catch {
      const fallback = getFallbackAccessInfo();
      setAccessInfo(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

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
  const writeAccess = accessInfo?.write_access === true;
  const canViewOrgTasks =
    accessInfo?.all_teams_access === true || (accessInfo?.access_team_ids?.length ?? 0) > 0;
  const canManageTasks = writeAccess && canViewOrgTasks;

  return {
    accessInfo,
    loading,
    can,
    isProjectManager,
    writeAccess,
    canViewOrgTasks,
    canManageTasks,
    refetch: fetchPermissions,
  };
}

export { DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_PM_PERMISSIONS };
