const db = require('../db');

// Helper function to calculate project progress based on tasks
const calculateProjectProgress = async (projectId) => {
  try {
    
    const progressQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        AVG(progress) as avg_progress
      FROM tasks 
      WHERE project_id = ?
    `;
    
    const result = await db.query(progressQuery, [projectId]);
    
    if (result.length > 0 && result[0].total_tasks > 0) {
      const calculatedProgress = Math.round(result[0].avg_progress || 0);
      return calculatedProgress;
    }
    return 0; // No tasks or no progress
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0;
  }
};

// Helper function to calculate unique users assigned to project tasks
const calculateProjectUserCount = async (projectId) => {
  try {
    
    const userCountQuery = `
      SELECT COUNT(DISTINCT ta.assignee_id) as unique_users
      FROM task_assignees ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE t.project_id = ?
    `;
    
    const result = await db.query(userCountQuery, [projectId]);
    const userCount = result[0]?.unique_users || 0;
    return userCount;
  } catch (error) {
    console.error('Error calculating project user count:', error);
    return 0;
  }
};

// Team employees only see projects they belong to or have assigned tasks on
const TEAM_ASSIGNED_PROJECTS_FILTER = `
  AND p.id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.user_id = ? AND pm.user_type = 'team'
    UNION
    SELECT DISTINCT t.project_id FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    WHERE ta.assignee_id = ? AND ta.assignee_type = 'team'
  )
`;

const appendTeamMemberProjectScope = (req, query, queryParams) => {
  if (req.user?.type === 'team' && req.user.role !== 'project_manager') {
    query += TEAM_ASSIGNED_PROJECTS_FILTER;
    queryParams.push(req.user.id, req.user.id);
  }
  return query;
};

// Get all projects with filters
const getProjects = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 500, 
      sort = 'created_at', 
      order = 'desc', 
      search, 
      status, 
      category 
    } = req.query;

    const offset = (page - 1) * limit;
    // Test with simplest possible query first
    const testQuery = 'SELECT COUNT(*) as count FROM projects';
    try {
      const testResult = await db.query(testQuery);
    } catch (error) {
      console.error('❌ Projects table issue:', error.message);
      
      // Provide detailed error information for debugging
      let errorMessage = 'Failed to fetch projects';
      let errorCode = 'DATABASE_ERROR';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Database connection refused. MySQL server may not be running or is not accessible at the configured host/port.';
        errorCode = 'DB_CONNECTION_REFUSED';
      } else if (error.code === 'ER_NO_DB_ERROR') {
        errorMessage = 'Database does not exist. Please check the DB_NAME configuration.';
        errorCode = 'DB_NOT_FOUND';
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        errorMessage = 'Database access denied. Please check the DB_USER and DB_PASSWORD configuration.';
        errorCode = 'DB_ACCESS_DENIED';
      } else if (error.code === 'ER_NO_SUCH_TABLE') {
        errorMessage = 'Projects table does not exist in the database.';
        errorCode = 'TABLE_NOT_FOUND';
      }
      
      return res.status(500).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }

    // Build query with filters applied
    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.description as category_description
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const queryParams = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all' && status !== 'All') {
      query += ` AND p.status = ?`;
      queryParams.push(status);
    }

    if (category) {
      query += ` AND p.category_id = ?`;
      queryParams.push(category);
    }

    query = appendTeamMemberProjectScope(req, query, queryParams);

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['created_at', 'name', 'status', 'start_date', 'end_date', 'updated_at'];
    const safeSort = allowedSortColumns.includes(sort) ? sort : 'created_at';
    const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

    // Use string concatenation for LIMIT/OFFSET (MySQL doesn't support parameterized LIMIT)
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    query += ` ORDER BY p.${safeSort} ${safeOrder} LIMIT ${parsedLimit} OFFSET ${parsedOffset}`;

    // Execute query with filters
    const rows = await db.query(query, queryParams);
    
    // Calculate progress and user count for each project
    const projectsWithDetails = await Promise.all(rows.map(async (project) => {
      const [calculatedProgress, userCount] = await Promise.all([
        calculateProjectProgress(project.id),
        calculateProjectUserCount(project.id)
      ]);
      return {
        ...project,
        progress: calculatedProgress,
        userCount: userCount
      };
    }));

    // Get total count for pagination (with same filters)
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const countParams = [];

    if (search) {
      countQuery += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all' && status !== 'All') {
      countQuery += ` AND p.status = ?`;
      countParams.push(status);
    }

    if (category) {
      countQuery += ` AND p.category_id = ?`;
      countParams.push(category);
    }

    countQuery = appendTeamMemberProjectScope(req, countQuery, countParams);

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: projectsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch projects'
      }
    });
  }
};

// Get project by ID
const getProject = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.description as category_description
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `;

    const rows = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    const project = rows[0];
    
    // Calculate progress and user count for this project
    const [calculatedProgress, userCount] = await Promise.all([
      calculateProjectProgress(id),
      calculateProjectUserCount(id)
    ]);
    
    const projectWithDetails = {
      ...project,
      progress: calculatedProgress,
      userCount: userCount
    };

    res.json({
      success: true,
      data: projectWithDetails
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch project'
      }
    });
  }
};

