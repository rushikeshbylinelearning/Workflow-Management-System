import React, { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';
import type { Project, User, Task, TeamAllocation, FilterOptions, ProjectComponent } from '../types';
import { sampleProjects, sampleUsers, sampleTasks } from '../utils/sampleData';

export type ViewName = 'dashboard' | 'projects' | 'teams' | 'tasks' | 'allocations' | 'analytics' | 'core-analytics' | 'notifications' | 'settings';

interface AppState {
  projects: Project[];
  users: User[];
  tasks: Task[];
  allocations: TeamAllocation[];
  categories: string[];
  skills: string[];
  filters: FilterOptions;
  selectedProject: string | null;
  selectedView: ViewName;
  selectedTaskId: string | null;
  viewHistory: ViewName[];
  previousView: ViewName;
}

type AppAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'SET_ALLOCATIONS'; payload: TeamAllocation[] }
  | { type: 'ADD_ALLOCATION'; payload: TeamAllocation }
  | { type: 'UPDATE_ALLOCATION'; payload: TeamAllocation }
  | { type: 'ADD_CATEGORY'; payload: string }
  | { type: 'ADD_SKILL'; payload: string }
  | { type: 'SET_FILTERS'; payload: FilterOptions }
  | { type: 'SET_SELECTED_PROJECT'; payload: string | null }
  | { type: 'SET_SELECTED_VIEW'; payload: ViewName }
  | { type: 'SET_SELECTED_TASK'; payload: string | null }
  | { type: 'SET_PREVIOUS_VIEW'; payload: ViewName }
  | { type: 'POP_VIEW' };

export const VALID_VIEWS: ViewName[] = [
  'dashboard', 'projects', 'teams', 'tasks', 'allocations',
  'analytics', 'core-analytics', 'notifications', 'settings',
];

function getPersistedView(): ViewName {
  try {
    const saved = sessionStorage.getItem('selectedView') as ViewName | null;
    if (saved && VALID_VIEWS.includes(saved)) return saved;
  } catch {}
  return 'dashboard';
}

const initialView = getPersistedView();

const initialState: AppState = {
  projects: sampleProjects,
  users: sampleUsers,
  tasks: sampleTasks,
  allocations: [],
  categories: ['eLearning Design', 'Curriculum Design', 'IT Applications'],
  skills: ['Content Writers', 'Instructional Designers', 'Graphic Designers', 'Developers', 'Animators', 'Tech', 'Sales', 'Marketing', 'QA'],
  filters: {},
  selectedProject: null,
  selectedView: initialView,
  selectedTaskId: null,
  viewHistory: [initialView],
  previousView: initialView,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] };
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'SET_ALLOCATIONS':
      return { ...state, allocations: action.payload };
    case 'ADD_ALLOCATION':
      return { ...state, allocations: [...state.allocations, action.payload] };
    case 'UPDATE_ALLOCATION':
      return {
        ...state,
        allocations: state.allocations.map(a =>
          a.userId === action.payload.userId &&
          a.projectId === action.payload.projectId &&
          a.taskId === action.payload.taskId ? action.payload : a
        )
      };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'ADD_SKILL':
      return { ...state, skills: [...state.skills, action.payload] };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProject: action.payload };

    case 'SET_SELECTED_VIEW': {
      const next = action.payload;
      if (next === state.selectedView) return state;
      try { sessionStorage.setItem('selectedView', next); } catch {}
      return {
        ...state,
        selectedView: next,
        previousView: state.selectedView,
        viewHistory: [...state.viewHistory, next],
      };
    }

    case 'POP_VIEW': {
      if (state.viewHistory.length < 2) return state;
      const newHistory = state.viewHistory.slice(0, -1);
      const previous = newHistory[newHistory.length - 1];
      try { sessionStorage.setItem('selectedView', previous); } catch {}
      return {
        ...state,
        selectedView: previous,
        previousView: newHistory.length >= 2 ? newHistory[newHistory.length - 2] : previous,
        viewHistory: newHistory,
        selectedTaskId: null,
      };
    }

    case 'SET_SELECTED_TASK':
      return { ...state, selectedTaskId: action.payload };
    case 'SET_PREVIOUS_VIEW':
      return { ...state, previousView: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const contextValue = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}