import React, { memo, useState, useEffect } from 'react';
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
  Eye,
  UserMinus,
  UserPlus,
  Flag,
  Building2,
  Star,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Briefcase,
  Mail,
  ChevronDown,
  ChevronUp,
  ListTodo,
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
  active_project_count?: number; // Number of active projects
  active_project_names?: string[]; // Names of active projects
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
  const [memberProjects, setMemberProjects] = useState<{ active: any[]; completed: any[]; overdue: any[] } | null>(null);
  const [loadingMemberProjects, setLoadingMemberProjects] = useState(false);
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
  }, [user, activeTab, showInactiveMembers]); // eslint-disable-line react-hooks/exhaustive-deps

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
          teamService.getMembers(showInactiveMembers),
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
    setMemberProjects(null);
    setShowMemberDetailsModal(true);
    // Fetch projects for this member
    setLoadingMemberProjects(true);
    teamService.getMemberProjects(member.id)
      .then((data) => setMemberProjects(data))
      .catch((err) => console.warn('Failed to load member projects:', err))
      .finally(() => setLoadingMemberProjects(false));
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
            setMemberProjects(null);
          }}
          title={`${selectedMember.name} - Member Details`}
        >
          <div className="space-y-5">
            {/* Avatar + basic info */}
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-lg">
                  {selectedMember.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedMember.name}</h3>
                <p className="text-gray-600">{selectedMember.team_role || 'Member'}</p>
              </div>
            </div>

            {/* Email + skill count */}
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

            {/* Skill badges */}
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

            {/* ── Projects section ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Projects</label>

              {loadingMemberProjects ? (
                <div className="text-sm text-gray-500 py-3 text-center">Loading projects…</div>
              ) : memberProjects ? (
                <div className="space-y-4">

                  {/* Active Projects */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                      <span className="text-sm font-semibold text-blue-700">
                        Active Projects ({memberProjects.active.length})
                      </span>
                    </div>
                    {memberProjects.active.length === 0 ? (
                      <p className="text-xs text-gray-400 pl-4">No active projects</p>
                    ) : (
                      <ul className="space-y-1.5 pl-4">
                        {memberProjects.active.map((p: any) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800 truncate mr-2">{p.name}</span>
                            <span className="text-xs text-blue-600 whitespace-nowrap capitalize">{p.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Completed Projects */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></span>
                      <span className="text-sm font-semibold text-green-700">
                        Completed Projects ({memberProjects.completed.length})
                      </span>
                    </div>
                    {memberProjects.completed.length === 0 ? (
                      <p className="text-xs text-gray-400 pl-4">No completed projects</p>
                    ) : (
                      <ul className="space-y-1.5 pl-4">
                        {memberProjects.completed.map((p: any) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800 truncate mr-2">{p.name}</span>
                            <span className="text-xs text-green-600 whitespace-nowrap">Completed</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Overdue Projects */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"></span>
                      <span className="text-sm font-semibold text-red-700">
                        Overdue Projects ({memberProjects.overdue.length})
                      </span>
                    </div>
                    {memberProjects.overdue.length === 0 ? (
                      <p className="text-xs text-gray-400 pl-4">No overdue projects</p>
                    ) : (
                      <ul className="space-y-1.5 pl-4">
                        {memberProjects.overdue.map((p: any) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800 truncate mr-2">{p.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {p.end_date && (
                                <span className="text-xs text-red-500 whitespace-nowrap">
                                  Due {new Date(p.end_date).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-xs text-red-600 capitalize whitespace-nowrap">{p.status}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                </div>
              ) : (
                <p className="text-xs text-gray-400">Could not load project data.</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowMemberDetailsModal(false);
                  setSelectedMember(null);
                  setMemberProjects(null);
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

// ─────────────────────────────────────────────────────────────────────────────
// Avatar helper — deterministic colour from name
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
];

function getAvatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Tooltip wrapper
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white
                      opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

// Chip list with expand/collapse
function ChipList({ items, colourClass }: { items: string[]; colourClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const SHOW = 3;
  const visible = expanded ? items : items.slice(0, SHOW);
  const overflow = items.length - SHOW;
  if (items.length === 0) return <span className="text-xs text-gray-400 italic">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item, i) => (
        <span key={i} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colourClass}`}>
          {item}
        </span>
      ))}
      {!expanded && overflow > 0 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          +{overflow} <ChevronDown className="w-3 h-3" />
        </button>
      )}
      {expanded && overflow > 0 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          Less <ChevronUp className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Status pill
function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Employee Card
// ─────────────────────────────────────────────────────────────────────────────
interface MemberCardProps {
  member: TeamMember;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onViewTasks: (member: TeamMember) => void;
  onEdit: (member: TeamMember) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number, currentStatus: boolean) => void;
  onFlag: (member: TeamMember) => void;
}

const MemberCard = memo(function MemberCard({
  member, isSelected, onSelect, onViewTasks, onEdit, onDelete, onToggleStatus, onFlag,
}: MemberCardProps) {
  const gradient  = getAvatarGradient(member.name);
  const initials  = getInitials(member.name);
  const taskCount = member.task_count || 0;
  const flags     = member.performance_flags_summary ?? { red: 0, orange: 0, yellow: 0, green: 0 };
  const totalFlags = flags.red + flags.orange + flags.yellow + flags.green;
  const activeProjectCount = member.active_project_count || 0;
  const activeProjectNames = member.active_project_names || [];

  const perfMetrics = [
    { label: 'Critical',     value: flags.red,    icon: AlertCircle,  colour: 'text-red-500',     bg: 'bg-red-50'     },
    { label: 'Warning',      value: flags.orange, icon: Clock,        colour: 'text-amber-500',   bg: 'bg-amber-50'   },
    { label: 'Observation',  value: flags.yellow, icon: Circle,       colour: 'text-yellow-500',  bg: 'bg-yellow-50'  },
    { label: 'Positive',     value: flags.green,  icon: CheckCircle2, colour: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  const taskBarColour =
    taskCount === 0  ? ''
    : taskCount < 5  ? 'bg-emerald-500'
    : taskCount < 10 ? 'bg-blue-500'
    : taskCount < 20 ? 'bg-amber-500'
    : 'bg-red-500';

  const taskLabel =
    taskCount === 0  ? 'No tasks assigned'
    : taskCount < 5  ? 'Light workload'
    : taskCount < 10 ? 'Moderate workload'
    : taskCount < 20 ? 'Heavy workload'
    : 'Critical workload';

  return (
    <article
      className={[
        'group relative flex flex-col bg-white rounded-xl border transition-all duration-200',
        'hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] hover:-translate-y-0.5',
        isSelected ? 'ring-2 ring-blue-500 border-blue-300 shadow-md' : 'border-gray-200 shadow-sm hover:border-blue-200',
        !member.is_active ? 'opacity-60' : '',
      ].join(' ')}
      aria-label={`Employee card for ${member.name}`}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <input type="checkbox" aria-label={`Select ${member.name}`}
          checked={isSelected} onChange={() => onSelect(member.id)} onClick={e => e.stopPropagation()}
          className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
        <div className={`w-12 h-12 flex-shrink-0 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
          <span className="text-white font-bold text-sm tracking-wide">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="text-[15px] font-semibold text-gray-900 leading-snug truncate cursor-pointer hover:text-blue-600 transition-colors"
              title={member.name} onClick={() => onViewTasks(member)}>
              {member.name}
            </h3>
            <StatusPill active={member.is_active} />
          </div>
          <p className="flex items-center gap-1 text-[13px] text-gray-500 truncate mt-0.5" title={member.email}>
            <Mail className="w-3 h-3 flex-shrink-0 text-gray-400" />{member.email}
          </p>
          {member.team_names && member.team_names.length > 0 && (
            <p className="flex items-center gap-1 text-[12px] text-gray-400 mt-0.5 truncate">
              <Briefcase className="w-3 h-3 flex-shrink-0" />{member.team_names.join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="mx-4 border-t border-gray-100" />

      {/* ── Task Progress ── */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            <ListTodo className="w-3.5 h-3.5" />Task Load
          </span>
          <span className="text-[13px] font-bold text-gray-800">{taskCount} Tasks</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${taskBarColour}`}
            style={{ width: taskCount === 0 ? '0%' : `${Math.min(taskCount * 5, 100)}%` }}
            role="progressbar" aria-valuenow={taskCount} aria-valuemin={0} aria-valuemax={20} />
        </div>
        <p className="mt-1 text-[11px] text-gray-400">{taskLabel}</p>
      </div>

      <div className="mx-4 border-t border-gray-100" />

      {/* ── Skills & Teams ── */}
      <div className="px-4 py-3 space-y-2.5">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Skills</span>
          <ChipList items={member.skills || []} colourClass="bg-blue-50 text-blue-700 border border-blue-100" />
        </div>
        {member.team_names && member.team_names.length > 0 && (
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Teams</span>
            <ChipList items={member.team_names} colourClass="bg-violet-50 text-violet-700 border border-violet-100" />
          </div>
        )}
      </div>

      {/* ── Performance Metrics (always shown) ── */}
      <>
        <div className="mx-4 border-t border-gray-100" />
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Performance Flags</span>
            {totalFlags > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 min-w-[20px]">
                {totalFlags}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {perfMetrics.map(({ label, value, icon: Icon, colour, bg }) => (
              <Tooltip key={label} label={label}>
                <div className={`flex flex-col items-center justify-center rounded-lg ${value > 0 ? bg : 'bg-gray-50'} py-2 px-1 cursor-default`}>
                  <Icon className={`w-3.5 h-3.5 ${value > 0 ? colour : 'text-gray-300'} mb-0.5`} />
                  <span className={`text-sm font-bold ${value > 0 ? colour : 'text-gray-400'}`}>{value}</span>
                  <span className="text-[10px] text-gray-500 leading-none mt-0.5 truncate w-full text-center">{label}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </>

      {/* ── Active Projects ── */}
      {activeProjectCount > 0 && (
        <>
          <div className="mx-4 border-t border-gray-100" />
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Active Projects</span>
              <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 min-w-[20px]">
                {activeProjectCount}
              </span>
            </div>
            <ChipList items={activeProjectNames} colourClass="bg-blue-50 text-blue-700 border border-blue-100" />
          </div>
        </>
      )}

      {/* ── Quick Actions footer ── */}
      <div className="mx-4 border-t border-gray-100 mt-auto" />
      <div className="flex items-center justify-between px-3 py-2.5">
        <Tooltip label="View Tasks">
          <button type="button" aria-label="View tasks"
            onClick={e => { e.stopPropagation(); onViewTasks(member); }}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            <Eye className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label={member.is_active ? 'Deactivate' : 'Activate'}>
          <button type="button" aria-label={member.is_active ? 'Deactivate' : 'Activate'}
            onClick={e => { e.stopPropagation(); onToggleStatus(member.id, member.is_active); }}
            className={`flex items-center justify-center h-9 w-9 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
              ${member.is_active ? 'text-gray-500 hover:bg-amber-50 hover:text-amber-600 focus:ring-amber-400'
                                 : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 focus:ring-emerald-400'}`}>
            {member.is_active ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          </button>
        </Tooltip>
        <Tooltip label="Flag Employee">
          <button type="button" aria-label="Flag employee"
            onClick={e => { e.stopPropagation(); onFlag(member); }}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-yellow-50 hover:text-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400">
            <Flag className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Edit Member">
          <button type="button" aria-label="Edit member"
            onClick={e => { e.stopPropagation(); onEdit(member); }}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            <Edit className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Delete Member">
          <button type="button" aria-label="Delete member"
            onClick={e => { e.stopPropagation(); onDelete(member.id); }}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </article>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Team Members Tab
// ─────────────────────────────────────────────────────────────────────────────
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
  members, onEdit, onDelete, onToggleStatus, onFlag, onViewTasks, selectedMembers, onSelectMember, onSelectAll,
}: TeamMembersTabProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-base font-semibold text-gray-500">No team members found</p>
        <p className="text-sm text-gray-400 mt-1">Try adjusting your search or add a new member.</p>
      </div>
    );
  }
  const allSelected = selectedMembers.length === members.length && members.length > 0;
  const someSelected = selectedMembers.length > 0 && selectedMembers.length < members.length;
  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);
  return (
    <div className="space-y-4">
      {/* Select-all bar */}
      <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5">
        <input ref={selectAllRef} id="select-all" type="checkbox" checked={allSelected} onChange={onSelectAll}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          aria-label="Select all members" />
        <label htmlFor="select-all" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
          {allSelected ? 'Deselect all' : 'Select all'}
          <span className="ml-1 text-gray-400">({members.length} {members.length === 1 ? 'member' : 'members'})</span>
        </label>
        {someSelected && (
          <span className="text-sm text-blue-600 font-medium ml-1">{selectedMembers.length} selected</span>
        )}
      </div>
      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {members.map(member => (
          <MemberCard key={member.id} member={member}
            isSelected={selectedMembers.includes(member.id)}
            onSelect={onSelectMember} onViewTasks={onViewTasks}
            onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} onFlag={onFlag} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teams Tab
// ─────────────────────────────────────────────────────────────────────────────
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {teams.map((team) => (
        <div key={team.id}
          className="group flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-200">
          {/* Header */}
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <h3 className="text-[15px] font-semibold text-gray-900 truncate leading-snug" title={team.name}>{team.name}</h3>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold
                  ${team.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${team.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {team.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-[12px] text-gray-500 line-clamp-1 mt-0.5">{team.description || 'No description'}</p>
            </div>
          </div>
          <div className="mx-4 border-t border-gray-100" />
          {/* Stats */}
          <div className="px-4 py-3 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Capacity</span>
                <span className="text-[12px] font-semibold text-gray-700">
                  {team.member_count || 0} <span className="text-gray-400 font-normal">/ {team.max_capacity || 10}</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(((team.member_count || 0) / (team.max_capacity || 10)) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">{team.team_lead_name || 'No team lead'}</span>
            </div>
            {team.functional_unit_name && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate">{team.functional_unit_name}</span>
              </div>
            )}
            {team.skills && team.skills.length > 0 && (
              <ChipList items={team.skills} colourClass="bg-teal-50 text-teal-700 border border-teal-100" />
            )}
          </div>
          <div className="mx-4 border-t border-gray-100 mt-auto" />
          {/* Actions */}
          <div className="flex items-center justify-around px-3 py-2.5">
            <Tooltip label="View Members">
              <button type="button" aria-label="View team members" onClick={() => onViewDetails(team)}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                <Users className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label="Edit Team">
              <button type="button" aria-label="Edit team" onClick={() => onEdit(team)}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                <Edit className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label="Delete Team">
              <button type="button" aria-label="Delete team" onClick={() => onDelete(team.id)}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}