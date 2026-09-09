const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const reworkService = require('../services/taskReworkService');

// Team member authentication
const authenticateTeamMember = async (req, res) => {
  try {
    const { email, passcode } = req.body;

    // Validate required fields
    if (!email || !passcode) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and passcode are required' }
      });
    }

    // Find team member by email
    const teamMembers = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills,
        GROUP_CONCAT(DISTINCT t.name) as team_names,
        GROUP_CONCAT(DISTINCT t.id) as team_ids
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams t ON tmt.team_id = t.id AND t.is_active = 1
      WHERE tm.email = ? AND tm.is_active = true
      GROUP BY tm.id
    `, [email]);

    if (teamMembers.length === 0) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or passcode' }
      });
    }

    const member = teamMembers[0];

    // Verify passcode
    if (member.passcode !== passcode) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or passcode' }
      });
    }

    // Format response data
    const userData = {
      ...member,
      skills: member.skills ? member.skills.split(',') : [],
      team_names: member.team_names ? member.team_names.split(',') : [],
      team_ids: member.team_ids ? member.team_ids.split(',').map(id => parseInt(id)) : []
    };

    // Update last login
    await db.query(
      'UPDATE team_members SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [member.id]
    );

    // Generate JWT token for team member
    const token = jwt.sign(
      { 
        id: member.id, 
        email: member.email, 
        name: member.name,
        type: 'team'
      },
      process.env.JWT_SECRET,
      { expiresIn: '10d' }
    );

    res.json({
      success: true,
      data: userData,
      token: token,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Authentication failed' }
    });
  }
};

// Get team member's own tasks
const getMyTasks = async (req, res) => {
  try {
    const teamMemberId = req.user.id;
    
    const tasks = await db.query(`
      SELECT 
        t.*,
        p.name as project_name,
        p.status as project_status,
        p.description as project_description,
        cs.name as stage_name,
        cs.description as stage_description,
        c.name as category_name,
        c.description as category_description,
        GROUP_CONCAT(DISTINCT sk.name) as required_skills,
        GROUP_CONCAT(DISTINCT g.name) as grade_name,
        GROUP_CONCAT(DISTINCT b.name) as book_name,
        GROUP_CONCAT(DISTINCT u.name) as unit_name,
        GROUP_CONCAT(DISTINCT l.name) as lesson_name,
        pf.type as performance_flag_type,
        pf.reason as performance_flag_reason
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN category_stages cs ON t.category_stage_id = cs.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN task_skills ts ON t.id = ts.task_id
      LEFT JOIN skills sk ON ts.skill_id = sk.id
      LEFT JOIN grades g ON t.grade_id = g.id
      LEFT JOIN books b ON t.book_id = b.id
      LEFT JOIN units u ON t.unit_id = u.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN performance_flags pf ON t.id = pf.task_id AND pf.team_member_id = ?
      WHERE ta.assignee_id = ? AND ta.assignee_type = 'team'
      GROUP BY t.id
      ORDER BY
        CASE
          WHEN COALESCE(t.rework_count, 0) >= 3 THEN 1
          WHEN COALESCE(t.rework_count, 0) = 2 THEN 2
          WHEN COALESCE(t.rework_count, 0) = 1 THEN 3
          WHEN t.end_date IS NOT NULL AND t.end_date < CURDATE() AND t.status NOT IN ('completed', 'skipped') THEN 4
          ELSE 5
        END,
        t.updated_at DESC
    `, [teamMemberId, teamMemberId]);

    // Process the tasks to format arrays and add computed fields
    const processedTasks = reworkService.attachReworkFieldsBatch(tasks.map(task => ({
      ...task,
      required_skills: task.required_skills ? task.required_skills.split(',') : [],
      grade_name: task.grade_name || null,
      book_name: task.book_name || null,
      unit_name: task.unit_name || null,
      lesson_name: task.lesson_name || null,
      // Add computed fields
      is_overdue: (() => {
        if (!task.end_date || task.status === 'completed') return false;
        
        // Get today's date at midnight (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get the end date at midnight (start of day)
        const dueDate = new Date(task.end_date);
        dueDate.setHours(0, 0, 0, 0);
        
        // Task is overdue if due date is before today
        return dueDate < today;
      })(),
      days_until_due: task.end_date ? Math.ceil((new Date(task.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
      priority_color: task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'orange' : task.priority === 'medium' ? 'blue' : 'gray',
      status_color: task.status === 'completed' ? 'green' : task.status === 'in-progress' ? 'blue' : task.status === 'under-review' ? 'yellow' : task.status === 'blocked' ? 'red' : task.status === 'on-hold' ? 'gray' : 'gray'
    })));

    res.json({
      success: true,
      data: processedTasks
    });
  } catch (error) {
    console.error('Error fetching team member tasks:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch tasks' }
    });
  }
};

// Get team member's own profile
const getMyProfile = async (req, res) => {
  try {
    const teamMemberId = req.user.id;
    
    const teamMembers = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills,
        GROUP_CONCAT(DISTINCT t.name) as team_names,
        GROUP_CONCAT(DISTINCT t.id) as team_ids,
        GROUP_CONCAT(DISTINCT pf.type) as performance_flags,
        GROUP_CONCAT(DISTINCT pf.reason) as flag_reasons,
        COUNT(DISTINCT ta.task_id) as total_assigned_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN ta.task_id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN ta.task_id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'under-review' THEN ta.task_id END) as under_review_tasks
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams t ON tmt.team_id = t.id AND t.is_active = 1
      LEFT JOIN performance_flags pf ON tm.id = pf.team_member_id
      LEFT JOIN task_assignees ta ON tm.id = ta.assignee_id AND ta.assignee_type = 'team'
      LEFT JOIN tasks t ON ta.task_id = t.id
      WHERE tm.id = ? AND tm.is_active = true
      GROUP BY tm.id
    `, [teamMemberId]);

    if (teamMembers.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    const member = teamMembers[0];
    member.skills = member.skills ? member.skills.split(',') : [];
    member.team_names = member.team_names ? member.team_names.split(',') : [];
    member.team_ids = member.team_ids ? member.team_ids.split(',').map(id => parseInt(id)) : [];
    member.performance_flags = member.performance_flags ? member.performance_flags.split(',') : [];
    member.flag_reasons = member.flag_reasons ? member.flag_reasons.split(',') : [];
    
    // Calculate completion rate
    member.completion_rate = member.total_assigned_tasks > 0 
      ? Math.round((member.completed_tasks / member.total_assigned_tasks) * 100) 
      : 0;

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching team member profile:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch profile' }
    });
  }
};

