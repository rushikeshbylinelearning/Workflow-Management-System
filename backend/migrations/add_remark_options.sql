-- Migration: add_remark_options
-- Description: Per-assignee remark/stage options for Add Remark, Bulk Add Remark, and Teams
-- Created: 2026-09-18

-- Allow custom remark types beyond the original four values
ALTER TABLE `task_remarks`
  MODIFY COLUMN `remark_type` VARCHAR(64) DEFAULT 'general';

CREATE TABLE IF NOT EXISTS `remark_options` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `status_effect` ENUM('none', 'in-progress', 'under-review', 'skipped') NOT NULL DEFAULT 'none',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 100,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_remark_option_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `team_member_remark_options` (
  `team_member_id` INT NOT NULL,
  `option_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_member_id`, `option_id`),
  CONSTRAINT `fk_tmro_member` FOREIGN KEY (`team_member_id`) REFERENCES `team_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tmro_option` FOREIGN KEY (`option_id`) REFERENCES `remark_options` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `remark_options` (`slug`, `label`, `status_effect`, `is_system`, `sort_order`) VALUES
  ('general', 'General / In Progress', 'in-progress', 1, 10),
  ('complete', 'Completed', 'under-review', 1, 20),
  ('skipped', 'Skipped', 'skipped', 1, 30),
  ('other', 'Other', 'none', 1, 40);
