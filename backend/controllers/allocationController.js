const db = require('../db');
const { ensureTeamMembersOnProject } = require('../utils/projectMembership');
const { emitProjectTaskUpdate } = require('../utils/emitProjectTaskUpdate');

// Get all allocations with filters
const getAllocations = async (req, res) => {
  try {
    const { 
      user_id,
      user_type,
      project_id,
      task_id,
      start_date,
      end_date,
      date
    } = req.query;

    let query = `
      SELECT 
        ta.*,
        p.name as project_name,
        t.name as task_name,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.name
          WHEN ta.user_type = 'team' THEN tm.name
        END as user_name,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.email
          WHEN ta.user_type = 'team' THEN tm.email
        END as user_email
      FROM team_allocations ta
      LEFT JOIN projects p ON ta.project_id = p.id
      LEFT JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN admin_users au ON ta.user_id = au.id AND ta.user_type = 'admin'
      LEFT JOIN team_members tm ON ta.user_id = tm.id AND ta.user_type = 'team'
      WHERE 1=1
    `;
    
    const queryParams = [];

    if (user_id) {
      query += ' AND ta.user_id = ?';
      queryParams.push(user_id);
    }

    if (user_type) {
      query += ' AND ta.user_type = ?';
      queryParams.push(user_type);
    }

    if (project_id) {
      query += ' AND ta.project_id = ?';
      queryParams.push(project_id);
    }

    if (task_id) {
      query += ' AND ta.task_id = ?';
      queryParams.push(task_id);
    }

    if (start_date) {
      query += ' AND ta.start_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      query += ' AND ta.end_date <= ?';
      queryParams.push(end_date);
    }

    if (date) {
      query += ' AND ? BETWEEN ta.start_date AND ta.end_date';
      queryParams.push(date);
    }

    query += ' ORDER BY ta.start_date ASC, ta.user_id ASC';


    const allocations = await db.query(query, queryParams);

    res.json({
      success: true,
      data: allocations
    });

  } catch (error) {
    console.error('Get allocations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch allocations'
      }
    });
  }
};

