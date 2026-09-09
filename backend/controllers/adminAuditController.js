const db = require('../db');

// Helper function to convert UTC timestamp to IST
const convertToIST = (utcTimestamp) => {
  if (!utcTimestamp) return null;
  const date = new Date(utcTimestamp);
  // Add 5 hours 30 minutes for IST
  date.setHours(date.getHours() + 5);
  date.setMinutes(date.getMinutes() + 30);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

// Helper function to format timestamp for display
const formatISTTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const options = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
    hour12: true
  };
  return new Intl.DateTimeFormat('en-IN', options).format(date);
};

// =====================================================
// PERFORMANCE FLAGS MANAGEMENT
// =====================================================

// Get all performance flags (for admin review/deletion)
const getAllPerformanceFlags = async (req, res) => {
  try {
    const { teamMemberId, taskId, flagType, limit = 100 } = req.query;

    let query = `
      SELECT 
        pf.*,
        tm.name as team_member_name,
        tm.email as team_member_email,
        t.name as task_name,
        t.description as task_description,
        p.name as project_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN team_members tm ON pf.team_member_id = tm.id
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE 1=1
    `;

    const params = [];

    if (teamMemberId) {
      query += ' AND pf.team_member_id = ?';
      params.push(teamMemberId);
    }

    if (taskId) {
      query += ' AND pf.task_id = ?';
      params.push(taskId);
    }

    if (flagType) {
      query += ' AND pf.type = ?';
      params.push(flagType);
    }

    query += ' ORDER BY pf.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const flags = await db.query(query, params);

    // Format timestamps to IST
    const formattedFlags = flags.map(flag => ({
      ...flag,
      created_at_ist: formatISTTimestamp(flag.created_at)
    }));

    res.json({
      success: true,
      data: formattedFlags,
      count: formattedFlags.length
    });

  } catch (error) {
    console.error('Get all performance flags error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch performance flags'
      }
    });
  }
};

