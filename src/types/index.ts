export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  skills: string[];
  avatar?: string;
  passcode?: string;
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'on-leave';
  hourly_rate?: number;
  bio?: string;
  performanceFlags?: PerformanceFlag[];
  performance_flags?: PerformanceFlag[]; // Backend field
  team_names?: string[]; // Backend field
  team_ids?: number[]; // Backend field
  last_login_at?: string; // Backend field
}

export interface PerformanceFlag {
  id: number;
  team_member_id: number;
  task_id?: number;
  type: 'red' | 'orange' | 'yellow' | 'green';
  reason: string;
  added_by: string;
  added_by_id?: number;
  created_at: string;
  task_name?: string;
  team_member_name?: string;
  added_by_name?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id?: number | null; // Backend field for category ID
  current_stage_id?: number | null; // Backend field for current stage ID
  status: ProjectStatus;
  startDate?: Date; // Frontend field (optional for backward compatibility)
  endDate?: Date; // Frontend field (optional for backward compatibility)
  start_date?: string; // Backend field for start date (primary)
  end_date?: string; // Backend field for end date (primary)
  progress: number;
  userCount?: number; // Number of unique users assigned to project tasks
  stages: Stage[];
  teamMembers: string[]; // User IDs
  subProjects?: Project[];
  parentId?: string;
  grades?: Grade[];
}

export interface Grade {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  order: number;
  weight: number; // Percentage weight of this grade (0-100)
  books: Book[];
}

export interface Book {
  id: string;
  name: string;
  type: 'student' | 'teacher' | 'practice' | 'digital';
  description?: string;
  gradeId: string;
  order: number;
  weight: number; // Percentage weight of this book (0-100)
  units: Unit[];
}

export interface Unit {
  id: string;
  name: string;
  description?: string;
  bookId: string;
  order: number;
  weight: number; // Percentage weight of this unit (0-100)
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  name: string;
  description?: string;
  unitId: string;
  order: number;
  weight: number; // Percentage weight of this lesson (0-100)
}

export interface ProjectComponent {
  id: string;
  name: string;
  type: 'project' | 'grade' | 'book' | 'unit' | 'lesson';
  description?: string;
  parentId?: string;
  projectId: string;
  progress: number;
  order: number;
  path: string; // e.g., "Grade KG1 > Book 1 > Unit 1 > Lesson 1"
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  order: number;
  weight: number; // Percentage weight of this stage (0-100)
  status: StageStatus;
  progress: number;
  startDate: Date;
  endDate: Date;
  reviewRounds: ReviewRound[];
  tasks: Task[];
  subStages?: Stage[];
  parentStageId?: string;
}

export interface ReviewRound {
  id: string;
  name: string;
  stageId: string;
  status: ReviewStatus;
  reviewers: string[]; // User IDs
  startDate: Date;
  endDate: Date;
  comments?: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  stageId?: string; // Frontend field (optional for backward compatibility)
  projectId?: string; // Frontend field (optional for backward compatibility)
  stage_id?: string; // Backend field for stage ID (legacy)
  category_stage_id?: string | number; // Backend field for category stage ID
  project_id?: string; // Backend field for project ID
  gradeId?: string;
  bookId?: string;
  unitId?: string;
  lessonId?: string;
  grade_id?: string | number | null; // Backend field
  book_id?: string | number | null; // Backend field
  unit_id?: string | number | null; // Backend field
  lesson_id?: string | number | null; // Backend field
  componentPath?: string; // Human readable path
  assignees: string[]; // User IDs
  teamAssignees?: string[]; // Team IDs
  skills: string[] | any[]; // Can be array of strings or skill objects
  status: TaskStatus;
  priority: Priority;
  startDate?: Date; // Frontend field (optional for backward compatibility)
  endDate?: Date; // Frontend field (optional for backward compatibility)
  start_date?: string; // Backend field for start date
  end_date?: string; // Backend field for end date
  progress: number;
  estimatedHours?: number; // Frontend field (optional for backward compatibility)
  actualHours?: number; // Frontend field (optional for backward compatibility)
  estimated_hours?: number; // Backend field for estimated hours
  actual_hours?: number; // Backend field for actual hours
  created_at?: string; // Backend field
  updated_at?: string; // Backend field
  created_by?: string; // Backend field
  // Enhanced fields from team member queries
  project_name?: string;
  project_status?: string;
  project_description?: string;
  stage_name?: string;
  stage_description?: string;
  category_name?: string;
  category_description?: string;
  required_skills?: string[];
  grade_name?: string;
  book_name?: string;
  unit_name?: string;
  lesson_name?: string;
  // Computed fields
  is_overdue?: boolean;
  days_until_due?: number;
  priority_color?: string;
  status_color?: string;
  server_location?: string;
  performance_flag_type?: 'red' | 'orange' | 'yellow' | 'green';
  performance_flag_reason?: string;
  rework_count?: number;
  reworkCount?: number;
  reworkSeverity?: 'yellow' | 'orange' | 'red' | null;
  resubmission_deadline?: string | null;
  resubmissionDeadline?: string | null;
  resubmission_set_by?: number | null;
  resubmission_set_at?: string | null;
  remainingTime?: string | null;
  resubmissionOverdue?: boolean;
}

export interface TeamAllocation {
  id?: string | number;
  user_id: string | number;
  user_type: 'admin' | 'team';
  project_id: string | number;
  task_id?: string | number;
  hours_per_day: number;
  start_date: string;
  end_date: string;
  created_at?: string;
  updated_at?: string;
  // Frontend compatibility fields
  userId?: string;
  projectId?: string;
  taskId?: string;
  hoursPerDay?: number;
  startDate?: Date;
  endDate?: Date;
  // Related data from joins
  project_name?: string;
  task_name?: string;
  user_name?: string;
  user_email?: string;
  user_skills?: string[];
  date?: string;
  task_status?: string;
  task_priority?: string;
}

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
export type StageStatus = 'not-started' | 'in-progress' | 'under-review' | 'completed';
export type ReviewStatus = 'pending' | 'in-progress' | 'approved' | 'rejected';
export type TaskStatus =
  | 'not-started'
  | 'in-progress'
  | 'under-review'
  | 'completed'
  | 'blocked'
  | 'on-hold'
  | 'returned'
  | 'redo-requested'
  | 'resubmitted';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface FilterOptions {
  projects?: string[];
  categories?: string[];
  teamMembers?: string[];
  skills?: string[];
  stages?: string[];
  statuses?: string[];
  activeOnly?: boolean;
  overdue?: boolean;
  dueToday?: boolean;
  dueTomorrow?: boolean;
  dueThisWeek?: boolean;
}

export interface PerformanceSummary {
  team_member: {
    id: number;
    name: string;
    email: string;
  };
  summary: Array<{
    type: 'red' | 'orange' | 'yellow' | 'green';
    count: number;
    last_flag_date: string;
  }>;
}