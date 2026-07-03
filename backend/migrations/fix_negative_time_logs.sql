-- Fix negative duration_seconds caused by MySQL/Node.js timezone mismatch
-- Safe to run multiple times (idempotent)

-- 1. Zero out any negative duration rows in time logs
UPDATE task_time_logs
SET duration_seconds = 0
WHERE duration_seconds < 0;

-- 2. Recalculate total_time_seconds for all tasks from their completed/paused sessions
UPDATE tasks t
SET total_time_seconds = (
  SELECT COALESCE(SUM(duration_seconds), 0)
  FROM task_time_logs
  WHERE task_id = t.id
    AND status IN ('paused', 'completed')
    AND duration_seconds >= 0
);

-- 3. Ensure total_time_seconds is never negative
UPDATE tasks
SET total_time_seconds = 0
WHERE total_time_seconds < 0;
