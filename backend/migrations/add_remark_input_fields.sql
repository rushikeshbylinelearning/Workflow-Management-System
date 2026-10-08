-- Migration: add_remark_input_fields
-- Description: Admin-defined extra remark text fields, assigned per employee
-- Created: 2026-09-18

CREATE TABLE IF NOT EXISTS `remark_input_fields` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 100,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_remark_input_field_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `team_member_remark_fields` (
  `team_member_id` INT NOT NULL,
  `field_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_member_id`, `field_id`),
  CONSTRAINT `fk_tmrf_member` FOREIGN KEY (`team_member_id`) REFERENCES `team_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tmrf_field` FOREIGN KEY (`field_id`) REFERENCES `remark_input_fields` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `task_remarks`
  ADD COLUMN `extra_fields` JSON NULL COMMENT 'Admin-defined extra remark input values';
