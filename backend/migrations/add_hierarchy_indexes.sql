-- Add indexes for educational hierarchy columns in tasks table
-- These indexes improve query performance when filtering tasks by grade, book, unit, or lesson

-- Check if indexes already exist before creating them
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'tasks' 
               AND index_name = 'idx_grade_id');
SET @sqlstmt := IF(@exist > 0, 'SELECT ''Index idx_grade_id already exists''', 
                   'CREATE INDEX idx_grade_id ON tasks(grade_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'tasks' 
               AND index_name = 'idx_book_id');
SET @sqlstmt := IF(@exist > 0, 'SELECT ''Index idx_book_id already exists''', 
                   'CREATE INDEX idx_book_id ON tasks(book_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'tasks' 
               AND index_name = 'idx_unit_id');
SET @sqlstmt := IF(@exist > 0, 'SELECT ''Index idx_unit_id already exists''', 
                   'CREATE INDEX idx_unit_id ON tasks(unit_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'tasks' 
               AND index_name = 'idx_lesson_id');
SET @sqlstmt := IF(@exist > 0, 'SELECT ''Index idx_lesson_id already exists''', 
                   'CREATE INDEX idx_lesson_id ON tasks(lesson_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create composite index for common query patterns (filtering by multiple hierarchy levels)
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'tasks' 
               AND index_name = 'idx_hierarchy_composite');
SET @sqlstmt := IF(@exist > 0, 'SELECT ''Index idx_hierarchy_composite already exists''', 
                   'CREATE INDEX idx_hierarchy_composite ON tasks(project_id, grade_id, book_id, unit_id, lesson_id)');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