// Get team member's performance flags
const getMyPerformanceFlags = async (req, res) => {
  try {
    const teamMemberId = req.user.id;
    
    const query = `
      SELECT 
        pf.*,
        t.name as task_name,
        t.description as task_description,
        t.status as task_status,
        t.progress as task_progress,
        t.end_date as task_due_date,
        p.name as project_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.team_member_id = ?
      ORDER BY pf.created_at DESC
    `;

    const flags = await db.query(query, [teamMemberId]);

    // Group flags by type for summary
    const summary = {
      total: flags.length,
      red: flags.filter(f => f.type === 'red').length,
      orange: flags.filter(f => f.type === 'orange').length,
      yellow: flags.filter(f => f.type === 'yellow').length,
      green: flags.filter(f => f.type === 'green').length
    };

    res.json({
      success: true,
      data: {
        flags,
        summary
      }
    });
  } catch (error) {
    console.error('Error fetching team member performance flags:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch performance flags' }
    });
  }
};

// Get all teams
const getTeams = async (req, res) => {
  try {
    const query = `
      SELECT id, name, description, is_active
      FROM teams 
      WHERE is_active = true
      ORDER BY name
    `;
    
    const teams = await db.query(query);
    
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch teams' }
    });
  }
};

// Get team members with performance flags for ranking
const getTeamMembersWithPerformanceFlags = async (req, res) => {
  try {
    const { teamId } = req.query;
    
    // Build WHERE clause for team filtering
    let teamFilter = '';
    if (teamId) {
      teamFilter = 'AND team.id = ?';
    }
    
    const teamMembers = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills,
        GROUP_CONCAT(DISTINCT team.name) as team_names,
        GROUP_CONCAT(DISTINCT team.id) as team_ids,
        COUNT(DISTINCT CASE WHEN pf.type = 'green' THEN pf.id END) as green_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'yellow' THEN pf.id END) as yellow_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'orange' THEN pf.id END) as orange_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'red' THEN pf.id END) as red_flags,
        COUNT(DISTINCT pf.id) as total_flags,
        COUNT(DISTINCT ta.task_id) as total_assigned_tasks,
        COUNT(DISTINCT CASE WHEN task.status = 'completed' THEN ta.task_id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN task.status = 'in-progress' THEN ta.task_id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN task.status = 'under-review' THEN ta.task_id END) as under_review_tasks
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams team ON tmt.team_id = team.id AND team.is_active = 1
      LEFT JOIN performance_flags pf ON tm.id = pf.team_member_id
      LEFT JOIN task_assignees ta ON tm.id = ta.assignee_id AND ta.assignee_type = 'team'
      LEFT JOIN tasks task ON ta.task_id = task.id
      WHERE tm.is_active = 1 ${teamFilter}
      GROUP BY tm.id
      ORDER BY 
        (COUNT(DISTINCT CASE WHEN pf.type = 'green' THEN pf.id END) * 4 + 
         COUNT(DISTINCT CASE WHEN pf.type = 'yellow' THEN pf.id END) * 2 + 
         COUNT(DISTINCT CASE WHEN pf.type = 'orange' THEN pf.id END) * 1 - 
         COUNT(DISTINCT CASE WHEN pf.type = 'red' THEN pf.id END) * 3) DESC,
        COUNT(DISTINCT CASE WHEN pf.type = 'green' THEN pf.id END) DESC,
        COUNT(DISTINCT CASE WHEN pf.type = 'yellow' THEN pf.id END) DESC,
        COUNT(DISTINCT CASE WHEN pf.type = 'orange' THEN pf.id END) DESC,
        COUNT(DISTINCT CASE WHEN pf.type = 'red' THEN pf.id END) ASC
    `, teamId ? [teamId] : []);

    // Process the results
    const processedMembers = teamMembers
      .filter((member) => member.is_active === 1 || member.is_active === true)
      .map(member => {
      member.skills = member.skills ? member.skills.split(',') : [];
      member.team_names = member.team_names ? member.team_names.split(',') : [];
      member.team_ids = member.team_ids ? member.team_ids.split(',').map(id => parseInt(id)) : [];
      
      // Calculate completion rate
      member.completion_rate = member.total_assigned_tasks > 0 
        ? Math.round((member.completed_tasks / member.total_assigned_tasks) * 100) 
        : 0;

      return member;
    });


    res.json({
      success: true,
      data: processedMembers
    });

  } catch (error) {
    console.error('❌ Error fetching team members with performance flags:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team members with performance flags' }
    });
  }
};

// Get performance flags for a specific team member (admin only)
const getTeamMemberFlags = async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const flags = await db.query(`
      SELECT 
        pf.*,
        t.name as task_name,
        t.description as task_description,
        t.status as task_status,
        t.progress as task_progress,
        t.end_date as task_due_date,
        p.name as project_name,
        au.name as added_by_name
      FROM performance_flags pf
      LEFT JOIN tasks t ON pf.task_id = t.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN admin_users au ON pf.added_by_id = au.id
      WHERE pf.team_member_id = ?
      ORDER BY pf.created_at DESC
    `, [memberId]);


    res.json({
      success: true,
      data: {
        flags: flags,
        summary: {
          total: flags.length,
          green: flags.filter(f => f.type === 'green').length,
          yellow: flags.filter(f => f.type === 'yellow').length,
          orange: flags.filter(f => f.type === 'orange').length,
          red: flags.filter(f => f.type === 'red').length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching team member flags:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team member performance flags' }
    });
  }
};

// Remove a performance flag (admin only)
const removePerformanceFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    
    // Check if flag exists
    const existingFlag = await db.query('SELECT * FROM performance_flags WHERE id = ?', [flagId]);
    if (existingFlag.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Performance flag not found' }
      });
    }

    // Remove the flag
    await db.query('DELETE FROM performance_flags WHERE id = ?', [flagId]);


    res.json({
      success: true,
      message: 'Performance flag removed successfully'
    });

  } catch (error) {
    console.error('❌ Error removing performance flag:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove performance flag' }
    });
  }
};

// Get all team members (existing functionality)
const getAllTeamMembers = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    const teamMembers = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills,
        COUNT(DISTINCT pf.id) as performance_flags_count,
        COUNT(DISTINCT CASE WHEN pf.type = 'red' THEN pf.id END) as red_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'orange' THEN pf.id END) as orange_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'yellow' THEN pf.id END) as yellow_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'green' THEN pf.id END) as green_flags,
        COUNT(DISTINCT ta.task_id) as task_count,
        GROUP_CONCAT(DISTINCT t.name) as team_names,
        GROUP_CONCAT(DISTINCT t.id) as team_ids,
        (
          SELECT COUNT(DISTINCT p2.id)
          FROM projects p2
          INNER JOIN tasks t2 ON t2.project_id = p2.id
          INNER JOIN task_assignees ta2 ON ta2.task_id = t2.id
            AND ta2.assignee_id = tm.id AND ta2.assignee_type = 'team'
          WHERE p2.status IN ('active', 'planning', 'on-hold')
            AND NOT (p2.end_date IS NOT NULL AND p2.end_date < CURDATE()
                     AND p2.status NOT IN ('completed', 'cancelled'))
        ) as active_project_count,
        (
          SELECT GROUP_CONCAT(DISTINCT p2.name ORDER BY p2.name SEPARATOR '||')
          FROM projects p2
          INNER JOIN tasks t2 ON t2.project_id = p2.id
          INNER JOIN task_assignees ta2 ON ta2.task_id = t2.id
            AND ta2.assignee_id = tm.id AND ta2.assignee_type = 'team'
          WHERE p2.status IN ('active', 'planning', 'on-hold')
            AND NOT (p2.end_date IS NOT NULL AND p2.end_date < CURDATE()
                     AND p2.status NOT IN ('completed', 'cancelled'))
        ) as active_project_names
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN performance_flags pf ON tm.id = pf.team_member_id
      LEFT JOIN task_assignees ta ON tm.id = ta.assignee_id AND ta.assignee_type = 'team'
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams t ON tmt.team_id = t.id AND t.is_active = 1
      ${includeInactive ? '' : 'WHERE tm.is_active = true'}
      GROUP BY tm.id
      ORDER BY tm.name
    `);


    // Parse skills string into array and add team information
    const formattedTeamMembers = teamMembers.map(member => {
      const formattedMember = {
        ...member,
        skills: member.skills ? member.skills.split(',') : [],
        team_names: member.team_names ? member.team_names.split(',') : [],
        team_ids: member.team_ids ? member.team_ids.split(',').map(id => parseInt(id)) : [],
        performance_flags_summary: {
          red: parseInt(member.red_flags) || 0,
          orange: parseInt(member.orange_flags) || 0,
          yellow: parseInt(member.yellow_flags) || 0,
          green: parseInt(member.green_flags) || 0
        },
        task_count: parseInt(member.task_count) || 0,
        active_project_count: parseInt(member.active_project_count) || 0,
        active_project_names: member.active_project_names
          ? member.active_project_names.split('||').filter(Boolean)
          : []
      };
      
      return formattedMember;
    });

    res.json({
      success: true,
      data: formattedTeamMembers
    });
  } catch (error) {
    console.error('❌ Error fetching team members:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team members' }
    });
  }
};

