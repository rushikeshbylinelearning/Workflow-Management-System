export type HierarchyTagType = 'grade' | 'book' | 'unit' | 'lesson';

export interface HierarchyTagItem {
  id: string;
  name: string;
  type: HierarchyTagType;
  gradeId: number;
  bookId: number | null;
  unitId: number | null;
  lessonId: number | null;
}

export function buildProjectHierarchyTags(
  projectId: number | string,
  grades: any[],
  books: any[],
  units: any[],
  lessons: any[]
): HierarchyTagItem[] {
  const parsedProjectId = parseInt(String(projectId), 10);
  if (Number.isNaN(parsedProjectId)) return [];

  const items: HierarchyTagItem[] = [];
  const projectGrades = grades.filter((grade) => Number(grade.project_id) === parsedProjectId);

  projectGrades.forEach((grade) => {
    items.push({
      id: `grade-${grade.id}`,
      name: grade.name,
      type: 'grade',
      gradeId: Number(grade.id),
      bookId: null,
      unitId: null,
      lessonId: null,
    });

    const gradeBooks = books.filter((book) => Number(book.grade_id) === Number(grade.id));
    gradeBooks.forEach((book) => {
      items.push({
        id: `grade-${grade.id}-book-${book.id}`,
        name: `${grade.name} > ${book.name}`,
        type: 'book',
        gradeId: Number(grade.id),
        bookId: Number(book.id),
        unitId: null,
        lessonId: null,
      });

      const bookUnits = units.filter((unit) => Number(unit.book_id) === Number(book.id));
      bookUnits.forEach((unit) => {
        items.push({
          id: `grade-${grade.id}-book-${book.id}-unit-${unit.id}`,
          name: `${grade.name} > ${book.name} > ${unit.name}`,
          type: 'unit',
          gradeId: Number(grade.id),
          bookId: Number(book.id),
          unitId: Number(unit.id),
          lessonId: null,
        });

        const unitLessons = lessons.filter((lesson) => Number(lesson.unit_id) === Number(unit.id));
        unitLessons.forEach((lesson) => {
          items.push({
            id: `grade-${grade.id}-book-${book.id}-unit-${unit.id}-lesson-${lesson.id}`,
            name: `${grade.name} > ${book.name} > ${unit.name} > ${lesson.name}`,
            type: 'lesson',
            gradeId: Number(grade.id),
            bookId: Number(book.id),
            unitId: Number(unit.id),
            lessonId: Number(lesson.id),
          });
        });
      });
    });
  });

  return items;
}

export function findHierarchyTagItem(
  items: HierarchyTagItem[],
  gradeId: string | number | null | undefined,
  bookId: string | number | null | undefined,
  unitId: string | number | null | undefined,
  lessonId: string | number | null | undefined
): HierarchyTagItem | undefined {
  const parsedGradeId = gradeId ? parseInt(String(gradeId), 10) : null;
  const parsedBookId = bookId ? parseInt(String(bookId), 10) : null;
  const parsedUnitId = unitId ? parseInt(String(unitId), 10) : null;
  const parsedLessonId = lessonId ? parseInt(String(lessonId), 10) : null;

  return items.find(
    (item) =>
      item.gradeId === parsedGradeId &&
      item.bookId === parsedBookId &&
      item.unitId === parsedUnitId &&
      item.lessonId === parsedLessonId
  );
}

export function filterHierarchyTags(items: HierarchyTagItem[], query: string, limit = 50): HierarchyTagItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items.slice(0, limit);

  return items
    .filter((item) => {
      const haystack = `${item.name} ${item.type}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, limit);
}

export interface HierarchyFilterSelection {
  gradeId?: string;
  bookId?: string;
  unitId?: string;
  lessonId?: string;
}

export function isHierarchyFilterActive(selection: HierarchyFilterSelection | null | undefined): boolean {
  return !!selection?.gradeId;
}

function idsMatch(taskValue: string | number | null | undefined, filterValue: string | undefined): boolean {
  if (!filterValue) return true;
  const parsedTask = taskValue == null || taskValue === '' ? null : parseInt(String(taskValue), 10);
  const parsedFilter = parseInt(String(filterValue), 10);
  if (parsedTask == null || Number.isNaN(parsedTask) || Number.isNaN(parsedFilter)) return false;
  return parsedTask === parsedFilter;
}

export function taskMatchesHierarchyFilter(
  task: {
    grade_id?: string | number | null;
    book_id?: string | number | null;
    unit_id?: string | number | null;
    lesson_id?: string | number | null;
    gradeId?: string | number | null;
    bookId?: string | number | null;
    unitId?: string | number | null;
    lessonId?: string | number | null;
  },
  selection: HierarchyFilterSelection | null | undefined
): boolean {
  if (!isHierarchyFilterActive(selection)) return true;

  return (
    idsMatch(task.grade_id ?? task.gradeId, selection?.gradeId) &&
    idsMatch(task.book_id ?? task.bookId, selection?.bookId) &&
    idsMatch(task.unit_id ?? task.unitId, selection?.unitId) &&
    idsMatch(task.lesson_id ?? task.lessonId, selection?.lessonId)
  );
}
