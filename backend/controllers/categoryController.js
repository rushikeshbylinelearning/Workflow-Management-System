const db = require('../db');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as project_count
      FROM categories c
      LEFT JOIN projects p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    const rows = await db.query(query);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch categories'
      }
    });
  }
};

// Get category by ID
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as project_count
      FROM categories c
      LEFT JOIN projects p ON c.id = p.category_id
      WHERE c.id = ?
      GROUP BY c.id
    `;

    const rows = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch category'
      }
    });
  }
};

// Create new category
const createCategory = async (req, res) => {
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
          message: 'Category name is required'
        }
      });
    }

    // Check if category name already exists
    const existing = await db.query(
      'SELECT id FROM categories WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Category name already exists'
        }
      });
    }

    const query = `
      INSERT INTO categories (name, description)
      VALUES (?, ?)
    `;


    const result = await db.insert(query, [name, description]);

    // Get the created category
    const createdCategory = await db.query(
      'SELECT * FROM categories WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: createdCategory[0],
      message: 'Category created successfully'
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create category'
      }
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    
    const { id } = req.params;
    const { name = null, description = null } = req.body;

    // Check if category exists
    const existing = await db.query('SELECT id FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // If name is being updated, check for duplicates
    if (name) {
      const duplicate = await db.query(
        'SELECT id FROM categories WHERE name = ? AND id != ?',
        [name, id]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Category name already exists'
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
      UPDATE categories SET
        ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    updateParams.push(id);
    
    
    await db.query(query, updateParams);

    // Get updated category
    const updatedCategory = await db.query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: updatedCategory[0],
      message: 'Category updated successfully'
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update category'
      }
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await db.query('SELECT id FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
    }

    // Check if category is being used by any projects
    const projects = await db.query(
      'SELECT COUNT(*) as count FROM projects WHERE category_id = ?',
      [id]
    );

    if (projects[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete category that is being used by projects'
        }
      });
    }

    // Delete category
    await db.query('DELETE FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete category'
      }
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
};
