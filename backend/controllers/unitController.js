const db = require('../db');

// Get all units for a book
const getUnitsByBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    
    const query = `
      SELECT u.*, b.name as book_name, g.name as grade_name,
             COUNT(DISTINCT l.id) as lesson_count
      FROM units u
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN lessons l ON u.id = l.unit_id
      WHERE u.book_id = ?
      GROUP BY u.id
      ORDER BY u.order_index ASC, u.name ASC
    `;
    
    const units = await db.query(query, [bookId]);
    
    // Transform data to ensure proper types
    const transformedUnits = units.map(unit => ({
      ...unit,
      weight: parseFloat(unit.weight) || 0,
      order_index: parseInt(unit.order_index) || 0,
      book_id: parseInt(unit.book_id) || 0,
      id: parseInt(unit.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedUnits,
      message: 'Units retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching units by book:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch units', details: error.message }
    });
  }
};

// Get all units
const getAllUnits = async (req, res) => {
  try {
    const query = `
      SELECT u.*, b.name as book_name, g.name as grade_name, p.name as project_name
      FROM units u
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      ORDER BY p.id, g.order_index, b.order_index, u.order_index
    `;
    
    const units = await db.query(query);
    
    // Transform data to ensure proper types
    const transformedUnits = units.map(unit => ({
      ...unit,
      weight: parseFloat(unit.weight) || 0,
      order_index: parseInt(unit.order_index) || 0,
      book_id: parseInt(unit.book_id) || 0,
      id: parseInt(unit.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedUnits,
      message: 'Units retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching all units:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch units', details: error.message }
    });
  }
};

// Get unit by ID
const getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT u.*, b.name as book_name, g.name as grade_name, p.name as project_name
      FROM units u
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      WHERE u.id = ?
    `;
    
    const units = await db.query(query, [id]);
    
    if (units.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Unit not found' }
      });
    }
    
    // Transform data to ensure proper types
    const transformedUnit = {
      ...units[0],
      weight: parseFloat(units[0].weight) || 0,
      order_index: parseInt(units[0].order_index) || 0,
      book_id: parseInt(units[0].book_id) || 0,
      id: parseInt(units[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedUnit,
      message: 'Unit retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching unit by ID:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch unit', details: error.message }
    });
  }
};

// Create new unit
const createUnit = async (req, res) => {
  try {
    const { book_id, name, description, order_index, weight } = req.body;
    
    if (!book_id || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Book ID and name are required' }
      });
    }
    
    // Check if book exists
    const books = await db.query('SELECT id FROM books WHERE id = ?', [book_id]);
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Book not found' }
      });
    }
    
    // Get next order index if not provided
    let finalOrderIndex = order_index;
    if (!finalOrderIndex) {
      const maxOrder = await db.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM units WHERE book_id = ?',
        [book_id]
      );
      finalOrderIndex = maxOrder[0].next_order;
    }
    
    const query = `
      INSERT INTO units (book_id, name, description, order_index, weight)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await db.insert(query, [
      book_id, name, description || null, finalOrderIndex, weight || 0
    ]);
    
    const newUnit = await db.query('SELECT * FROM units WHERE id = ?', [result.insertId]);
    
    // Transform data to ensure proper types
    const transformedUnit = {
      ...newUnit[0],
      weight: parseFloat(newUnit[0].weight) || 0,
      order_index: parseInt(newUnit[0].order_index) || 0,
      book_id: parseInt(newUnit[0].book_id) || 0,
      id: parseInt(newUnit[0].id) || 0
    };
    
    res.status(201).json({
      success: true,
      data: transformedUnit,
      message: 'Unit created successfully'
    });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create unit', details: error.message }
    });
  }
};

// Update unit
const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, order_index, weight } = req.body;
    
    const existingUnits = await db.query('SELECT * FROM units WHERE id = ?', [id]);
    if (existingUnits.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Unit not found' }
      });
    }
    
    const query = `
      UPDATE units 
      SET name = ?, description = ?, order_index = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await db.execute(query, [
      name || existingUnits[0].name,
      description !== undefined ? description : existingUnits[0].description,
      order_index !== undefined ? order_index : existingUnits[0].order_index,
      weight !== undefined ? weight : existingUnits[0].weight,
      id
    ]);
    
    const updatedUnit = await db.query('SELECT * FROM units WHERE id = ?', [id]);
    
    // Transform data to ensure proper types
    const transformedUnit = {
      ...updatedUnit[0],
      weight: parseFloat(updatedUnit[0].weight) || 0,
      order_index: parseInt(updatedUnit[0].order_index) || 0,
      book_id: parseInt(updatedUnit[0].book_id) || 0,
      id: parseInt(updatedUnit[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedUnit,
      message: 'Unit updated successfully'
    });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update unit', details: error.message }
    });
  }
};

// Delete unit
const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingUnits = await db.query('SELECT * FROM units WHERE id = ?', [id]);
    if (existingUnits.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Unit not found' }
      });
    }
    
    // Check if unit has lessons
    const lessons = await db.query('SELECT COUNT(*) as count FROM lessons WHERE unit_id = ?', [id]);
    if (lessons[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete unit with existing lessons. Please delete lessons first.' }
      });
    }
    
    await db.execute('DELETE FROM units WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Unit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete unit', details: error.message }
    });
  }
};

// Auto-distribute weights for units in a book
const distributeWeights = async (req, res) => {
  try {
    const { book_id } = req.body;
    
    if (!book_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Book ID is required' }
      });
    }
    
    const units = await db.query('SELECT id FROM units WHERE book_id = ? ORDER BY order_index', [book_id]);
    
    if (units.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No units found for this book' }
      });
    }
    
    const equalWeight = 100 / units.length;
    
    for (const unit of units) {
      await db.execute('UPDATE units SET weight = ? WHERE id = ?', [equalWeight, unit.id]);
    }
    
    res.json({
      success: true,
      message: `Weights distributed equally (${equalWeight.toFixed(2)}% each) among ${units.length} units`
    });
  } catch (error) {
    console.error('Error distributing weights:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to distribute weights', details: error.message }
    });
  }
};

module.exports = {
  getUnitsByBook,
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  distributeWeights
};
