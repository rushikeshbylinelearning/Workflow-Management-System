/**
 * Resolve required Grade → Book → Unit → Lesson names for task bulk upload.
 * Reuses existing table relationships: grades.project_id, books.grade_id,
 * units.book_id, lessons.unit_id. Name matching matches bulk-upload normalizeName.
 */

function normalizeName(s) {
  if (s === undefined || s === null) return '';
  return s
    .toString()
    .replace(/[\u2013\u2014\u2012\u2010\u2011\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cell(task, key) {
  const v = task?.[key];
  if (v === undefined || v === null) return '';
  return v.toString().trim();
}

function findByName(items, name) {
  const n = normalizeName(name);
  if (!n) return null;
  return items.find((item) => normalizeName(item.name) === n) || null;
}

function validateHierarchyParents(task) {
  const grade = cell(task, 'Grade');
  const book = cell(task, 'Book');
  const unit = cell(task, 'Unit');
  const lesson = cell(task, 'Lesson');

  if (!grade) return 'Grade is required';
  if (!book) return 'Book is required';
  if (!unit) return 'Unit is required';
  if (!lesson) return 'Lesson is required';
  return null;
}

function resolveHierarchyIds({ projectId, projectName, task, catalogs }) {
  const gradeName = cell(task, 'Grade');
  const bookName = cell(task, 'Book');
  const unitName = cell(task, 'Unit');
  const lessonName = cell(task, 'Lesson');

  const parentError = validateHierarchyParents(task);
  if (parentError) return { error: parentError };

  let gradeId = null;
  let bookId = null;
  let unitId = null;
  let lessonId = null;

  if (gradeName) {
    const inProject = (catalogs.grades || []).filter((g) => Number(g.project_id) === Number(projectId));
    const grade = findByName(inProject, gradeName);
    if (!grade) {
      const elsewhere = findByName(catalogs.grades || [], gradeName);
      if (elsewhere) {
        return { error: `Grade "${gradeName}" does not belong to project "${projectName}".` };
      }
      return { error: `Grade "${gradeName}" was not found under project "${projectName}".` };
    }
    gradeId = grade.id;
  }

  if (bookName) {
    const underGrade = (catalogs.books || []).filter((b) => Number(b.grade_id) === Number(gradeId));
    const book = findByName(underGrade, bookName);
    if (!book) {
      const elsewhere = findByName(catalogs.books || [], bookName);
      if (elsewhere) {
        return { error: `Book "${bookName}" does not belong to grade "${gradeName}".` };
      }
      return { error: `Book "${bookName}" was not found under grade "${gradeName}".` };
    }
    bookId = book.id;
  }

  if (unitName) {
    const underBook = (catalogs.units || []).filter((u) => Number(u.book_id) === Number(bookId));
    const unit = findByName(underBook, unitName);
    if (!unit) {
      const elsewhere = findByName(catalogs.units || [], unitName);
      if (elsewhere) {
        return { error: `Unit "${unitName}" does not belong to book "${bookName}".` };
      }
      return { error: `Unit "${unitName}" was not found under book "${bookName}".` };
    }
    unitId = unit.id;
  }

  if (lessonName) {
    const underUnit = (catalogs.lessons || []).filter((l) => Number(l.unit_id) === Number(unitId));
    const lesson = findByName(underUnit, lessonName);
    if (!lesson) {
      const elsewhere = findByName(catalogs.lessons || [], lessonName);
      if (elsewhere) {
        return { error: `Lesson "${lessonName}" does not belong to unit "${unitName}".` };
      }
      return { error: `Lesson "${lessonName}" was not found under unit "${unitName}".` };
    }
    lessonId = lesson.id;
  }

  return { gradeId, bookId, unitId, lessonId };
}

function resolveHierarchyUpdateIds({ projectId, projectName, task, catalogs, existing }) {
  const gradeName = cell(task, 'Grade');
  const bookName = cell(task, 'Book');
  const unitName = cell(task, 'Unit');
  const lessonName = cell(task, 'Lesson');

  let gradeId = existing?.gradeId ?? existing?.grade_id ?? null;
  let bookId = existing?.bookId ?? existing?.book_id ?? null;
  let unitId = existing?.unitId ?? existing?.unit_id ?? null;
  let lessonId = existing?.lessonId ?? existing?.lesson_id ?? null;

  const labelFor = (items, id) => {
    const found = (items || []).find((item) => Number(item.id) === Number(id));
    return found ? found.name : '';
  };

  if (gradeName) {
    const inProject = (catalogs.grades || []).filter((g) => Number(g.project_id) === Number(projectId));
    const grade = findByName(inProject, gradeName);
    if (!grade) {
      return { error: `Grade "${gradeName}" was not found under the task's project.` };
    }
    gradeId = grade.id;
  }

  if (bookName) {
    if (!gradeId) {
      return { error: `Book "${bookName}" cannot be mapped without a Grade.` };
    }
    const underGrade = (catalogs.books || []).filter((b) => Number(b.grade_id) === Number(gradeId));
    const book = findByName(underGrade, bookName);
    if (!book) {
      const gradeLabel = gradeName || labelFor(catalogs.grades, gradeId) || 'the selected Grade';
      const elsewhere = findByName(catalogs.books || [], bookName);
      if (elsewhere) {
        return { error: `Book "${bookName}" does not belong to Grade "${gradeLabel}".` };
      }
      return { error: `Book "${bookName}" was not found under Grade "${gradeLabel}".` };
    }
    bookId = book.id;
  }

  if (unitName) {
    if (!bookId) {
      return { error: `Unit "${unitName}" cannot be mapped without a Book.` };
    }
    const underBook = (catalogs.units || []).filter((u) => Number(u.book_id) === Number(bookId));
    const unit = findByName(underBook, unitName);
    if (!unit) {
      const bookLabel = bookName || labelFor(catalogs.books, bookId) || 'the selected Book';
      const elsewhere = findByName(catalogs.units || [], unitName);
      if (elsewhere) {
        return { error: `Unit "${unitName}" does not belong to Book "${bookLabel}".` };
      }
      return { error: `Unit "${unitName}" was not found under Book "${bookLabel}".` };
    }
    unitId = unit.id;
  }

  if (lessonName) {
    if (!unitId) {
      return { error: `Lesson "${lessonName}" cannot be mapped without a Unit.` };
    }
    const underUnit = (catalogs.lessons || []).filter((l) => Number(l.unit_id) === Number(unitId));
    const lesson = findByName(underUnit, lessonName);
    if (!lesson) {
      const unitLabel = unitName || labelFor(catalogs.units, unitId) || 'the selected Unit';
      const elsewhere = findByName(catalogs.lessons || [], lessonName);
      if (elsewhere) {
        return { error: `Lesson "${lessonName}" does not belong to Unit "${unitLabel}".` };
      }
      return { error: `Lesson "${lessonName}" was not found under Unit "${unitLabel}".` };
    }
    lessonId = lesson.id;
  }

  return { gradeId, bookId, unitId, lessonId };
}

module.exports = {
  cell,
  normalizeName,
  validateHierarchyParents,
  resolveHierarchyIds,
  resolveHierarchyUpdateIds,
};
