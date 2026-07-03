const db = require('../db');

// Get all books for a grade
const getBooksByGrade = async (req, res) => {
  try {
    const { gradeId } = req.params;
    
    const query = `
      SELECT b.*, g.name as grade_name,
             COUNT(DISTINCT u.id) as unit_count,
             COUNT(DISTINCT l.id) as lesson_count
      FROM books b
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN units u ON b.id = u.book_id
      LEFT JOIN lessons l ON u.id = l.unit_id
      WHERE b.grade_id = ?
      GROUP BY b.id
      ORDER BY b.order_index ASC, b.name ASC
    `;
    
    const books = await db.query(query, [gradeId]);
    
    // Transform data to ensure proper types
    const transformedBooks = books.map(book => ({
      ...book,
      weight: parseFloat(book.weight) || 0,
      order_index: parseInt(book.order_index) || 0,
      grade_id: parseInt(book.grade_id) || 0,
      id: parseInt(book.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedBooks,
      message: 'Books retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching books by grade:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch books', details: error.message }
    });
  }
};

// Get all books
const getAllBooks = async (req, res) => {
  try {
    const query = `
      SELECT b.*, g.name as grade_name, p.name as project_name
      FROM books b
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      ORDER BY p.id, g.order_index, b.order_index
    `;
    
    const books = await db.query(query);
    
    // Transform data to ensure proper types
    const transformedBooks = books.map(book => ({
      ...book,
      weight: parseFloat(book.weight) || 0,
      order_index: parseInt(book.order_index) || 0,
      grade_id: parseInt(book.grade_id) || 0,
      id: parseInt(book.id) || 0
    }));
    
    res.json({
      success: true,
      data: transformedBooks,
      message: 'Books retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching all books:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch books', details: error.message }
    });
  }
};

// Get book by ID
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT b.*, g.name as grade_name, p.name as project_name
      FROM books b
      LEFT JOIN grades g ON b.grade_id = g.id
      LEFT JOIN projects p ON g.project_id = p.id
      WHERE b.id = ?
    `;
    
    const books = await db.query(query, [id]);
    
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Book not found' }
      });
    }
    
    // Transform data to ensure proper types
    const transformedBook = {
      ...books[0],
      weight: parseFloat(books[0].weight) || 0,
      order_index: parseInt(books[0].order_index) || 0,
      grade_id: parseInt(books[0].grade_id) || 0,
      id: parseInt(books[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedBook,
      message: 'Book retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch book', details: error.message }
    });
  }
};

// Create new book
const createBook = async (req, res) => {
  try {
    const { grade_id, name, type, description, order_index, weight } = req.body;
    
    if (!grade_id || !name || !type) {
      return res.status(400).json({
        success: false,
        error: { message: 'Grade ID, name, and type are required' }
      });
    }
    
    // Check if grade exists
    const grades = await db.query('SELECT id FROM grades WHERE id = ?', [grade_id]);
    if (grades.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Grade not found' }
      });
    }
    
    // Get next order index if not provided
    let finalOrderIndex = order_index;
    if (!finalOrderIndex) {
      const maxOrder = await db.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM books WHERE grade_id = ?',
        [grade_id]
      );
      finalOrderIndex = maxOrder[0].next_order;
    }
    
    const query = `
      INSERT INTO books (grade_id, name, type, description, order_index, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.insert(query, [
      grade_id, name, type, description || null, finalOrderIndex, weight || 0
    ]);
    
    const newBook = await db.query('SELECT * FROM books WHERE id = ?', [result.insertId]);
    
    // Transform data to ensure proper types
    const transformedBook = {
      ...newBook[0],
      weight: parseFloat(newBook[0].weight) || 0,
      order_index: parseInt(newBook[0].order_index) || 0,
      grade_id: parseInt(newBook[0].grade_id) || 0,
      id: parseInt(newBook[0].id) || 0
    };
    
    res.status(201).json({
      success: true,
      data: transformedBook,
      message: 'Book created successfully'
    });
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create book', details: error.message }
    });
  }
};

// Update book
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, order_index, weight } = req.body;
    
    const existingBooks = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    if (existingBooks.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Book not found' }
      });
    }
    
    const query = `
      UPDATE books 
      SET name = ?, type = ?, description = ?, order_index = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await db.execute(query, [
      name || existingBooks[0].name,
      type || existingBooks[0].type,
      description !== undefined ? description : existingBooks[0].description,
      order_index !== undefined ? order_index : existingBooks[0].order_index,
      weight !== undefined ? weight : existingBooks[0].weight,
      id
    ]);
    
    const updatedBook = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    
    // Transform data to ensure proper types
    const transformedBook = {
      ...updatedBook[0],
      weight: parseFloat(updatedBook[0].weight) || 0,
      order_index: parseInt(updatedBook[0].order_index) || 0,
      grade_id: parseInt(updatedBook[0].grade_id) || 0,
      id: parseInt(updatedBook[0].id) || 0
    };
    
    res.json({
      success: true,
      data: transformedBook,
      message: 'Book updated successfully'
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update book', details: error.message }
    });
  }
};

// Delete book
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingBooks = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    if (existingBooks.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Book not found' }
      });
    }
    
    // Check if book has units
    const units = await db.query('SELECT COUNT(*) as count FROM units WHERE book_id = ?', [id]);
    if (units[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete book with existing units. Please delete units first.' }
      });
    }
    
    await db.execute('DELETE FROM books WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete book', details: error.message }
    });
  }
};

// Auto-distribute weights for books in a grade
const distributeWeights = async (req, res) => {
  try {
    const { grade_id } = req.body;
    
    if (!grade_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Grade ID is required' }
      });
    }
    
    const books = await db.query('SELECT id FROM books WHERE grade_id = ? ORDER BY order_index', [grade_id]);
    
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No books found for this grade' }
      });
    }
    
    const equalWeight = 100 / books.length;
    
    for (const book of books) {
      await db.execute('UPDATE books SET weight = ? WHERE id = ?', [equalWeight, book.id]);
    }
    
    res.json({
      success: true,
      message: `Weights distributed equally (${equalWeight.toFixed(2)}% each) among ${books.length} books`
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
  getBooksByGrade,
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  distributeWeights
};