// Get allocation by ID
const getAllocation = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        ta.*,
        p.name as project_name,
        t.name as task_name,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.name
          WHEN ta.user_type = 'team' THEN tm.name
        END as user_name,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.email
          WHEN ta.user_type = 'team' THEN tm.email
        END as user_email
      FROM team_allocations ta
      LEFT JOIN projects p ON ta.project_id = p.id
      LEFT JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN admin_users au ON ta.user_id = au.id AND ta.user_type = 'admin'
      LEFT JOIN team_members tm ON ta.user_id = tm.id AND ta.user_type = 'team'
      WHERE ta.id = ?
    `;

    const allocations = await db.query(query, [id]);

    if (allocations.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Allocation not found'
        }
      });
    }

    res.json({
      success: true,
      data: allocations[0]
    });

  } catch (error) {
    console.error('Get allocation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch allocation'
      }
    });
  }
};

// Create new allocation
const createAllocation = async (req, res) => {
  try {
    const {
      user_id,
      user_type,
      project_id,
      task_id,
      hours_per_day = 8.00,
      start_date,
      end_date
    } = req.body;

    // Validate required fields
    if (!user_id || !project_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: user_id, project_id, start_date, end_date'
        }
      });
    }

    // Validate user exists - check both admin_users and team_members tables
    let userExists = await db.query('SELECT id FROM admin_users WHERE id = ?', [user_id]);
    let finalUserType = user_type; // Use a local variable instead of reassigning the const
    
    if (userExists.length === 0) {
      // If not found in admin_users, check team_members
      userExists = await db.query('SELECT id FROM team_members WHERE id = ?', [user_id]);
      if (userExists.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `User with ID ${user_id} not found in either admin_users or team_members tables`
          }
        });
      } else {
        // User found in team_members, set user_type to 'team'
        finalUserType = 'team';
      }
    } else {
      // User found in admin_users, set user_type to 'admin'
      finalUserType = 'admin';
    }

    // Validate project exists
    const projectExists = await db.query('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (projectExists.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Project with ID ${project_id} not found`
        }
      });
    }

    // Validate task exists if provided
    if (task_id) {
      const taskExists = await db.query('SELECT id FROM tasks WHERE id = ?', [task_id]);
      if (taskExists.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Task with ID ${task_id} not found`
          }
        });
      }
    }

    // Format dates
    const formattedStartDate = new Date(start_date).toISOString().split('T')[0];
    const formattedEndDate = new Date(end_date).toISOString().split('T')[0];

    // Create the allocation
    const insertQuery = `
      INSERT INTO team_allocations (
        user_id, user_type, project_id, task_id, hours_per_day, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      user_id,
      finalUserType,
      project_id,
      task_id || null,
      parseFloat(hours_per_day) || 8.00,
      formattedStartDate,
      formattedEndDate
    ];


    const result = await db.insert(insertQuery, insertParams);
    const allocationId = result.insertId;

    // Also add the user as a task assignee and update task end_date if task_id is provided
    if (task_id) {
      try {
        // Check if assignee already exists for this task
        const existingAssignee = await db.query(
          'SELECT id FROM task_assignees WHERE task_id = ? AND assignee_id = ? AND assignee_type = ?',
          [task_id, user_id, finalUserType]
        );

        if (existingAssignee.length === 0) {
          // Add as task assignee
          const assigneeQuery = `
            INSERT INTO task_assignees (task_id, assignee_id, assignee_type)
            VALUES (?, ?, ?)
          `;
          await db.insert(assigneeQuery, [task_id, user_id, finalUserType]);
        } else {
        }

        // Update the task's end_date to match the allocation end_date
        const updateTaskQuery = `
          UPDATE tasks 
          SET end_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        await db.query(updateTaskQuery, [formattedEndDate, task_id]);

        if (finalUserType === 'team') {
          try {
            await ensureTeamMembersOnProject(project_id, [user_id]);
          } catch (membershipError) {
            console.error('Failed to add allocated user to project team (allocation still created):', membershipError);
          }
        }

        emitProjectTaskUpdate(project_id, task_id, 'assigned');
        
      } catch (assigneeError) {
        console.error('⚠️ Failed to create task assignee or update task (allocation still created):', assigneeError);
        // Don't fail the allocation creation if assignee creation or task update fails
      }
    }

    // Get the created allocation with all related data
    const createdAllocation = await getAllocationById(allocationId);


    res.status(201).json({
      success: true,
      data: createdAllocation,
      message: task_id ? 'Allocation created, task assigned, and end date updated successfully' : 'Allocation created successfully'
    });

  } catch (error) {
    console.error('Create allocation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create allocation'
      }
    });
  }
};

// Update allocation
const updateAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_id,
      user_type,
      project_id,
      task_id,
      hours_per_day,
      start_date,
      end_date
    } = req.body;

    // Check if allocation exists
    const existing = await db.query('SELECT id FROM team_allocations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Allocation not found'
        }
      });
    }

    // Build update query dynamically for provided fields
    let updateQuery = 'UPDATE team_allocations SET updated_at = CURRENT_TIMESTAMP';
    const updateParams = [];

    if (user_id !== undefined) {
      updateQuery += ', user_id = ?';
      updateParams.push(user_id);
    }
    if (user_type !== undefined) {
      updateQuery += ', user_type = ?';
      updateParams.push(user_type);
    }
    if (project_id !== undefined) {
      updateQuery += ', project_id = ?';
      updateParams.push(project_id);
    }
    if (task_id !== undefined) {
      updateQuery += ', task_id = ?';
      updateParams.push(task_id);
    }
    if (hours_per_day !== undefined) {
      updateQuery += ', hours_per_day = ?';
      updateParams.push(parseFloat(hours_per_day) || 8.00);
    }
    if (start_date !== undefined) {
      updateQuery += ', start_date = ?';
      updateParams.push(new Date(start_date).toISOString().split('T')[0]);
    }
    if (end_date !== undefined) {
      updateQuery += ', end_date = ?';
      updateParams.push(new Date(end_date).toISOString().split('T')[0]);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.query(updateQuery, updateParams);

    // Get updated allocation
    const updatedAllocation = await getAllocationById(id);

    res.json({
      success: true,
      data: updatedAllocation,
      message: 'Allocation updated successfully'
    });

  } catch (error) {
    console.error('Update allocation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update allocation'
      }
    });
  }
};

// Delete allocation
const deleteAllocation = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if allocation exists
    const existing = await db.query('SELECT id FROM team_allocations WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Allocation not found'
        }
      });
    }

    // Delete allocation
    await db.query('DELETE FROM team_allocations WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Allocation deleted successfully'
    });

  } catch (error) {
    console.error('Delete allocation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete allocation'
      }
    });
  }
};

// Get workload summary for a specific date
const getWorkloadSummary = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date parameter is required'
        }
      });
    }

    // Get all allocations for the date
    const query = `
      SELECT 
        ta.user_id,
        ta.user_type,
        ta.hours_per_day,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.name
          WHEN ta.user_type = 'team' THEN tm.name
        END as user_name,
        CASE 
          WHEN ta.user_type = 'admin' THEN au.email
          WHEN ta.user_type = 'team' THEN tm.email
        END as user_email
      FROM team_allocations ta
      LEFT JOIN admin_users au ON ta.user_id = au.id AND ta.user_type = 'admin'
      LEFT JOIN team_members tm ON ta.user_id = tm.id AND ta.user_type = 'team'
      WHERE ? BETWEEN ta.start_date AND ta.end_date
    `;

    const allocations = await db.query(query, [date]);

    // Calculate workload status for each user
    const workloadSummary = {};
    
    allocations.forEach(allocation => {
      const userId = `${allocation.user_type}_${allocation.user_id}`;
      
      if (!workloadSummary[userId]) {
        workloadSummary[userId] = {
          user_id: allocation.user_id,
          user_type: allocation.user_type,
          user_name: allocation.user_name,
          user_email: allocation.user_email,
          total_hours: 0,
          allocation_count: 0,
          status: 'available'
        };
      }
      
      workloadSummary[userId].total_hours += parseFloat(allocation.hours_per_day) || 0;
      workloadSummary[userId].allocation_count += 1;
    });

    // Determine status for each user
    Object.values(workloadSummary).forEach(user => {
      if (user.total_hours === 0) {
        user.status = 'available';
      } else if (user.total_hours > 8) {
        user.status = 'overloaded';
      } else if (user.total_hours >= 6) {
        user.status = 'busy';
      } else {
        user.status = 'normal';
      }
    });

    // Get counts by status
    const statusCounts = {
      available: 0,
      normal: 0,
      busy: 0,
      overloaded: 0
    };

    Object.values(workloadSummary).forEach(user => {
      statusCounts[user.status]++;
    });

    res.json({
      success: true,
      data: {
        date: date,
        users: Object.values(workloadSummary),
        status_counts: statusCounts,
        total_users: Object.keys(workloadSummary).length
      }
    });

  } catch (error) {
    console.error('Get workload summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch workload summary'
      }
    });
  }
};

// Get daily allocations based on actual task assignments
const getDailyAllocations = async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      group_by = 'team' // 'team' or 'project'
    } = req.query;


    // Get all tasks with their assignees and project info
    let tasksQuery = `
      SELECT 
        t.id as task_id,
        t.name as task_name,
        t.estimated_hours,
        t.start_date,
        t.end_date,
        t.status,
        t.priority,
        p.id as project_id,
        p.name as project_name,
        c.name as project_category,
        ta.assignee_id,
        ta.assignee_type,
        tm.name as team_member_name,
        tm.email as team_member_email,
        GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') as team_member_skills,
        au.name as admin_name,
        au.email as admin_email
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
      WHERE t.start_date IS NOT NULL 
        AND t.end_date IS NOT NULL
        AND ta.assignee_id IS NOT NULL
    `;

    const queryParams = [];
    if (start_date && end_date) {
      tasksQuery += ' AND t.start_date <= ? AND t.end_date >= ?';
      queryParams.push(end_date, start_date);
    }

    tasksQuery += ' GROUP BY t.id, ta.assignee_id, ta.assignee_type ORDER BY t.start_date ASC, ta.assignee_id ASC';


    const tasks = await db.query(tasksQuery, queryParams);

    // Transform tasks into daily allocations
    const dailyAllocations = [];
    const dateRange = getDateRange(start_date, end_date);

    tasks.forEach(task => {
      if (!task.assignee_id || !task.start_date || !task.end_date) return;

      const estimatedHours = parseFloat(task.estimated_hours) || 8;
      const endDate = new Date(task.end_date);
      const endDateStr = endDate.toISOString().split('T')[0];

      // Check if estimated hours > 8 and we need to distribute across days
      if (estimatedHours > 8) {
        // Get previous day
        const previousDate = new Date(endDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split('T')[0];

        // Check if previous day has 0 hours allocated for this user
        const hasPreviousDayAllocation = dailyAllocations.some(allocation => 
          allocation.user_id === task.assignee_id && 
          allocation.date === previousDateStr && 
          allocation.hours_per_day > 0
        );

        // If previous day has 0 hours, distribute the hours
        if (!hasPreviousDayAllocation && dateRange.includes(previousDateStr)) {
          // Add 8 hours to previous day
          dailyAllocations.push({
            id: `${task.task_id}-${task.assignee_id}-${previousDateStr}`,
            user_id: task.assignee_id,
            user_type: task.assignee_type,
            user_name: task.assignee_type === 'team' ? task.team_member_name : task.admin_name,
            user_email: task.assignee_type === 'team' ? task.team_member_email : task.admin_email,
            user_skills: task.team_member_skills ? task.team_member_skills.split(', ').filter(skill => skill.trim()) : [],
            project_id: task.project_id,
            project_name: task.project_name,
            project_category: task.project_category,
            task_id: task.task_id,
            task_name: task.task_name,
            task_status: task.status,
            task_priority: task.priority,
            hours_per_day: 8,
            date: previousDateStr,
            start_date: task.start_date,
            end_date: task.end_date,
            estimated_hours: estimatedHours
          });

          // Add remaining hours to end date
          const remainingHours = estimatedHours - 8;
          if (dateRange.includes(endDateStr)) {
            dailyAllocations.push({
              id: `${task.task_id}-${task.assignee_id}-${endDateStr}`,
              user_id: task.assignee_id,
              user_type: task.assignee_type,
              user_name: task.assignee_type === 'team' ? task.team_member_name : task.admin_name,
              user_email: task.assignee_type === 'team' ? task.team_member_email : task.admin_email,
              user_skills: task.team_member_skills ? task.team_member_skills.split(', ').filter(skill => skill.trim()) : [],
              project_id: task.project_id,
              project_name: task.project_name,
              project_category: task.project_category,
              task_id: task.task_id,
              task_name: task.task_name,
              task_status: task.status,
              task_priority: task.priority,
              hours_per_day: remainingHours,
              date: endDateStr,
              start_date: task.start_date,
              end_date: task.end_date,
              estimated_hours: estimatedHours
            });
          }
        } else {
          // Previous day has hours or not in range, put all hours on end date
          if (dateRange.includes(endDateStr)) {
            dailyAllocations.push({
              id: `${task.task_id}-${task.assignee_id}-${endDateStr}`,
              user_id: task.assignee_id,
              user_type: task.assignee_type,
              user_name: task.assignee_type === 'team' ? task.team_member_name : task.admin_name,
              user_email: task.assignee_type === 'team' ? task.team_member_email : task.admin_email,
              user_skills: task.team_member_skills ? task.team_member_skills.split(', ').filter(skill => skill.trim()) : [],
              project_id: task.project_id,
              project_name: task.project_name,
              project_category: task.project_category,
              task_id: task.task_id,
              task_name: task.task_name,
              task_status: task.status,
              task_priority: task.priority,
              hours_per_day: estimatedHours,
              date: endDateStr,
              start_date: task.start_date,
              end_date: task.end_date,
              estimated_hours: estimatedHours
            });
          }
        }
      } else {
        // Estimated hours <= 8, put all hours on end date (original logic)
        if (dateRange.includes(endDateStr)) {
          dailyAllocations.push({
            id: `${task.task_id}-${task.assignee_id}-${endDateStr}`,
            user_id: task.assignee_id,
            user_type: task.assignee_type,
            user_name: task.assignee_type === 'team' ? task.team_member_name : task.admin_name,
            user_email: task.assignee_type === 'team' ? task.team_member_email : task.admin_email,
            user_skills: task.team_member_skills ? task.team_member_skills.split(', ').filter(skill => skill.trim()) : [],
            project_id: task.project_id,
            project_name: task.project_name,
            project_category: task.project_category,
            task_id: task.task_id,
            task_name: task.task_name,
            task_status: task.status,
            task_priority: task.priority,
            hours_per_day: estimatedHours,
            date: endDateStr,
            start_date: task.start_date,
            end_date: task.end_date,
            estimated_hours: estimatedHours
          });
        }
      }
    });


    // Group by team or project
    let groupedData;
    if (group_by === 'project') {
      groupedData = groupByProject(dailyAllocations);
    } else {
      groupedData = groupByTeam(dailyAllocations);
    }

    res.json({
      success: true,
      data: {
        allocations: dailyAllocations,
        grouped: groupedData,
        summary: getSummaryStats(dailyAllocations),
        date_range: {
          start: start_date,
          end: end_date
        }
      }
    });

  } catch (error) {
    console.error('Get daily allocations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch daily allocations'
      }
    });
  }
};

// Helper function to get date range
const getDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    // Default to current week if no dates provided
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    startDate = startOfWeek.toISOString().split('T')[0];
    endDate = endOfWeek.toISOString().split('T')[0];
  }

  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
};

// Helper function to group allocations by team member
const groupByTeam = (allocations) => {
  const grouped = {};
  
  allocations.forEach(allocation => {
    const userId = allocation.user_id;
    if (!grouped[userId]) {
      grouped[userId] = {
        user_id: userId,
        user_name: allocation.user_name,
        user_email: allocation.user_email,
        user_skills: allocation.user_skills,
        daily_allocations: {}
      };
    }
    
    const date = allocation.date;
    if (!grouped[userId].daily_allocations[date]) {
      grouped[userId].daily_allocations[date] = {
        date: date,
        total_hours: 0,
        tasks: []
      };
    }
    
    grouped[userId].daily_allocations[date].total_hours += allocation.hours_per_day;
    grouped[userId].daily_allocations[date].tasks.push({
      task_id: allocation.task_id,
      task_name: allocation.task_name,
      project_name: allocation.project_name,
      hours_per_day: allocation.hours_per_day,
      status: allocation.task_status,
      priority: allocation.task_priority
    });
  });
  
  return grouped;
};

// Helper function to group allocations by project
const groupByProject = (allocations) => {
  const grouped = {};
  
  allocations.forEach(allocation => {
    const projectId = allocation.project_id;
    if (!grouped[projectId]) {
      grouped[projectId] = {
        project_id: projectId,
        project_name: allocation.project_name,
        project_category: allocation.project_category,
        daily_allocations: {}
      };
    }
    
    const date = allocation.date;
    if (!grouped[projectId].daily_allocations[date]) {
      grouped[projectId].daily_allocations[date] = {
        date: date,
        total_hours: 0,
        team_members: []
      };
    }
    
    grouped[projectId].daily_allocations[date].total_hours += allocation.hours_per_day;
    grouped[projectId].daily_allocations[date].team_members.push({
      user_id: allocation.user_id,
      user_name: allocation.user_name,
      task_id: allocation.task_id,
      task_name: allocation.task_name,
      hours_per_day: allocation.hours_per_day
    });
  });
  
  return grouped;
};

// Helper function to get summary statistics
const getSummaryStats = (allocations) => {
  const userStats = {};
  const dateStats = {};
  
  allocations.forEach(allocation => {
    const userId = allocation.user_id;
    const date = allocation.date;
    
    // User stats
    if (!userStats[userId]) {
      userStats[userId] = {
        user_id: userId,
        user_name: allocation.user_name,
        total_hours: 0,
        total_tasks: 0,
        dates_worked: new Set()
      };
    }
    
    userStats[userId].total_hours += allocation.hours_per_day;
    userStats[userId].total_tasks += 1;
    userStats[userId].dates_worked.add(date);
    
    // Date stats
    if (!dateStats[date]) {
      dateStats[date] = {
        date: date,
        total_hours: 0,
        total_tasks: 0,
        unique_users: new Set()
      };
    }
    
    dateStats[date].total_hours += allocation.hours_per_day;
    dateStats[date].total_tasks += 1;
    dateStats[date].unique_users.add(userId);
  });
  
  // Convert sets to counts
  Object.values(userStats).forEach(user => {
    user.dates_worked = user.dates_worked.size;
  });
  
  Object.values(dateStats).forEach(date => {
    date.unique_users = date.unique_users.size;
  });
  
  return {
    total_allocations: allocations.length,
    total_users: Object.keys(userStats).length,
    total_dates: Object.keys(dateStats).length,
    user_stats: Object.values(userStats),
    date_stats: Object.values(dateStats)
  };
};

// Helper function to get allocation by ID with all related data
const getAllocationById = async (allocationId) => {
  const query = `
    SELECT 
      ta.*,
      p.name as project_name,
      t.name as task_name,
      CASE 
        WHEN ta.user_type = 'admin' THEN au.name
        WHEN ta.user_type = 'team' THEN tm.name
      END as user_name,
      CASE 
        WHEN ta.user_type = 'admin' THEN au.email
        WHEN ta.user_type = 'team' THEN tm.email
      END as user_email
    FROM team_allocations ta
    LEFT JOIN projects p ON ta.project_id = p.id
    LEFT JOIN tasks t ON ta.task_id = t.id
    LEFT JOIN admin_users au ON ta.user_id = au.id AND ta.user_type = 'admin'
    LEFT JOIN team_members tm ON ta.user_id = tm.id AND ta.user_type = 'team'
    WHERE ta.id = ?
  `;

  const allocations = await db.query(query, [allocationId]);
  return allocations[0];
};

module.exports = {
  getAllocations,
  getAllocation,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  getWorkloadSummary,
  getDailyAllocations
};
