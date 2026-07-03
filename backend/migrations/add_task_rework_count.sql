-- Rework escalation: count admin returns to assignee (resets on final approval)
-- Run once; ignore duplicate-column errors if re-applying.
ALTER TABLE tasks
  ADD COLUMN rework_count INT NOT NULL DEFAULT 0
  COMMENT 'Admin return-to-assignee cycles; 0=normal';

ALTER TABLE task_remark_history
  ADD COLUMN rework_count INT NULL AFTER new_status;

-- Extend action enum for explicit rework return events
ALTER TABLE task_remark_history
  MODIFY COLUMN action_type ENUM(
    'task_created',
    'submitted',
    'remark_added',
    'approved',
    'denied',
    'reopened',
    'completed',
    'status_updated',
    'returned_for_rework'
  ) NOT NULL;
