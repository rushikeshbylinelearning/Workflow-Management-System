-- Migration to add Server Location and File Name fields to task_remarks table
-- Also adds 'skipped' option to task status enum

-- Add new columns to task_remarks table
ALTER TABLE `task_remarks` 
ADD COLUMN `server_location` VARCHAR(500) NULL COMMENT 'Server path where files are saved',
ADD COLUMN `file_name` VARCHAR(255) NULL COMMENT 'Exact name of the file worked on';

-- Add 'skipped' option to tasks status enum
ALTER TABLE `tasks` 
MODIFY COLUMN `status` ENUM('not-started','in-progress','under-review','completed','blocked','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'not-started';

-- Update remark_type enum to only include the 4 required options
ALTER TABLE `task_remarks` 
MODIFY COLUMN `remark_type` ENUM('general','complete','skipped','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'general';

-- Add indexes for better performance
ALTER TABLE `task_remarks` 
ADD INDEX `idx_server_location` (`server_location`),
ADD INDEX `idx_file_name` (`file_name`);
