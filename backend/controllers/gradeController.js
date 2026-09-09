          const db = require('../db');
          const {
            getGradeUsage,
            blockedMessage,
            withTransaction,
            cascadeDeleteGrade
          } = require('../utils/hierarchyDeleteGuard');

          // Get all grades for a project
          const getGradesByProject = async (req, res) => {
            try {
              const { projectId } = req.params;
              
              const query = `
                SELECT g.*, 
                      0 as book_count,
                      0 as unit_count,
                      0 as lesson_count
                FROM grades g
                WHERE g.project_id = ?
                ORDER BY g.order_index ASC, g.name ASC
              `;
              
              const grades = await db.query(query, [projectId]);
              
              // Transform data to ensure proper types
              const transformedGrades = grades.map(grade => ({
                ...grade,
                weight: parseFloat(grade.weight) || 0,
                order_index: parseInt(grade.order_index) || 0,
                project_id: parseInt(grade.project_id) || 0,
                id: parseInt(grade.id) || 0
              }));
              
              res.json({
                success: true,
                data: transformedGrades,
                message: 'Grades retrieved successfully'
              });
            } catch (error) {
              console.error('Error fetching grades by project:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to fetch grades',
                  details: error.message
                }
              });
            }
          };

          // Get all grades
          const getAllGrades = async (req, res) => {
            try {
              const query = `
                SELECT g.*, p.name as project_name,
                      COUNT(DISTINCT b.id) as book_count
                FROM grades g
                LEFT JOIN projects p ON g.project_id = p.id
                LEFT JOIN books b ON g.id = b.grade_id
                GROUP BY g.id
                ORDER BY g.project_id, g.order_index ASC
              `;
              
              const grades = await db.query(query);
              
              // Transform data to ensure proper types
              const transformedGrades = grades.map(grade => ({
                ...grade,
                weight: parseFloat(grade.weight) || 0,
                order_index: parseInt(grade.order_index) || 0,
                project_id: parseInt(grade.project_id) || 0,
                id: parseInt(grade.id) || 0
              }));
              
              res.json({
                success: true,
                data: transformedGrades,
                message: 'Grades retrieved successfully'
              });
            } catch (error) {
              console.error('Error fetching all grades:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to fetch grades',
                  details: error.message
                }
              });
            }
          };

          // Get grade by ID
          const getGradeById = async (req, res) => {
            try {
              const { id } = req.params;
              
              const query = `
                SELECT g.*, p.name as project_name
                FROM grades g
                LEFT JOIN projects p ON g.project_id = p.id
                WHERE g.id = ?
              `;
              
              const grades = await db.query(query, [id]);
              
              if (grades.length === 0) {
                return res.status(404).json({
                  success: false,
                  error: {
                    message: 'Grade not found'
                  }
                });
              }
              
              // Transform data to ensure proper types
              const transformedGrade = {
                ...grades[0],
                weight: parseFloat(grades[0].weight) || 0,
                order_index: parseInt(grades[0].order_index) || 0,
                project_id: parseInt(grades[0].project_id) || 0,
                id: parseInt(grades[0].id) || 0
              };
              
              res.json({
                success: true,
                data: transformedGrade,
                message: 'Grade retrieved successfully'
              });
            } catch (error) {
              console.error('Error fetching grade by ID:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to fetch grade',
                  details: error.message
                }
              });
            }
          };

          // Create new grade
          const createGrade = async (req, res) => {
            try {
              const { project_id, name, description, order_index, weight } = req.body;
              
              // Validate required fields
              if (!project_id || !name) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: 'Project ID and name are required'
                  }
                });
              }
              
              // Check if project exists
              const projects = await db.query('SELECT id FROM projects WHERE id = ?', [project_id]);
              if (projects.length === 0) {
                return res.status(404).json({
                  success: false,
                  error: {
                    message: 'Project not found'
                  }
                });
              }
              
              // Get next order index if not provided
              let finalOrderIndex = order_index;
              if (!finalOrderIndex) {
                const maxOrder = await db.query(
                  'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM grades WHERE project_id = ?',
                  [project_id]
                );
                finalOrderIndex = maxOrder[0].next_order;
              }
              
              const query = `
                INSERT INTO grades (project_id, name, description, order_index, weight)
                VALUES (?, ?, ?, ?, ?)
              `;
              
              const result = await db.insert(query, [
                project_id,
                name,
                description || null,
                finalOrderIndex,
                weight || 0
              ]);
              
              // Fetch the created grade
              const newGrade = await db.query('SELECT * FROM grades WHERE id = ?', [result.insertId]);
              
              // Transform data to ensure proper types
              const transformedGrade = {
                ...newGrade[0],
                weight: parseFloat(newGrade[0].weight) || 0,
                order_index: parseInt(newGrade[0].order_index) || 0,
                project_id: parseInt(newGrade[0].project_id) || 0,
                id: parseInt(newGrade[0].id) || 0
              };
              
              res.status(201).json({
                success: true,
                data: transformedGrade,
                message: 'Grade created successfully'
              });
            } catch (error) {
              console.error('Error creating grade:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to create grade',
                  details: error.message
                }
              });
            }
          };

            // Update grade
          const updateGrade = async (req, res) => {
            try {
              const { id } = req.params;
              const { name, description, order_index, weight } = req.body;
              
              // Check if grade exists
              const existingGrades = await db.query('SELECT * FROM grades WHERE id = ?', [id]);
              if (existingGrades.length === 0) {
                return res.status(404).json({
                  success: false,
                  error: {
                    message: 'Grade not found'
                  }
                });
              }
              
              const query = `
                UPDATE grades 
                SET name = ?, description = ?, order_index = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `;
              
              await db.execute(query, [
                name || existingGrades[0].name,
                description !== undefined ? description : existingGrades[0].description,
                order_index !== undefined ? order_index : existingGrades[0].order_index,
                weight !== undefined ? weight : existingGrades[0].weight,
                id
              ]);
              
              // Fetch the updated grade
              const updatedGrade = await db.query('SELECT * FROM grades WHERE id = ?', [id]);
              
              // Transform data to ensure proper types
              const transformedGrade = {
                ...updatedGrade[0],
                weight: parseFloat(updatedGrade[0].weight) || 0,
                order_index: parseInt(updatedGrade[0].order_index) || 0,
                project_id: parseInt(updatedGrade[0].project_id) || 0,
                id: parseInt(updatedGrade[0].id) || 0
              };
              
              res.json({
                success: true,
                data: transformedGrade,
                message: 'Grade updated successfully'
              });
            } catch (error) {
              console.error('Error updating grade:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to update grade',
                  details: error.message
                }
              });
            }
          };

            // Delete grade
          const deleteGrade = async (req, res) => {
            try {
              const { id } = req.params;
              
              // Check if grade exists
              const existingGrades = await db.query('SELECT * FROM grades WHERE id = ?', [id]);
              if (existingGrades.length === 0) {
                return res.status(404).json({
                  success: false,
                  error: {
                    message: 'Grade not found'
                  }
                });
              }
              
              const usage = await getGradeUsage(id);
              const blocked = blockedMessage('grade', usage);
              if (blocked) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: blocked
                  }
                });
              }

              await withTransaction(async (conn) => {
                await cascadeDeleteGrade(conn, id);
              });
              
              res.json({
                success: true,
                message: 'Grade deleted successfully'
              });
            } catch (error) {
              console.error('Error deleting grade:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to delete grade',
                  details: error.message
                }
              });
            }
          };

          // Auto-distribute weights for grades in a project
          const distributeWeights = async (req, res) => {
            try {
              const { project_id } = req.body;
              
              if (!project_id) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: 'Project ID is required'
                  }
                });
              }
              
              // Get all grades for the project
              const grades = await db.query('SELECT id FROM grades WHERE project_id = ? ORDER BY order_index', [project_id]);
              
              if (grades.length === 0) {
                return res.status(404).json({
                  success: false,
                  error: {
                    message: 'No grades found for this project'
                  }
                });
              }
              
              // Calculate equal weight distribution
              const equalWeight = 100 / grades.length;
              
              // Update all grades with equal weight
              for (const grade of grades) {
                await db.execute('UPDATE grades SET weight = ? WHERE id = ?', [equalWeight, grade.id]);
              }
              
              res.json({
                success: true,
                message: `Weights distributed equally (${equalWeight.toFixed(2)}% each) among ${grades.length} grades`
              });
            } catch (error) {
              console.error('Error distributing weights:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to distribute weights',
                  details: error.message
                }
              });
            }
          };

          // Bulk upload educational hierarchy from Excel data
          const bulkUpload = async (req, res) => {
            const { project_id, data } = req.body;
            
            if (!project_id || !data || !Array.isArray(data)) {
              return res.status(400).json({
                success: false,
                error: { message: 'Project ID and data array are required' }
              });
            }
            
            // Verify project exists before acquiring a connection
            const projects = await db.query('SELECT id FROM projects WHERE id = ?', [project_id]);
            if (projects.length === 0) {
              return res.status(404).json({
                success: false,
                error: { message: 'Project not found' }
              });
            }
            
            const conn = await db.getPool().getConnection();
            try {
              await conn.beginTransaction();

              const created = { grades: 0, books: 0, units: 0, lessons: 0 };
              const gradeMap = new Map();
              const bookMap = new Map();
              const unitMap = new Map();
              const lessonMap = new Map();
              const bookNextOrder = new Map();
              const unitNextOrder = new Map();
              const lessonNextOrder = new Map();

              const bumpOrder = (map, parentId) => {
                const next = (map.get(parentId) || 0) + 1;
                map.set(parentId, next);
                return next;
              };

              // Preload existing hierarchy so uploads merge instead of duplicating
              const [existingGrades] = await conn.execute(
                'SELECT id, name, order_index FROM grades WHERE project_id = ? ORDER BY order_index ASC, id ASC',
                [project_id]
              );
              let gradeOrderIndex = 1;
              for (const grade of existingGrades) {
                const gradeKey = String(grade.name).trim();
                if (!gradeMap.has(gradeKey)) {
                  gradeMap.set(gradeKey, grade.id);
                }
                gradeOrderIndex = Math.max(gradeOrderIndex, (grade.order_index || 0) + 1);
              }

              const [existingBooks] = await conn.execute(
                `SELECT b.id, b.grade_id, b.name, b.order_index
                FROM books b
                INNER JOIN grades g ON g.id = b.grade_id
                WHERE g.project_id = ?`,
                [project_id]
              );
              for (const book of existingBooks) {
                const bookName = String(book.name).trim();
                bookMap.set(`${book.grade_id}::${bookName}`, book.id);
                const current = bookNextOrder.get(book.grade_id) || 0;
                bookNextOrder.set(book.grade_id, Math.max(current, book.order_index || 0));
              }

              const [existingUnits] = await conn.execute(
                `SELECT u.id, u.book_id, u.name, u.order_index
                FROM units u
                INNER JOIN books b ON b.id = u.book_id
                INNER JOIN grades g ON g.id = b.grade_id
                WHERE g.project_id = ?`,
                [project_id]
              );
              for (const unit of existingUnits) {
                const unitName = String(unit.name).trim();
                unitMap.set(`${unit.book_id}::${unitName}`, unit.id);
                const current = unitNextOrder.get(unit.book_id) || 0;
                unitNextOrder.set(unit.book_id, Math.max(current, unit.order_index || 0));
              }

              const [existingLessons] = await conn.execute(
                `SELECT l.id, l.unit_id, l.name, l.order_index
                FROM lessons l
                INNER JOIN units u ON u.id = l.unit_id
                INNER JOIN books b ON b.id = u.book_id
                INNER JOIN grades g ON g.id = b.grade_id
                WHERE g.project_id = ?`,
                [project_id]
              );
              for (const lesson of existingLessons) {
                const lessonName = String(lesson.name).trim();
                lessonMap.set(`${lesson.unit_id}::${lessonName}`, lesson.id);
                const current = lessonNextOrder.get(lesson.unit_id) || 0;
                lessonNextOrder.set(lesson.unit_id, Math.max(current, lesson.order_index || 0));
              }

              for (const row of data) {
                // Skip rows with no grade — cannot build hierarchy without it
                if (!row.grade || String(row.grade).trim() === '') continue;

                // --- Grade ---
                let gradeId;
                const gradeKey = String(row.grade).trim();
                if (!gradeMap.has(gradeKey)) {
                  const [gradeResult] = await conn.execute(
                    'INSERT INTO grades (project_id, name, description, order_index, weight) VALUES (?, ?, ?, ?, ?)',
                    [project_id, gradeKey, row.gradeDescription || null, gradeOrderIndex++, row.gradeWeight || 0]
                  );
                  gradeId = gradeResult.insertId;
                  gradeMap.set(gradeKey, gradeId);
                  created.grades++;
                } else {
                  gradeId = gradeMap.get(gradeKey);
                }

                // --- Book ---
                let bookId;
                if (row.book && String(row.book).trim() !== '') {
                  const bookName = String(row.book).trim();
                  const bookKey = `${gradeId}::${bookName}`;
                  if (!bookMap.has(bookKey)) {
                    const orderIndex = bumpOrder(bookNextOrder, gradeId);
                    const [bookResult] = await conn.execute(
                      'INSERT INTO books (grade_id, name, type, description, order_index, weight) VALUES (?, ?, ?, ?, ?, ?)',
                      [gradeId, bookName, row.bookType || 'student', row.bookDescription || null, orderIndex, row.bookWeight || 0]
                    );
                    bookId = bookResult.insertId;
                    bookMap.set(bookKey, bookId);
                    created.books++;
                  } else {
                    bookId = bookMap.get(bookKey);
                  }
                }

                // --- Unit ---
                let unitId;
                if (bookId && row.unit && String(row.unit).trim() !== '') {
                  const unitName = String(row.unit).trim();
                  const unitKey = `${bookId}::${unitName}`;
                  if (!unitMap.has(unitKey)) {
                    const orderIndex = bumpOrder(unitNextOrder, bookId);
                    const [unitResult] = await conn.execute(
                      'INSERT INTO units (book_id, name, description, order_index, weight) VALUES (?, ?, ?, ?, ?)',
                      [bookId, unitName, row.unitDescription || null, orderIndex, row.unitWeight || 0]
                    );
                    unitId = unitResult.insertId;
                    unitMap.set(unitKey, unitId);
                    created.units++;
                  } else {
                    unitId = unitMap.get(unitKey);
                  }
                }

                // --- Lesson ---
                if (unitId && row.lesson && String(row.lesson).trim() !== '') {
                  const lessonName = String(row.lesson).trim();
                  const lessonKey = `${unitId}::${lessonName}`;
                  if (!lessonMap.has(lessonKey)) {
                    const orderIndex = bumpOrder(lessonNextOrder, unitId);
                    await conn.execute(
                      'INSERT INTO lessons (unit_id, name, description, order_index, weight) VALUES (?, ?, ?, ?, ?)',
                      [unitId, lessonName, row.lessonDescription || null, orderIndex, row.lessonWeight || 0]
                    );
                    lessonMap.set(lessonKey, true);
                    created.lessons++;
                  }
                }
              }
              
              await conn.commit();
              
              res.status(200).json({
                success: true,
                data: { created }
              });
              
            } catch (error) {
              await conn.rollback();
              console.error('Error in bulk upload, transaction rolled back:', error);
              res.status(500).json({
                success: false,
                error: {
                  message: 'Failed to bulk upload data — all changes have been rolled back',
                  details: error.message
                }
              });
            } finally {
              conn.release();
            }
          };

          module.exports = {
            getGradesByProject,
            getAllGrades,
            getGradeById,
            createGrade,
            updateGrade,
            deleteGrade,
            distributeWeights,
            bulkUpload
          };
