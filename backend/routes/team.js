const express = require('express');
const router = express.Router();
const { requireAdminAuth, requireAdminOrPMAuth, requireTeamAuth } = require('../middleware/auth');
const {
  // Team member functions (existing)
  authenticateTeamMember,
  getMyTasks,
  getMyProfile,
  getMyPerformanceFlags,
  getAllTeamMembers,
  getTeams,
  getTeamMembersWithPerformanceFlags,
  getTeamMemberFlags,
  removePerformanceFlag,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberStatus,
  bulkUpdateTeamMembersStatus,
  
  // Team management functions (new)
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  debugTeamMemberData,
  createSampleData,

  // Projects for a team member
  getTeamMemberProjects,
} = require('../controllers/teamController');

// =====================================================
// TEAM MEMBER ROUTES (existing functionality)
// =====================================================

// Team member authentication (no auth required)
router.post('/authenticate', authenticateTeamMember);

// Team member specific routes (requires team auth)
router.get('/my-tasks', requireTeamAuth, getMyTasks);
router.get('/my-profile', requireTeamAuth, getMyProfile);
router.get('/my-performance-flags', requireTeamAuth, getMyPerformanceFlags);

// Get all team members (admin only)
router.get('/members', requireAdminOrPMAuth, getAllTeamMembers);

// Get team members with performance flags for ranking (admin only)
router.get('/members/performance-ranking', requireAdminOrPMAuth, getTeamMembersWithPerformanceFlags);

// Get performance flags for a specific team member (admin only)
router.get('/members/:memberId/flags', requireAdminOrPMAuth, getTeamMemberFlags);

// Remove a performance flag (admin only)
router.delete('/flags/:flagId', requireAdminAuth, removePerformanceFlag);

// Get team member by ID
router.get('/members/:id', requireAdminOrPMAuth, getTeamMemberById);

// Get projects for a specific team member (active, completed, overdue)
router.get('/members/:id/projects', requireAdminOrPMAuth, getTeamMemberProjects);

// Create new team member
router.post('/members', requireAdminAuth, createTeamMember);

// Update team member
router.put('/members/:id', requireAdminAuth, updateTeamMember);

// Delete team member
router.delete('/members/:id', requireAdminAuth, deleteTeamMember);

// Bulk update team members status (must be before /:id/status to avoid Express
// matching "bulk" as the :id param)
router.patch('/members/bulk/status', requireAdminAuth, bulkUpdateTeamMembersStatus);

// Toggle team member active status
router.patch('/members/:id/status', requireAdminAuth, toggleTeamMemberStatus);

// =====================================================
// TEAM MANAGEMENT ROUTES (new functionality)
// =====================================================

// Get all teams with detailed information
router.get('/teams', requireAdminOrPMAuth, getAllTeams);

// Get team by ID with members
router.get('/teams/:id', requireAdminOrPMAuth, getTeamById);

// Create new team
router.post('/teams', requireAdminAuth, createTeam);

// Update team
router.put('/teams/:id', requireAdminAuth, updateTeam);

// Delete team
router.delete('/teams/:id', requireAdminAuth, deleteTeam);

// Add member to team
router.post('/teams/:teamId/members', requireAdminAuth, addMemberToTeam);

// Remove member from team
router.delete('/teams/:teamId/members/:memberId', requireAdminAuth, removeMemberFromTeam);

// Debug endpoint (development only)
router.get('/debug', requireAdminAuth, debugTeamMemberData);

// Create sample data (development only)
router.post('/sample-data', requireAdminAuth, createSampleData);

// =====================================================
// LEGACY ROUTES (for backward compatibility)
// =====================================================

// Get all team members (legacy route)
router.get('/', requireAdminOrPMAuth, getAllTeamMembers);

module.exports = router;