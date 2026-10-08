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
  Plus,
  Trash2,
  MessageSquare,
  Type,
  Eye,
  Pencil,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { remarkOptionsService, remarkFieldsService, type RemarkOption, type RemarkInputField } from '../services/apiService';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

interface Permission {
  key: string;
  label: string;
  description: string;
  category: string;
}

const STATUS_EFFECT_LABELS: Record<RemarkOption['status_effect'], string> = {
  none: 'No status change',
  'in-progress': 'Mark In Progress',
  'under-review': 'Submit for review',
  skipped: 'Mark Skipped',
};

interface MemberWithPermissions {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'project_manager';
  is_active: boolean;
  skills: string[];
  permissions: Record<string, boolean>;
  access_level?: 'read' | 'write';
  all_teams_access?: boolean;
  access_team_ids?: number[];
  remark_option_ids?: number[];
  uses_default_remark_options?: boolean;
  remark_field_ids?: number[];
}

interface AccessTeam {
  id: number;
  name: string;
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
  teams,
  remarkOptions,
  remarkFields,
  onRoleChange,
  onPermissionChange,
  onAccessTeamsChange,
  onToggleRemarkOption,
  onResetRemarkOptions,
  onToggleRemarkField,
}: {
  member: MemberWithPermissions;
  permissionDefs: Permission[];
  teams: AccessTeam[];
  remarkOptions: RemarkOption[];
  remarkFields: RemarkInputField[];
  onRoleChange: (memberId: number, role: 'employee' | 'project_manager') => void;
  onPermissionChange: (memberId: number, key: string, value: boolean) => void;
  onAccessTeamsChange: (memberId: number, allTeams: boolean, teamIds: number[]) => void;
  onToggleRemarkOption: (memberId: number, optionId: number, enabled: boolean) => void;
  onResetRemarkOptions: (memberId: number) => void;
  onToggleRemarkField: (memberId: number, fieldId: number, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const featureDefs = permissionDefs.filter(
    (perm) => perm.key !== 'write_access' && perm.key !== 'all_teams_access'
  );
  const grantedCount = featureDefs.filter((perm) => member.permissions[perm.key]).length;
  const totalCount = featureDefs.length;
  const writeAccess = member.permissions.write_access === true || member.access_level === 'write';
  const allTeamsAccess = member.permissions.all_teams_access === true || member.all_teams_access === true;
  const selectedTeamIds = member.access_team_ids || [];

  const grouped: Record<string, Permission[]> = {};
  featureDefs.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  const systemIds = remarkOptions.filter(option => option.is_system).map(option => Number(option.id));
  const enabledIds = new Set(
    member.uses_default_remark_options || !member.remark_option_ids?.length
      ? systemIds
      : member.remark_option_ids
  );

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

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            writeAccess ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {writeAccess ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {writeAccess ? 'Read & write' : 'Read only'}
          </span>

          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
            {allTeamsAccess
              ? 'All teams'
              : selectedTeamIds.length > 0
                ? `${selectedTeamIds.length} team${selectedTeamIds.length === 1 ? '' : 's'}`
                : 'Own tasks'}
          </span>

          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
            {grantedCount}/{totalCount} features
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
              Changing the role above resets feature toggles to role defaults. Choose read/write
              and team scope below so All Tasks, updates, and reports match what this person should see.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Access level</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => onPermissionChange(member.id, 'write_access', false)}
                  className={`flex-1 text-left text-xs rounded-lg border px-3 py-2 ${
                    !writeAccess ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="font-semibold block">Read only</span>
                  View tasks, updates, and reports. Cannot create, edit, or delete.
                </button>
                <button
                  type="button"
                  onClick={() => onPermissionChange(member.id, 'write_access', true)}
                  className={`flex-1 text-left text-xs rounded-lg border px-3 py-2 ${
                    writeAccess ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="font-semibold block">Full read & write</span>
                  Create, edit, assign, and update tasks in the granted team scope.
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Team access
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={allTeamsAccess}
                  onChange={(e) => onAccessTeamsChange(member.id, e.target.checked, selectedTeamIds)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                All teams (same task list as admin)
              </label>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto ${allTeamsAccess ? 'opacity-50 pointer-events-none' : ''}`}>
                {teams.length === 0 ? (
                  <p className="text-xs text-gray-400">No teams found.</p>
                ) : (
                  teams.map((team) => {
                    const checked = selectedTeamIds.includes(Number(team.id));
                    return (
                      <label key={team.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...new Set([...selectedTeamIds, Number(team.id)])]
                              : selectedTeamIds.filter((id) => id !== Number(team.id));
                            onAccessTeamsChange(member.id, false, next);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{team.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {!allTeamsAccess && selectedTeamIds.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-2">
                  No teams selected — All Tasks will only show this user&apos;s own assignments.
                </p>
              )}
            </div>
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

          <div className="mt-4 bg-white rounded-lg border border-purple-200 p-3">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Remark / Stage options
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Control which Stage choices this assignee sees in Add Remark and Bulk Add Remark.
                  Extra options also appear in Teams updates.
                </p>
              </div>
              {!member.uses_default_remark_options && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetRemarkOptions(member.id);
                  }}
                >
                  Restore defaults
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {remarkOptions.map((option) => {
                const optionId = Number(option.id);
                const enabled = enabledIds.has(optionId);
                return (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRemarkOption(member.id, optionId, !enabled);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      enabled
                        ? 'bg-purple-50 border-purple-300 text-purple-800'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                    title={STATUS_EFFECT_LABELS[option.status_effect]}
                  >
                    {enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {option.label}
                    {!option.is_system && (
                      <span className="text-[10px] uppercase tracking-wide text-purple-500">extra</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {remarkFields.length > 0 && (
            <div className="mt-4 bg-white rounded-lg border border-indigo-200 p-3">
              <div className="mb-3">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                  <Type className="w-3.5 h-3.5" />
                  Extra remark input fields
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Extra text fields this assignee sees in Add Remark and Bulk Add Remark, in addition to File Location, File Name, and Remark. Values also appear in Teams updates.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {remarkFields.map((field) => {
                  const fieldId = Number(field.id);
                  const enabled = (member.remark_field_ids || []).includes(fieldId);
                  return (
                    <button
                      key={field.slug}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRemarkField(member.id, fieldId, !enabled);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        enabled
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      {enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {field.label}
                      {field.is_required && (
                        <span className="text-[10px] uppercase tracking-wide text-indigo-500">required</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
  const [teams, setTeams] = useState<AccessTeam[]>([]);
  const [remarkOptions, setRemarkOptions] = useState<RemarkOption[]>([]);
  const [remarkFields, setRemarkFields] = useState<RemarkInputField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'project_manager'>('all');
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionEffect, setNewOptionEffect] = useState<RemarkOption['status_effect']>('none');
  const [savingOption, setSavingOption] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [savingField, setSavingField] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes, membersRes, teamsRes, optionsRes, fieldsRes] = await Promise.all([
        fetch(`${API_URL}/access/permissions-definitions`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/access/members`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/access/teams`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/remark-options/all`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/remark-options/fields/all`, { headers: getAuthHeaders() }),
      ]);

      if (defsRes.ok) {
        const d = await defsRes.json();
        setPermissionDefs(d.data || []);
      }
      if (membersRes.ok) {
        const m = await membersRes.json();
        setMembers(m.data || []);
      }
      if (teamsRes.ok) {
        const t = await teamsRes.json();
        setTeams(t.data || []);
      }
      if (optionsRes.ok) {
        const o = await optionsRes.json();
        setRemarkOptions(o.data || []);
      }
      if (fieldsRes.ok) {
        const f = await fieldsRes.json();
        setRemarkFields(f.data || []);
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

  const handleAccessTeamsChange = async (memberId: number, allTeams: boolean, teamIds: number[]) => {
    // Optimistic UI update
    const previousState = members.find(m => m.id === memberId);
    if (!previousState) return;

    setMembers(prev =>
      prev.map(m =>
        m.id === memberId
          ? { 
              ...m, 
              all_teams_access: allTeams,
              permissions: { ...m.permissions, all_teams_access: allTeams },
              access_team_ids: allTeams ? [] : teamIds 
            }
          : m
      )
    );

    setSaving(memberId);
    try {
      const res = await fetch(`${API_URL}/access/members/${memberId}/permissions`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          permissions: { all_teams_access: allTeams },
          access_team_ids: allTeams ? [] : teamIds 
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Update with server response
        setMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { 
                  ...m, 
                  all_teams_access: result.data.all_teams_access,
                  permissions: { ...m.permissions, all_teams_access: result.data.all_teams_access },
                  access_team_ids: result.data.access_team_ids || []
                }
              : m
          )
        );
      } else {
        // Revert on failure
        setMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { 
                  ...m, 
                  all_teams_access: previousState.all_teams_access,
                  permissions: previousState.permissions,
                  access_team_ids: previousState.access_team_ids
                }
              : m
          )
        );
        showToast(result.message || 'Failed to update team access', 'error');
      }
    } catch {
      // Revert on failure
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { 
                ...m, 
                all_teams_access: previousState.all_teams_access,
                permissions: previousState.permissions,
                access_team_ids: previousState.access_team_ids
              }
            : m
        )
      );
      showToast('Network error — team access not saved', 'error');
    } finally {
      setSaving(null);
    }
  };

  const currentEnabledIds = (member: MemberWithPermissions): number[] => {
    const systemIds = remarkOptions.filter(option => option.is_system).map(option => Number(option.id));
    if (member.uses_default_remark_options || !member.remark_option_ids?.length) {
      return systemIds;
    }
    return member.remark_option_ids;
  };

  const handleToggleRemarkOption = async (memberId: number, optionId: number, enabled: boolean) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const current = currentEnabledIds(member);
    const next = enabled
      ? [...new Set([...current, optionId])]
      : current.filter(id => id !== optionId);
    if (next.length === 0) {
      showToast('Keep at least one remark option for this assignee', 'error');
      return;
    }
    const previous = {
      remark_option_ids: member.remark_option_ids,
      uses_default_remark_options: member.uses_default_remark_options,
    };
    setMembers(prev => prev.map(m => (
      m.id === memberId
        ? { ...m, remark_option_ids: next, uses_default_remark_options: false }
        : m
    )));
    setSaving(memberId);
    try {
      const result = await remarkOptionsService.updateMemberOptions(memberId, next);
      setMembers(prev => prev.map(m => (
        m.id === memberId
          ? { ...m, remark_option_ids: result.assignedIds, uses_default_remark_options: result.usesDefault }
          : m
      )));
    } catch (err: any) {
      setMembers(prev => prev.map(m => (
        m.id === memberId ? { ...m, ...previous } : m
      )));
      showToast(err?.message || 'Failed to update remark options', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleResetRemarkOptions = async (memberId: number) => {
    setSaving(memberId);
    try {
      const result = await remarkOptionsService.updateMemberOptions(memberId, [], true);
      setMembers(prev => prev.map(m => (
        m.id === memberId
          ? { ...m, remark_option_ids: result.assignedIds, uses_default_remark_options: result.usesDefault }
          : m
      )));
      showToast('Restored default remark options', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to restore defaults', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleAddRemarkOption = async () => {
    const label = newOptionLabel.trim();
    if (!label) {
      showToast('Enter an option name', 'error');
      return;
    }
    setSavingOption(true);
    try {
      const created = await remarkOptionsService.create({
        label,
        status_effect: newOptionEffect,
      });
      setRemarkOptions(prev => [...prev, created]);
      setNewOptionLabel('');
      setNewOptionEffect('none');
      showToast(`Added "${created.label}". Enable it on specific assignees below.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to add remark option', 'error');
    } finally {
      setSavingOption(false);
    }
  };

  const handleDeleteRemarkOption = async (option: RemarkOption) => {
    if (!option.id || option.is_system) return;
    if (!window.confirm(`Remove "${option.label}" from all assignees?`)) return;
    try {
      await remarkOptionsService.remove(option.id);
      setRemarkOptions(prev => prev.filter(item => item.id !== option.id));
      setMembers(prev => prev.map(m => ({
        ...m,
        remark_option_ids: (m.remark_option_ids || []).filter(id => id !== option.id),
      })));
      showToast(`Removed "${option.label}"`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove remark option', 'error');
    }
  };

  const handleToggleRemarkField = async (memberId: number, fieldId: number, enabled: boolean) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const current = member.remark_field_ids || [];
    const next = enabled
      ? [...new Set([...current, fieldId])]
      : current.filter(id => id !== fieldId);
    const previous = member.remark_field_ids;
    setMembers(prev => prev.map(m => (
      m.id === memberId ? { ...m, remark_field_ids: next } : m
    )));
    setSaving(memberId);
    try {
      const result = await remarkFieldsService.updateMemberFields(memberId, next);
      setMembers(prev => prev.map(m => (
        m.id === memberId ? { ...m, remark_field_ids: result.assignedIds } : m
      )));
    } catch (err: any) {
      setMembers(prev => prev.map(m => (
        m.id === memberId ? { ...m, remark_field_ids: previous } : m
      )));
      showToast(err?.message || 'Failed to update extra remark fields', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleAddRemarkField = async () => {
    const label = newFieldLabel.trim();
    if (!label) {
      showToast('Enter a field name', 'error');
      return;
    }
    setSavingField(true);
    try {
      const created = await remarkFieldsService.create({
        label,
        is_required: newFieldRequired,
      });
      setRemarkFields(prev => [...prev, created]);
      setNewFieldLabel('');
      setNewFieldRequired(false);
      showToast(`Added "${created.label}". Enable it on specific assignees below.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to add extra remark field', 'error');
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteRemarkField = async (field: RemarkInputField) => {
    if (!field.id) return;
    if (!window.confirm(`Remove "${field.label}" from all assignees?`)) return;
    try {
      await remarkFieldsService.remove(field.id);
      setRemarkFields(prev => prev.filter(item => item.id !== field.id));
      setMembers(prev => prev.map(m => ({
        ...m,
        remark_field_ids: (m.remark_field_ids || []).filter(id => id !== field.id),
      })));
      showToast(`Removed "${field.label}"`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove extra remark field', 'error');
    }
  };

  const handleToggleFieldRequired = async (field: RemarkInputField) => {
    if (!field.id) return;
    try {
      const updated = await remarkFieldsService.update(field.id, {
        is_required: !field.is_required,
      });
      setRemarkFields(prev => prev.map(item => item.id === field.id ? updated : item));
    } catch (err: any) {
      showToast(err?.message || 'Failed to update field', 'error');
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
            <p className="text-white/80">Manage roles, permissions, remark options, and extra remark fields for team members</p>
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

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              Remark / Stage options
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              These choices appear in Add Remark, Bulk Add Remark, and Teams updates.
              Built-in options stay available unless you remove them for a specific assignee below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {remarkOptions.map((option) => (
              <div
                key={option.slug}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                  option.is_system
                    ? 'bg-gray-50 border-gray-200 text-gray-700'
                    : 'bg-purple-50 border-purple-200 text-purple-800'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-gray-400">{STATUS_EFFECT_LABELS[option.status_effect]}</span>
                {!option.is_system && option.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRemarkOption(option)}
                    className="text-purple-500 hover:text-red-600"
                    title="Remove extra option"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              placeholder="Add extra option, e.g. Sent to Client"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <select
              value={newOptionEffect}
              onChange={(e) => setNewOptionEffect(e.target.value as RemarkOption['status_effect'])}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="none">No status change</option>
              <option value="in-progress">Mark In Progress</option>
              <option value="under-review">Submit for review</option>
              <option value="skipped">Mark Skipped</option>
            </select>
            <Button
              type="button"
              onClick={handleAddRemarkOption}
              loading={savingOption}
              disabled={!newOptionLabel.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add option
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-600" />
              Extra remark input fields
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Add extra text fields such as Ticket Number or Client Name. Enable them on specific employees below so they appear in Add Remark, Bulk Add Remark, and Teams updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {remarkFields.length === 0 && (
              <p className="text-xs text-gray-400">No extra fields yet. Add one below, then enable it for the assignee who needs it.</p>
            )}
            {remarkFields.map((field) => (
              <div
                key={field.slug}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs bg-indigo-50 border-indigo-200 text-indigo-800"
              >
                <span className="font-medium">{field.label}</span>
                <button
                  type="button"
                  onClick={() => handleToggleFieldRequired(field)}
                  className={`text-[10px] uppercase tracking-wide ${field.is_required ? 'text-red-600' : 'text-gray-400'}`}
                  title={field.is_required ? 'Required for assigned employees' : 'Optional — click to require'}
                >
                  {field.is_required ? 'required' : 'optional'}
                </button>
                {field.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRemarkField(field)}
                    className="text-indigo-500 hover:text-red-600"
                    title="Remove extra field"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="Add extra field, e.g. Ticket Number"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 px-2">
              <input
                type="checkbox"
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Required
            </label>
            <Button
              type="button"
              onClick={handleAddRemarkField}
              loading={savingField}
              disabled={!newFieldLabel.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add field
            </Button>
          </div>
        </CardContent>
      </Card>

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
                teams={teams}
                remarkOptions={remarkOptions}
                remarkFields={remarkFields}
                onRoleChange={handleRoleChange}
                onPermissionChange={handlePermissionChange}
                onAccessTeamsChange={handleAccessTeamsChange}
                onToggleRemarkOption={handleToggleRemarkOption}
                onResetRemarkOptions={handleResetRemarkOptions}
                onToggleRemarkField={handleToggleRemarkField}
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