// Create new project
const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      current_stage_id,
      start_date,
      end_date,
      status = 'planning',
      progress = 0,
      parent_id = null
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name is required'
        }
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Start date and end date are required'
        }
      });
    }

    const query = `
      INSERT INTO projects (
        name, description, category_id, current_stage_id, start_date, end_date, 
        status, progress, created_by, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure all parameters are defined and properly formatted
    const created_by = req.user?.id || 1; // Fallback to admin user ID 1
    
    // Format dates to MySQL DATE format (YYYY-MM-DD)
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // Extract YYYY-MM-DD part
    };
    
    const formattedStartDate = formatDate(start_date);
    const formattedEndDate = formatDate(end_date);
    
    const params = [
      name || null,
      description || null,
      category_id || null,
      current_stage_id || null,
      formattedStartDate,
      formattedEndDate,
      status || 'planning',
      progress || 0,
      created_by,
      parent_id || null
    ];

    // Use the fixed db.insert method
    const result = await db.insert(query, params);
    const insertId = result.insertId;


    // Get the created project
    const createdProject = await db.query(
      `SELECT 
        p.*,
        c.name as category_name,
        c.description as category_description
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?`,
      [insertId]
    );

    res.status(201).json({
      success: true,
      data: createdProject[0],
      message: 'Project created successfully'
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create project'
      }
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category_id,
      current_stage_id,
      start_date,
      end_date,
      status,
      progress,
      parent_id
    } = req.body;

    // Check if project exists
    const existing = await db.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    // Build dynamic query based on provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (category_id !== undefined) {
      updateFields.push('category_id = ?');
      updateValues.push(category_id);
    }
    if (current_stage_id !== undefined) {
      updateFields.push('current_stage_id = ?');
      updateValues.push(current_stage_id);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (progress !== undefined) {
      updateFields.push('progress = ?');
      updateValues.push(progress);
    }
    if (parent_id !== undefined) {
      updateFields.push('parent_id = ?');
      updateValues.push(parent_id);
    }
    
    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    const query = `
      UPDATE projects SET
        ${updateFields.join(', ')}
      WHERE id = ?
    `;

    // Add the project ID to the update values
    updateValues.push(id);

    await db.query(query, updateValues);

    // Get updated project
    const updatedProject = await db.query(
      `SELECT 
        p.*,
        c.name as category_name,
        c.description as category_description
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?`,
      [id]
    );

    // Recalculate progress based on tasks
    const calculatedProgress = await calculateProjectProgress(id);
    
    // Update the project with calculated progress
    const projectWithProgress = {
      ...updatedProject[0],
      progress: calculatedProgress
    };

    res.json({
      success: true,
      data: projectWithProgress,
      message: 'Project updated successfully'
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update project'
      }
    });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if project exists
    const existing = await db.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    // Delete project (this will cascade delete related records due to foreign key constraints)
    await db.query('DELETE FROM projects WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete project'
      }
    });
  }
};

// Get project members
const getProjectMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        pm.id as project_member_id,
        pm.project_id,
        pm.user_id,
        pm.user_type,
        pm.role,
        pm.created_at,
        tm.id as team_member_id,
        tm.name,
        tm.email,
        tm.is_active,
        GROUP_CONCAT(DISTINCT s.name) as skills
      FROM project_members pm
      JOIN team_members tm ON pm.user_id = tm.id AND pm.user_type = 'team' AND tm.is_active = true
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      WHERE pm.project_id = ?
      GROUP BY pm.id, tm.id
      ORDER BY pm.created_at DESC
    `;

    const rows = await db.query(query, [id]);

    // Convert skills from comma-separated string to array
    const members = rows.map(member => ({
      ...member,
      skills: member.skills ? member.skills.split(',') : []
    }));

    res.json({
      success: true,
      data: members
    });

  } catch (error) {
    console.error('Get project members error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch project members'
      }
    });
  }
};

