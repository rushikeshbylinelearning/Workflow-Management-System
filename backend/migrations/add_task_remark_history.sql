-- Immutable audit trail for task review / remarks (append-only)
CREATE TABLE IF NOT EXISTS task_remark_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  user_role ENUM('admin', 'assignee') NOT NULL,
  action_type ENUM(
    'task_created',
    'submitted',
    'remark_added',
    'approved',
    'denied',
    'reopened',
    'completed',
    'status_updated'
  ) NOT NULL,
  remark_text TEXT,
  previous_status VARCHAR(32) NULL,
  new_status VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_remark_history_task_created (task_id, created_at),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: one "task created" + one "current status" entry per existing task (no duplicates)
INSERT INTO task_remark_history (task_id, user_id, user_role, action_type, remark_text, previous_status, new_status, created_at)
SELECT
  t.id,
  COALESCE(t.created_by, 1),
  'admin',
  'task_created',
  'Task created',
  NULL,
  t.status,
  COALESCE(t.created_at, NOW())
FROM tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM task_remark_history h
  WHERE h.task_id = t.id AND h.action_type = 'task_created'
);

INSERT INTO task_remark_history (task_id, user_id, user_role, action_type, remark_text, previous_status, new_status, created_at)
SELECT
  t.id,
  COALESCE(t.created_by, 1),
  'admin',
  CASE t.status
    WHEN 'completed' THEN 'completed'
    WHEN 'under-review' THEN 'submitted'
    ELSE 'status_updated'
  END,
  CONCAT('Current status: ', REPLACE(t.status, '-', ' ')),
  NULL,
  t.status,
  COALESCE(t.updated_at, t.created_at, NOW())
FROM tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM task_remark_history h
  WHERE h.task_id = t.id AND h.action_type IN ('completed', 'submitted', 'status_updated')
    AND h.remark_text LIKE 'Current status:%'
);
