export interface GradeBand {
  id: string;
  name: string;
  cycle: string;
  grades: string;
  ages: string;
}

export interface AIStrand {
  id: string;
  name: string;
  shortName: string;
  code: string;
  definition: string;
}

export interface Grade {
  id: string;
  name: string;
  gradeBandId: string;
  weeklyHours: number;
  annualHours: number;
  projectTimePercent: number;
  assessmentTimePercent: number;
  aiStrandsCoverage: { [strandId: string]: number };
  yearTheme: string;
  essentialQuestion: string;
  competencies: {
    term1: string[];
    term2: string[];
    term3: string[];
  };
  resources: {
    studentBook?: string;
    teacherGuide?: string;
  };
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  activities: Activity[];
}

export interface Activity {
  id: string;
  title: string;
  type: 'classroom' | 'online' | 'assessment' | 'project';
  duration: number; // in minutes
  description: string;
  aiStrands: string[]; // Array of AI strand IDs
  unescoCompetencies: string[]; // Array of UNESCO competency IDs
}

export interface LearningProgressionIndicator {
  id: string;
  gradeBandId: string;
  strandId: string;
  indicators: string[];
}

export interface CrossCuttingCompetency {
  id: string;
  gradeBandId: string;
  component: 'computational-thinking' | 'ethical-development' | 'innovation-skills' | 'technical-skills';
  progression: string[];
}

export interface UNESCOCompetency {
  id: string;
  code: string;
  level: 1 | 2 | 3;
  levelName: 'Understand' | 'Apply' | 'Create';
  aspect: 'human-centred' | 'ethics' | 'techniques' | 'system-design';
  aspectName: 'Human-centred mindset' | 'Ethics of AI' | 'AI Techniques & Applications' | 'AI System Design';
  title: string;
  description: string;
  curricularGoals: string[];
}

export interface CurriculumData {
  gradeBands: GradeBand[];
  aiStrands: AIStrand[];
  grades: Grade[];
  learningProgressionIndicators: LearningProgressionIndicator[];
  crossCuttingCompetencies: CrossCuttingCompetency[];
  unescoCompetencies: UNESCOCompetency[];
}