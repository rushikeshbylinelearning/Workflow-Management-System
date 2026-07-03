import { supabase } from '../lib/supabase';
import { CurriculumData, GradeBand, AIStrand, Grade, UNESCOCompetency, LearningProgressionIndicator, CrossCuttingCompetency } from '../types/curriculum';
import { initialCurriculumData } from '../data/initialData';

export class DatabaseService {
  static async initializeDatabase(): Promise<void> {
    console.log('Initializing database with default data...');
    
    try {
      // Check if tables exist by trying to query one
      const { error: checkError } = await supabase
        .from('grade_bands')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        throw new Error('Database tables not found. Please run the migration SQL in your Supabase dashboard.');
      }

      // Check if data already exists
      const { data: existingData, error } = await supabase
        .from('grade_bands')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      // If no data exists, initialize with default data
      if (!existingData || existingData.length === 0) {
        await this.seedDatabase();
      }
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  static async seedDatabase(): Promise<void> {
    console.log('Seeding database with initial data...');

    try {
      // Insert grade bands
      const { error: gradeBandsError } = await supabase
        .from('grade_bands')
        .upsert(initialCurriculumData.gradeBands, { onConflict: 'id' });

      if (gradeBandsError) throw gradeBandsError;

      // Insert AI strands
      const { error: aiStrandsError } = await supabase
        .from('ai_strands')
        .upsert(initialCurriculumData.aiStrands, { onConflict: 'id' });

      if (aiStrandsError) throw aiStrandsError;

      // Insert UNESCO competencies
      const { error: unescoError } = await supabase
        .from('unesco_competencies')
        .upsert(initialCurriculumData.unescoCompetencies, { onConflict: 'id' });

      if (unescoError) throw unescoError;

      // Insert grades
      const { error: gradesError } = await supabase
        .from('grades')
        .upsert(initialCurriculumData.grades, { onConflict: 'id' });

      if (gradesError) throw gradesError;

      // Insert learning progression indicators
      const { error: lpiError } = await supabase
        .from('learning_progression_indicators')
        .upsert(initialCurriculumData.learningProgressionIndicators, { onConflict: 'id' });

      if (lpiError) throw lpiError;

      // Insert cross-cutting competencies
      const { error: cccError } = await supabase
        .from('cross_cutting_competencies')
        .upsert(initialCurriculumData.crossCuttingCompetencies, { onConflict: 'id' });

      if (cccError) throw cccError;

      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }
  }

  static async loadAllData(): Promise<CurriculumData> {
    try {
      const [
        gradeBandsResult,
        aiStrandsResult,
        gradesResult,
        unescoResult,
        lpiResult,
        cccResult
      ] = await Promise.all([
        supabase.from('grade_bands').select('*'),
        supabase.from('ai_strands').select('*'),
        supabase.from('grades').select('*'),
        supabase.from('unesco_competencies').select('*'),
        supabase.from('learning_progression_indicators').select('*'),
        supabase.from('cross_cutting_competencies').select('*')
      ]);

      if (gradeBandsResult.error) throw gradeBandsResult.error;
      if (aiStrandsResult.error) throw aiStrandsResult.error;
      if (gradesResult.error) throw gradesResult.error;
      if (unescoResult.error) throw unescoResult.error;
      if (lpiResult.error) throw lpiResult.error;
      if (cccResult.error) throw cccResult.error;

      return {
        gradeBands: gradeBandsResult.data || [],
        aiStrands: aiStrandsResult.data || [],
        grades: gradesResult.data || [],
        unescoCompetencies: unescoResult.data || [],
        learningProgressionIndicators: lpiResult.data || [],
        crossCuttingCompetencies: cccResult.data || []
      };
    } catch (error) {
      console.error('Error loading data from database:', error);
      throw error;
    }
  }

  static async saveGradeBand(gradeBand: GradeBand): Promise<void> {
    const { error } = await supabase
      .from('grade_bands')
      .upsert(gradeBand, { onConflict: 'id' });

    if (error) throw error;
  }

  static async saveGrade(grade: Grade): Promise<void> {
    const { error } = await supabase
      .from('grades')
      .upsert(grade, { onConflict: 'id' });

    if (error) throw error;
  }

  static async saveLearningProgressionIndicator(lpi: LearningProgressionIndicator): Promise<void> {
    const { error } = await supabase
      .from('learning_progression_indicators')
      .upsert(lpi, { onConflict: 'id' });

    if (error) throw error;
  }

  static async saveCrossCuttingCompetency(ccc: CrossCuttingCompetency): Promise<void> {
    const { error } = await supabase
      .from('cross_cutting_competencies')
      .upsert(ccc, { onConflict: 'id' });

    if (error) throw error;
  }
}