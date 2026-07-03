import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Users,
  Briefcase,
  User,
  Check,
  X,
  RefreshCw,
  Info,
  Lock,
  Unlock,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

interface Permission {
  key: string;
  label: string;
  description: string;
  category: string;
}

interface MemberWithPermissions {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'project_manager';
  is_active: boolean;
  skills: string[];
  permissions: Record<string, boolean>;
}

function getAuthHeaders() {
  const token = sessionStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Role badge ────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: 'employee' | 'project_manager' }) {
  if (role === 'project_manager') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
        <Briefcase className="w-3 h-3" />
        Project Manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      <User className="w-3 h-3" />
      Employee
    </span>
  );
}

// ─── Permission toggle ──────────────────────────────────────────────────────
function PermissionToggle({
  granted,
  onChange,
  disabled,
}: {
  granted: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!granted)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        granted ? 'bg-blue-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          granted ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Member row ─────────────────────────────────────────────────────────────
function MemberPermissionRow({
  member,
  permissionDefs,
  onRoleChange,
  onPermissionChange,
}: {
  member: MemberWithPermissions;
  permissionDefs: Permission[];
  onRoleChange: (memberId: number, role: 'employee' | 'project_manager') => void;
  onPermissionChange: (memberId: number, key: string, value: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const grantedCount = Object.values(member.permissions).filter(Boolean).length;
  const totalCount = permissionDefs.length;

  // Group permissions by category
  const grouped: Record<string, Permission[]> = {};
  permissionDefs.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{member.name}</p>
            <p className="text-xs text-gray-500">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Role selector */}
          <div onClick={e => e.stopPropagation()}>
            <select
              value={member.role}
              onChange={e =>
                onRoleChange(member.id, e.target.value as 'employee' | 'project_manager')
              }
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="employee">Employee</option>
              <option value="project_manager">Project Manager</option>
            </select>
          </div>

          {/* Permission count pill */}
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
            {grantedCount}/{totalCount} access
          </span>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded permissions panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
            <Info className="w-3.5 h-3.5" />
            <span>
              Changing the role above resets all toggles to role defaults. You can then fine-tune
              individual permissions below.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(grouped).map(([category, perms]) => (
              <div key={category} className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {category}
                </p>
                <div className="space-y-2">
                  {perms.map(perm => {
                    const granted = member.permissions[perm.key] ?? false;
                    return (
                      <div key={perm.key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{perm.label}</p>
                          <p className="text-xs text-gray-400 truncate">{perm.description}</p>
                        </div>
                        <PermissionToggle
                          granted={granted}
                          onChange={v => onPermissionChange(member.id, perm.key, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export function AccessManagement() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<MemberWithPermissions[]>([]);
  const [permissionDefs, setPermissionDefs] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'project_manager'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/access/permissions-definitions`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/access/members`, { headers: getAuthHeaders() }),
      ]);

      if (defsRes.ok) {
        const d = await defsRes.json();
        setPermissionDefs(d.data || []);
      }
      if (membersRes.ok) {
        const m = await membersRes.json();
        setMembers(m.data || []);
      }
    } catch (err) {
      showToast('Failed to load access management data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle role change – resets permissions to role defaults on backend
  const handleRoleChange = async (memberId: number, role: 'employee' | 'project_manager') => {
    setSaving(memberId);
    try {
      const res = await fetch(`${API_URL}/access/members/${memberId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      const result = await res.json();
      if (result.success) {
        setMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { ...m, role, permissions: result.data.permissions }
              : m
          )
        );
        showToast(
          `Role updated to ${role === 'project_manager' ? 'Project Manager' : 'Employee'} and permissions reset`,
          'success'
        );
      } else {
        showToast(result.message || 'Failed to update role', 'error');
      }
    } catch {
      showToast('Network error — could not update role', 'error');
    } finally {
      setSaving(null);
    }
  };

  // Handle individual permission toggle
  const handlePermissionChange = async (memberId: number, key: string, value: boolean) => {
    // Optimistic UI update
    setMembers(prev =>
      prev.map(m =>
        m.id === memberId
          ? { ...m, permissions: { ...m.permissions, [key]: value } }
          : m
      )
    );

    setSaving(memberId);
    try {
      const res = await fetch(`${API_URL}/access/members/${memberId}/permissions`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ permissions: { [key]: value } }),
      });
      const result = await res.json();
      if (!result.success) {
        // Revert on failure
        setMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { ...m, permissions: { ...m.permissions, [key]: !value } }
              : m
          )
        );
        showToast(result.message || 'Failed to update permission', 'error');
      }
    } catch {
      // Revert on failure
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { ...m, permissions: { ...m.permissions, [key]: !value } }
            : m
        )
      );
      showToast('Network error — permission not saved', 'error');
    } finally {
      setSaving(null);
    }
  };

  // Filtered list
  const filtered = members.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const pmCount = members.filter(m => m.role === 'project_manager').length;
  const empCount = members.filter(m => m.role === 'employee').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Access Management</h1>
            <p className="text-white/80">Manage roles and permissions for team members</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{members.length}</p>
                <p className="text-xs text-gray-500">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pmCount}</p>
                <p className="text-xs text-gray-500">Project Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{empCount}</p>
                <p className="text-xs text-gray-500">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-600" />
            <h4 className="font-semibold text-gray-800 text-sm">Employee</h4>
          </div>
          <p className="text-xs text-gray-500">
            Default role. Gets access to Dashboard, My Tasks, and Notifications only. Admin can
            grant additional sections individually.
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-purple-700" />
            <h4 className="font-semibold text-purple-800 text-sm">Project Manager</h4>
          </div>
          <p className="text-xs text-purple-700">
            Elevated role. Gets access to Projects, Teams, Tasks, Analytics, Allocations, and Top
            Performers. Admin can restrict individual sections.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search members…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="employee">Employee</option>
            <option value="project_manager">Project Manager</option>
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      {/* Member list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading access management data…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No members found</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery ? 'Try a different search term.' : 'No active team members.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(member => (
            <div key={member.id} className="relative">
              {saving === member.id && (
                <div className="absolute top-3 right-14 z-10">
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Saving…
                  </span>
                </div>
              )}
              <MemberPermissionRow
                member={member}
                permissionDefs={permissionDefs}
                onRoleChange={handleRoleChange}
                onPermissionChange={handlePermissionChange}
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Changes take effect the next time the team member refreshes their portal session.
      </p>
    </div>
  );
}
