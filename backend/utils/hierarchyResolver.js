/**
 * Resolve educational hierarchy names (Grade → Book → Unit → Lesson) within a project.
 * Used by bulk task upload and bulk task tagging.
 */

const normalizeHierarchyName = (s) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[\u2013\u2014\u2012\u2010\u2011\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const trimValue = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const buildComponentPath = ({ gradeName, bookName, unitName, lessonName }) => {
  const parts = [gradeName, bookName, unitName, lessonName].filter(Boolean);
  return parts.length > 0 ? parts.join(' > ') : null;
};

/**
 * Extract hierarchy column values from a bulk upload row.
 * Supports standard and export-style column headers.
 */
const extractHierarchyNamesFromRow = (row) => ({
  grade: trimValue(row.Grade ?? row['Level 1 (Grade)']),
  book: trimValue(row.Book ?? row['Level 2 (Book)']),
  unit: trimValue(row.Unit ?? row['Level 3 (Unit)']),
  lesson: trimValue(row.Lesson ?? row['Level 4 (Lesson)']),
});

/**
 * Load hierarchy lookup maps for a project using an existing DB connection.
 */
const loadHierarchyMaps = async (connection, projectId) => {
  const gradeMap = new Map();
  const bookMap = new Map();
  const unitMap = new Map();
  const lessonMap = new Map();

  const [grades] = await connection.execute(
    'SELECT id, name FROM grades WHERE project_id = ?',
    [projectId]
  );
  for (const grade of grades) {
    gradeMap.set(normalizeHierarchyName(grade.name), { id: grade.id, name: grade.name });
  }

  const [books] = await connection.execute(
    `SELECT b.id, b.name, b.grade_id
     FROM books b
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE g.project_id = ?`,
    [projectId]
  );
  for (const book of books) {
    const key = `${book.grade_id}::${normalizeHierarchyName(book.name)}`;
    bookMap.set(key, { id: book.id, name: book.name, grade_id: book.grade_id });
  }

  const [units] = await connection.execute(
    `SELECT u.id, u.name, u.book_id, b.grade_id
     FROM units u
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE g.project_id = ?`,
    [projectId]
  );
  for (const unit of units) {
    const key = `${unit.book_id}::${normalizeHierarchyName(unit.name)}`;
    unitMap.set(key, { id: unit.id, name: unit.name, book_id: unit.book_id, grade_id: unit.grade_id });
  }

  const [lessons] = await connection.execute(
    `SELECT l.id, l.name, l.unit_id, u.book_id, b.grade_id
     FROM lessons l
     INNER JOIN units u ON u.id = l.unit_id
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE g.project_id = ?`,
    [projectId]
  );
  for (const lesson of lessons) {
    const key = `${lesson.unit_id}::${normalizeHierarchyName(lesson.name)}`;
    lessonMap.set(key, {
      id: lesson.id,
      name: lesson.name,
      unit_id: lesson.unit_id,
      book_id: lesson.book_id,
      grade_id: lesson.grade_id,
    });
  }

  return { gradeMap, bookMap, unitMap, lessonMap };
};

/**
 * Resolve hierarchy names to IDs within a project.
 * Returns { grade_id, book_id, unit_id, lesson_id, component_path } or { error }.
 */
const resolveHierarchyByNames = (maps, names) => {
  const { grade, book, unit, lesson } = names;

  if (!grade && !book && !unit && !lesson) {
    return {
      grade_id: null,
      book_id: null,
      unit_id: null,
      lesson_id: null,
      component_path: null,
    };
  }

  if ((book || unit || lesson) && !grade) {
    return { error: 'Grade is required when Book, Unit, or Lesson is provided' };
  }
  if ((unit || lesson) && !book) {
    return { error: 'Book is required when Unit or Lesson is provided' };
  }
  if (lesson && !unit) {
    return { error: 'Unit is required when Lesson is provided' };
  }

  let gradeEntry = null;
  let bookEntry = null;
  let unitEntry = null;
  let lessonEntry = null;

  if (grade) {
    gradeEntry = maps.gradeMap.get(normalizeHierarchyName(grade));
    if (!gradeEntry) {
      return { error: `Grade not found: "${grade}"` };
    }
  }

  if (book) {
    const bookKey = `${gradeEntry.id}::${normalizeHierarchyName(book)}`;
    bookEntry = maps.bookMap.get(bookKey);
    if (!bookEntry) {
      return { error: `Book not found: "${book}" under grade "${grade}"` };
    }
  }

  if (unit) {
    const unitKey = `${bookEntry.id}::${normalizeHierarchyName(unit)}`;
    unitEntry = maps.unitMap.get(unitKey);
    if (!unitEntry) {
      return { error: `Unit not found: "${unit}" under book "${book}"` };
    }
  }

  if (lesson) {
    const lessonKey = `${unitEntry.id}::${normalizeHierarchyName(lesson)}`;
    lessonEntry = maps.lessonMap.get(lessonKey);
    if (!lessonEntry) {
      return { error: `Lesson not found: "${lesson}" under unit "${unit}"` };
    }
  }

  return {
    grade_id: gradeEntry?.id ?? null,
    book_id: bookEntry?.id ?? null,
    unit_id: unitEntry?.id ?? null,
    lesson_id: lessonEntry?.id ?? null,
    component_path: buildComponentPath({
      gradeName: gradeEntry?.name,
      bookName: bookEntry?.name,
      unitName: unitEntry?.name,
      lessonName: lessonEntry?.name,
    }),
  };
};

module.exports = {
  normalizeHierarchyName,
  trimValue,
  buildComponentPath,
  extractHierarchyNamesFromRow,
  loadHierarchyMaps,
  resolveHierarchyByNames,
};
