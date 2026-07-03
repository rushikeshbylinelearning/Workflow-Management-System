-- Migration: Add active_extension_requests table
-- Description: Creates table to track extension requests for tasks/projects
-- Created: 2026-05-11

-- Drop table if it exists (to start fresh)
DROP TABLE IF EXISTS active_extension_requests;

-- Create active_extension_requests table (without foreign keys to avoid constraint errors)
CREATE TABLE active_extension_requests (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    task_id INT(11) NOT NULL,
    project_id INT(11) NOT NULL,
    requested_by INT(11) NOT NULL,
    current_deadline DATETIME NOT NULL,
    requested_deadline DATETIME NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT(11) NULL,
    reviewed_at DATETIME NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better query performance
    INDEX idx_task_id (task_id),
    INDEX idx_project_id (project_id),
    INDEX idx_status (status),
    INDEX idx_requested_by (requested_by),
    INDEX idx_reviewed_by (reviewed_by),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores extension requests for task deadlines';

-- Note: Foreign keys are intentionally omitted to avoid constraint errors
-- The application layer should handle referential integrity
-- Relationships:
--   task_id -> tasks(id)
--   project_id -> projects(id)
--   requested_by -> team_members(id)
--   reviewed_by -> admin_users(id)
