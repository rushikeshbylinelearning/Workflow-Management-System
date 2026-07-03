import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type Database = {
  public: {
    Tables: {
      grade_bands: {
        Row: {
          id: string;
          name: string;
          cycle: string;
          grades: string;
          ages: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          cycle: string;
          grades: string;
          ages: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          cycle?: string;
          grades?: string;
          ages?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      ai_strands: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          code: string;
          definition: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          code: string;
          definition: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          code?: string;
          definition?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      grades: {
        Row: {
          id: string;
          name: string;
          grade_band_id: string | null;
          weekly_hours: number;
          annual_hours: number;
          project_time_percent: number;
          assessment_time_percent: number;
          ai_strands_coverage: any;
          year_theme: string;
          essential_question: string;
          competencies: any;
          resources: any;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          grade_band_id?: string | null;
          weekly_hours?: number;
          annual_hours?: number;
          project_time_percent?: number;
          assessment_time_percent?: number;
          ai_strands_coverage?: any;
          year_theme?: string;
          essential_question?: string;
          competencies?: any;
          resources?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          grade_band_id?: string | null;
          weekly_hours?: number;
          annual_hours?: number;
          project_time_percent?: number;
          assessment_time_percent?: number;
          ai_strands_coverage?: any;
          year_theme?: string;
          essential_question?: string;
          competencies?: any;
          resources?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      unesco_competencies: {
        Row: {
          id: string;
          code: string;
          level: number;
          level_name: string;
          aspect: string;
          aspect_name: string;
          title: string;
          description: string;
          curricular_goals: any;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          level: number;
          level_name: string;
          aspect: string;
          aspect_name: string;
          title: string;
          description: string;
          curricular_goals?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          level?: number;
          level_name?: string;
          aspect?: string;
          aspect_name?: string;
          title?: string;
          description?: string;
          curricular_goals?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      learning_progression_indicators: {
        Row: {
          id: string;
          grade_band_id: string | null;
          strand_id: string | null;
          indicators: any;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          grade_band_id?: string | null;
          strand_id?: string | null;
          indicators?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          grade_band_id?: string | null;
          strand_id?: string | null;
          indicators?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      cross_cutting_competencies: {
        Row: {
          id: string;
          grade_band_id: string | null;
          component: string;
          progression: any;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          grade_band_id?: string | null;
          component: string;
          progression?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          grade_band_id?: string | null;
          component?: string;
          progression?: any;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      lessons: {
        Row: {
          id: string;
          grade_id: string | null;
          title: string;
          description: string;
          order_index: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          grade_id?: string | null;
          title: string;
          description?: string;
          order_index?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          grade_id?: string | null;
          title?: string;
          description?: string;
          order_index?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      activities: {
        Row: {
          id: string;
          lesson_id: string | null;
          title: string;
          type: string;
          duration: number;
          description: string;
          ai_strands: any;
          unesco_competencies: any;
          materials: any;
          instructions: any;
          order_index: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          lesson_id?: string | null;
          title: string;
          type: string;
          duration?: number;
          description?: string;
          ai_strands?: any;
          unesco_competencies?: any;
          materials?: any;
          instructions?: any;
          order_index?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          lesson_id?: string | null;
          title?: string;
          type?: string;
          duration?: number;
          description?: string;
          ai_strands?: any;
          unesco_competencies?: any;
          materials?: any;
          instructions?: any;
          order_index?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
  };
};