// Get project teams
const getProjectTeams = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        pt.id as project_team_id,
        pt.team_id as id,
        pt.role,
        pt.start_date,
        pt.end_date,
        pt.hours_per_day,
        pt.created_at,
        pt.updated_at,
        t.name as team_name,
        t.description as team_description,
        t.max_capacity,
        COUNT(DISTINCT tmt.team_member_id) as member_count
      FROM project_teams pt
      JOIN teams t ON pt.team_id = t.id
      LEFT JOIN team_members_teams tmt ON t.id = tmt.team_id AND tmt.is_active = 1
      WHERE pt.project_id = ?
      GROUP BY pt.id, t.id
      ORDER BY pt.created_at DESC
    `;

    const rows = await db.query(query, [id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Get project teams error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch project teams'
      }
    });
  }
};

// Add member to project
const addProjectMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, team_id, role = 'member' } = req.body;

    if (!user_id && !team_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either user_id or team_id is required'
        }
      });
    }

    // Check if project exists
    const project = await db.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (project.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
    }

    // If team_id is provided, assign the entire team
    if (team_id) {
      // Check if team exists
      const team = await db.query('SELECT id FROM teams WHERE id = ?', [team_id]);
      if (team.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Team not found'
          }
        });
      }

      // Check if team is already assigned to project
      const existingTeam = await db.query(
        'SELECT id FROM project_teams WHERE project_id = ? AND team_id = ?',
        [id, team_id]
      );

      if (existingTeam.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Team is already assigned to this project'
          }
        });
      }

      // Add team to project
      await db.insert(
        'INSERT INTO project_teams (project_id, team_id, role, start_date) VALUES (?, ?, ?, CURDATE())',
        [id, team_id, role]
      );

      // Get all team members and add them to project_members
      const teamMembers = await db.query(`
        SELECT tm.id 
        FROM team_members tm
        JOIN team_members_teams tmt ON tm.id = tmt.team_member_id
        WHERE tmt.team_id = ? AND tmt.is_active = 1
      `, [team_id]);

      const addedMembers = [];
      for (const member of teamMembers) {
        // Check if member is already in project
        const existingMember = await db.query(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [id, member.id]
        );

        if (existingMember.length === 0) {
          // Add member to project
          await db.insert(
            'INSERT INTO project_members (project_id, user_id, user_type, role) VALUES (?, ?, ?, ?)',
            [id, member.id, 'team', role]
          );

          // Get member details
          const memberDetails = await db.query(`
            SELECT 
              pm.*,
              tm.name,
              tm.email,
              tm.is_active
            FROM project_members pm
            JOIN team_members tm ON pm.user_id = tm.id
            WHERE pm.project_id = ? AND pm.user_id = ?
          `, [id, member.id]);

          addedMembers.push(memberDetails[0]);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          team_id,
          added_members: addedMembers,
          total_members_added: addedMembers.length
        },
        message: `Team assigned to project successfully. ${addedMembers.length} members added.`
      });

      return;
    }

    // If user_id is provided, assign individual member
    if (user_id) {
      // Check if user exists
      const user = await db.query('SELECT id FROM team_members WHERE id = ?', [user_id]);
      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Team member not found'
          }
        });
      }

      // Check if member is already in project
      const existing = await db.query(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [id, user_id]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'User is already a member of this project'
          }
        });
      }

      // Add member to project
      const result = await db.insert(
        'INSERT INTO project_members (project_id, user_id, user_type, role) VALUES (?, ?, ?, ?)',
        [id, user_id, 'team', role]
      );

      // Get the created project member with user details
      const newMember = await db.query(`
        SELECT 
          pm.*,
          tm.name,
          tm.email,
          tm.is_active
        FROM project_members pm
        JOIN team_members tm ON pm.user_id = tm.id
        WHERE pm.id = ?
      `, [result.insertId]);

      res.status(201).json({
        success: true,
        data: newMember[0],
        message: 'Member added to project successfully'
      });
    }

  } catch (error) {
    console.error('Add project member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to add member to project'
      }
    });
  }
};

// Remove member from project
const removeProjectMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;

    // Check if membership exists (using project_members.id as primary key)
    const existing = await db.query(
      'SELECT id FROM project_members WHERE id = ? AND project_id = ?',
      [memberId, id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project membership not found'
        }
      });
    }

    // Remove member from project
    await db.query(
      'DELETE FROM project_members WHERE id = ? AND project_id = ?',
      [memberId, id]
    );

    res.json({
      success: true,
      message: 'Member removed from project successfully'
    });

  } catch (error) {
    console.error('Remove project member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to remove member from project'
      }
    });
  }
};

// Remove team from project
const removeProjectTeam = async (req, res) => {
  try {
    const { id, teamId } = req.params;

    // Check if team is assigned to project
    const existing = await db.query(
      'SELECT id FROM project_teams WHERE project_id = ? AND team_id = ?',
      [id, teamId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team is not assigned to this project'
        }
      });
    }

    // Remove all team members from project_members
    await db.query(
      'DELETE pm FROM project_members pm ' +
      'JOIN team_members_teams tmt ON pm.user_id = tmt.team_member_id ' +
      'WHERE tmt.team_id = ? AND pm.project_id = ?',
      [teamId, id]
    );

    // Remove team from project_teams
    await db.query(
      'DELETE FROM project_teams WHERE project_id = ? AND team_id = ?',
      [id, teamId]
    );

    res.json({
      success: true,
      message: 'Team removed from project successfully'
    });

  } catch (error) {
    console.error('Remove project team error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to remove team from project'
      }
    });
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  getProjectTeams,
  addProjectMember,
  removeProjectMember,
  removeProjectTeam
};
