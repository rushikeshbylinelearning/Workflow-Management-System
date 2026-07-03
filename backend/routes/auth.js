const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { requireAdminAuth, requireTeamAuth } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Admin Authentication Routes
router.post('/admin/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
], authController.adminLogin);

router.post('/admin/refresh', [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
], authController.refreshAdminToken);

router.post('/admin/logout', 
  requireAdminAuth, 
  authController.adminLogout
);

router.post('/admin/logout-all', 
  requireAdminAuth, 
  authController.adminLogoutAll
);

router.get('/admin/me', 
  requireAdminAuth, 
  authController.getAdminProfile
);

// Team Member Authentication Routes
router.post('/team/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('passcode')
    .isLength({ min: 3, max: 20 })
    .withMessage('Passcode must be between 3 and 20 characters'),
  handleValidationErrors
], authController.teamMemberLogin);

router.post('/team/refresh', [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
], authController.refreshTeamMemberToken);

router.post('/team/logout', 
  requireTeamAuth, 
  authController.teamMemberLogout
);

// SSO Login Route
router.post('/sso-login', authController.ssoLogin);

router.get('/team/me', 
  requireTeamAuth, 
  async (req, res) => {
    try {
      const teamMemberId = req.user.id;

      // Get team member with skills and performance flags
      const teamMember = await require('../db').queryFirst(`
        SELECT 
          tm.*,
          GROUP_CONCAT(DISTINCT s.name) as skills
        FROM team_members tm
        LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
        LEFT JOIN skills s ON tms.skill_id = s.id
        WHERE tm.id = ? AND tm.is_active = true
        GROUP BY tm.id
      `, [teamMemberId]);

      if (!teamMember) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      // Get performance flags
      const performanceFlags = await require('../db').query(
        'SELECT * FROM performance_flags WHERE team_member_id = ? ORDER BY created_at DESC',
        [teamMemberId]
      );

      // Parse skills and add performance flags
      teamMember.skills = teamMember.skills ? teamMember.skills.split(',') : [];
      teamMember.performance_flags = performanceFlags;
      delete teamMember.passcode; // Don't send passcode

      res.json({
        success: true,
        data: teamMember
      });

    } catch (error) {
      console.error('Get team member profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  }
);

// Test routes for development
if (process.env.NODE_ENV === 'development') {
  // Test route to hash password (for creating admin users)
  router.post('/hash-password', [
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    handleValidationErrors
  ], async (req, res) => {
    try {
      const bcrypt = require('bcryptjs');
      const { password } = req.body;
      
      const hash = await bcrypt.hash(password, 12);
      
      res.json({
        success: true,
        data: {
          password: password,
          hash: hash,
          sql: `INSERT INTO admin_users (email, password_hash, name, is_active, email_verified_at) VALUES ('admin@example.com', '${hash}', 'Admin User', true, NOW());`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to hash password'
      });
    }
  });

  // Test route to verify token
  router.get('/verify-token', requireAdminAuth, (req, res) => {
    res.json({
      success: true,
      message: 'Token is valid',
      user: req.user
    });
  });
}

module.exports = router;
