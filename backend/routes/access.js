const express = require('express');
const router = express.Router();
const { requireAdminAuth, requireTeamAuth } = require('../middleware/auth');
const {
  getPermissionDefinitions,
  getMembersWithPermissions,
  updateMemberRole,
  updateMemberPermissions,
  getMyPermissions,
} = require('../controllers/accessController');

// ============================================================
// ADMIN ROUTES – manage other members' roles/permissions
// ============================================================

// Get all available permission keys and labels
router.get('/permissions-definitions', requireAdminAuth, getPermissionDefinitions);

// Get all team members with their current roles & permissions
router.get('/members', requireAdminAuth, getMembersWithPermissions);

// Update a team member's role (employee | project_manager)
// Also resets their permissions to role defaults
router.put('/members/:id/role', requireAdminAuth, updateMemberRole);

// Fine-grained permission overrides for a specific team member
router.put('/members/:id/permissions', requireAdminAuth, updateMemberPermissions);

// ============================================================
// TEAM MEMBER SELF-SERVICE – get own permissions
// ============================================================

// Called by a logged-in team member to fetch their own permissions
router.get('/my-permissions', requireTeamAuth, getMyPermissions);

module.exports = router;
