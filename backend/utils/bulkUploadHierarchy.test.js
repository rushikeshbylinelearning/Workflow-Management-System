const assert = require('assert');
const { cell, validateHierarchyParents, resolveHierarchyIds, resolveHierarchyUpdateIds } = require('./bulkUploadHierarchy');

const catalogs = {
  grades: [
    { id: 10, name: 'Grade 5', project_id: 1 },
    { id: 11, name: 'Grade 6', project_id: 2 },
    { id: 12, name: 'Grade 4', project_id: 1 },
  ],
  books: [
    { id: 20, name: 'Mathematics Book', grade_id: 10 },
    { id: 21, name: 'Science Book', grade_id: 11 },
  ],
  units: [
    { id: 30, name: 'Unit 2', book_id: 20 },
    { id: 31, name: 'Unit 9', book_id: 21 },
  ],
  lessons: [
    { id: 40, name: 'Fractions', unit_id: 30 },
    { id: 41, name: 'Plants', unit_id: 31 },
  ],
};

const valid = {
  Grade: 'Grade 5',
  Book: 'Mathematics Book',
  Unit: 'Unit 2',
  Lesson: 'Fractions',
};

function resolve(task, projectId = 1, projectName = 'Math Project') {
  return resolveHierarchyIds({ projectId, projectName, task, catalogs });
}

assert.strictEqual(cell({}, 'Grade'), '');
assert.strictEqual(cell({ Grade: undefined }, 'Grade'), '');

assert.strictEqual(validateHierarchyParents({}), 'Grade is required');
assert.strictEqual(validateHierarchyParents({ Grade: 'Grade 5' }), 'Book is required');
assert.strictEqual(
  validateHierarchyParents({ Grade: 'Grade 5', Book: 'Mathematics Book' }),
  'Unit is required'
);
assert.strictEqual(
  validateHierarchyParents({ Grade: 'Grade 5', Book: 'Mathematics Book', Unit: 'Unit 2' }),
  'Lesson is required'
);
assert.strictEqual(validateHierarchyParents(valid), null);

assert.strictEqual(resolve({}).error, 'Grade is required');
assert.strictEqual(resolve({ Grade: '', Book: '', Unit: '', Lesson: '' }).error, 'Grade is required');
assert.strictEqual(resolve({ Grade: 'Grade 5' }).error, 'Book is required');

assert.deepStrictEqual(resolve(valid), {
  gradeId: 10, bookId: 20, unitId: 30, lessonId: 40,
});

assert.deepStrictEqual(
  resolve({
    Grade: '  GRADE 5  ',
    Book: 'Mathematics Book',
    Unit: 'Unit 2',
    Lesson: 'Fractions',
  }),
  { gradeId: 10, bookId: 20, unitId: 30, lessonId: 40 }
);

assert.strictEqual(
  resolve({ ...valid, Grade: 'Grade 99' }).error,
  'Grade "Grade 99" was not found under project "Math Project".'
);

assert.strictEqual(
  resolve({ ...valid, Grade: 'Grade 6' }).error,
  'Grade "Grade 6" does not belong to project "Math Project".'
);

assert.strictEqual(
  resolve({ ...valid, Book: 'Science Book' }).error,
  'Book "Science Book" does not belong to grade "Grade 5".'
);

assert.strictEqual(
  resolve({ ...valid, Unit: 'Unit 99' }).error,
  'Unit "Unit 99" was not found under book "Mathematics Book".'
);

assert.strictEqual(
  resolve({ ...valid, Lesson: 'Plants' }).error,
  'Lesson "Plants" does not belong to unit "Unit 2".'
);

const mixedA = resolve(valid);
const mixedB = resolve({
  Grade: 'Grade 5',
  Book: 'Mathematics Book',
  Unit: 'Unit 2',
  Lesson: 'Fractions',
});
assert.strictEqual(mixedA.gradeId, 10);
assert.strictEqual(mixedB.lessonId, 40);

const existing = { gradeId: 10, bookId: 20, unitId: 30, lessonId: 40 };

assert.deepStrictEqual(
  resolveHierarchyUpdateIds({ projectId: 1, projectName: 'Math Project', task: valid, catalogs, existing }),
  { gradeId: 10, bookId: 20, unitId: 30, lessonId: 40 }
);

assert.deepStrictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project', task: { Grade: 'Grade 4' }, catalogs, existing,
  }),
  { gradeId: 12, bookId: 20, unitId: 30, lessonId: 40 }
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project', task: { Grade: 'Grade 6' }, catalogs, existing,
  }).error,
  'Grade "Grade 6" was not found under the task\'s project.'
);

assert.deepStrictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Grade: '', Book: '', Unit: '', Lesson: '' },
    catalogs, existing,
  }),
  { gradeId: 10, bookId: 20, unitId: 30, lessonId: 40 }
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Grade: 'Grade 99', Book: 'Mathematics Book', Unit: 'Unit 2', Lesson: 'Fractions' },
    catalogs, existing,
  }).error,
  'Grade "Grade 99" was not found under the task\'s project.'
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Grade: 'Grade 5', Book: 'Science Book', Unit: 'Unit 2', Lesson: 'Fractions' },
    catalogs, existing,
  }).error,
  'Book "Science Book" does not belong to Grade "Grade 5".'
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Grade: 'Grade 5', Book: 'Mathematics Book', Unit: 'Unit 9', Lesson: 'Fractions' },
    catalogs, existing,
  }).error,
  'Unit "Unit 9" does not belong to Book "Mathematics Book".'
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Grade: 'Grade 5', Book: 'Mathematics Book', Unit: 'Unit 2', Lesson: 'Plants' },
    catalogs, existing,
  }).error,
  'Lesson "Plants" does not belong to Unit "Unit 2".'
);

assert.deepStrictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Book: 'Mathematics Book' },
    catalogs, existing,
  }),
  { gradeId: 10, bookId: 20, unitId: 30, lessonId: 40 }
);

assert.strictEqual(
  resolveHierarchyUpdateIds({
    projectId: 1, projectName: 'Math Project',
    task: { Book: 'Mathematics Book' },
    catalogs,
    existing: { gradeId: null, bookId: null, unitId: null, lessonId: null },
  }).error,
  'Book "Mathematics Book" cannot be mapped without a Grade.'
);

console.log('bulkUploadHierarchy tests passed');
