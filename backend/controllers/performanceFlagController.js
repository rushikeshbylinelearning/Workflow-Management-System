const db = require('../db');

// Get all performance flags for a team member
const getPerformanceFlags = async (req, res) => {
  try {
    const { teamMemberId } = req.params;

    const query = `
      SELECT 
        pf.*,
        t.name as task_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.team_member_id = ?
      ORDER BY pf.created_at DESC
    `;

    const flags = await db.query(query, [teamMemberId]);

    res.json({
      success: true,
      data: flags
    });

  } catch (error) {
    console.error('Get performance flags error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch performance flags'
      }
    });
  }
};

// Get performance flags for a specific task
const getTaskPerformanceFlags = async (req, res) => {
  try {
    const { taskId } = req.params;

    const query = `
      SELECT 
        pf.*,
        tm.name as team_member_name,
        tm.email as team_member_email,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN team_members tm ON pf.team_member_id = tm.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.task_id = ?
      ORDER BY pf.created_at DESC
    `;

    const flags = await db.query(query, [taskId]);

    res.json({
      success: true,
      data: flags
    });

  } catch (error) {
    console.error('Get task performance flags error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch task performance flags'
      }
    });
  }
};

// Add a new performance flag
const addPerformanceFlag = async (req, res) => {
  try {
    const { team_member_id, task_id, type, reason } = req.body;
    const added_by_id = req.user?.id;
    // mysql2 rejects undefined bind params; optional task_id must be SQL NULL
    const normalizedTaskId =
      task_id != null && task_id !== '' ? Number(task_id) : null;


    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can add performance flags'
        }
      });
    }

    // Validate required fields
    if (!team_member_id || !type || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: team_member_id, type, reason'
        }
      });
    }

    // Validate flag type - ensure consistency with frontend expectations
    const validTypes = ['red', 'orange', 'yellow', 'green'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid flag type. Must be one of: red, orange, yellow, green'
        }
      });
    }

    // Check if team member exists
    const teamMemberCheck = await db.query(
      'SELECT id, name FROM team_members WHERE id = ? AND is_active = true',
      [team_member_id]
    );

    if (teamMemberCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team member not found'
        }
      });
    }

    // Check if task exists (if task_id is provided)
    if (normalizedTaskId != null) {
      const taskCheck = await db.query(
        'SELECT id, name FROM tasks WHERE id = ?',
        [normalizedTaskId]
      );

      if (taskCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found'
          }
        });
      }
    }

    // Get admin user name for added_by field
    const adminUser = await db.query(
      'SELECT name FROM admin_users WHERE id = ?',
      [added_by_id]
    );

    const adminName = adminUser.length > 0 ? adminUser[0].name : 'Unknown Admin';

    // Insert performance flag
    const insertQuery = `
      INSERT INTO performance_flags (
        team_member_id, task_id, type, reason, added_by, added_by_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await db.insert(insertQuery, [
      team_member_id, normalizedTaskId, type, reason, adminName, added_by_id
    ]);

    // Get the created flag with related data
    const createdFlag = await db.query(`
      SELECT 
        pf.*,
        t.name as task_name,
        tm.name as team_member_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN team_members tm ON pf.team_member_id = tm.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      data: createdFlag[0],
      message: 'Performance flag added successfully'
    });

  } catch (error) {
    console.error('❌ Add performance flag error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to add performance flag'
      }
    });
  }
};

// Update a performance flag
const updatePerformanceFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { type, reason } = req.body;
    const updated_by_id = req.user?.id;

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can update performance flags'
        }
      });
    }

    // Check if flag exists
    const flagCheck = await db.query(
      'SELECT * FROM performance_flags WHERE id = ?',
      [flagId]
    );

    if (flagCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Performance flag not found'
        }
      });
    }

    // Validate flag type if provided
    if (type) {
      const validTypes = ['red', 'orange', 'yellow', 'green'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid flag type. Must be one of: red, orange, yellow, green'
          }
        });
      }
    }

    // Build update query
    let updateQuery = 'UPDATE performance_flags SET updated_at = CURRENT_TIMESTAMP';
    const updateParams = [];

    if (type !== undefined) {
      updateQuery += ', type = ?';
      updateParams.push(type);
    }

    if (reason !== undefined) {
      updateQuery += ', reason = ?';
      updateParams.push(reason);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(flagId);

    await db.query(updateQuery, updateParams);

    // Get updated flag
    const updatedFlag = await db.query(`
      SELECT 
        pf.*,
        t.name as task_name,
        tm.name as team_member_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN team_members tm ON pf.team_member_id = tm.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.id = ?
    `, [flagId]);

    res.json({
      success: true,
      data: updatedFlag[0],
      message: 'Performance flag updated successfully'
    });

  } catch (error) {
    console.error('Update performance flag error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update performance flag'
      }
    });
  }
};

// Delete a performance flag
const deletePerformanceFlag = async (req, res) => {
  try {
    const { flagId } = req.params;

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can delete performance flags'
        }
      });
    }

    // Check if flag exists
    const flagCheck = await db.query(
      'SELECT * FROM performance_flags WHERE id = ?',
      [flagId]
    );

    if (flagCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Performance flag not found'
        }
      });
    }

    // Delete flag
    await db.query('DELETE FROM performance_flags WHERE id = ?', [flagId]);

    res.json({
      success: true,
      message: 'Performance flag deleted successfully'
    });

  } catch (error) {
    console.error('Delete performance flag error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete performance flag'
      }
    });
  }
};

// Get performance summary for a team member
const getPerformanceSummary = async (req, res) => {
  try {
    const { teamMemberId } = req.params;

    const query = `
      SELECT 
        type,
        COUNT(*) as count,
        MAX(created_at) as last_flag_date
      FROM performance_flags
      WHERE team_member_id = ?
      GROUP BY type
      ORDER BY type
    `;

    const summary = await db.query(query, [teamMemberId]);

    // Get team member info
    const teamMember = await db.query(
      'SELECT id, name, email FROM team_members WHERE id = ?',
      [teamMemberId]
    );

    if (teamMember.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team member not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        team_member: teamMember[0],
        summary: summary
      }
    });

  } catch (error) {
    console.error('Get performance summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch performance summary'
      }
    });
  }
};

module.exports = {
  getPerformanceFlags,
  getTaskPerformanceFlags,
  addPerformanceFlag,
  updatePerformanceFlag,
  deletePerformanceFlag,
  getPerformanceSummary
};
