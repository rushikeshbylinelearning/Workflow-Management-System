const ExcelJS = require('exceljs');
const db = require('../db');

const buildHierarchyPath = (gradeName, bookName, unitName, lessonName) => {
  return [gradeName, bookName, unitName, lessonName].filter(Boolean).join(' > ');
};

/**
 * Export project educational hierarchy to Excel.
 * Includes all tag levels (grade, book, unit, lesson) for download and bulk reference.
 */
async function exportEducationalHierarchyToExcel(projectId) {
  const projects = await db.query('SELECT id, name FROM projects WHERE id = ?', [projectId]);
  if (!projects.length) {
    throw new Error('Project not found');
  }

  const projectName = projects[0].name;

  const [grades, books, units, lessons] = await Promise.all([
    db.query(
      'SELECT id, name, description, weight, order_index FROM grades WHERE project_id = ? ORDER BY order_index ASC, name ASC',
      [projectId]
    ),
    db.query(
      `SELECT b.id, b.grade_id, b.name, b.type, b.description, b.weight, b.order_index
       FROM books b
       INNER JOIN grades g ON g.id = b.grade_id
       WHERE g.project_id = ?
       ORDER BY b.order_index ASC, b.name ASC`,
      [projectId]
    ),
    db.query(
      `SELECT u.id, u.book_id, u.name, u.description, u.weight, u.order_index
       FROM units u
       INNER JOIN books b ON b.id = u.book_id
       INNER JOIN grades g ON g.id = b.grade_id
       WHERE g.project_id = ?
       ORDER BY u.order_index ASC, u.name ASC`,
      [projectId]
    ),
    db.query(
      `SELECT l.id, l.unit_id, l.name, l.description, l.weight, l.order_index
       FROM lessons l
       INNER JOIN units u ON u.id = l.unit_id
       INNER JOIN books b ON b.id = u.book_id
       INNER JOIN grades g ON g.id = b.grade_id
       WHERE g.project_id = ?
       ORDER BY l.order_index ASC, l.name ASC`,
      [projectId]
    ),
  ]);

  const booksByGrade = new Map();
  for (const book of books) {
    if (!booksByGrade.has(book.grade_id)) booksByGrade.set(book.grade_id, []);
    booksByGrade.get(book.grade_id).push(book);
  }

  const unitsByBook = new Map();
  for (const unit of units) {
    if (!unitsByBook.has(unit.book_id)) unitsByBook.set(unit.book_id, []);
    unitsByBook.get(unit.book_id).push(unit);
  }

  const lessonsByUnit = new Map();
  for (const lesson of lessons) {
    if (!lessonsByUnit.has(lesson.unit_id)) lessonsByUnit.set(lesson.unit_id, []);
    lessonsByUnit.get(lesson.unit_id).push(lesson);
  }

  const rows = [];

  const pushRow = (payload) => {
    rows.push({
      Grade: payload.grade?.name || '',
      'Grade Description': payload.grade?.description || '',
      'Grade Weight': payload.grade?.weight ?? '',
      Book: payload.book?.name || '',
      'Book Type': payload.book?.type || '',
      'Book Description': payload.book?.description || '',
      'Book Weight': payload.book?.weight ?? '',
      Unit: payload.unit?.name || '',
      'Unit Description': payload.unit?.description || '',
      'Unit Weight': payload.unit?.weight ?? '',
      Lesson: payload.lesson?.name || '',
      'Lesson Description': payload.lesson?.description || '',
      'Lesson Weight': payload.lesson?.weight ?? '',
      'Tag Level': payload.tagLevel,
      'Hierarchy Path': payload.hierarchyPath,
    });
  };

  for (const grade of grades) {
    pushRow({
      grade,
      tagLevel: 'grade',
      hierarchyPath: grade.name,
    });

    for (const book of booksByGrade.get(grade.id) || []) {
      pushRow({
        grade,
        book,
        tagLevel: 'book',
        hierarchyPath: buildHierarchyPath(grade.name, book.name),
      });

      for (const unit of unitsByBook.get(book.id) || []) {
        pushRow({
          grade,
          book,
          unit,
          tagLevel: 'unit',
          hierarchyPath: buildHierarchyPath(grade.name, book.name, unit.name),
        });

        for (const lesson of lessonsByUnit.get(unit.id) || []) {
          pushRow({
            grade,
            book,
            unit,
            lesson,
            tagLevel: 'lesson',
            hierarchyPath: buildHierarchyPath(grade.name, book.name, unit.name, lesson.name),
          });
        }
      }
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Byline LMS Workflow';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Educational Hierarchy');
  sheet.columns = [
    { header: 'Grade', key: 'Grade', width: 22 },
    { header: 'Grade Description', key: 'Grade Description', width: 28 },
    { header: 'Grade Weight', key: 'Grade Weight', width: 14 },
    { header: 'Book', key: 'Book', width: 22 },
    { header: 'Book Type', key: 'Book Type', width: 12 },
    { header: 'Book Description', key: 'Book Description', width: 28 },
    { header: 'Book Weight', key: 'Book Weight', width: 14 },
    { header: 'Unit', key: 'Unit', width: 22 },
    { header: 'Unit Description', key: 'Unit Description', width: 28 },
    { header: 'Unit Weight', key: 'Unit Weight', width: 14 },
    { header: 'Lesson', key: 'Lesson', width: 22 },
    { header: 'Lesson Description', key: 'Lesson Description', width: 28 },
    { header: 'Lesson Weight', key: 'Lesson Weight', width: 14 },
    { header: 'Tag Level', key: 'Tag Level', width: 12 },
    { header: 'Hierarchy Path', key: 'Hierarchy Path', width: 48 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EAF6' },
  };

  rows.forEach((row) => sheet.addRow(row));

  const infoSheet = workbook.addWorksheet('Info');
  infoSheet.addRow(['Project', projectName]);
  infoSheet.addRow(['Project ID', projectId]);
  infoSheet.addRow(['Exported At', new Date().toISOString()]);
  infoSheet.addRow(['Total Tags', rows.length]);
  infoSheet.getColumn(1).width = 16;
  infoSheet.getColumn(2).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, projectName, rowCount: rows.length };
}

module.exports = {
  exportEducationalHierarchyToExcel,
};
