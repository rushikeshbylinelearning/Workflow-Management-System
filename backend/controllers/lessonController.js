const db = require('../db');

// Get all lessons for a unit
const getLessonsByUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    
    const query = `
      SELECT l.*, u.name as unit_name, b.name as book_name, g.name as grade_name
      FROM lessons l
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      WHERE l.unit_id = ?
      ORDER BY l.order_index ASC, l.name ASC
    `;
    
    const lessons = await db.query(query, [unitId]);
    
    // Transform data to ensure proper types
    const transformedLessons = lessons.map(lesson => ({
      ...lesson,
      weight: parseFloat(lesson.weight) || 0,
      order_index: parseInt(lesson.order_index) || 0,
      unit_id: parseInt(lesson.unit_id) || 0,
      id: parseInt(lesson.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedLessons,
      message: 'Lessons retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching lessons by unit:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch lessons', details: error.message }
    });
  }
};

// Get all lessons
const getAllLessons = async (req, res) => {
  try {
    const query = `
      SELECT l.*, u.name as unit_name, b.name as book_name, g.name as grade_name, p.name as project_name
      FROM lessons l
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      ORDER BY p.id, g.order_index, b.order_index, u.order_index, l.order_index
    `;
    
    const lessons = await db.query(query);
    
    // Transform data to ensure proper types
    const transformedLessons = lessons.map(lesson => ({
      ...lesson,
      weight: parseFloat(lesson.weight) || 0,
      order_index: parseInt(lesson.order_index) || 0,
      unit_id: parseInt(lesson.unit_id) || 0,
      id: parseInt(lesson.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedLessons,
      message: 'Lessons retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching all lessons:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch lessons', details: error.message }
    });
  }
};

// Get lesson by ID
const getLessonById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT l.*, u.name as unit_name, b.name as book_name, g.name as grade_name, p.name as project_name
      FROM lessons l
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN books b ON u.book_id = b.id
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      WHERE l.id = ?
    `;
    
    const lessons = await db.query(query, [id]);
    
    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Lesson not found' }
      });
    }
    
    // Transform data to ensure proper types
    const transformedLesson = {
      ...lessons[0],
      weight: parseFloat(lessons[0].weight) || 0,
      order_index: parseInt(lessons[0].order_index) || 0,
      unit_id: parseInt(lessons[0].unit_id) || 0,
      id: parseInt(lessons[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedLesson,
      message: 'Lesson retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching lesson by ID:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch lesson', details: error.message }
    });
  }
};

// Create new lesson
const createLesson = async (req, res) => {
  try {
    const { unit_id, name, description, order_index, weight } = req.body;
    
    if (!unit_id || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unit ID and name are required' }
      });
    }
    
    // Check if unit exists
    const units = await db.query('SELECT id FROM units WHERE id = ?', [unit_id]);
    if (units.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Unit not found' }
      });
    }
    
    // Get next order index if not provided
    let finalOrderIndex = order_index;
    if (!finalOrderIndex) {
      const maxOrder = await db.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM lessons WHERE unit_id = ?',
        [unit_id]
      );
      finalOrderIndex = maxOrder[0].next_order;
    }
    
    const query = `
      INSERT INTO lessons (unit_id, name, description, order_index, weight)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await db.insert(query, [
      unit_id, name, description || null, finalOrderIndex, weight || 0
    ]);
    
    const newLesson = await db.query('SELECT * FROM lessons WHERE id = ?', [result.insertId]);
    
    // Transform data to ensure proper types
    const transformedLesson = {
      ...newLesson[0],
      weight: parseFloat(newLesson[0].weight) || 0,
      order_index: parseInt(newLesson[0].order_index) || 0,
      unit_id: parseInt(newLesson[0].unit_id) || 0,
      id: parseInt(newLesson[0].id) || 0
    };
    
    res.status(201).json({
      success: true,
      data: transformedLesson,
      message: 'Lesson created successfully'
    });
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create lesson', details: error.message }
    });
  }
};

// Update lesson
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, order_index, weight } = req.body;
    
    const existingLessons = await db.query('SELECT * FROM lessons WHERE id = ?', [id]);
    if (existingLessons.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Lesson not found' }
      });
    }
    
    const query = `
      UPDATE lessons 
      SET name = ?, description = ?, order_index = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await db.execute(query, [
      name || existingLessons[0].name,
      description !== undefined ? description : existingLessons[0].description,
      order_index !== undefined ? order_index : existingLessons[0].order_index,
      weight !== undefined ? weight : existingLessons[0].weight,
      id
    ]);
    
    const updatedLesson = await db.query('SELECT * FROM lessons WHERE id = ?', [id]);
    
    // Transform data to ensure proper types
    const transformedLesson = {
      ...updatedLesson[0],
      weight: parseFloat(updatedLesson[0].weight) || 0,
      order_index: parseInt(updatedLesson[0].order_index) || 0,
      unit_id: parseInt(updatedLesson[0].unit_id) || 0,
      id: parseInt(updatedLesson[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedLesson,
      message: 'Lesson updated successfully'
    });
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update lesson', details: error.message }
    });
  }
};

// Delete lesson
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingLessons = await db.query('SELECT * FROM lessons WHERE id = ?', [id]);
    if (existingLessons.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Lesson not found' }
      });
    }
    
    await db.execute('DELETE FROM lessons WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete lesson', details: error.message }
    });
  }
};

// Auto-distribute weights for lessons in a unit
const distributeWeights = async (req, res) => {
  try {
    const { unit_id } = req.body;
    
    if (!unit_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unit ID is required' }
      });
    }
    
    const lessons = await db.query('SELECT id FROM lessons WHERE unit_id = ? ORDER BY order_index', [unit_id]);
    
    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No lessons found for this unit' }
      });
    }
    
    const equalWeight = 100 / lessons.length;
    
    for (const lesson of lessons) {
      await db.execute('UPDATE lessons SET weight = ? WHERE id = ?', [equalWeight, lesson.id]);
    }
    
    res.json({
      success: true,
      message: `Weights distributed equally (${equalWeight.toFixed(2)}% each) among ${lessons.length} lessons`
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
  getLessonsByUnit,
  getAllLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  distributeWeights
};
