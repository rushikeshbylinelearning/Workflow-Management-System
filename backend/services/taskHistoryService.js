const db = require('../db');

async function recordTaskEvent(event, database = db) {
  try {
    await database.execute(
      `INSERT INTO task_history_events
        (task_id, action, field_name, old_value, new_value, changed_by_id, changed_by_name, changed_at, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [
        event.taskId,
        event.action,
        event.fieldName || null,
        event.oldValue == null ? null : String(event.oldValue),
        event.newValue == null ? null : String(event.newValue),
        event.changedById || 0,
        event.changedByName || 'unknown',
        event.details || null,
      ]
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return;
    console.error('task history event failed:', error.message);
  }
}

function actor(user) {
  return {
    changedById: user && user.id ? Number(user.id) : 0,
    changedByName: (user && (user.name || user.email)) || 'unknown',
  };
}

module.exports = { recordTaskEvent, actor };
