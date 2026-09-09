const db = require('../db');

function normalizeUsage(row) {
  const taskCount = Number(row?.task_count) || 0;
  const assignedTaskCount = Number(row?.assigned_task_count) || 0;
  return { taskCount, assignedTaskCount };
}

function usageQuery(whereSql) {
  return `
    SELECT
      COUNT(DISTINCT t.id) AS task_count,
      COUNT(DISTINCT CASE WHEN ta.id IS NOT NULL THEN t.id END) AS assigned_task_count
    FROM tasks t
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    WHERE ${whereSql}
  `;
}

async function getGradeUsage(gradeId) {
  const rows = await db.query(usageQuery(`
    t.grade_id = ?
    OR t.book_id IN (SELECT id FROM books WHERE grade_id = ?)
    OR t.unit_id IN (
      SELECT u.id FROM units u
      INNER JOIN books b ON u.book_id = b.id
      WHERE b.grade_id = ?
    )
    OR t.lesson_id IN (
      SELECT l.id FROM lessons l
      INNER JOIN units u ON l.unit_id = u.id
      INNER JOIN books b ON u.book_id = b.id
      WHERE b.grade_id = ?
    )
  `), [gradeId, gradeId, gradeId, gradeId]);
  return normalizeUsage(rows[0]);
}

async function getBookUsage(bookId) {
  const rows = await db.query(usageQuery(`
    t.book_id = ?
    OR t.unit_id IN (SELECT id FROM units WHERE book_id = ?)
    OR t.lesson_id IN (
      SELECT l.id FROM lessons l
      INNER JOIN units u ON l.unit_id = u.id
      WHERE u.book_id = ?
    )
  `), [bookId, bookId, bookId]);
  return normalizeUsage(rows[0]);
}

async function getUnitUsage(unitId) {
  const rows = await db.query(usageQuery(`
    t.unit_id = ?
    OR t.lesson_id IN (SELECT id FROM lessons WHERE unit_id = ?)
  `), [unitId, unitId]);
  return normalizeUsage(rows[0]);
}

async function getLessonUsage(lessonId) {
  const rows = await db.query(usageQuery('t.lesson_id = ?'), [lessonId]);
  return normalizeUsage(rows[0]);
}

function blockedMessage(label, usage) {
  if (!usage || usage.taskCount === 0) return null;
  if (usage.assignedTaskCount > 0) {
    return `Cannot delete ${label} that is assigned to team members. Please reassign or delete those tasks first.`;
  }
  return `Cannot delete ${label} with existing tasks. Please delete or reassign those tasks first.`;
}

async function withTransaction(work) {
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    await work(conn);
    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  } finally {
    conn.release();
  }
}

async function cascadeDeleteBook(conn, bookId) {
  const [units] = await conn.query('SELECT id FROM units WHERE book_id = ?', [bookId]);
  const unitIds = units.map((unit) => unit.id);
  if (unitIds.length > 0) {
    const placeholders = unitIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM lessons WHERE unit_id IN (${placeholders})`, unitIds);
    await conn.query('DELETE FROM units WHERE book_id = ?', [bookId]);
  }
  await conn.query('DELETE FROM books WHERE id = ?', [bookId]);
}

async function cascadeDeleteGrade(conn, gradeId) {
  const [books] = await conn.query('SELECT id FROM books WHERE grade_id = ?', [gradeId]);
  const bookIds = books.map((book) => book.id);
  if (bookIds.length > 0) {
    const bookPlaceholders = bookIds.map(() => '?').join(',');
    const [units] = await conn.query(
      `SELECT id FROM units WHERE book_id IN (${bookPlaceholders})`,
      bookIds
    );
    const unitIds = units.map((unit) => unit.id);
    if (unitIds.length > 0) {
      const unitPlaceholders = unitIds.map(() => '?').join(',');
      await conn.query(`DELETE FROM lessons WHERE unit_id IN (${unitPlaceholders})`, unitIds);
      await conn.query(`DELETE FROM units WHERE book_id IN (${bookPlaceholders})`, bookIds);
    }
    await conn.query('DELETE FROM books WHERE grade_id = ?', [gradeId]);
  }
  await conn.query('DELETE FROM grades WHERE id = ?', [gradeId]);
}

async function cascadeDeleteUnit(conn, unitId) {
  await conn.query('DELETE FROM lessons WHERE unit_id = ?', [unitId]);
  await conn.query('DELETE FROM units WHERE id = ?', [unitId]);
}

module.exports = {
  getGradeUsage,
  getBookUsage,
  getUnitUsage,
  getLessonUsage,
  blockedMessage,
  withTransaction,
  cascadeDeleteBook,
  cascadeDeleteGrade,
  cascadeDeleteUnit
};
