import React, { useState, useEffect } from 'react';
import { gradeService, bookService, unitService, lessonService } from '../services/apiService';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Plus, Edit, Trash2, BookOpen, GraduationCap, Layers, FileText, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import BulkUploadHierarchyModal from './BulkUploadHierarchyModal';

interface Grade {
  id: number;
  name: string;
  description?: string;
  order_index: number;
  weight: number;
  project_id: number;
  book_count: number;
  unit_count: number;
  lesson_count: number;
}

interface Book {
  id: number;
  name: string;
  type: 'student' | 'teacher' | 'practice' | 'digital';
  description?: string;
  order_index: number;
  weight: number;
  grade_id: number;
  unit_count: number;
  lesson_count: number;
}

interface Unit {
  id: number;
  name: string;
  description?: string;
  order_index: number;
  weight: number;
  book_id: number;
  lesson_count: number;
}

interface Lesson {
  id: number;
  name: string;
  description?: string;
  order_index: number;
  weight: number;
  unit_id: number;
}

interface EducationalHierarchyProps {
  projectId: number;
}

const EducationalHierarchy: React.FC<EducationalHierarchyProps> = ({ projectId }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  
  // Modal States
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  
  // Form States
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  // Load educational hierarchy data
  useEffect(() => {
    loadEducationalHierarchy();
  }, [projectId]);

  const loadEducationalHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all data in parallel using bulk endpoints
      const [gradesData, booksData, unitsData, lessonsData] = await Promise.all([
        gradeService.getByProject(projectId),
        bookService.getAll(), // Get all books and filter by project grades
        unitService.getAll(), // Get all units and filter by project books
        lessonService.getAll() // Get all lessons and filter by project units
      ]);
      
      setGrades(gradesData || []);
      
      // Filter books to only include those from this project's grades
      const projectGradeIds = new Set((gradesData || []).map((grade: Grade) => grade.id));
      const projectBooks = (booksData || []).filter((book: Book) => projectGradeIds.has(book.grade_id));
      setBooks(projectBooks);
      
      // Filter units to only include those from this project's books
      const projectBookIds = new Set(projectBooks.map((book: Book) => book.id));
      const projectUnits = (unitsData || []).filter((unit: Unit) => projectBookIds.has(unit.book_id));
      setUnits(projectUnits);
      
      // Filter lessons to only include those from this project's units
      const projectUnitIds = new Set(projectUnits.map((unit: Unit) => unit.id));
      const projectLessons = (lessonsData || []).filter((lesson: Lesson) => projectUnitIds.has(lesson.unit_id));
      setLessons(projectLessons);
      
    } catch (err: any) {
      console.error('Error loading educational hierarchy:', err);
      setError(err.message || 'Failed to load educational hierarchy');
    } finally {
      setLoading(false);
    }
  };

  // Toggle expansion states
  const toggleGradeExpansion = (gradeId: number) => {
    const newExpanded = new Set(expandedGrades);
    if (newExpanded.has(gradeId)) {
      newExpanded.delete(gradeId);
    } else {
      newExpanded.add(gradeId);
    }
    setExpandedGrades(newExpanded);
  };

  const toggleBookExpansion = (bookId: number) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId);
    } else {
      newExpanded.add(bookId);
    }
    setExpandedBooks(newExpanded);
  };

  // CRUD Operations
  const handleCreateGrade = async (gradeData: Partial<Grade>) => {
    try {
      const newGrade = await gradeService.create({
        ...gradeData,
        project_id: projectId
      });
      setGrades([...grades, newGrade]);
      setShowGradeModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create grade');
    }
  };

  const handleUpdateGrade = async (gradeData: Partial<Grade>) => {
    if (!editingGrade) return;
    try {
      const updatedGrade = await gradeService.update(editingGrade.id, gradeData);
      setGrades(grades.map(g => g.id === editingGrade.id ? updatedGrade : g));
      setShowGradeModal(false);
      setEditingGrade(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update grade');
    }
  };

  const handleDeleteGrade = async (gradeId: number) => {
    if (!confirm('Are you sure you want to delete this grade? This will also delete all associated books, units, and lessons.')) {
      return;
    }
    try {
      await gradeService.delete(gradeId);
      setGrades(grades.filter(g => g.id !== gradeId));
      setBooks(books.filter(b => b.grade_id !== gradeId));
      setUnits(units.filter(u => {
        const book = books.find(b => b.id === u.book_id);
        return book && book.grade_id !== gradeId;
      }));
      setLessons(lessons.filter(l => {
        const unit = units.find(u => u.id === l.unit_id);
        const book = books.find(b => b.id === unit?.book_id);
        return book && book.grade_id !== gradeId;
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to delete grade');
    }
  };

  const handleCreateBook = async (bookData: Partial<Book>) => {
    if (!selectedGradeId) return;
    try {
      const newBook = await bookService.create({
        ...bookData,
        grade_id: selectedGradeId
      });
      setBooks([...books, newBook]);
      setShowBookModal(false);
      setSelectedGradeId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create book');
    }
  };

  const handleUpdateBook = async (bookData: Partial<Book>) => {
    if (!editingBook) return;
    try {
      const updatedBook = await bookService.update(editingBook.id, bookData);
      setBooks(books.map(b => b.id === editingBook.id ? updatedBook : b));
      setShowBookModal(false);
      setEditingBook(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update book');
    }
  };

  const handleDeleteBook = async (bookId: number) => {
    if (!confirm('Are you sure you want to delete this book? This will also delete all associated units and lessons.')) {
      return;
    }
    try {
      await bookService.delete(bookId);
      setBooks(books.filter(b => b.id !== bookId));
      setUnits(units.filter(u => u.book_id !== bookId));
      setLessons(lessons.filter(l => {
        const unit = units.find(u => u.id === l.unit_id);
        return unit && unit.book_id !== bookId;
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to delete book');
    }
  };

  const handleCreateUnit = async (unitData: Partial<Unit>) => {
    if (!selectedBookId) return;
    try {
      const newUnit = await unitService.create({
        ...unitData,
        book_id: selectedBookId
      });
      setUnits([...units, newUnit]);
      setShowUnitModal(false);
      setSelectedBookId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create unit');
    }
  };

  const handleUpdateUnit = async (unitData: Partial<Unit>) => {
    if (!editingUnit) return;
    try {
      const updatedUnit = await unitService.update(editingUnit.id, unitData);
      setUnits(units.map(u => u.id === editingUnit.id ? updatedUnit : u));
      setShowUnitModal(false);
      setEditingUnit(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update unit');
    }
  };

  const handleDeleteUnit = async (unitId: number) => {
    if (!confirm('Are you sure you want to delete this unit? This will also delete all associated lessons.')) {
      return;
    }
    try {
      await unitService.delete(unitId);
      setUnits(units.filter(u => u.id !== unitId));
      setLessons(lessons.filter(l => l.unit_id !== unitId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete unit');
    }
  };

  const handleCreateLesson = async (lessonData: Partial<Lesson>) => {
    if (!selectedUnitId) return;
    try {
      const newLesson = await lessonService.create({
        ...lessonData,
        unit_id: selectedUnitId
      });
      setLessons([...lessons, newLesson]);
      setShowLessonModal(false);
      setSelectedUnitId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create lesson');
    }
  };

  const handleUpdateLesson = async (lessonData: Partial<Lesson>) => {
    if (!editingLesson) return;
    try {
      const updatedLesson = await lessonService.update(editingLesson.id, lessonData);
      setLessons(lessons.map(l => l.id === editingLesson.id ? updatedLesson : l));
      setShowLessonModal(false);
      setEditingLesson(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update lesson');
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return;
    }
    try {
      await lessonService.delete(lessonId);
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete lesson');
    }
  };

  const handleAddUnit = (bookId: number) => {
    setSelectedBookId(bookId);
    setEditingUnit(null);
    setShowUnitModal(true);
  };

  const handleAddLesson = (unitId: number) => {
    setSelectedUnitId(unitId);
    setEditingLesson(null);
    setShowLessonModal(true);
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setShowBookModal(true);
  };

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setShowUnitModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading educational hierarchy...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Educational Hierarchy</h2>
          <p className="text-gray-600">Manage grades, books, units, and lessons for this project</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowBulkUploadModal(true)}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Upload</span>
          </Button>
          <Button
            onClick={() => {
              setEditingGrade(null);
              setShowGradeModal(true);
            }}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Grade</span>
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Educational Hierarchy Tree */}
      <div className="space-y-4">
        {(!grades || grades.length === 0) ? (
          <Card>
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Grades Yet</h3>
              <p className="text-gray-600 mb-4">Start by creating the first grade for this project.</p>
              <Button
                onClick={() => {
                  setEditingGrade(null);
                  setShowGradeModal(true);
                }}
              >
                Create First Grade
              </Button>
            </CardContent>
          </Card>
        ) : (
          (grades || []).map((grade) => (
            <GradeItem
              key={grade.id}
              grade={grade}
              books={(books || []).filter(b => b.grade_id === grade.id)}
              units={units || []}
              lessons={lessons || []}
              expanded={expandedGrades.has(grade.id)}
              isSelected={selectedGrade === grade.id}
              onToggleExpansion={() => toggleGradeExpansion(grade.id)}
              onSelect={() => setSelectedGrade(prev => prev === grade.id ? null : grade.id)}
              onEdit={() => {
                setEditingGrade(grade);
                setShowGradeModal(true);
              }}
              onDelete={() => handleDeleteGrade(grade.id)}
              onAddBook={() => {
                setSelectedGradeId(grade.id);
                setEditingBook(null);
                setShowBookModal(true);
              }}
              onAddUnit={handleAddUnit}
              onEditBook={handleEditBook}
              onDeleteBook={handleDeleteBook}
              onAddLesson={handleAddLesson}
              onEditUnit={handleEditUnit}
              onDeleteUnit={handleDeleteUnit}
              onEditLesson={(lesson) => {
                setEditingLesson(lesson);
                setShowLessonModal(true);
              }}
              onDeleteLesson={handleDeleteLesson}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <GradeModal
        isOpen={showGradeModal}
        onClose={() => {
          setShowGradeModal(false);
          setEditingGrade(null);
        }}
        grade={editingGrade}
        onSubmit={editingGrade ? handleUpdateGrade : handleCreateGrade}
      />

      <BookModal
        isOpen={showBookModal}
        onClose={() => {
          setShowBookModal(false);
          setEditingBook(null);
          setSelectedGradeId(null);
        }}
        book={editingBook}
        onSubmit={editingBook ? handleUpdateBook : handleCreateBook}
      />

      <UnitModal
        isOpen={showUnitModal}
        onClose={() => {
          setShowUnitModal(false);
          setEditingUnit(null);
          setSelectedBookId(null);
        }}
        unit={editingUnit}
        onSubmit={editingUnit ? handleUpdateUnit : handleCreateUnit}
      />

      <LessonModal
        isOpen={showLessonModal}
        onClose={() => {
          setShowLessonModal(false);
          setEditingLesson(null);
          setSelectedUnitId(null);
        }}
        lesson={editingLesson}
        onSubmit={editingLesson ? handleUpdateLesson : handleCreateLesson}
      />

      <BulkUploadHierarchyModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        projectId={projectId}
        onUploadComplete={loadEducationalHierarchy}
      />
    </div>
  );
};

// Grade Item Component
interface GradeItemProps {
  grade: Grade;
  books: Book[];
  units: Unit[];
  lessons: Lesson[];
  expanded: boolean;
  isSelected?: boolean;
  onToggleExpansion: () => void;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddBook: () => void;
  onAddUnit: (bookId: number) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (bookId: number) => void;
  onAddLesson: (unitId: number) => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: number) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: number) => void;
}

const GradeItem: React.FC<GradeItemProps> = ({
  grade,
  books,
  units,
   lessons,
  expanded,
  isSelected,
  onToggleExpansion,
  onSelect,
  onEdit,
  onDelete,
  onAddBook,
  onAddUnit,
  onEditBook,
  onDeleteBook,
  onAddLesson,
  onEditUnit,
  onDeleteUnit,
  onEditLesson,
  onDeleteLesson
}) => {
  return (
    <Card className={isSelected ? 'ring-2 ring-blue-500' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleExpansion}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <div
              className={`cursor-pointer select-none ${onSelect ? 'hover:text-blue-600' : ''}`}
              onClick={onSelect}
            >
              <h3 className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{grade.name}</h3>
              {grade.description && (
                <p className="text-sm text-gray-600">{grade.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
                         <Badge variant="secondary">{typeof grade.weight === 'number' ? grade.weight.toFixed(1) : '0.0'}%</Badge>
            <Badge variant="secondary">{(books || []).length} books</Badge>
            <div className="flex space-x-1">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={onAddBook}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={onDelete}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4">
            {(!books || books.length === 0) ? (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-2">No books in this grade</p>
                <Button size="sm" onClick={onAddBook}>
                  Add Book
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {books.map((book) => (
                  <BookItem
                    key={book.id}
                    book={book}
                    units={(units || []).filter(u => u.book_id === book.id)}
                    lessons={lessons || []}
                    onAddUnit={onAddUnit}
                    onEditBook={onEditBook}
                    onDeleteBook={onDeleteBook}
                    onAddLesson={onAddLesson}
                    onEditUnit={onEditUnit}
                    onDeleteUnit={onDeleteUnit}
                    onEditLesson={onEditLesson}
                    onDeleteLesson={onDeleteLesson}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Book Item Component
interface BookItemProps {
  book: Book;
  units: Unit[];
  lessons: Lesson[];
  onAddUnit: (bookId: number) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (bookId: number) => void;
  onAddLesson: (unitId: number) => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: number) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: number) => void;
}

const BookItem: React.FC<BookItemProps> = ({ book, units, lessons, onAddUnit, onEditBook, onDeleteBook, onAddLesson, onEditUnit, onDeleteUnit, onEditLesson, onDeleteLesson }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-6 border-l-2 border-gray-200 pl-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <BookOpen className="w-4 h-4 text-green-600" />
          <div>
            <h4 className="font-medium text-gray-900">{book.name}</h4>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{book.type}</Badge>
                             <Badge variant="secondary">{typeof book.weight === 'number' ? book.weight.toFixed(1) : '0.0'}%</Badge>
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <Button size="sm" variant="outline" onClick={() => onEditBook(book)}>
            <Edit className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddUnit(book.id)}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDeleteBook(book.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {(!units || units.length === 0) ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-600 mb-2">No units in this book</p>
              <Button size="sm" onClick={() => onAddUnit(book.id)}>
                Add Unit
              </Button>
            </div>
          ) : (
                          units.map((unit) => (
                <UnitItem
                  key={unit.id}
                  unit={unit}
                  lessons={(lessons || []).filter(l => l.unit_id === unit.id)}
                  onAddLesson={onAddLesson}
                  onEditUnit={onEditUnit}
                  onDeleteUnit={onDeleteUnit}
                  onEditLesson={onEditLesson}
                  onDeleteLesson={onDeleteLesson}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
};

// Unit Item Component
interface UnitItemProps {
  unit: Unit;
  lessons: Lesson[];
  onAddLesson: (unitId: number) => void;
  onEditUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: number) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: number) => void;
}

const UnitItem: React.FC<UnitItemProps> = ({ unit, lessons, onAddLesson, onEditUnit, onDeleteUnit, onEditLesson, onDeleteLesson }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-6 border-l-2 border-gray-200 pl-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <Layers className="w-4 h-4 text-purple-600" />
          <div>
            <h5 className="font-medium text-gray-900">{unit.name}</h5>
                         <Badge variant="secondary">{typeof unit.weight === 'number' ? unit.weight.toFixed(1) : '0.0'}%</Badge>
          </div>
        </div>
        <div className="flex space-x-1">
          <Button size="sm" variant="outline" onClick={() => onEditUnit(unit)}>
            <Edit className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddLesson(unit.id)}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDeleteUnit(unit.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {(!lessons || lessons.length === 0) ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-600 mb-2">No lessons in this unit</p>
              <Button size="sm" onClick={() => onAddLesson(unit.id)}>
                Add Lesson
              </Button>
            </div>
          ) : (
            lessons.map((lesson) => (
              <div key={lesson.id} className="ml-6 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-3 h-3 text-orange-600" />
                  <span className="text-sm text-gray-900">{lesson.name}</span>
                  <Badge variant="secondary">{typeof lesson.weight === 'number' ? lesson.weight.toFixed(1) : '0.0'}%</Badge>
                </div>
                <div className="flex space-x-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onEditLesson(lesson)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onDeleteLesson(lesson.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Modal Components
interface GradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  grade: Grade | null;
  onSubmit: (data: Partial<Grade>) => void;
}

const GradeModal: React.FC<GradeModalProps> = ({ isOpen, onClose, grade, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: grade?.name || '',
    description: grade?.description || '',
         weight: typeof grade?.weight === 'number' ? grade.weight : 0
  });

  useEffect(() => {
    if (grade) {
      setFormData({
        name: grade.name,
        description: grade.description || '',
                 weight: typeof grade.weight === 'number' ? grade.weight : 0
      });
    } else {
      setFormData({
        name: '',
        description: '',
        weight: 0
      });
    }
  }, [grade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={grade ? 'Edit Grade' : 'Create Grade'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {grade ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Simplified modal components for Book, Unit, and Lesson
const BookModal: React.FC<any> = ({ isOpen, onClose, book, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: book?.name || '',
    type: book?.type || 'student',
    description: book?.description || '',
         weight: typeof book?.weight === 'number' ? book.weight : 0
  });

  useEffect(() => {
    if (book) {
      setFormData({
        name: book.name,
        type: book.type,
        description: book.description || '',
                 weight: typeof book.weight === 'number' ? book.weight : 0
      });
    } else {
      setFormData({
        name: '',
        type: 'student',
        description: '',
        weight: 0
      });
    }
  }, [book]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={book ? 'Edit Book' : 'Create Book'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="student">Student Book</option>
            <option value="teacher">Teacher Guide</option>
            <option value="practice">Practice Book</option>
            <option value="digital">Digital</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {book ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const UnitModal: React.FC<any> = ({ isOpen, onClose, unit, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: unit?.name || '',
    description: unit?.description || '',
         weight: typeof unit?.weight === 'number' ? unit.weight : 0
  });

  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name,
        description: unit.description || '',
                 weight: typeof unit.weight === 'number' ? unit.weight : 0
      });
    } else {
      setFormData({
        name: '',
        description: '',
        weight: 0
      });
    }
  }, [unit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={unit ? 'Edit Unit' : 'Create Unit'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {unit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const LessonModal: React.FC<any> = ({ isOpen, onClose, lesson, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: lesson?.name || '',
    description: lesson?.description || '',
         weight: typeof lesson?.weight === 'number' ? lesson.weight : 0
  });

  useEffect(() => {
    if (lesson) {
      setFormData({
        name: lesson.name,
        description: lesson.description || '',
                 weight: typeof lesson.weight === 'number' ? lesson.weight : 0
      });
    } else {
      setFormData({
        name: '',
        description: '',
        weight: 0
      });
    }
  }, [lesson]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lesson ? 'Edit Lesson' : 'Create Lesson'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {lesson ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EducationalHierarchy;
