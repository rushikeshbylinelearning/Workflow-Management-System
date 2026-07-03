import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Star, 
  Flag, 
  Users, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Search,
  Filter,
  Trash2,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ProgressBar } from './ui/ProgressBar';
import { Modal } from './ui/Modal';
import { teamService } from '../services/apiService';
import tokenService from '../services/tokenService';

const isActiveMember = (member: { is_active?: boolean | number }) =>
  member.is_active === true || member.is_active === 1;

export function TopPerformers() {
  const [performers, setPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'completion' | 'flags'>('flags');
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showMemberFlagsModal, setShowMemberFlagsModal] = useState(false);
  const [memberFlags, setMemberFlags] = useState<any[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPerformers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if token is expired before making API calls
        if (tokenService.isActiveTokenExpired()) {
          const refreshed = await tokenService.refreshActiveToken();
          if (!refreshed) {
            setError('Session expired. Please login again.');
            setLoading(false);
            return;
          }
        }
        
        // Fetch teams and performers in parallel
        const [teamsData, performersData] = await Promise.all([
          teamService.getTeams(),
          teamService.getMembersWithPerformanceRanking(selectedTeam || undefined)
        ]);
        
        if (isMounted) {
          setTeams(teamsData);
          setPerformers((performersData || []).filter(isActiveMember));
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Top performers fetch error:', err);
          
          // Check if it's an authentication error
          if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            try {
              const refreshed = await tokenService.refreshActiveToken();
              if (refreshed) {
                // Retry the API call
                const [teamsData, retryData] = await Promise.all([
                  teamService.getTeams(),
                  teamService.getMembersWithPerformanceRanking(selectedTeam || undefined)
                ]);
                if (isMounted) {
                  setTeams(teamsData);
                  setPerformers((retryData || []).filter(isActiveMember));
                  setError(null);
                }
              } else {
                setError('Session expired. Please login again.');
              }
            } catch (refreshError) {
              setError('Session expired. Please login again.');
            }
          } else {
            setError(err.message || 'Failed to load performance data');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPerformers();

    return () => {
      isMounted = false;
    };
  }, [selectedTeam]);

  const handleMemberClick = async (member: any) => {
    setSelectedMember(member);
    setShowMemberFlagsModal(true);
    await loadMemberFlags(member.id);
  };

  const loadMemberFlags = async (memberId: number) => {
    setLoadingFlags(true);
    try {
      const response = await teamService.getMemberFlags(memberId);
      if (response && response.flags) {
        setMemberFlags(response.flags);
      } else {
        setMemberFlags([]);
      }
    } catch (error) {
      console.error('Failed to load member flags:', error);
      setMemberFlags([]);
    } finally {
      setLoadingFlags(false);
    }
  };

  const handleRemoveFlag = async (flagId: number) => {
    if (window.confirm('Are you sure you want to remove this flag? This action cannot be undone.')) {
      try {
        await teamService.removeFlag(flagId);
        
        // Refresh the flags list
        if (selectedMember) {
          await loadMemberFlags(selectedMember.id);
        }
        
        // Show success message
        alert('Flag removed successfully!');
      } catch (error) {
        console.error('Failed to remove flag:', error);
        alert('Failed to remove flag. Please try again.');
      }
    }
  };

  const handleCloseMemberFlagsModal = () => {
    setShowMemberFlagsModal(false);
    setSelectedMember(null);
    setMemberFlags([]);
  };

  // Filter and sort performers
  const filteredAndSortedPerformers = performers
    .filter(isActiveMember)
    .filter(performer => 
      performer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      performer.skills?.some((skill: string) => 
        skill.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'completion':
          return (b.completion_rate || 0) - (a.completion_rate || 0);
        case 'flags':
          // Keep the backend ranking (don't re-sort by total flags)
          return 0;
        default:
          return 0;
      }
    });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Star className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Star className="w-5 h-5 text-orange-400" />;
    return <span className="w-5 h-5 text-sm font-bold text-gray-500 flex items-center justify-center">#{index + 1}</span>;
  };


  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Performers</h1>
          <p className="text-gray-600">Performance ranking based on flags and task completion</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Performers</h1>
          <p className="text-gray-600">Performance ranking based on flags and task completion</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Top Performers</h1>
            <p className="text-white/80">Performance ranking based on flags and task completion</p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or skill..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-500 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedTeam || ''}
                onChange={(e) => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
                className="pl-10 pr-8 py-2 border border-gray-500 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent appearance-none"
              >
                <option value="" className="text-gray-900 bg-white">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} className="text-gray-900 bg-white">{team.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="pl-10 pr-8 py-2 border border-gray-500 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent appearance-none"
              >
                <option value="flags" className="text-gray-900 bg-white">Performance Ranking</option>
                <option value="completion" className="text-gray-900 bg-white">Sort by Completion</option>
              </select>
            </div>
          </div>
        </div>
      </div>


      {/* Performers List */}
      <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="space-y-0">
            {filteredAndSortedPerformers.map((performer, index) => (
              <div 
                key={performer.id} 
                className="flex items-center justify-between p-6 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleMemberClick(performer)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getRankIcon(index)}
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                    {performer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{performer.name}</h3>
                    <p className="text-sm text-gray-600">{performer.skills?.join(', ') || 'No skills listed'}</p>
                    <p className="text-xs text-gray-500">{performer.team_names?.join(', ') || 'No teams'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  {/* Flag Counts */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{performer.green_flags || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{performer.yellow_flags || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{performer.orange_flags || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{performer.red_flags || 0}</span>
                    </div>
                  </div>

                  {/* Total Flags */}
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{performer.total_flags || 0}</div>
                    <div className="text-xs text-gray-500">flags</div>
                  </div>

                  {/* Task Completion */}
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{performer.completion_rate || 0}%</div>
                    <div className="text-xs text-gray-500">completion</div>
                  </div>

                  {/* Task Stats */}
                  <div className="text-right text-sm text-gray-600">
                    <div>{performer.total_assigned_tasks || 0} assigned</div>
                    <div>{performer.completed_tasks || 0} completed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {filteredAndSortedPerformers.length === 0 && (
        <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No performers found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search criteria' : 'No team members with performance data available'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Member Performance Flags Modal */}
      <Modal
        isOpen={showMemberFlagsModal}
        onClose={handleCloseMemberFlagsModal}
        title={`${selectedMember?.name}'s Performance Flags`}
      >
        <div className="space-y-6">
          {selectedMember && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                  {selectedMember.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">{selectedMember.name}</h4>
                  <p className="text-sm text-gray-600">{selectedMember.skills?.join(', ') || 'No skills listed'}</p>
                  <p className="text-xs text-gray-500">{selectedMember.team_names?.join(', ') || 'No teams'}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{selectedMember.total_flags || 0}</div>
                  <div className="text-xs text-gray-500">Total Flags</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{selectedMember.completion_rate || 0}%</div>
                  <div className="text-xs text-gray-500">Completion</div>
                </div>
              </div>
            </div>
          )}

          {loadingFlags ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-600" />
              <p className="text-gray-600">Loading performance flags...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {memberFlags.length > 0 ? (
                memberFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className={`p-4 rounded-lg border-2 ${
                      flag.type === 'green' ? 'bg-green-50 border-green-200' :
                      flag.type === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                      flag.type === 'orange' ? 'bg-orange-50 border-orange-200' :
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge 
                            variant={
                              flag.type === 'red' ? 'danger' :
                              flag.type === 'orange' ? 'warning' :
                              flag.type === 'yellow' ? 'warning' : 'default'
                            }
                            size="sm"
                          >
                            {flag.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {new Date(flag.created_at).toLocaleDateString()}
                          </span>
                          {flag.added_by && (
                            <span className="text-xs text-gray-500">
                              Added by: {flag.added_by}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 mb-3">{flag.reason}</p>
                        
                        {flag.task_name ? (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-700">Related Task:</span>
                              <span className="text-sm text-gray-600">{flag.task_name}</span>
                            </div>
                            {flag.project_name && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700">Project:</span>
                                <span className="text-sm text-gray-600">{flag.project_name}</span>
                              </div>
                            )}
                            <div className="pt-2 flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  // TODO: Implement view task details
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            No specific task associated with this flag
                          </div>
                        )}
                      </div>
                      
                      {/* Remove Flag Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveFlag(flag.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50 ml-2"
                        title="Remove this flag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Flag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No performance flags found for this member</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
