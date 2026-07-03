-- Migration: Add server_location field to tasks table
-- Description: Adds server_location column to tasks table to store file paths assigned by admin
-- Date: 2026-05-06

-- Add server_location column to tasks table
ALTER TABLE `tasks` 
ADD COLUMN `server_location` VARCHAR(500) NULL COMMENT 'Server path where task files should be saved' AFTER `component_path`;

-- Add index for better performance
ALTER TABLE `tasks` 
ADD INDEX `idx_server_location` (`server_location`);