// Get team member by ID
const getTeamMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const teamMembers = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills,
        GROUP_CONCAT(DISTINCT pf.type) as performance_flags,
        GROUP_CONCAT(DISTINCT t.name) as team_names,
        GROUP_CONCAT(DISTINCT t.id) as team_ids
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN performance_flags pf ON tm.id = pf.team_member_id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams t ON tmt.team_id = t.id AND t.is_active = 1
      WHERE tm.id = ? AND tm.is_active = true
      GROUP BY tm.id
    `, [id]);

    if (teamMembers.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    const member = teamMembers[0];
    member.skills = member.skills ? member.skills.split(',') : [];
    member.performance_flags = member.performance_flags ? member.performance_flags.split(',') : [];
    member.team_names = member.team_names ? member.team_names.split(',') : [];
    member.team_ids = member.team_ids ? member.team_ids.split(',').map(id => parseInt(id)) : [];

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team member' }
    });
  }
};

// Create team member
const createTeamMember = async (req, res) => {
  try {
    const { name, email, passcode, skills, team_id } = req.body;

    // Validate required fields
    if (!name || !email || !passcode) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name, email, and passcode are required' }
      });
    }

    // Check if email already exists for active team members
    const existingMembers = await db.query(
      'SELECT id FROM team_members WHERE email = ? AND is_active = true',
      [email]
    );

    if (existingMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email already exists' }
      });
    }

    // Insert team member
    const result = await db.insert(
      'INSERT INTO team_members (name, email, passcode) VALUES (?, ?, ?)',
      [name, email, passcode]
    );

    const teamMemberId = result.insertId;

    // Add skills if provided
    if (skills && Array.isArray(skills) && skills.length > 0) {
      for (const skillName of skills) {
        // Get or create skill
        let skillResult = await db.query(
          'SELECT id FROM skills WHERE name = ?',
          [skillName]
        );

        let skillId;
        if (skillResult.length === 0) {
          // Create new skill
          const newSkillResult = await db.insert(
            'INSERT INTO skills (name, description) VALUES (?, ?)',
            [skillName, `Skill for ${skillName}`]
          );
          skillId = newSkillResult.insertId;
        } else {
          skillId = skillResult[0].id;
        }

        // Add skill to team member
        await db.execute(
          'INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (?, ?)',
          [teamMemberId, skillId]
        );
      }
    }

    // Add to team if team_id is provided
    if (team_id) {
      await db.execute(
        'INSERT INTO team_members_teams (team_id, team_member_id, role, joined_date) VALUES (?, ?, ?, NOW())',
        [team_id, teamMemberId, 'member']
      );
    }

    // Get created team member with skills
    const createdMember = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      WHERE tm.id = ?
      GROUP BY tm.id
    `, [teamMemberId]);

    const member = createdMember[0];
    member.skills = member.skills ? member.skills.split(',') : [];

    res.status(201).json({
      success: true,
      data: member,
      message: 'Team member created successfully'
    });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create team member' }
    });
  }
};

