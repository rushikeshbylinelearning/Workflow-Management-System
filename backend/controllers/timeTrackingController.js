const db = require('../db');

// Helper: format seconds to "Xh Ym" — always non-negative
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Helper: get current UTC time as a MySQL-compatible string
const utcNow = () => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' '); // "YYYY-MM-DD HH:MM:SS" in UTC
};

// Helper: safely compute elapsed seconds between two dates (always >= 0)
const elapsedSeconds = (startTime) => {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  if (isNaN(start) || now < start) return 0;
  return Math.floor((now - start) / 1000);
};

// ▶️ Start Task Timer
const startTaskTimer = async (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = req.user?.id;
  const userType = req.user?.type || 'admin';

  try {
    const task = await db.queryFirst('SELECT id, timer_status, status FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    if (task.status === 'on-hold') {
      return res.status(400).json({ success: false, error: { message: 'This task is on hold and cannot be timed' } });
    }

    // Prevent duplicate active session for this user on this task
    const running = await db.queryFirst(
      'SELECT id FROM task_time_logs WHERE task_id = ? AND user_id = ? AND status = "running"',
      [taskId, userId]
    );
    if (running) {
      return res.status(400).json({ success: false, error: { message: 'Timer already running for this task' } });
    }

    // Use UTC time from Node.js — avoids MySQL server timezone issues
    const startTime = utcNow();
    await db.insert(
      'INSERT INTO task_time_logs (task_id, user_id, user_type, start_time, status) VALUES (?, ?, ?, ?, "running")',
      [taskId, userId, userType, startTime]
    );

    // Update timer_status and also move task status to in-progress if it hasn't started yet
    await db.execute(
      `UPDATE tasks SET timer_status = "in_progress",
        status = CASE WHEN status = 'not-started' THEN 'in-progress' ELSE status END
       WHERE id = ?`,
      [taskId]
    );

    return res.json({ success: true, message: 'Timer started' });
  } catch (err) {
    console.error('startTaskTimer error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to start timer' } });
  }
};

// ⏸ Pause Task Timer
const pauseTaskTimer = async (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = req.user?.id;

  try {
    const log = await db.queryFirst(
      'SELECT id, start_time FROM task_time_logs WHERE task_id = ? AND user_id = ? AND status = "running"',
      [taskId, userId]
    );
    if (!log) {
      return res.status(400).json({ success: false, error: { message: 'No running timer found for this task' } });
    }

    const endTime = utcNow();
    const durationSeconds = elapsedSeconds(log.start_time);

    await db.execute(
      'UPDATE task_time_logs SET end_time = ?, duration_seconds = ?, status = "paused", updated_at = ? WHERE id = ?',
      [endTime, durationSeconds, endTime, log.id]
    );

    await db.execute(
      'UPDATE tasks SET total_time_seconds = total_time_seconds + ?, timer_status = "paused" WHERE id = ?',
      [durationSeconds, taskId]
    );

    return res.json({ success: true, message: 'Timer paused', duration_seconds: durationSeconds });
  } catch (err) {
    console.error('pauseTaskTimer error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to pause timer' } });
  }
};

// ▶️ Resume Task Timer
const resumeTaskTimer = async (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = req.user?.id;
  const userType = req.user?.type || 'admin';

  try {
    const task = await db.queryFirst('SELECT id, status FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    if (task.status === 'on-hold') {
      return res.status(400).json({ success: false, error: { message: 'This task is on hold and cannot be timed' } });
    }

    const running = await db.queryFirst(
      'SELECT id FROM task_time_logs WHERE task_id = ? AND user_id = ? AND status = "running"',
      [taskId, userId]
    );
    if (running) {
      return res.status(400).json({ success: false, error: { message: 'Timer already running' } });
    }

    const startTime = utcNow();
    await db.insert(
      'INSERT INTO task_time_logs (task_id, user_id, user_type, start_time, status) VALUES (?, ?, ?, ?, "running")',
      [taskId, userId, userType, startTime]
    );

    await db.execute(
      `UPDATE tasks SET timer_status = "in_progress",
        status = CASE WHEN status = 'not-started' THEN 'in-progress' ELSE status END
       WHERE id = ?`,
      [taskId]
    );

    return res.json({ success: true, message: 'Timer resumed' });
  } catch (err) {
    console.error('resumeTaskTimer error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to resume timer' } });
  }
};

