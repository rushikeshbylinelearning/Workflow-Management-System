const db = require('../db');

// Get all stage templates for a category
const getTemplatesByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

    const query = `
      SELECT st.*, cs.name as stage_name, cs.description as stage_description, cs.is_active as stage_active
      FROM stage_templates st
      INNER JOIN category_stages cs ON st.stage_id = cs.id
      WHERE st.category_id = ?
      ORDER BY st.order_index ASC, st.created_at ASC
    `;

    const templates = await db.query(query, [category_id]);

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Get templates by category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch stage templates'
      }
    });
  }
};

// Get stage template by ID
const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT st.*, cs.name as stage_name, cs.description as stage_description, cs.is_active as stage_active
      FROM stage_templates st
      INNER JOIN category_stages cs ON st.stage_id = cs.id
      WHERE st.id = ?
    `;

    const templates = await db.query(query, [id]);

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage template not found'
        }
      });
    }

    res.json({
      success: true,
      data: templates[0]
    });

  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch stage template'
      }
    });
  }
};

// Create new stage template
const createTemplate = async (req, res) => {
  try {
    const {
      category_id,
      stage_id,
      order_index = 0,
      is_default = false
    } = req.body;

    if (!category_id || !stage_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category ID and Stage ID are required'
        }
      });
    }

    // Check if category exists
    const category = await db.query('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (category.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // Check if stage exists
    const stage = await db.query('SELECT * FROM category_stages WHERE id = ?', [stage_id]);
    if (stage.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage not found'
        }
      });
    }

    // Check if template already exists
    const existingTemplate = await db.query(
      'SELECT * FROM stage_templates WHERE category_id = ? AND stage_id = ?',
      [category_id, stage_id]
    );
    if (existingTemplate.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Stage template already exists for this category and stage'
        }
      });
    }

    // If this is set as default, unset other defaults for this category
    if (is_default) {
      await db.query(
        'UPDATE stage_templates SET is_default = false WHERE category_id = ?',
        [category_id]
      );
    }

    const insertQuery = `
      INSERT INTO stage_templates (category_id, stage_id, order_index, is_default)
      VALUES (?, ?, ?, ?)
    `;

    const params = [category_id, stage_id, order_index, is_default];

    const result = await db.insert(insertQuery, params);
    
    // Get the created template
    const createdTemplate = await db.query(
      'SELECT * FROM stage_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: createdTemplate[0],
      message: 'Stage template created successfully'
    });

  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create stage template'
      }
    });
  }
};

// Update stage template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      order_index,
      is_default
    } = req.body;

    
    const existingTemplate = await db.query('SELECT * FROM stage_templates WHERE id = ?', [id]);
    if (existingTemplate.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage template not found'
        }
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateParams = [];

    if (order_index !== undefined) {
      updateFields.push('order_index = ?');
      updateParams.push(order_index);
    }

    if (is_default !== undefined) {
      updateFields.push('is_default = ?');
      updateParams.push(is_default);
      
      // If this is set as default, unset other defaults for this category
      if (is_default) {
        await db.query(
          'UPDATE stage_templates SET is_default = false WHERE category_id = ? AND id != ?',
          [existingTemplate[0].category_id, id]
        );
      }
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

    const updateQuery = `UPDATE stage_templates SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(updateQuery, updateParams);

    // Get the updated template
    const updatedTemplate = await db.query('SELECT * FROM stage_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updatedTemplate[0],
      message: 'Stage template updated successfully'
    });

  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update stage template'
      }
    });
  }
};

// Delete stage template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const existingTemplate = await db.query('SELECT * FROM stage_templates WHERE id = ?', [id]);
    if (existingTemplate.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Stage template not found'
        }
      });
    }

    // Delete the template
    await db.query('DELETE FROM stage_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Stage template deleted successfully'
    });

  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete stage template'
      }
    });
  }
};

// Bulk create stage templates for a category
const bulkCreateTemplates = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { templates } = req.body; // Array of { stage_id, order, is_default }

    if (!Array.isArray(templates)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'templates must be an array'
        }
      });
    }

    // Check if category exists
    const category = await db.query('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (category.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // Clear existing templates for this category
    await db.query('DELETE FROM stage_templates WHERE category_id = ?', [category_id]);

    // Insert new templates
    const createdTemplates = [];
    for (const template of templates) {
      const { stage_id, order_index = 0, is_default = false } = template;

      // Check if stage exists
      const stage = await db.query('SELECT * FROM category_stages WHERE id = ?', [stage_id]);
      if (stage.length === 0) {
        continue; // Skip invalid stage
      }

      const insertQuery = `
        INSERT INTO stage_templates (category_id, stage_id, order_index, is_default)
        VALUES (?, ?, ?, ?)
      `;

      const result = await db.insert(insertQuery, [category_id, stage_id, order_index, is_default]);
      createdTemplates.push({ id: result.insertId, ...template });
    }

    res.status(201).json({
      success: true,
      data: createdTemplates,
      message: 'Stage templates created successfully'
    });

  } catch (error) {
    console.error('Bulk create templates error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create stage templates'
      }
    });
  }
};

module.exports = {
  getTemplatesByCategory,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  bulkCreateTemplates
};
