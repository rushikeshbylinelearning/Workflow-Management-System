-- Migration: Create API Keys table for public dashboard access
-- Run: node backend/run-migration.js (or execute manually)

CREATE TABLE IF NOT EXISTS api_keys (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL COMMENT 'Human-readable label for this key',
  api_key       VARCHAR(64)   NOT NULL UNIQUE COMMENT 'The actual key sent in X-API-Key header',
  key_prefix    VARCHAR(8)    NOT NULL COMMENT 'First 8 chars shown in UI for identification',
  created_by_id INT           NOT NULL COMMENT 'admin_users.id who created this key',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  last_used_at  DATETIME      NULL,
  expires_at    DATETIME      NULL COMMENT 'NULL = never expires',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_key   (api_key),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (created_by_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