// Update team member
const updateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, passcode, skills, is_active, team_id } = req.body;

    // Check if team member exists
    const existingMember = await db.query(
      'SELECT id FROM team_members WHERE id = ?',
      [id]
    );

    if (existingMember.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    // Update basic info
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (email !== undefined) {
      // Check if email already exists for other active team members
      const existingEmailCheck = await db.query(
        'SELECT id FROM team_members WHERE email = ? AND is_active = true AND id != ?',
        [email, id]
      );

      if (existingEmailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Email already exists' }
        });
      }

      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (passcode !== undefined) {
      updateFields.push('passcode = ?');
      updateValues.push(passcode);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await db.execute(
        `UPDATE team_members SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Update skills if provided
    if (skills !== undefined) {
      // Remove existing skills
      await db.execute(
        'DELETE FROM team_member_skills WHERE team_member_id = ?',
        [id]
      );

      // Add new skills
      if (Array.isArray(skills) && skills.length > 0) {
        for (const skillName of skills) {
          // Get or create skill
          let skillResult = await db.query(
            'SELECT id FROM skills WHERE name = ?',
            [skillName]
          );

          let skillId;
          if (skillResult.length === 0) {
            // Create new skill
            const newSkillResult = await db.insert(
              'INSERT INTO skills (name, description) VALUES (?, ?)',
              [skillName, `Skill for ${skillName}`]
            );
            skillId = newSkillResult.insertId;
          } else {
            skillId = skillResult[0].id;
          }

          // Add skill to team member
          await db.execute(
            'INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (?, ?)',
            [id, skillId]
          );
        }
      }
    }

    // Update team assignment if provided
    if (team_id !== undefined) {
      // Remove existing team assignments
      await db.execute(
        'DELETE FROM team_members_teams WHERE team_member_id = ?',
        [id]
      );

      // Add new team assignment if team_id is provided
      if (team_id) {
        await db.execute(
          'INSERT INTO team_members_teams (team_id, team_member_id, role, joined_date) VALUES (?, ?, ?, NOW())',
          [team_id, id, 'member']
        );
      }
    }

    // Get updated team member
    const updatedMember = await db.query(`
      SELECT 
        tm.*,
        GROUP_CONCAT(DISTINCT s.name) as skills
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      WHERE tm.id = ?
      GROUP BY tm.id
    `, [id]);

    const member = updatedMember[0];
    member.skills = member.skills ? member.skills.split(',') : [];

    res.json({
      success: true,
      data: member,
      message: 'Team member updated successfully'
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update team member' }
    });
  }
};

// Delete team member
const deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if team member exists
    const existingMember = await db.query(
      'SELECT id FROM team_members WHERE id = ?',
      [id]
    );

    if (existingMember.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    // Generate random email to avoid conflicts when recreating team members
    const randomEmail = `deleted_${Date.now()}_${Math.random().toString(36).substring(2, 15)}@deleted.com`;

    // Soft delete by setting is_active to false and changing email to random string
    await db.execute(
      'UPDATE team_members SET is_active = false, email = ? WHERE id = ?',
      [randomEmail, id]
    );

    res.json({
      success: true,
      message: 'Team member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete team member' }
    });
  }
};

// Toggle team member active status
const toggleTeamMemberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Check if team member exists
    const existingMember = await db.query(
      'SELECT id, is_active FROM team_members WHERE id = ?',
      [id]
    );

    if (existingMember.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    // Update is_active status
    await db.execute(
      'UPDATE team_members SET is_active = ? WHERE id = ?',
      [is_active, id]
    );

    res.json({
      success: true,
      message: `Team member ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling team member status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to toggle team member status' }
    });
  }
};

