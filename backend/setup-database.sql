-- ============================================================================
-- Database Setup Script for Workflow LMS
-- ============================================================================
-- This script creates the database and user if they don't exist
-- Run this as root user: mysql -u root -p < setup-database.sql
-- ============================================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS bylinelm_workflow_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user if it doesn't exist
CREATE USER IF NOT EXISTS 'bylinelm_workflow_db'@'localhost' 
IDENTIFIED BY 'admin@Byline25';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON bylinelm_workflow_db.* 
TO 'bylinelm_workflow_db'@'localhost';

-- Also allow from any host (for development/testing)
CREATE USER IF NOT EXISTS 'bylinelm_workflow_db'@'%' 
IDENTIFIED BY 'admin@Byline25';

GRANT ALL PRIVILEGES ON bylinelm_workflow_db.* 
TO 'bylinelm_workflow_db'@'%';

-- Apply the privilege changes
FLUSH PRIVILEGES;

-- Verify the setup
SELECT 'Database and user created successfully!' as Status;
SELECT user, host FROM mysql.user WHERE user = 'bylinelm_workflow_db';
