const db = require('../db');

// Get all stages (optionally filtered by project or category)
const getStages = async (req, res) => {
  try {
    const { project_id, category_id } = req.query;

    let query, queryParams = [];

    if (project_id) {
      // Get stages for a specific project via its category's stage templates
      query = `
        SELECT DISTINCT cs.*, st.order_index as template_order, st.is_default
        FROM category_stages cs
        INNER JOIN stage_templates st ON cs.id = st.stage_id
        INNER JOIN projects p ON st.category_id = p.category_id
        WHERE p.id = ?
        ORDER BY st.order_index ASC, cs.created_at ASC
      `;
      queryParams.push(project_id);
    } else if (category_id) {
      // Get stages for a specific category via stage templates
      query = `
        SELECT DISTINCT cs.*, st.order_index as template_order, st.is_default
        FROM category_stages cs
        INNER JOIN stage_templates st ON cs.id = st.stage_id
        WHERE st.category_id = ?
        ORDER BY st.order_index ASC, cs.created_at ASC
      `;
      queryParams.push(category_id);
    } else {
      // Get all stages
      query = 'SELECT * FROM category_stages ORDER BY order_index ASC, created_at ASC';
    }

    const stages = await db.query(query, queryParams);

    res.json({
      success: true,
      data: stages
    });

  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch stages'
      }
    });
  }
};

// Get stages by category (stage templates)
const getStagesByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

    const query = `
      SELECT cs.*, st.order_index as template_order, st.is_default
      FROM category_stages cs
      INNER JOIN stage_templates st ON cs.id = st.stage_id
      WHERE st.category_id = ?
      ORDER BY st.order_index ASC, cs.created_at ASC
    `;

    const stages = await db.query(query, [category_id]);

    res.json({
      success: true,
      data: stages
    });

  } catch (error) {
    console.error('Get stages by category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch stages for category'
      }
    });
  }
};

// Get stage by ID
const getStage = async (req, res) => {
  try {
    const { id } = req.params;

    const stages = await db.query('SELECT * FROM category_stages WHERE id = ?', [id]);

    if (stages.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage not found'
        }
      });
    }

    res.json({
      success: true,
      data: stages[0]
    });

  } catch (error) {
    console.error('Get stage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch stage'
      }
    });
  }
};

// Create new stage
const createStage = async (req, res) => {
  try {
    const {
      name,
      description,
      order_index = 0
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stage name is required'
        }
      });
    }

    const insertQuery = `
      INSERT INTO category_stages (name, description, order_index)
      VALUES (?, ?, ?)
    `;

    const params = [name, description || null, order_index];

    const result = await db.insert(insertQuery, params);
    
    // Get the created stage
    const createdStage = await db.query('SELECT * FROM category_stages WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: createdStage[0],
      message: 'Stage created successfully'
    });

  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create stage'
      }
    });
  }
};

// Update stage
const updateStage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      order_index,
      is_active
    } = req.body;

    // Check if stage exists
    const existingStage = await db.query('SELECT * FROM category_stages WHERE id = ?', [id]);
    if (existingStage.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage not found'
        }
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }

    if (order_index !== undefined) {
      updateFields.push('order_index = ?');
      updateParams.push(order_index);
    }

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateParams.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update'
        }
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);

    const updateQuery = `UPDATE category_stages SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(updateQuery, updateParams);

    // Get the updated stage
    const updatedStage = await db.query('SELECT * FROM category_stages WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedStage[0],
      message: 'Stage updated successfully'
    });

  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update stage'
      }
    });
  }
};

// Delete stage
const deleteStage = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if stage exists
    const existingStage = await db.query('SELECT * FROM category_stages WHERE id = ?', [id]);
    if (existingStage.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage not found'
        }
      });
    }

    // Check if stage is used in any templates
    const templateUsage = await db.query('SELECT * FROM stage_templates WHERE stage_id = ?', [id]);
    if (templateUsage.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONSTRAINT_ERROR',
          message: 'Cannot delete stage as it is used in category templates'
        }
      });
    }

    // Delete the stage
    await db.query('DELETE FROM category_stages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Stage deleted successfully'
    });

  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete stage'
      }
    });
  }
};

// Reorder stages within a category
const reorderStages = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { stage_orders } = req.body; // Array of { stage_id, order }

    if (!Array.isArray(stage_orders)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'stage_orders must be an array'
        }
      });
    }

    // Update each stage template order
    for (const item of stage_orders) {
      await db.query(
        'UPDATE stage_templates SET order_index = ? WHERE category_id = ? AND stage_id = ?',
        [item.order, category_id, item.stage_id]
      );
    }

    res.json({
      success: true,
      message: 'Stages reordered successfully'
    });

  } catch (error) {
    console.error('Reorder stages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to reorder stages'
      }
    });
  }
};

module.exports = {
  getStages,
  getStagesByCategory,
  getStage,
  createStage,
  updateStage,
  deleteStage,
  reorderStages
};