// Delete/Revert a performance flag with audit logging
const deletePerformanceFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const deleted_by = req.user?.id;
    const deleted_by_name = req.user?.name || 'Unknown Admin';
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can delete performance flags'
        }
      });
    }

    // Get flag details before deletion
    const flags = await db.query(`
      SELECT 
        pf.*,
        tm.name as team_member_name,
        t.name as task_name,
        au.name as original_added_by_name
      FROM performance_flags pf
      LEFT JOIN team_members tm ON pf.team_member_id = tm.id
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.id = ?
    `, [flagId]);

    if (flags.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Performance flag not found'
        }
      });
    }

    const flag = flags[0];
    const deleted_at = convertToIST(new Date());

    // Create audit log entry
    await db.insert(`
      INSERT INTO flag_audit_logs (
        flag_id, team_member_id, team_member_name, task_id, task_name,
        flag_type, flag_reason, original_added_by, original_added_by_id,
        original_created_at, deleted_by, deleted_by_name, deleted_by_type,
        deleted_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
    `, [
      flagId,
      flag.team_member_id,
      flag.team_member_name,
      flag.task_id,
      flag.task_name,
      flag.type,
      flag.reason,
      flag.original_added_by_name || flag.added_by,
      flag.added_by_id,
      flag.created_at,
      deleted_by,
      deleted_by_name,
      deleted_at,
      ip_address,
      user_agent
    ]);

    // Delete the flag
    await db.query('DELETE FROM performance_flags WHERE id = ?', [flagId]);

    res.json({
      success: true,
      message: 'Performance flag deleted successfully',
      audit: {
        deleted_at_ist: formatISTTimestamp(deleted_at),
        deleted_by: deleted_by_name
      }
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

// Bulk delete performance flags with audit logging
const bulkDeletePerformanceFlags = async (req, res) => {
  try {
    const { flagIds } = req.body;
    const deleted_by = req.user?.id;
    const deleted_by_name = req.user?.name || 'Unknown Admin';
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can delete performance flags'
        }
      });
    }

    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Flag IDs array is required'
        }
      });
    }

    const deleted_at = convertToIST(new Date());
    const deletedCount = { success: 0, failed: 0 };

    // Process each flag
    for (const flagId of flagIds) {
      try {
        // Get flag details
        const flags = await db.query(`
          SELECT 
            pf.*,
            tm.name as team_member_name,
            t.name as task_name,
            au.name as original_added_by_name
          FROM performance_flags pf
          LEFT JOIN team_members tm ON pf.team_member_id = tm.id
          LEFT JOIN tasks t ON pf.task_id = t.id
          LEFT JOIN admin_users au ON pf.added_by_id = au.id
          WHERE pf.id = ?
        `, [flagId]);

        if (flags.length === 0) {
          deletedCount.failed++;
          continue;
        }

        const flag = flags[0];

        // Create audit log
        await db.insert(`
          INSERT INTO flag_audit_logs (
            flag_id, team_member_id, team_member_name, task_id, task_name,
            flag_type, flag_reason, original_added_by, original_added_by_id,
            original_created_at, deleted_by, deleted_by_name, deleted_by_type,
            deleted_at, ip_address, user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
        `, [
          flagId,
          flag.team_member_id,
          flag.team_member_name,
          flag.task_id,
          flag.task_name,
          flag.type,
          flag.reason,
          flag.original_added_by_name || flag.added_by,
          flag.added_by_id,
          flag.created_at,
          deleted_by,
          deleted_by_name,
          deleted_at,
          ip_address,
          user_agent
        ]);

        // Delete flag
        await db.query('DELETE FROM performance_flags WHERE id = ?', [flagId]);
        deletedCount.success++;

      } catch (error) {
        console.error(`Error deleting flag ${flagId}:`, error);
        deletedCount.failed++;
      }
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount.success} flags successfully`,
      summary: deletedCount,
      audit: {
        deleted_at_ist: formatISTTimestamp(deleted_at),
        deleted_by: deleted_by_name
      }
    });

  } catch (error) {
    console.error('Bulk delete performance flags error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to bulk delete performance flags'
      }
    });
  }
};

// Get flag audit logs
const getFlagAuditLogs = async (req, res) => {
  try {
    const { teamMemberId, taskId, flagType, limit = 100 } = req.query;

    let query = `
      SELECT 
        fal.*
      FROM flag_audit_logs fal
      WHERE 1=1
    `;

    const params = [];

    if (teamMemberId) {
      query += ' AND fal.team_member_id = ?';
      params.push(teamMemberId);
    }

    if (taskId) {
      query += ' AND fal.task_id = ?';
      params.push(taskId);
    }

    if (flagType) {
      query += ' AND fal.flag_type = ?';
      params.push(flagType);
    }

    query += ' ORDER BY fal.deleted_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await db.query(query, params);

    // Format timestamps to IST
    const formattedLogs = logs.map(log => ({
      ...log,
      deleted_at_ist: formatISTTimestamp(log.deleted_at),
      original_created_at_ist: formatISTTimestamp(log.original_created_at)
    }));

    res.json({
      success: true,
      data: formattedLogs,
      count: formattedLogs.length
    });

  } catch (error) {
    console.error('Get flag audit logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch flag audit logs'
      }
    });
  }
};

// =====================================================
// EXTENSION REQUESTS MANAGEMENT
// =====================================================

// Get all extension requests (for admin review/deletion)
const getAllExtensionRequests = async (req, res) => {
  try {
    const { status, taskId, projectId, limit = 100 } = req.query;

    let query = `
      SELECT 
        te.*,
        t.name as task_name,
        p.name as project_name,
        COALESCE(tm.name, au.name) as requested_by_name,
        reviewer.name as reviewed_by_name
      FROM task_extensions te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON te.requested_by = tm.id AND te.requested_by_type = 'team'
      LEFT JOIN admin_users au ON te.requested_by = au.id AND te.requested_by_type = 'admin'
      LEFT JOIN admin_users reviewer ON te.reviewed_by = reviewer.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ' AND te.status = ?';
      params.push(status);
    }

    if (taskId) {
      query += ' AND te.task_id = ?';
      params.push(taskId);
    }

    if (projectId) {
      query += ' AND p.id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY te.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const requests = await db.query(query, params);

    // Format timestamps to IST
    const formattedRequests = requests.map(request => ({
      ...request,
      created_at_ist: formatISTTimestamp(request.created_at),
      reviewed_at_ist: formatISTTimestamp(request.reviewed_at),
      current_due_date_ist: formatISTTimestamp(request.current_due_date),
      requested_due_date_ist: formatISTTimestamp(request.requested_due_date)
    }));

    res.json({
      success: true,
      data: formattedRequests,
      count: formattedRequests.length
    });

  } catch (error) {
    console.error('Get all extension requests error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch extension requests'
      }
    });
  }
};

