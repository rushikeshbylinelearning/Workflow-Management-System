// Progress calculation utilities for weighted project components

import { normalizeTaskStatus } from './reworkHighlight';

export interface ProgressCalculationResult {
  progress: number;
  completedWeight: number;
  totalWeight: number;
}

// Calculate progress for a lesson based on its tasks
export function calculateLessonProgress(
  lessonId: string,
  tasks: any[]
): ProgressCalculationResult {
  const lessonTasks = tasks.filter(task => task.lessonId === lessonId);
  
  if (lessonTasks.length === 0) {
    return { progress: 0, completedWeight: 0, totalWeight: 0 };
  }

  const totalProgress = lessonTasks.reduce((sum, task) => sum + task.progress, 0);
  const averageProgress = totalProgress / lessonTasks.length;
  
  return {
    progress: Math.round(averageProgress),
    completedWeight: averageProgress,
    totalWeight: 100
  };
}

// Calculate progress for a unit based on its lessons
export function calculateUnitProgress(
  unit: any,
  tasks: any[]
): ProgressCalculationResult {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  unit.lessons.forEach((lesson: any) => {
    const lessonResult = calculateLessonProgress(lesson.id, tasks);
    totalWeightedProgress += (lessonResult.progress * lesson.weight) / 100;
    totalWeight += lesson.weight;
  });

  const progress = totalWeight > 0 ? Math.round(totalWeightedProgress) : 0;
  
  return {
    progress,
    completedWeight: totalWeightedProgress,
    totalWeight
  };
}

// Calculate progress for a book based on its units
export function calculateBookProgress(
  book: any,
  tasks: any[]
): ProgressCalculationResult {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  book.units.forEach((unit: any) => {
    const unitResult = calculateUnitProgress(unit, tasks);
    totalWeightedProgress += (unitResult.progress * unit.weight) / 100;
    totalWeight += unit.weight;
  });

  const progress = totalWeight > 0 ? Math.round(totalWeightedProgress) : 0;
  
  return {
    progress,
    completedWeight: totalWeightedProgress,
    totalWeight
  };
}

// Calculate progress for a grade based on its books
export function calculateGradeProgress(
  grade: any,
  tasks: any[]
): ProgressCalculationResult {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  grade.books.forEach((book: any) => {
    const bookResult = calculateBookProgress(book, tasks);
    totalWeightedProgress += (bookResult.progress * book.weight) / 100;
    totalWeight += book.weight;
  });

  const progress = totalWeight > 0 ? Math.round(totalWeightedProgress) : 0;
  
  return {
    progress,
    completedWeight: totalWeightedProgress,
    totalWeight
  };
}

// Calculate progress for a stage based on its tasks
export function calculateStageProgress(
  stageId: string,
  tasks: any[]
): ProgressCalculationResult {
  const stageTasks = tasks.filter(task => task.stageId === stageId);
  
  if (stageTasks.length === 0) {
    return { progress: 0, completedWeight: 0, totalWeight: 0 };
  }

  const totalProgress = stageTasks.reduce((sum, task) => sum + task.progress, 0);
  const averageProgress = totalProgress / stageTasks.length;
  
  return {
    progress: Math.round(averageProgress),
    completedWeight: averageProgress,
    totalWeight: 100
  };
}

// Calculate overall project progress based on stages and grades
export function calculateProjectProgress(
  project: any,
  tasks: any[]
): ProgressCalculationResult {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  // Calculate progress from stages
  if (project.stages && project.stages.length > 0) {
    project.stages.forEach((stage: any) => {
      const stageResult = calculateStageProgress(stage.id, tasks);
      totalWeightedProgress += (stageResult.progress * stage.weight) / 100;
      totalWeight += stage.weight;
    });
  }

  // Calculate progress from grades (if applicable)
  if (project.grades && project.grades.length > 0) {
    project.grades.forEach((grade: any) => {
      const gradeResult = calculateGradeProgress(grade, tasks);
      totalWeightedProgress += (gradeResult.progress * grade.weight) / 100;
      totalWeight += grade.weight;
    });
  }

  const progress = totalWeight > 0 ? Math.round(totalWeightedProgress) : 0;
  
  return {
    progress,
    completedWeight: totalWeightedProgress,
    totalWeight
  };
}

// Auto-calculate task progress based on status
export function calculateTaskProgress(status: string): number {
  switch (normalizeTaskStatus(status)) {
    case 'not-started':
      return 0;
    case 'in-progress':
      return 50; // Default to 50% for in-progress tasks
    case 'under-review':
      return 90; // 90% when under review
    case 'completed':
      return 100;
    case 'blocked':
      return 25; // 25% for blocked tasks (some work done)
    case 'returned':
    case 'redo-requested':
      return 50;
    case 'resubmitted':
      return 90;
    default:
      return 0;
  }
}

// Validate that weights sum to 100% for a collection
export function validateWeights(items: any[], itemType: string): { isValid: boolean; message: string } {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  
  if (Math.abs(totalWeight - 100) > 0.1) { // Allow small floating point differences
    return {
      isValid: false,
      message: `${itemType} weights must sum to 100%. Current total: ${totalWeight}%`
    };
  }
  
  return {
    isValid: true,
    message: 'Weights are valid'
  };
}

// Auto-distribute weights evenly across items
export function distributeWeightsEvenly(items: any[]): any[] {
  if (items.length === 0) return items;
  
  const weightPerItem = Math.round(100 / items.length);
  const remainder = 100 - (weightPerItem * items.length);
  
  return items.map((item, index) => ({
    ...item,
    weight: index === 0 ? weightPerItem + remainder : weightPerItem
  }));
}