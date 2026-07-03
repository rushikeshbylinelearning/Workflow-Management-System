const db = require('../db');

// Get all skills
const getSkills = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        COUNT(DISTINCT tms.team_member_id) as team_member_count,
        COUNT(DISTINCT ts.task_id) as task_count
      FROM skills s
      LEFT JOIN team_member_skills tms ON s.id = tms.skill_id
      LEFT JOIN task_skills ts ON s.id = ts.skill_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `;

    const rows = await db.query(query);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch skills'
      }
    });
  }
};

// Get skill by ID
const getSkill = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        s.*,
        COUNT(DISTINCT tms.team_member_id) as team_member_count,
        COUNT(DISTINCT ts.task_id) as task_count
      FROM skills s
      LEFT JOIN team_member_skills tms ON s.id = tms.skill_id
      LEFT JOIN task_skills ts ON s.id = ts.skill_id
      WHERE s.id = ?
      GROUP BY s.id
    `;

    const rows = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Skill not found'
        }
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Get skill error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch skill'
      }
    });
  }
};

// Create new skill
const createSkill = async (req, res) => {
  try {
    const {
      name,
      description = null
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Skill name is required'
        }
      });
    }

    // Check if skill name already exists
    const existing = await db.query(
      'SELECT id FROM skills WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Skill name already exists'
        }
      });
    }

    const query = `
      INSERT INTO skills (name, description)
      VALUES (?, ?)
    `;

    const result = await db.insert(query, [name, description]);

    // Get the created skill
    const createdSkill = await db.query(
      'SELECT * FROM skills WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: createdSkill[0],
      message: 'Skill created successfully'
    });

  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create skill'
      }
    });
  }
};

// Update skill
const updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { name = null, description = null } = req.body;

    // Check if skill exists
    const existing = await db.query('SELECT id FROM skills WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Skill not found'
        }
      });
    }

    // If name is being updated, check for duplicates
    if (name) {
      const duplicate = await db.query(
        'SELECT id FROM skills WHERE name = ? AND id != ?',
        [name, id]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Skill name already exists'
          }
        });
      }
    }

    // Build dynamic query based on provided fields
    let updateFields = [];
    let updateParams = [];
    
    if (name !== null && name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    
    if (description !== null && description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    
    // Always update the timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update'
        }
      });
    }
    
    const query = `
      UPDATE skills SET
        ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    updateParams.push(id);
    await db.query(query, updateParams);

    // Get updated skill
    const updatedSkill = await db.query(
      'SELECT * FROM skills WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: updatedSkill[0],
      message: 'Skill updated successfully'
    });

  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update skill'
      }
    });
  }
};

// Delete skill
const deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if skill exists
    const existing = await db.query('SELECT id FROM skills WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Skill not found'
        }
      });
    }

    // Check if skill is being used
    const usage = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM team_member_skills WHERE skill_id = ?) as team_member_count,
        (SELECT COUNT(*) FROM task_skills WHERE skill_id = ?) as task_count
    `, [id, id]);

    if (usage[0].team_member_count > 0 || usage[0].task_count > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SKILL_IN_USE',
          message: 'Cannot delete skill that is assigned to team members or tasks'
        }
      });
    }

    // Delete skill
    await db.query('DELETE FROM skills WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Skill deleted successfully'
    });

  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete skill'
      }
    });
  }
};

module.exports = {
  getSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill
};