// Delete/Revert an extension request with audit logging
const deleteExtensionRequest = async (req, res) => {
  try {
    const { extensionId } = req.params;
    const deleted_by = req.user?.id;
    const deleted_by_name = req.user?.name || 'Unknown Admin';
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can delete extension requests'
        }
      });
    }

    // Get extension request details before deletion
    const requests = await db.query(`
      SELECT 
        te.*,
        t.name as task_name,
        p.id as project_id,
        p.name as project_name,
        COALESCE(tm.name, au.name) as requested_by_name,
        reviewer.name as reviewed_by_name
      FROM task_extensions te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON te.requested_by = tm.id AND te.requested_by_type = 'team'
      LEFT JOIN admin_users au ON te.requested_by = au.id AND te.requested_by_type = 'admin'
      LEFT JOIN admin_users reviewer ON te.reviewed_by = reviewer.id
      WHERE te.id = ?
    `, [extensionId]);

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Extension request not found'
        }
      });
    }

    const request = requests[0];
    const deleted_at = convertToIST(new Date());

    // Create audit log entry
    await db.insert(`
      INSERT INTO extension_request_audit_logs (
        extension_id, task_id, task_name, project_id, project_name,
        requested_by, requested_by_name, requested_by_type,
        current_due_date, requested_due_date, reason, status,
        reviewed_by, reviewed_by_name, reviewed_at, review_notes,
        deleted_by, deleted_by_name, deleted_by_type,
        deleted_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
    `, [
      extensionId,
      request.task_id,
      request.task_name,
      request.project_id,
      request.project_name,
      request.requested_by,
      request.requested_by_name,
      request.requested_by_type,
      request.current_due_date,
      request.requested_due_date,
      request.reason,
      request.status,
      request.reviewed_by,
      request.reviewed_by_name,
      request.reviewed_at,
      request.review_notes,
      deleted_by,
      deleted_by_name,
      deleted_at,
      ip_address,
      user_agent
    ]);

    // Delete the extension request
    await db.query('DELETE FROM task_extensions WHERE id = ?', [extensionId]);

    res.json({
      success: true,
      message: 'Extension request deleted successfully',
      audit: {
        deleted_at_ist: formatISTTimestamp(deleted_at),
        deleted_by: deleted_by_name
      }
    });

  } catch (error) {
    console.error('Delete extension request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete extension request'
      }
    });
  }
};

