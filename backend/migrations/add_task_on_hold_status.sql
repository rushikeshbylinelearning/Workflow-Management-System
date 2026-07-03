-- Add on-hold task status (run once)
ALTER TABLE tasks
  MODIFY COLUMN `status` ENUM(
    'not-started',
    'in-progress',
    'under-review',
    'completed',
    'blocked',
    'skipped',
    'returned',
    'redo-requested',
    'resubmitted',
    'on-hold'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'not-started';
