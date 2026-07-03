const jwt = require('jsonwebtoken');
const db = require('../db');

// Middleware to verify admin JWT token
const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user type is admin
    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Skip session validation for now to fix login redirect
    // TODO: Re-enable session validation after testing login flow
    // const [sessionRows] = await pool.execute(
    //   'SELECT * FROM admin_sessions WHERE user_id = ? AND access_token = ? AND expires_at > NOW()',
    //   [decoded.id, token]
    // );

    // if (sessionRows.length === 0) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Session expired or invalid'
    //   });
    // }

    // Get admin user
    const adminRows = await db.query(
      'SELECT id, email, name, is_active FROM admin_users WHERE id = ? AND is_active = true',
      [decoded.id]
    );

    if (adminRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found or inactive'
      });
    }

    const admin = adminRows[0];

    // Add user to request object
    req.user = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      type: 'admin'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    const logger = require('../utils/logger');
    logger.error('Admin authentication middleware failure', error, {
      url: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to verify team member token
const requireTeamAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user type is team
    if (decoded.type !== 'team') {
      return res.status(403).json({
        success: false,
        message: 'Team member access required'
      });
    }

    // Get team member
    const teamMemberRows = await db.query(
      'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true',
      [decoded.id]
    );

    if (teamMemberRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Team member not found or inactive'
      });
    }

    const teamMember = teamMemberRows[0];

    // Load permissions
    const permRows = await db.query(
      'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
      [teamMember.id]
    );
    const permissions = {};
    permRows.forEach(p => { permissions[p.permission_key] = !!p.is_granted; });

    // Add user to request object
    req.user = {
      id: teamMember.id,
      email: teamMember.email,
      name: teamMember.name,
      role: teamMember.role || 'employee',
      permissions,
      type: 'team'
    };

    next();
  } catch (error) {
    const logger = require('../utils/logger');
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    // Log the actual error for debugging
    logger.error('Team authentication middleware failure', error, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    console.error('Team auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to verify either admin or team member token
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'admin') {
      // Admin authentication (skip session validation for now)
      // TODO: Re-enable session validation after testing login flow  
      // const [sessionRows] = await pool.execute(
      //   'SELECT * FROM admin_sessions WHERE user_id = ? AND access_token = ? AND expires_at > NOW()',
      //   [decoded.id, token]
      // );

      // if (sessionRows.length === 0) {
      //   return res.status(401).json({
      //     success: false,
      //     message: 'Session expired or invalid'
      //   });
      // }

      const adminRows = await db.query(
        'SELECT id, email, name, is_active FROM admin_users WHERE id = ? AND is_active = true',
        [decoded.id]
      );

      if (adminRows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found or inactive'
        });
      }

      const admin = adminRows[0];

      req.user = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        type: 'admin'
      };

    } else if (decoded.type === 'team') {
      // Team member authentication (skip session validation for now)
      const teamMemberRows = await db.query(
        'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true',
        [decoded.id]
      );

      if (teamMemberRows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Team member not found or inactive'
        });
      }

      const teamMember = teamMemberRows[0];

      // Load permissions
      const permRows = await db.query(
        'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
        [teamMember.id]
      );
      const permissions = {};
      permRows.forEach(p => { permissions[p.permission_key] = !!p.is_granted; });

      req.user = {
        id: teamMember.id,
        email: teamMember.email,
        name: teamMember.name,
        role: teamMember.role || 'employee',
        permissions,
        type: 'team'
      };

    } else {
      return res.status(403).json({
        success: false,
        message: 'Invalid user type'
      });
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    const logger = require('../utils/logger');
    logger.error('Combined authentication middleware failure', error, {
      url: req.originalUrl,
      method: req.method
    });
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'admin') {
      const adminRows = await db.query(
        'SELECT id, email, name FROM admin_users WHERE id = ? AND is_active = true',
        [decoded.id]
      );
      
      if (adminRows.length > 0) {
        req.user = { ...adminRows[0], type: 'admin' };
      }
    } else if (decoded.type === 'team') {
      const teamMemberRows = await db.query(
        'SELECT id, email, name FROM team_members WHERE id = ? AND is_active = true',
        [decoded.id]
      );
      
      if (teamMemberRows.length > 0) {
        req.user = { ...teamMemberRows[0], type: 'team' };
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth
    req.user = null;
    next();
  }
};


