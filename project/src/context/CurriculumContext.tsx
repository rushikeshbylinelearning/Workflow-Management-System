import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurriculumData } from '../types/curriculum';
import { DatabaseService } from '../services/database';
import { initialCurriculumData } from '../data/initialData';

interface CurriculumContextType {
  data: CurriculumData;
  updateData: (newData: CurriculumData) => void;
  isAdminMode: boolean;
  setIsAdminMode: (isAdmin: boolean) => void;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const CurriculumContext = createContext<CurriculumContextType | undefined>(undefined);

export const CurriculumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<CurriculumData>(initialCurriculumData);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Try to load from database, fall back to initial data if tables don't exist
      try {
        await DatabaseService.initializeDatabase();
        const curriculumData = await DatabaseService.loadAllData();
        setData(curriculumData);
        console.log('Successfully loaded data from database');
      } catch (dbError) {
        console.warn('Database not available, using initial data:', dbError);
        setData(initialCurriculumData);
        setError('Database not connected. Using default data. Please set up your database tables to persist changes.');
      }
      // Try to load from database, fall back to initial data if tables don't exist
      try {
        await DatabaseService.initializeDatabase();
        const curriculumData = await DatabaseService.loadAllData();
        setData(curriculumData);
        console.log('Successfully loaded data from database');
      } catch (dbError) {
        console.warn('Database not available, using initial data:', dbError);
        setData(initialCurriculumData);
        setError('Database not connected. Using default data. Please set up your database tables to persist changes.');
      }
    } catch (err) {
      console.error('Error loading curriculum data:', err);
      setData(initialCurriculumData);
      setError('Failed to load data. Using default curriculum data.');
      setError('Failed to load data. Using default curriculum data.');
      setError('Failed to load data. Using default curriculum data.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateData = (newData: CurriculumData) => {
    setData(newData);
    // Note: Individual components should handle their own database updates
    // This function is kept for compatibility but actual persistence
    // should happen through the DatabaseService methods
  };

  return (
    <CurriculumContext.Provider value={{ 
      data, 
      updateData, 
      isAdminMode, 
      setIsAdminMode, 
      isLoading, 
      error, 
      refreshData 
    }}>
      {children}
    </CurriculumContext.Provider>
  );
};

export const useCurriculum = () => {
  const context = useContext(CurriculumContext);
  if (context === undefined) {
    throw new Error('useCurriculum must be used within a CurriculumProvider');
  }
  return context;
};