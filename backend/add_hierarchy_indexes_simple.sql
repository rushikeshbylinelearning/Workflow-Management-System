-- Add indexes for educational hierarchy columns in tasks table
-- Run this SQL in phpMyAdmin or MySQL Workbench to improve performance

USE workflow_db;

-- Add individual indexes
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_grade_id (grade_id);
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_book_id (book_id);
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_unit_id (unit_id);
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_lesson_id (lesson_id);

-- Add composite index for multi-level filtering
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_hierarchy_composite (project_id, grade_id, book_id, unit_id, lesson_id);

-- Verify indexes were created
SHOW INDEX FROM tasks WHERE Key_name LIKE 'idx_%hierarchy%' OR Key_name LIKE 'idx_grade%' OR Key_name LIKE 'idx_book%' OR Key_name LIKE 'idx_unit%' OR Key_name LIKE 'idx_lesson%';