// ✅ Complete Task Timer
const completeTaskTimer = async (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = req.user?.id;

  try {
    const log = await db.queryFirst(
      'SELECT id, start_time FROM task_time_logs WHERE task_id = ? AND user_id = ? AND status = "running"',
      [taskId, userId]
    );

    if (log) {
      const endTime = utcNow();
      const durationSeconds = elapsedSeconds(log.start_time);
      await db.execute(
        'UPDATE task_time_logs SET end_time = ?, duration_seconds = ?, status = "completed", updated_at = ? WHERE id = ?',
        [endTime, durationSeconds, endTime, log.id]
      );
      await db.execute(
        'UPDATE tasks SET total_time_seconds = total_time_seconds + ? WHERE id = ?',
        [durationSeconds, taskId]
      );
    }

    // Mark all paused logs as completed
    await db.execute(
      'UPDATE task_time_logs SET status = "completed" WHERE task_id = ? AND user_id = ? AND status = "paused"',
      [taskId, userId]
    );

    await db.execute('UPDATE tasks SET timer_status = "completed" WHERE id = ?', [taskId]);

    const task = await db.queryFirst('SELECT total_time_seconds FROM tasks WHERE id = ?', [taskId]);

    return res.json({
      success: true,
      message: 'Timer completed',
      total_time_seconds: task?.total_time_seconds || 0,
      total_time_formatted: formatDuration(task?.total_time_seconds || 0)
    });
  } catch (err) {
    console.error('completeTaskTimer error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to complete timer' } });
  }
};

// 📊 Get Task Time Summary (all sessions)
const getTaskTime = async (req, res) => {
  const taskId = parseInt(req.params.id);

  try {
    const task = await db.queryFirst(
      'SELECT total_time_seconds, timer_status FROM tasks WHERE id = ?',
      [taskId]
    );
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });

    const logs = await db.query(
      `SELECT ttl.id, ttl.user_id, ttl.user_type, ttl.start_time, ttl.end_time,
              ttl.duration_seconds, ttl.status,
              COALESCE(tm.name, au.name) as user_name
       FROM task_time_logs ttl
       LEFT JOIN team_members tm ON ttl.user_id = tm.id AND ttl.user_type = 'team'
       LEFT JOIN admin_users au ON ttl.user_id = au.id AND ttl.user_type = 'admin'
       WHERE ttl.task_id = ?
       ORDER BY ttl.start_time ASC`,
      [taskId]
    );

    const runningLog = logs.find(l => l.status === 'running');
    const liveSeconds = runningLog ? elapsedSeconds(runningLog.start_time) : 0;
    const totalSeconds = Math.max(0, (task.total_time_seconds || 0) + liveSeconds);

    return res.json({
      success: true,
      data: {
        total_time_seconds: totalSeconds,
        total_time_hours: parseFloat((totalSeconds / 3600).toFixed(2)),
        total_time_formatted: formatDuration(totalSeconds),
        timer_status: task.timer_status || 'not_started',
        is_running: !!runningLog,
        sessions: logs.map(l => {
          const dur = l.status === 'running'
            ? elapsedSeconds(l.start_time)
            : Math.max(0, l.duration_seconds || 0);
          return {
            id: l.id,
            user_name: l.user_name,
            start: l.start_time,
            end: l.end_time,
            duration_seconds: dur,
            duration_hours: parseFloat((dur / 3600).toFixed(2)),
            duration_formatted: formatDuration(dur),
            status: l.status
          };
        })
      }
    });
  } catch (err) {
    console.error('getTaskTime error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to get task time' } });
  }
};

// 📊 Get Timer Status for current user on a task
const getTimerStatus = async (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = req.user?.id;

  try {
    const task = await db.queryFirst(
      'SELECT total_time_seconds, timer_status FROM tasks WHERE id = ?',
      [taskId]
    );
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });

    const runningLog = await db.queryFirst(
      'SELECT id, start_time FROM task_time_logs WHERE task_id = ? AND user_id = ? AND status = "running"',
      [taskId, userId]
    );

    const liveSeconds = runningLog ? elapsedSeconds(runningLog.start_time) : 0;
    const totalSeconds = Math.max(0, (task.total_time_seconds || 0) + liveSeconds);

    return res.json({
      success: true,
      data: {
        timer_status: task.timer_status || 'not_started',
        is_running: !!runningLog,
        total_time_seconds: totalSeconds,
        total_time_formatted: formatDuration(totalSeconds),
        live_seconds: liveSeconds
      }
    });
  } catch (err) {
    console.error('getTimerStatus error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to get timer status' } });
  }
};

module.exports = {
  startTaskTimer,
  pauseTaskTimer,
  resumeTaskTimer,
  completeTaskTimer,
  getTaskTime,
  getTimerStatus
};
