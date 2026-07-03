-- Resubmission deadline when admin returns task for rework (separate from end_date)
ALTER TABLE tasks
  ADD COLUMN resubmission_deadline DATETIME NULL COMMENT 'Assignee must resubmit by this time',
  ADD COLUMN resubmission_set_by INT NULL COMMENT 'Admin user id who set the deadline',
  ADD COLUMN resubmission_set_at DATETIME NULL COMMENT 'When resubmission deadline was set';

CREATE INDEX idx_tasks_resubmission_deadline ON tasks (resubmission_deadline);