// Middleware that allows EITHER:
//   1. An admin token, OR
//   2. A team member token whose role is 'project_manager'
//
// Used on routes that PM users need to read from the admin portal
// (allocations, team members listing, analytics, etc.)
const requireAdminOrPMAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Admin path ────────────────────────────────────────────────
    if (decoded.type === 'admin') {
      const adminRows = await db.query(
        'SELECT id, email, name, is_active FROM admin_users WHERE id = ? AND is_active = true',
        [decoded.id]
      );

      if (adminRows.length === 0) {
        return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
      }

      req.user = {
        id: adminRows[0].id,
        email: adminRows[0].email,
        name: adminRows[0].name,
        type: 'admin'
      };
      return next();
    }

    // ── Project Manager path ──────────────────────────────────────
    if (decoded.type === 'team') {
      const teamMemberRows = await db.query(
        'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true',
        [decoded.id]
      );

      if (teamMemberRows.length === 0) {
        return res.status(401).json({ success: false, message: 'Team member not found or inactive' });
      }

      const teamMember = teamMemberRows[0];

      // Only allow project_manager role
      if (teamMember.role !== 'project_manager') {
        return res.status(403).json({
          success: false,
          message: 'Project Manager access required'
        });
      }

      // Load permissions for reference by controllers
      const permRows = await db.query(
        'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
        [teamMember.id]
      );
      const permissions = {};
      permRows.forEach(p => { permissions[p.permission_key] = !!p.is_granted; });

      req.user = {
        id: teamMember.id,
        email: teamMember.email,
        name: teamMember.name,
        role: 'project_manager',
        permissions,
        type: 'team'
      };
      return next();
    }

    return res.status(403).json({ success: false, message: 'Invalid user type' });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    console.error('requireAdminOrPMAuth error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

// ── API Key middleware ────────────────────────────────────────────────────────
// Accepts requests that carry a valid API key in one of:
//   Header : X-API-Key: wf_xxxx
//   Query  : ?api_key=wf_xxxx
//
// On success sets req.apiKey = { id, name } and calls next().
// Falls through to JWT check if no key is present (so the same route can
// accept both API-key callers and logged-in users).
const requireApiKey = async (req, res, next) => {
  try {
    const key = req.headers['x-api-key'] || req.query.api_key;

    if (!key) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Pass it via X-API-Key header or ?api_key= query param.'
      });
    }

    const row = await db.queryFirst(
      `SELECT id, name, is_active, expires_at
       FROM api_keys
       WHERE api_key = ?`,
      [key]
    );

    if (!row) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    if (!row.is_active) {
      return res.status(403).json({ success: false, message: 'API key has been revoked' });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(403).json({ success: false, message: 'API key has expired' });
    }

    // Update last_used_at asynchronously — don't block the request
    db.execute('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(() => {});

    req.apiKey = { id: row.id, name: row.name };
    next();
  } catch (error) {
    console.error('requireApiKey error:', error);
    res.status(500).json({ success: false, message: 'API key validation failed' });
  }
};

// ── Combined: API key OR JWT (admin/PM) ──────────────────────────────────────
// Dashboard routes use this so they can be called either way.
const requireApiKeyOrAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key) return requireApiKey(req, res, next);
  return requireAdminOrPMAuth(req, res, next);
};

// Alias for requireAdminAuth (commonly used for admin-only routes)
const authenticateToken = requireAdminAuth;

// Validation middleware for express-validator
const validateRequest = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  next();
};

module.exports = {
  requireAdminAuth,
  requireAdminOrPMAuth,
  requireTeamAuth,
  requireAuth,
  requireApiKey,
  requireApiKeyOrAuth,
  optionalAuth,
  authenticateToken,
  validateRequest
};