// Bulk delete extension requests with audit logging
const bulkDeleteExtensionRequests = async (req, res) => {
  try {
    const { extensionIds } = req.body;
    const deleted_by = req.user?.id;
    const deleted_by_name = req.user?.name || 'Unknown Admin';
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only admins can delete extension requests'
        }
      });
    }

    if (!extensionIds || !Array.isArray(extensionIds) || extensionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Extension IDs array is required'
        }
      });
    }

    const deleted_at = convertToIST(new Date());
    const deletedCount = { success: 0, failed: 0 };

    // Process each extension request
    for (const extensionId of extensionIds) {
      try {
        // Get request details
        const requests = await db.query(`
          SELECT 
            te.*,
            t.name as task_name,
            p.id as project_id,
            p.name as project_name,
            COALESCE(tm.name, au.name) as requested_by_name,
            reviewer.name as reviewed_by_name
          FROM task_extensions te
          LEFT JOIN tasks t ON te.task_id = t.id
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN team_members tm ON te.requested_by = tm.id AND te.requested_by_type = 'team'
          LEFT JOIN admin_users au ON te.requested_by = au.id AND te.requested_by_type = 'admin'
          LEFT JOIN admin_users reviewer ON te.reviewed_by = reviewer.id
          WHERE te.id = ?
        `, [extensionId]);

        if (requests.length === 0) {
          deletedCount.failed++;
          continue;
        }

        const request = requests[0];

        // Create audit log
        await db.insert(`
          INSERT INTO extension_request_audit_logs (
            extension_id, task_id, task_name, project_id, project_name,
            requested_by, requested_by_name, requested_by_type,
            current_due_date, requested_due_date, reason, status,
            reviewed_by, reviewed_by_name, reviewed_at, review_notes,
            deleted_by, deleted_by_name, deleted_by_type,
            deleted_at, ip_address, user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
        `, [
          extensionId,
          request.task_id,
          request.task_name,
          request.project_id,
          request.project_name,
          request.requested_by,
          request.requested_by_name,
          request.requested_by_type,
          request.current_due_date,
          request.requested_due_date,
          request.reason,
          request.status,
          request.reviewed_by,
          request.reviewed_by_name,
          request.reviewed_at,
          request.review_notes,
          deleted_by,
          deleted_by_name,
          deleted_at,
          ip_address,
          user_agent
        ]);

        // Delete request
        await db.query('DELETE FROM task_extensions WHERE id = ?', [extensionId]);
        deletedCount.success++;

      } catch (error) {
        console.error(`Error deleting extension request ${extensionId}:`, error);
        deletedCount.failed++;
      }
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount.success} extension requests successfully`,
      summary: deletedCount,
      audit: {
        deleted_at_ist: formatISTTimestamp(deleted_at),
        deleted_by: deleted_by_name
      }
    });

  } catch (error) {
    console.error('Bulk delete extension requests error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to bulk delete extension requests'
      }
    });
  }
};

// Get extension request audit logs
const getExtensionAuditLogs = async (req, res) => {
  try {
    const { taskId, projectId, status, limit = 100 } = req.query;

    let query = `
      SELECT 
        eal.*
      FROM extension_request_audit_logs eal
      WHERE 1=1
    `;

    const params = [];

    if (taskId) {
      query += ' AND eal.task_id = ?';
      params.push(taskId);
    }

    if (projectId) {
      query += ' AND eal.project_id = ?';
      params.push(projectId);
    }

    if (status) {
      query += ' AND eal.status = ?';
      params.push(status);
    }

    query += ' ORDER BY eal.deleted_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await db.query(query, params);

    // Format timestamps to IST
    const formattedLogs = logs.map(log => ({
      ...log,
      deleted_at_ist: formatISTTimestamp(log.deleted_at),
      reviewed_at_ist: formatISTTimestamp(log.reviewed_at),
      current_due_date_ist: formatISTTimestamp(log.current_due_date),
      requested_due_date_ist: formatISTTimestamp(log.requested_due_date)
    }));

    res.json({
      success: true,
      data: formattedLogs,
      count: formattedLogs.length
    });

  } catch (error) {
    console.error('Get extension audit logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch extension audit logs'
      }
    });
  }
};

module.exports = {
  // Performance Flags
  getAllPerformanceFlags,
  deletePerformanceFlag,
  bulkDeletePerformanceFlags,
  getFlagAuditLogs,
  
  // Extension Requests
  getAllExtensionRequests,
  deleteExtensionRequest,
  bulkDeleteExtensionRequests,
  getExtensionAuditLogs
};
