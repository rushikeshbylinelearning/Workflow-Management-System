import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { ProgressBar } from './ui/ProgressBar';
import { 
  Users, 
  Users2,
  Plus, 
  Edit, 
  Trash2,
  Search, 
  Filter, 
  Eye,
  UserMinus,
  UserPlus,
  Flag,
  Building2,
  Star,
} from 'lucide-react';
import { teamService, skillService, taskService, performanceFlagService } from '../services/apiService';
import { useApp } from '../contexts/AppContext';
import { FlagEmployeeModal } from './modals/FlagEmployeeModal';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  passcode?: string;
  skills: string[];
  team_names?: string[];
  team_ids?: number[];
  performance_flags_count: number;
  performance_flags_summary?: {
    red: number;
    orange: number;
    yellow: number;
    green: number;
  };
  is_active: boolean;
  created_at: string;
  task_count?: number; // Number of tasks assigned to this member
}

interface Team {
  id: number;
  name: string;
  description: string;
  functional_unit_name: string;
  team_lead_name: string;
  member_count: number;
  max_capacity: number;
  skills: string[];
  is_active: boolean;
  created_at: string;
  members?: any[];
}

interface FunctionalUnit {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
}

export function TeamManager() {
  const { user } = useAuth();
  
  // Check if user is logged in (either admin or team member)
  const isAuthenticated = () => {
    if (user) return true;
    const teamToken = sessionStorage.getItem('teamToken');
    const teamUserData = sessionStorage.getItem('teamUserData');
    return !!(teamToken && teamUserData);
  };
  const { dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'members' | 'teams'>('members');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Team Members State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  
  // Teams State
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [showAddMemberToTeamModal, setShowAddMemberToTeamModal] = useState(false);
  const [availableMembersForTeam, setAvailableMembersForTeam] = useState<TeamMember[]>([]);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingMember, setFlaggingMember] = useState<{ id: number; name: string } | null>(null);
  
  // Form States
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    email: '',
    passcode: '',
    skills: [] as string[],
    team_id: null as number | null
  });
  
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    functional_unit_id: null as number | null,
    team_lead_id: null as number | null,
    team_lead_type: 'team' as 'admin' | 'team',
    max_capacity: 10,
    members: [] as any[]
  });

  // Available skills for selection
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);

  // Fetch data from backend
  useEffect(() => {
    // Only fetch data if user is authenticated
    if (isAuthenticated()) {
      fetchData();
    }
  }, [user, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available skills
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const skillsData = await skillService.getAll();
        
        // The API now returns the data array directly
        let skillsArray = [];
        if (Array.isArray(skillsData)) {
          skillsArray = skillsData;
        }
        
        
        // Extract skill names from the skills data
        const skillNames = skillsArray.map((skill: any) => skill.name || skill);
        setAvailableSkills(skillNames);
      } catch (error) {
        console.error('Error fetching skills:', error);
      }
    };
    // Only fetch skills if user is authenticated
    if (isAuthenticated()) {
      fetchSkills();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchData = async () => {
      try {
        setLoading(true);
      setError(null);
      
      if (activeTab === 'members') {
        const [membersData, tasksData] = await Promise.all([
          teamService.getMembers(),
          taskService.getAll({ all: 'true' })
        ]);
        
        
        // Extract data from API response structure
        const membersArray = membersData.data || membersData;
        const tasksArray = tasksData.data || tasksData;
        
        // Add task counts and performance flag summaries to team members
        const membersWithDetails = await Promise.all((membersArray || []).map(async (member: TeamMember) => {
          const memberTasks = tasksArray.filter((task: any) => 
            task.assignees &&
            task.assignees.map((id: any) => String(id)).includes(String(member.id))
          );
          
          // Fetch performance flag summary for this member
          let performanceFlagsSummary = null;
          try {
            const summaryData = await performanceFlagService.getSummary(member.id.toString());
            // Convert array format to object format
            if (summaryData && summaryData.summary) {
              performanceFlagsSummary = {
                red: 0,
                orange: 0,
                yellow: 0,
                green: 0
              };
              
              summaryData.summary.forEach((item: any) => {
                if (item.type && item.count) {
                  performanceFlagsSummary[item.type] = item.count;
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch performance flags for member ${member.id}:`, error);
          }
          
          return {
            ...member,
            task_count: memberTasks.length,
            performance_flags_summary: performanceFlagsSummary
          };
        }));
        
        setTeamMembers(membersWithDetails);
        setFilteredMembers(membersWithDetails);
      } else {
        const teamsData = await teamService.getTeams();
        
        const teamsArray = teamsData.data || teamsData;
        setTeams(teamsArray || []);
        setFilteredTeams(teamsArray || []);
      }
      } catch (error) {
        console.error('❌ Fetch team data error:', error);
        setError('Failed to load team data');
      } finally {
        setLoading(false);
      }
    };

  // Always fetch teams for the dropdown, regardless of active tab
  useEffect(() => {
    const fetchTeamsForDropdown = async () => {
      try {
        const teamsData = await teamService.getTeams();
        const teamsArray = teamsData.data || teamsData;
        setTeams(teamsArray || []);
      } catch (error) {
        console.error('Error fetching teams for dropdown:', error);
      }
    };
    fetchTeamsForDropdown();
  }, []);

  // Filter team members
  useEffect(() => {
    if (activeTab === 'members') {
      let filtered = teamMembers.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.skills && member.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      
      // Filter by active status
      if (!showInactiveMembers) {
        filtered = filtered.filter(member => member.is_active);
      }
      
      setFilteredMembers(filtered);
      } else {
      const filtered = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (team.skills && team.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      setFilteredTeams(filtered);
    }
  }, [searchTerm, teamMembers, teams, activeTab, showInactiveMembers]);

  // Team Member Functions
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passcode is provided for new members
    if (!memberFormData.passcode || memberFormData.passcode.trim() === '') {
      setError('Passcode is required for new team members');
      return;
    }
    
    try {
      const result = await teamService.createMember(memberFormData);
      setTeamMembers([...teamMembers, result]);
      setShowCreateMemberModal(false);
      resetMemberForm();
    } catch (error) {
      console.error('Error creating team member:', error);
      setError('Failed to create team member');
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    
    try {
      // Only include passcode if it's provided (for updates)
      const updateData: any = { ...memberFormData };
      if (!updateData.passcode || updateData.passcode.trim() === '') {
        delete updateData.passcode;
      }
      
      const result = await teamService.updateMember(editingMember.id.toString(), updateData);
      setTeamMembers(teamMembers.map(m => m.id === editingMember.id ? result : m));
      setShowCreateMemberModal(false);
      setEditingMember(null);
      resetMemberForm();
    } catch (error) {
      console.error('Error updating team member:', error);
      setError('Failed to update team member');
    }
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    
    try {
      await teamService.deleteMember(id.toString());
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting team member:', error);
      setError('Failed to delete team member');
    }
  };

  const handleToggleMemberStatus = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this team member?`)) return;
    
    try {
      await teamService.toggleMemberStatus(id.toString(), !currentStatus);
      
      // Update local state
      setTeamMembers(teamMembers.map(m => 
        m.id === id ? { ...m, is_active: !currentStatus } : m
      ));
      
      setError(null);
    } catch (error) {
      console.error('Error toggling team member status:', error);
      setError('Failed to update team member status');
    }
  };

  const handleBulkToggleStatus = async (is_active: boolean) => {
    if (selectedMembers.length === 0) {
      setError('Please select at least one team member');
      return;
    }
    
    const action = is_active ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${selectedMembers.length} team member(s)?`)) return;
    
    try {
      await teamService.bulkUpdateMembersStatus(selectedMembers, is_active);
      
      // Update local state
      setTeamMembers(teamMembers.map(m => 
        selectedMembers.includes(m.id) ? { ...m, is_active } : m
      ));
      
      // Clear selection
      setSelectedMembers([]);
      setError(null);
    } catch (error) {
      console.error('Error bulk updating team members status:', error);
      setError('Failed to bulk update team members status');
    }
  };

  const handleSelectMember = (id: number) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(memberId => memberId !== id) : [...prev, id]
    );
  };

  const handleSelectAllMembers = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.id));
    }
  };

  const resetMemberForm = () => {
    setMemberFormData({
      name: '',
      email: '',
      passcode: '',
      skills: [],
      team_id: null
    });
  };

  // Team Functions
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await teamService.createTeam(teamFormData);
      setTeams([...teams, result]);
      setShowCreateTeamModal(false);
      resetTeamForm();
    } catch (error) {
      console.error('Error creating team:', error);
      setError('Failed to create team');
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    try {
      const result = await teamService.updateTeam(editingTeam.id.toString(), teamFormData);
      setTeams(teams.map(t => t.id === editingTeam.id ? result : t));
      setShowCreateTeamModal(false);
      setEditingTeam(null);
      resetTeamForm();
    } catch (error) {
      console.error('Error updating team:', error);
      setError('Failed to update team');
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    try {
      await teamService.deleteTeam(id.toString());
      setTeams(teams.filter(t => t.id !== id));
      } catch (error) {
      console.error('Error deleting team:', error);
      setError('Failed to delete team');
    }
  };

  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      description: '',
      functional_unit_id: null,
      team_lead_id: null,
      team_lead_type: 'team',
      max_capacity: 10,
      members: []
    });
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setMemberFormData({
      name: member.name,
      email: member.email,
      passcode: '', // Leave empty for updates - only required for new members
      skills: member.skills,
      team_id: member.team_ids && member.team_ids.length > 0 ? member.team_ids[0] : null
    });
    setShowCreateMemberModal(true);
  };

  const openEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamFormData({
      name: team.name,
      description: team.description,
      functional_unit_id: null, // Would need to fetch functional unit ID
      team_lead_id: null, // Would need to fetch team lead ID
      team_lead_type: 'team',
      max_capacity: team.max_capacity,
      members: []
    });
    setShowCreateTeamModal(true);
  };

  const openTeamDetails = async (team: Team) => {
    try {
      const result = await teamService.getTeamById(team.id.toString());
      setSelectedTeam(result);  
      setShowTeamDetailsModal(true);
      } catch (error) {
      console.error('Error fetching team details:', error);
      setError('Failed to fetch team details');
    }
  };

  const openAddMemberToTeam = async (team: Team) => {
    try {
      // Get all team members and filter out those already in this team
      const allMembers = await teamService.getMembers();
      const membersArray = allMembers.data || allMembers;
      const teamMembers = membersArray || [];
      
      // Filter out members who are already in this team
      const availableMembers = teamMembers.filter((member: TeamMember) => 
        !member.team_ids || !member.team_ids.includes(team.id)
      );
      
      setAvailableMembersForTeam(availableMembers);
      setSelectedTeam(team);
      setShowAddMemberToTeamModal(true);
      } catch (error) {
      console.error('Error fetching available members:', error);
      setError('Failed to fetch available members');
    }
  };

  const handleViewMemberTasks = (member: TeamMember) => {
    dispatch({ type: 'SET_SELECTED_VIEW', payload: 'tasks' });
    dispatch({
      type: 'SET_FILTERS',
      payload: {
        teamMembers: [String(member.id)],
        activeOnly: true,
      },
    });
  };

  const handleAddMemberToTeam = async (memberId: number) => {
    if (!selectedTeam) return;
    
    try {
      await teamService.addMemberToTeam(selectedTeam.id.toString(), { member_id: memberId });
      
      // Refresh team details
      const result = await teamService.getTeamById(selectedTeam.id.toString());
      setSelectedTeam(result);
      
      // Refresh team members list
      await fetchData();
      
      setShowAddMemberToTeamModal(false);
    } catch (error) {
      console.error('Error adding member to team:', error);
      setError('Failed to add member to team');
    }
  };

  const handleRemoveMemberFromTeam = async (memberId: number) => {
    if (!selectedTeam) return;
    
    if (!confirm(`Are you sure you want to remove this member from ${selectedTeam.name}?`)) {
      return;
    }
    
    try {
      await teamService.removeMemberFromTeam(selectedTeam.id.toString(), memberId.toString());
      
      // Refresh team details
      const result = await teamService.getTeamById(selectedTeam.id.toString());
      setSelectedTeam(result);
      
      // Refresh team members list
      await fetchData();
      
      setError(null);
    } catch (error) {
      console.error('Error removing member from team:', error);
      setError('Failed to remove member from team');
    }
  };

  const handleViewMemberDetails = (member: any) => {
    setSelectedMember(member);
    setShowMemberDetailsModal(true);
  };

  const handleOpenFlagModal = (member: TeamMember) => {
    setFlaggingMember({ id: member.id, name: member.name });
    setShowFlagModal(true);
  };

  const handleFlagSuccess = () => {
    fetchData(); // Refresh data to update flag counts
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading team data...</div>
      </div>
    );
  }
        
        return (
    <div className="w-full min-w-0 max-w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-white/80">Manage team members and teams</p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
                </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-6 sm:space-x-8 min-w-max sm:min-w-0">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members</span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'teams'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Teams</span>
          </button>
        </nav>
              </div>

      {/* Search and Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'members' ? 'team members' : 'teams'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {activeTab === 'members' && (
            <>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactiveMembers}
                  onChange={(e) => setShowInactiveMembers(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show Inactive</span>
              </label>
              
              {selectedMembers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedMembers.length} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkToggleStatus(false)}
                    className="flex items-center space-x-1"
                  >
                    <UserMinus className="w-3 h-3" />
                    <span>Deactivate</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkToggleStatus(true)}
                    className="flex items-center space-x-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Activate</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

                    <Button
          onClick={() => {
            if (activeTab === 'members') {
              setEditingMember(null);
              resetMemberForm();
              setShowCreateMemberModal(true);
            } else {
              setEditingTeam(null);
              resetTeamForm();
              setShowCreateTeamModal(true);
            }
          }}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add {activeTab === 'members' ? 'Member' : 'Team'}</span>
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'members' ? (
        <TeamMembersTab 
          members={filteredMembers}
          onEdit={openEditMember}
          onDelete={handleDeleteMember}
          onToggleStatus={handleToggleMemberStatus}
          onFlag={handleOpenFlagModal}
          onViewTasks={handleViewMemberTasks}
          selectedMembers={selectedMembers}
          onSelectMember={handleSelectMember}
          onSelectAll={handleSelectAllMembers}
        />
      ) : (
        <TeamsTab 
          teams={filteredTeams}
          onEdit={openEditTeam}
          onDelete={handleDeleteTeam}
          onViewDetails={openTeamDetails}
        />
      )}

      {/* Create/Edit Member Modal */}
      <Modal
        isOpen={showCreateMemberModal}
        onClose={() => {
          setShowCreateMemberModal(false);
          setEditingMember(null);
          resetMemberForm();
        }}
        title={editingMember ? 'Edit Team Member' : 'Create Team Member'}
      >
        <form onSubmit={editingMember ? handleUpdateMember : handleCreateMember} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={memberFormData.name}
                onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter full name"
                required
              />
                            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={memberFormData.email}
                onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
                required
              />
                        </div>
                      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passcode {editingMember && <span className="text-gray-500 text-xs">(leave empty to keep current)</span>}
              </label>
              <input
                type="text"
                value={memberFormData.passcode}
                onChange={(e) => setMemberFormData({ ...memberFormData, passcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={editingMember ? "Leave empty to keep current passcode" : "Enter passcode"}
                required={!editingMember}
              />
              {!editingMember && (
                <p className="text-xs text-gray-500 mt-1">Passcode is required for new team members</p>
                    )}
                  </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Team</label>
              <select
                value={memberFormData.team_id || ''}
                onChange={(e) => setMemberFormData({ ...memberFormData, team_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a team (optional)</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              </div>
    </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Skills</label>
            <div className="text-xs text-gray-500 mb-2">Available skills: {availableSkills.length}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {availableSkills.length > 0 ? (
                availableSkills.map((skill) => (
                  <label key={skill} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={memberFormData.skills.includes(skill)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMemberFormData({
                            ...memberFormData,
                            skills: [...memberFormData.skills, skill]
                          });
                        } else {
                          setMemberFormData({
                            ...memberFormData,
                            skills: memberFormData.skills.filter(s => s !== skill)
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{skill}</span>
                  </label>
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-500 py-4">
                  No skills available. Please add skills first.
                        </div>
              )}
                        </div>
            {memberFormData.skills.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">Selected skills:</p>
                <div className="flex flex-wrap gap-2">
                  {memberFormData.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      </div>
            )}
                          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowCreateMemberModal(false);
                setEditingMember(null);
                resetMemberForm();
              }}
              className="px-6"
            >
              Cancel
                        </Button>
            <Button type="submit" className="px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              {editingMember ? 'Update Member' : 'Create Member'}
                        </Button>
                      </div>
        </form>
      </Modal>

            {/* Create/Edit Team Modal */}
      <Modal
        isOpen={showCreateTeamModal}
        onClose={() => {
          setShowCreateTeamModal(false);
          setEditingTeam(null);
          resetTeamForm();
        }}
        title={editingTeam ? 'Edit Team' : 'Create Team'}
      >
        <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
              <input
                type="text"
                value={teamFormData.name}
                onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter team name"
                required
              />
              </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Capacity</label>
              <input
                type="number"
                value={teamFormData.max_capacity}
                onChange={(e) => setTeamFormData({ ...teamFormData, max_capacity: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="50"
                placeholder="10"
              />
              </div>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={teamFormData.description}
              onChange={(e) => setTeamFormData({ ...teamFormData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Enter team description"
            />
              </div>



          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowCreateTeamModal(false);
                setEditingTeam(null);
                resetTeamForm();
              }}
              className="px-6"
            >
              Cancel
            </Button>
            <Button type="submit" className="px-6 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700">
              {editingTeam ? 'Update Team' : 'Create Team'}
            </Button>
              </div>
        </form>
      </Modal>

      {/* Team Details Modal */}
      {selectedTeam && (
        <Modal
          isOpen={showTeamDetailsModal}
          onClose={() => {
            setShowTeamDetailsModal(false);
            setSelectedTeam(null);
          }}
          title={`${selectedTeam.name} - Team Details`}
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Team Information</h3>
              <p className="text-gray-600">{selectedTeam.description}</p>
      </div>

            <div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Members</label>
                <p className="text-gray-900 font-semibold">
                  <span className="text-blue-600">{selectedTeam.members?.length || selectedTeam.member_count || 0}</span> / <span className="text-gray-600">{selectedTeam.max_capacity}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(!selectedTeam.members?.length && !selectedTeam.member_count) || (selectedTeam.members?.length === 0 && selectedTeam.member_count === 0) ? 'No members' : 
                   (selectedTeam.members?.length || selectedTeam.member_count) === 1 ? '1 member' : 
                   `${selectedTeam.members?.length || selectedTeam.member_count} members`} assigned
                </p>
              </div>
            </div>
              
            {selectedTeam.skills && selectedTeam.skills.length > 0 && (
                <div>
                <label className="block text-sm font-medium text-gray-700">Team Skills</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedTeam.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Team Members</label>
                <Button
                  size="sm"
                  onClick={() => openAddMemberToTeam(selectedTeam)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={selectedTeam.member_count >= selectedTeam.max_capacity}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Add Member
                </Button>
                  </div>
              
              {selectedTeam.members && selectedTeam.members.length > 0 ? (
                <div className="space-y-2 mt-1">
                  {selectedTeam.members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-600">{member.team_role}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{member.skills?.length || 0} skills</Badge>
                        <div className="relative group">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewMemberDetails(member);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            View Details
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                        <div className="relative group">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMemberFromTeam(member.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            Remove User
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No members assigned to this team</p>
                  </div>
              )}
                  </div>
                </div>
        </Modal>
      )}

      {/* Add Member to Team Modal */}
      {selectedTeam && (
        <Modal
          isOpen={showAddMemberToTeamModal}
          onClose={() => {
            setShowAddMemberToTeamModal(false);
            setSelectedTeam(null);
            setAvailableMembersForTeam([]);
          }}
          title={`Add Member to ${selectedTeam.name}`}
        >
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Select a member to add to <strong>{selectedTeam.name}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Current: {selectedTeam.member_count} / {selectedTeam.max_capacity} members
              </p>
            </div>

            {availableMembersForTeam.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableMembersForTeam.map((member) => (
                        <div 
                          key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleAddMemberToTeam(member.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-xs">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                        </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {member.skills.length} skills
                      </Badge>
                      <Button size="sm" variant="outline" className="text-xs">
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
      </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No available members</p>
                <p className="text-sm">All team members are already assigned to this team or other teams.</p>
    </div>
            )}

            <div className="flex justify-end pt-4 border-t">
            <Button 
                variant="outline"
              onClick={() => {
                  setShowAddMemberToTeamModal(false);
                  setSelectedTeam(null);
                  setAvailableMembersForTeam([]);
              }}
            >
                Cancel
            </Button>
          </div>
        </div>
        </Modal>
      )}

      {/* Member Details Modal */}
      {selectedMember && (
        <Modal
          isOpen={showMemberDetailsModal}
          onClose={() => {
            setShowMemberDetailsModal(false);
            setSelectedMember(null);
          }}
          title={`${selectedMember.name} - Member Details`}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {selectedMember.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedMember.name}</h3>
                <p className="text-gray-600">{selectedMember.team_role || 'Member'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{selectedMember.email || 'Not provided'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Skills</label>
                <p className="text-gray-900">{selectedMember.skills?.length || 0} skills</p>
              </div>
            </div>

            {selectedMember.skills && selectedMember.skills.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skill Details</label>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.skills.map((skill: string, index: number) => (
                    <Badge key={index} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowMemberDetailsModal(false);
                  setSelectedMember(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Flag Employee Modal */}
      {flaggingMember && (
        <FlagEmployeeModal
          isOpen={showFlagModal}
          onClose={() => {
            setShowFlagModal(false);
            setFlaggingMember(null);
          }}
          memberId={flaggingMember.id}
          memberName={flaggingMember.name}
          onSuccess={handleFlagSuccess}
        />
      )}
    </div>
    );
  }

// Team Members Tab Component
interface TeamMembersTabProps {
  members: TeamMember[];
  onEdit: (member: TeamMember) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number, currentStatus: boolean) => void;
  onFlag: (member: TeamMember) => void;
  onViewTasks: (member: TeamMember) => void;
  selectedMembers: number[];
  onSelectMember: (id: number) => void;
  onSelectAll: () => void;
}

function TeamMembersTab({ 
  members, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  onFlag,
  onViewTasks,
  selectedMembers,
  onSelectMember,
  onSelectAll
}: TeamMembersTabProps) {
  return (
    <div className="space-y-4">
      {/* Select All Checkbox */}
      {members.length > 0 && (
        <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={selectedMembers.length === members.length && members.length > 0}
            onChange={onSelectAll}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Select All ({members.length} members)
          </span>
        </div>
      )}
      
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4 sm:gap-6 w-full min-w-0">
      {members.map((member) => (
        <Card 
          key={member.id} 
          className={`min-w-0 w-full overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer ${
            selectedMembers.includes(member.id) ? 'ring-2 ring-blue-500' : ''
          } ${!member.is_active ? 'opacity-60' : ''}`}
          onClick={() => onViewTasks(member)}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between min-w-0">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectMember(member.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                <div className="flex items-start sm:items-center space-x-3 mb-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
        <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg truncate" title={member.name}>{member.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center min-w-0">
                      <span className={`w-2 h-2 flex-shrink-0 ${member.is_active ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2`}></span>
                      <span className="truncate" title={member.email}>{member.email}</span>
                    </p>
                    {member.passcode && (
                      <p className="text-xs text-gray-500 mt-1">
                        Passcode: <span className="font-mono bg-gray-100 px-1 rounded">{member.passcode}</span>
                      </p>
                    )}
        </div>
          </div>
                
                <div className="mb-4 space-y-3">
                  {/* Task Count */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Tasks</span>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                        {member.task_count || 0} tasks
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((member.task_count || 0) * 10, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Skills</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {member.skills.length} skills
                      </span>
                    </div>

                    {member.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                            {skill}
                          </Badge>
                        ))}
                        {member.skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs px-2 py-1">
                            +{member.skills.length - 3} more
                          </Badge>
                        )}
              </div>
                    )}
              </div>

                  {member.team_names && member.team_names.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Teams</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {member.team_names.length} team{member.team_names.length > 1 ? 's' : ''}
                        </span>
              </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {member.team_names.map((teamName, index) => (
                          <Badge key={index} variant="default" className="text-xs px-2 py-1 bg-green-100 text-green-800">
                            {teamName}
                          </Badge>
                        ))}
              </div>
              </div>
                  )}
            </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Badge variant={member.is_active ? "default" : "secondary"} className="px-3 py-1">
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {member.performance_flags_count > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="danger" className="px-2 py-1 text-xs">
                          🔴 {member.performance_flags_summary?.red || 0}
                        </Badge>
                        <Badge variant="warning" className="px-2 py-1 text-xs">
                          🟠 {member.performance_flags_summary?.orange || 0}
                        </Badge>
                        <Badge variant="warning" className="px-2 py-1 text-xs">
                          🟡 {member.performance_flags_summary?.yellow || 0}
                        </Badge>
                        <Badge variant="success" className="px-2 py-1 text-xs">
                          🟢 {member.performance_flags_summary?.green || 0}
                        </Badge>
                      </div>
                    )}
      </div>

                  <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(member.id, member.is_active);
                      }}
                      className={`${
                        member.is_active 
                          ? 'hover:bg-orange-50 hover:border-orange-300' 
                          : 'hover:bg-green-50 hover:border-green-300'
                      } transition-colors`}
                      title={member.is_active ? 'Deactivate member' : 'Activate member'}
                    >
                      {member.is_active ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlag(member);
                      }}
                      className="hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
                      title="Flag Employee"
                    >
                      <Flag className="w-3 h-3 text-yellow-600" />
                    </Button>
            <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(member);
                      }}
                      className="hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
            </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(member.id);
                      }}
                      className="hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    </div>
  );
}

// Teams Tab Component
interface TeamsTabProps {
  teams: Team[];
  onEdit: (team: Team) => void;
  onDelete: (id: number) => void;
  onViewDetails: (team: Team) => void;
}

function TeamsTab({ teams, onEdit, onDelete, onViewDetails }: TeamsTabProps) {
  if (!teams || teams.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No teams found</h3>
        <p className="text-gray-600 mb-6">Create your first team to get started.</p>
        <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4 sm:gap-6 w-full min-w-0">
      {teams.map((team) => (
        <Card key={team.id} className="min-w-0 w-full overflow-hidden hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-start sm:items-center space-x-3 mb-3 min-w-0">
                  <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
          <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg truncate" title={team.name}>{team.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{team.description || 'No description'}</p>
                  </div>
          </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{team.functional_unit_name || 'No unit'}</span>
          </div>
                    <Badge variant={team.is_active ? "default" : "secondary"} className="px-2 py-1 text-xs">
                      {team.is_active ? 'Active' : 'Inactive'}
                    </Badge>
        </div>

                  <div className="flex items-center space-x-2">
                    <Users2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {team.member_count || 0} / {team.max_capacity || 10} members
                    </span>
                    <div className="flex-1 ml-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(((team.member_count || 0) / (team.max_capacity || 10)) * 100, 100)}%` }}
                        ></div>
                      </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{team.team_lead_name || 'No team lead'}</span>
                  </div>
        </div>

                {team.skills && team.skills.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Team Skills</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        {team.skills.length} skills
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {team.skills.slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                          {skill}
                        </Badge>
                      ))}
                      {team.skills.length > 3 && (
                        <Badge variant="secondary" className="text-xs px-2 py-1">
                          +{team.skills.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <div className="flex flex-wrap gap-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onViewDetails(team)}
                      className="hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <Users className="w-3 h-3" />
          </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onEdit(team)}
                      className="hover:bg-green-50 hover:border-green-300 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onDelete(team.id)}
                      className="hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
          </Button>
        </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}