// Bulk update team members status
const bulkUpdateTeamMembersStatus = async (req, res) => {
  try {
    const { member_ids, is_active } = req.body;

    // Validate input
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'member_ids must be a non-empty array' }
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'is_active must be a boolean value' }
      });
    }

    // Update all specified team members
    const placeholders = member_ids.map(() => '?').join(',');
    await db.execute(
      `UPDATE team_members SET is_active = ? WHERE id IN (${placeholders})`,
      [is_active, ...member_ids]
    );

    res.json({
      success: true,
      message: `${member_ids.length} team member(s) ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: {
        updated_count: member_ids.length
      }
    });
  } catch (error) {
    console.error('Error bulk updating team members status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to bulk update team members status' }
    });
  }
};

// =====================================================
// TEAM MANAGEMENT FUNCTIONS (NEW)
// =====================================================

// Get all teams
const getAllTeams = async (req, res) => {
  try {
    const teams = await db.query(`
      SELECT 
        t.*,
        fu.name as functional_unit_name,
        CONCAT(tm.name, ' (', t.team_lead_type, ')') as team_lead_name,
        COUNT(DISTINCT tmt.team_member_id) as member_count,
        GROUP_CONCAT(DISTINCT s.name) as skills
      FROM teams t
      LEFT JOIN functional_units fu ON t.functional_unit_id = fu.id
      LEFT JOIN team_members tm ON t.team_lead_id = tm.id AND t.team_lead_type = 'team'
      LEFT JOIN admin_users au ON t.team_lead_id = au.id AND t.team_lead_type = 'admin'
      LEFT JOIN team_members_teams tmt ON t.id = tmt.team_id AND tmt.is_active = true
      LEFT JOIN team_skills ts ON t.id = ts.team_id
      LEFT JOIN skills s ON ts.skill_id = s.id
      WHERE t.is_active = true
      GROUP BY t.id
      ORDER BY t.name
    `);

    // Parse skills string into array
    const formattedTeams = teams.map(team => ({
      ...team,
      skills: team.skills ? team.skills.split(',') : [],
      team_lead_name: team.team_lead_name || 'Unassigned'
    }));

    res.json({
      success: true,
      data: formattedTeams
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch teams' }
    });
  }
};

// Get team by ID with members
const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get team details
    const teams = await db.query(`
      SELECT 
        t.*,
        fu.name as functional_unit_name,
        CONCAT(tm.name, ' (', t.team_lead_type, ')') as team_lead_name
      FROM teams t
      LEFT JOIN functional_units fu ON t.functional_unit_id = fu.id
      LEFT JOIN team_members tm ON t.team_lead_id = tm.id AND t.team_lead_type = 'team'
      LEFT JOIN admin_users au ON t.team_lead_id = au.id AND t.team_lead_type = 'admin'
      WHERE t.id = ? AND t.is_active = true
    `, [id]);

    if (teams.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found' }
      });
    }

    const team = teams[0];
    team.team_lead_name = team.team_lead_name || 'Unassigned';

    // Get team members
    const members = await db.query(`
      SELECT 
        tm.*,
        tmt.role as team_role,
        tmt.joined_date,
        GROUP_CONCAT(DISTINCT s.name) as skills
      FROM team_members_teams tmt
      JOIN team_members tm ON tmt.team_member_id = tm.id
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      WHERE tmt.team_id = ? AND tmt.is_active = true AND tm.is_active = true
      GROUP BY tm.id
      ORDER BY tmt.role DESC, tm.name
    `, [id]);

    // Get team skills
    const skills = await db.query(`
      SELECT 
        s.name,
        ts.proficiency_level
      FROM team_skills ts
      JOIN skills s ON ts.skill_id = s.id
      WHERE ts.team_id = ?
      ORDER BY ts.proficiency_level DESC, s.name
    `, [id]);

    // Format members
    const formattedMembers = members.map(member => ({
      ...member,
      skills: member.skills ? member.skills.split(',') : []
    }));

    res.json({
      success: true,
      data: {
        ...team,
        members: formattedMembers,
        skills: skills
      }
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team' }
    });
  }
};

// Create team
const createTeam = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      functional_unit_id, 
      team_lead_id, 
      team_lead_type, 
      max_capacity,
      skills,
      members 
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Team name is required' }
      });
    }



    // Check if team name already exists
    const existingTeams = await db.query(
      'SELECT id FROM teams WHERE name = ? AND is_active = true',
      [name]
    );

    if (existingTeams.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Team name already exists' }
      });
    }

    // Insert team
    const result = await db.insert(
      `INSERT INTO teams (name, description, functional_unit_id, team_lead_id, team_lead_type, max_capacity) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, functional_unit_id, team_lead_id, team_lead_type, max_capacity || 10]
    );

    const teamId = result.insertId;

    // Add skills if provided
    if (skills && Array.isArray(skills) && skills.length > 0) {
      for (const skillData of skills) {
        const skillName = typeof skillData === 'string' ? skillData : skillData.name;
        const proficiencyLevel = skillData.proficiency_level || 'intermediate';

        // Get or create skill
        let skillResult = await db.query(
          'SELECT id FROM skills WHERE name = ?',
          [skillName]
        );

        let skillId;
        if (skillResult.length === 0) {
          // Create new skill
          const newSkillResult = await db.insert(
            'INSERT INTO skills (name, description) VALUES (?, ?)',
            [skillName, `Skill for ${skillName}`]
          );
          skillId = newSkillResult.insertId;
        } else {
          skillId = skillResult[0].id;
        }

        // Add skill to team
        await db.execute(
          'INSERT INTO team_skills (team_id, skill_id, proficiency_level) VALUES (?, ?, ?)',
          [teamId, skillId, proficiencyLevel]
        );
      }
    }

    // Add members if provided
    if (members && Array.isArray(members) && members.length > 0) {
      for (const memberData of members) {
        const memberId = memberData.member_id || memberData.id;
        const role = memberData.role || 'member';
        const joinedDate = memberData.joined_date || new Date().toISOString().split('T')[0];

        await db.execute(
          'INSERT INTO team_members_teams (team_id, team_member_id, role, joined_date) VALUES (?, ?, ?, ?)',
          [teamId, memberId, role, joinedDate]
        );
      }
    }

    // Get created team
    const createdTeam = await db.query(`
      SELECT 
        t.*,
        fu.name as functional_unit_name,
        CONCAT(tm.name, ' (', t.team_lead_type, ')') as team_lead_name
      FROM teams t
      LEFT JOIN functional_units fu ON t.functional_unit_id = fu.id
      LEFT JOIN team_members tm ON t.team_lead_id = tm.id AND t.team_lead_type = 'team'
      LEFT JOIN admin_users au ON t.team_lead_id = au.id AND t.team_lead_type = 'admin'
      WHERE t.id = ?
    `, [teamId]);

    const team = createdTeam[0];
    team.team_lead_name = team.team_lead_name || 'Unassigned';

    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully'
    });
  } catch (error) {
    console.error('Error creating team:', error);
    console.error('Request body:', req.body);
    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to create team',
        details: error.message 
      }
    });
  }
};

// Update team
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      functional_unit_id, 
      team_lead_id, 
      team_lead_type, 
      max_capacity,
      is_active 
    } = req.body;

    // Check if team exists
    const existingTeam = await db.query(
      'SELECT id FROM teams WHERE id = ?',
      [id]
    );

    if (existingTeam.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found' }
      });
    }

    // Update team
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
    if (functional_unit_id !== undefined) {
      updateFields.push('functional_unit_id = ?');
      updateValues.push(functional_unit_id);
    }
    if (team_lead_id !== undefined) {
      updateFields.push('team_lead_id = ?');
      updateValues.push(team_lead_id);
    }
    if (team_lead_type !== undefined) {
      updateFields.push('team_lead_type = ?');
      updateValues.push(team_lead_type);
    }
    if (max_capacity !== undefined) {
      updateFields.push('max_capacity = ?');
      updateValues.push(max_capacity);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await db.execute(
        `UPDATE teams SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Get updated team
    const updatedTeam = await db.query(`
      SELECT 
        t.*,
        fu.name as functional_unit_name,
        CONCAT(tm.name, ' (', t.team_lead_type, ')') as team_lead_name
      FROM teams t
      LEFT JOIN functional_units fu ON t.functional_unit_id = fu.id
      LEFT JOIN team_members tm ON t.team_lead_id = tm.id AND t.team_lead_type = 'team'
      LEFT JOIN admin_users au ON t.team_lead_id = au.id AND t.team_lead_type = 'admin'
      WHERE t.id = ?
    `, [id]);

    const team = updatedTeam[0];
    team.team_lead_name = team.team_lead_name || 'Unassigned';

    res.json({
      success: true,
      data: team,
      message: 'Team updated successfully'
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update team' }
    });
  }
};

// Delete team
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if team exists
    const existingTeam = await db.query(
      'SELECT id FROM teams WHERE id = ?',
      [id]
    );

    if (existingTeam.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found' }
      });
    }

    // Soft delete by setting is_active to false
    await db.execute(
      'UPDATE teams SET is_active = false WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete team' }
    });
  }
};

// Add member to team
const addMemberToTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { member_id, role, joined_date } = req.body;

    // Validate required fields
    if (!member_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Member ID is required' }
      });
    }

    // Check if team exists
    const existingTeam = await db.query(
      'SELECT id FROM teams WHERE id = ? AND is_active = true',
      [teamId]
    );

    if (existingTeam.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found' }
      });
    }

    // Check if member exists
    const existingMember = await db.query(
      'SELECT id FROM team_members WHERE id = ? AND is_active = true',
      [member_id]
    );

    if (existingMember.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    // Check if member is already in team (only active assignments)
    const existingAssignment = await db.query(
      'SELECT id FROM team_members_teams WHERE team_id = ? AND team_member_id = ? AND is_active = true',
      [teamId, member_id]
    );

    if (existingAssignment.length > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Member is already in this team' }
      });
    }

    // Check if member was previously in this team (inactive assignment)
    const inactiveAssignment = await db.query(
      'SELECT id FROM team_members_teams WHERE team_id = ? AND team_member_id = ? AND is_active = false',
      [teamId, member_id]
    );

    if (inactiveAssignment.length > 0) {
      // Reactivate the existing assignment
      await db.execute(
        'UPDATE team_members_teams SET is_active = true, role = ?, joined_date = ? WHERE team_id = ? AND team_member_id = ?',
        [role || 'member', joined_date || new Date().toISOString().split('T')[0], teamId, member_id]
      );
    } else {
      // Add new member to team
      await db.execute(
        'INSERT INTO team_members_teams (team_id, team_member_id, role, joined_date) VALUES (?, ?, ?, ?)',
        [teamId, member_id, role || 'member', joined_date || new Date().toISOString().split('T')[0]]
      );
    }

    res.json({
      success: true,
      message: 'Member added to team successfully'
    });
  } catch (error) {
    console.error('Error adding member to team:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to add member to team' }
    });
  }
};

// Remove member from team
const removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    // Check if assignment exists
    const existingAssignment = await db.query(
      'SELECT id FROM team_members_teams WHERE team_id = ? AND team_member_id = ?',
      [teamId, memberId]
    );

    if (existingAssignment.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Member is not in this team' }
      });
    }

    // Remove member from team (soft delete)
    await db.execute(
      'UPDATE team_members_teams SET is_active = false WHERE team_id = ? AND team_member_id = ?',
      [teamId, memberId]
    );

    res.json({
      success: true,
      message: 'Member removed from team successfully'
    });
  } catch (error) {
    console.error('Error removing member from team:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove member from team' }
    });
  }
};

// Debug endpoint to test task counts and performance flags
const debugTeamMemberData = async (req, res) => {
  try {
    
    // Test task counts
    const taskCounts = await db.query(`
      SELECT 
        tm.id,
        tm.name,
        COUNT(DISTINCT ta.task_id) as task_count
      FROM team_members tm
      LEFT JOIN task_assignees ta ON tm.id = ta.assignee_id AND ta.assignee_type = 'team'
      WHERE tm.is_active = true
      GROUP BY tm.id, tm.name
      ORDER BY tm.name
    `);
    
    // Test performance flags
    const flagCounts = await db.query(`
      SELECT 
        tm.id,
        tm.name,
        COUNT(DISTINCT pf.id) as flag_count,
        COUNT(DISTINCT CASE WHEN pf.type = 'red' THEN pf.id END) as red_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'orange' THEN pf.id END) as orange_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'yellow' THEN pf.id END) as yellow_flags,
        COUNT(DISTINCT CASE WHEN pf.type = 'green' THEN pf.id END) as green_flags
      FROM team_members tm
      LEFT JOIN performance_flags pf ON tm.id = pf.team_member_id
      WHERE tm.is_active = true
      GROUP BY tm.id, tm.name
      ORDER BY tm.name
    `);
    
    // Test task_assignees table
    const taskAssignees = await db.query(`
      SELECT 
        ta.*,
        tm.name as team_member_name,
        t.name as task_name
      FROM task_assignees ta
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN tasks t ON ta.task_id = t.id
      WHERE ta.assignee_type = 'team'
      ORDER BY tm.name, t.name
    `);
    
    res.json({
      success: true,
      data: {
        taskCounts,
        flagCounts,
        taskAssignees,
        summary: {
          totalTeamMembers: taskCounts.length,
          totalTaskAssignments: taskAssignees.length,
          totalFlags: flagCounts.reduce((sum, member) => sum + member.flag_count, 0)
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Debug failed' }
    });
  }
};

// Create sample data for testing
const createSampleData = async (req, res) => {
  try {
    
    // Get some team members
    const teamMembers = await db.query('SELECT id, name FROM team_members WHERE is_active = true LIMIT 5');
    
    if (teamMembers.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No team members found. Please create team members first.' }
      });
    }
    
    // Get some tasks
    const tasks = await db.query('SELECT id, name FROM tasks LIMIT 10');
    
    if (tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No tasks found. Please create tasks first.' }
      });
    }
    
    let createdAssignments = 0;
    let createdFlags = 0;
    
    // Create some task assignments
    for (let i = 0; i < Math.min(teamMembers.length, 3); i++) {
      const member = teamMembers[i];
      const task = tasks[i % tasks.length];
      
      // Check if assignment already exists
      const existingAssignment = await db.query(
        'SELECT id FROM task_assignees WHERE task_id = ? AND assignee_id = ? AND assignee_type = "team"',
        [task.id, member.id]
      );
      
      if (existingAssignment.length === 0) {
        await db.insert(
          'INSERT INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)',
          [task.id, member.id, 'team']
        );
        createdAssignments++;
      }
    }
    
    // Create some performance flags
    const flagTypes = ['red', 'orange', 'yellow', 'green'];
    const flagReasons = [
      'Missed deadline',
      'Excellent work quality',
      'Needs improvement',
      'Outstanding performance',
      'Requires additional training'
    ];
    
    for (let i = 0; i < Math.min(teamMembers.length, 2); i++) {
      const member = teamMembers[i];
      const flagType = flagTypes[i % flagTypes.length];
      const reason = flagReasons[i % flagReasons.length];
      
      await db.insert(
        'INSERT INTO performance_flags (team_member_id, type, reason, added_by, added_by_id) VALUES (?, ?, ?, ?, ?)',
        [member.id, flagType, reason, 'System', 1]
      );
      createdFlags++;
    }
    
    res.json({
      success: true,
      data: {
        message: 'Sample data created successfully',
        createdAssignments,
        createdFlags,
        teamMembers: teamMembers.length,
        tasks: tasks.length
      }
    });
  } catch (error) {
    console.error('❌ Create sample data error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create sample data' }
    });
  }
};

// Get projects for a specific team member grouped by status (active, completed, overdue)
const getTeamMemberProjects = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify member exists
    const memberRows = await db.query(
      'SELECT id, name FROM team_members WHERE id = ? AND is_active = true',
      [id]
    );
    if (memberRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team member not found' }
      });
    }

    // Fetch all projects the member is involved in (via task assignments or project membership)
    const projectRows = await db.query(`
      SELECT DISTINCT
        p.id,
        p.name,
        p.status,
        p.start_date,
        p.end_date,
        ROUND(COALESCE(AVG(t_all.progress), 0), 1) AS progress,
        COUNT(DISTINCT t_member.id) AS member_task_count,
        SUM(t_member.status = 'completed') AS completed_member_tasks,
        SUM(t_member.status NOT IN ('completed', 'skipped')) AS active_member_tasks,
        SUM(
          t_member.end_date < CURDATE() AND t_member.status NOT IN ('completed', 'skipped')
        ) AS overdue_member_tasks
      FROM projects p
      LEFT JOIN tasks t_all ON t_all.project_id = p.id
      INNER JOIN tasks t_member ON t_member.project_id = p.id
      INNER JOIN task_assignees ta ON ta.task_id = t_member.id
        AND ta.assignee_id = ? AND ta.assignee_type = 'team'
      GROUP BY p.id, p.name, p.status, p.start_date, p.end_date
      ORDER BY
        CASE p.status WHEN 'active' THEN 1 WHEN 'planning' THEN 2 WHEN 'on-hold' THEN 3 WHEN 'completed' THEN 4 ELSE 5 END,
        p.name ASC
    `, [id]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeProjects = [];
    const completedProjects = [];
    const overdueProjects = [];

    projectRows.forEach((p) => {
      const endDate = p.end_date ? new Date(p.end_date) : null;
      const isOverdue = endDate && endDate < today && !['completed', 'cancelled'].includes(p.status);

      const formatted = {
        id: p.id,
        name: p.name,
        status: p.status,
        start_date: p.start_date,
        end_date: p.end_date,
        progress: p.progress,
        member_task_count: p.member_task_count,
        completed_member_tasks: p.completed_member_tasks,
        active_member_tasks: p.active_member_tasks,
        overdue_member_tasks: p.overdue_member_tasks,
      };

      if (p.status === 'completed') {
        completedProjects.push(formatted);
      } else if (isOverdue) {
        overdueProjects.push(formatted);
      } else if (['active', 'planning', 'on-hold'].includes(p.status)) {
        activeProjects.push(formatted);
      }
    });

    res.json({
      success: true,
      data: {
        active: activeProjects,
        completed: completedProjects,
        overdue: overdueProjects,
      }
    });
  } catch (error) {
    console.error('Error fetching team member projects:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch team member projects' }
    });
  }
};

module.exports = {
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
};
