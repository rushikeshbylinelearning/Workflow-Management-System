import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  CheckSquare, 
  Clock,
  BarChart3,
  Settings,
  Plus,
  Edit2,
  Flag,
  AlertTriangle,
  Layers,
  UserPlus,
  X,
  GraduationCap,
  Trash2,
  Eye,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { Modal } from './ui/Modal';
import { useApp } from '../contexts/AppContext';
import { Project, Task, Stage, TaskStatus, Priority } from '../types';
import { calculateProjectProgress, calculateStageProgress, calculateTaskProgress } from '../utils/progressCalculator';
import {
  buildProjectTimelineItems,
  countTimelineItemsInProgress,
  isTimelineItemOverdue,
} from '../utils/projectTimeline';
import {
  PROJECT_TASKS_REFRESH_EVENT,
  type ProjectTasksRefreshDetail,
  requestProjectTasksRefresh,
} from '../utils/taskManagerCache';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { pickTaskUpdateStatus } from '../utils/taskStatusDisplay';
import { CreateTaskModal } from './TaskManager';
import { EditProjectModal } from './modals/EditProjectModal';
import EducationalHierarchy from './EducationalHierarchy';
import { TaskDetails } from './TaskDetails';
import { apiService, projectService, teamService, taskService, skillService, stageService, categoryService, gradeService, bookService, unitService, lessonService, performanceFlagService } from '../services/apiService';
import { FlagEmployeeModal } from './modals/FlagEmployeeModal';
import { BulkTaskSelectionActions } from './BulkTaskSelectionActions';
import { MAX_BULK_ROWS_ADMIN } from '../utils/bulkRemark';
import { useToast } from './ui/Toast';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
  onUpdate?: (updatedProject: Project) => void;
  categories?: any[];
}

export function ProjectDetails({ project, onBack, onUpdate, categories }: ProjectDetailsProps) {
  const { state, dispatch } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'stages' | 'tasks' | 'timeline' | 'team' | 'educational-hierarchy'>('overview');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingMember, setFlaggingMember] = useState<{ id: number; name: string } | null>(null);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [projectTeams, setProjectTeams] = useState<any[]>([]);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [localCategories, setLocalCategories] = useState<any[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [grades, setGrades] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  
  // Task management state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Task selection state for bulk operations
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  
  // Pagination state for tasks
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [allProjectTasks, setAllProjectTasks] = useState<any[]>([]); // Store all tasks for this project
  
  // Filter state for tasks
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  
  // Use the progress calculated by the backend, or calculate from tasks if not available
  const projectProgress = currentProject.progress !== undefined ? 
    { progress: currentProject.progress, completedWeight: currentProject.progress, totalWeight: 100 } :
    calculateProjectProgress(currentProject, projectTasks);

  // Get current stage information
  const currentStage = currentProject.current_stage_id ? 
    stages.find(stage => stage.id === currentProject.current_stage_id) : null;

  // Fetch project members, teams, and available team members
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [currentProjectData, members, teams, teamMembers, availableTeamsData, allTeamsData, tasksData, skillsData, projectsData, stagesData, categoriesData, gradesData, booksData, unitsData, lessonsData] = await Promise.all([
          projectService.getById(project.id),
          projectService.getMembers(project.id),
          projectService.getTeams(project.id),
          teamService.getMembers(),
          teamService.getTeams(),
          teamService.getTeams(),
          taskService.getAll({ all: 'true' }),
          skillService.getAll(),
          projectService.getAll(),
          stageService.getAll(project.id),
          categoryService.getAll(),
          gradeService.getAll(),
          bookService.getAll(),
          unitService.getAll(),
          lessonService.getAll()
        ]);
        setCurrentProject(currentProjectData);
        setProjectMembers(members.data || members);
        setProjectTeams(teams.data || teams);
        setAvailableTeamMembers(teamMembers.data || teamMembers);
        setAvailableTeams(availableTeamsData.data || availableTeamsData);
        setAllTeams(allTeamsData.data || allTeamsData);
        // Extract tasks from API response structure
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        
        
        // Store all project tasks and set pagination
        setAllProjectTasks(projectTasksArray);
        setTotalTasks(projectTasksArray.length);
        setTotalPages(Math.ceil(projectTasksArray.length / pageSize));
        
        // Set current page tasks
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        setProjectTasks(projectTasksArray.slice(startIndex, endIndex));
        setTeamMembers(teamMembers.data || teamMembers);
        setSkills(skillsData.data || skillsData);
        setProjects(projectsData.data || projectsData);
        const projStages = stagesData.data || stagesData;
        setStages(projStages);
        setProjectStages(projStages);
        setLocalCategories(categoriesData.data || categoriesData);
        setGrades(gradesData.data || gradesData);
        setBooks(booksData.data || booksData);
        setUnits(unitsData.data || unitsData);
        setLessons(lessonsData.data || lessonsData);
      } catch (error) {
        console.error('Failed to fetch project data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project.id]);

  // Debounce search term to reduce filtering calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Handle pagination and filtering changes
  useEffect(() => {
    if (allProjectTasks.length > 0) {
      // Apply filters
      let filteredTasks = allProjectTasks.filter((task: any) => {
        // Search filter
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          if (!task.name.toLowerCase().includes(searchLower) && 
              !task.description.toLowerCase().includes(searchLower)) {
            return false;
          }
        }
        
        // Status filter
        if (selectedStatus !== 'all' && selectedStatus !== 'overdue') {
          if (task.status !== selectedStatus) {
            return false;
          }
        }
        
        // Overdue filter (handled separately as it's not a status but a date-based condition)
        if (selectedStatus === 'overdue') {
          const endDate = task.end_date || task.endDate;
          if (!endDate || task.status === 'completed') return false;
          
          // Get today's date at midnight (start of day)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Get the end date at midnight (start of day)
          const dueDate = new Date(endDate);
          dueDate.setHours(0, 0, 0, 0);
          
          // Task is overdue if due date is before today AND not completed
          if (dueDate >= today) {
            return false;
          }
        }
        
        // Priority filter
        if (selectedPriority !== 'all' && task.priority !== selectedPriority) {
          return false;
        }
        
        // Assignee filter
        if (selectedAssignee !== 'all') {
          if (selectedAssignee === 'none') {
            if (task.assignees && task.assignees.length > 0) {
              return false;
            }
          } else {
            if (!task.assignees || !task.assignees.map((id: any) => String(id)).includes(String(selectedAssignee))) {
              return false;
            }
          }
        }

        // Stage filter (category_stage_id)
        if (selectedStage !== 'all') {
          const taskStageId = task.category_stage_id ? parseInt(task.category_stage_id.toString()) : (task.stage_id ? parseInt(task.stage_id.toString()) : null);
          if (taskStageId !== parseInt(selectedStage)) {
            return false;
          }
        }
        
        return true;
      });
      
      // Update total count for filtered results
      setTotalTasks(filteredTasks.length);
      setTotalPages(Math.ceil(filteredTasks.length / pageSize));
      
      // Reset to first page if current page is out of bounds
      const maxPage = Math.ceil(filteredTasks.length / pageSize);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(1);
      }
      
      // Apply pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setProjectTasks(filteredTasks.slice(startIndex, endIndex));
    }
  }, [currentPage, pageSize, allProjectTasks, debouncedSearch, selectedStatus, selectedPriority, selectedAssignee, selectedStage]);

  const refreshProjectTaskData = useCallback(async () => {
    try {
      const [tasksData, currentProjectData] = await Promise.all([
        taskService.getAll({ all: 'true', project_id: project.id }),
        projectService.getById(project.id),
      ]);
      const tasksArray = tasksData.data || tasksData;
      const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));

      setAllProjectTasks(projectTasksArray);
      setTotalTasks(projectTasksArray.length);
      setTotalPages(Math.ceil(projectTasksArray.length / pageSize));
      setCurrentProject(currentProjectData);
      onUpdate?.(currentProjectData);
    } catch (error) {
      console.error('Failed to refresh project task data:', error);
    }
  }, [project.id, pageSize, onUpdate]);

  const prevSelectedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevSelectedTaskIdRef.current && !selectedTaskId) {
      refreshProjectTaskData();
    }
    prevSelectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId, refreshProjectTaskData]);

  useEffect(() => {
    const handleProjectTasksRefresh = (event: Event) => {
      const detail = (event as CustomEvent<ProjectTasksRefreshDetail>).detail;
      if (String(detail?.projectId) === String(project.id)) {
        refreshProjectTaskData();
      }
    };

    window.addEventListener(PROJECT_TASKS_REFRESH_EVENT, handleProjectTasksRefresh);
    return () => window.removeEventListener(PROJECT_TASKS_REFRESH_EVENT, handleProjectTasksRefresh);
  }, [project.id, refreshProjectTaskData]);

  useEffect(() => {
    if (activeTab === 'timeline' || activeTab === 'team') {
      refreshProjectTaskData();
    }
  }, [activeTab, refreshProjectTaskData]);

  const timelineItems = useMemo(
    () =>
      buildProjectTimelineItems({
        project: currentProject,
        stages: projectStages,
        tasks: allProjectTasks,
      }),
    [currentProject, projectStages, allProjectTasks]
  );

  const membersWithAssignedTasks = useMemo(() => {
    const memberMap = new Map<string, {
      id: string;
      name: string;
      email?: string;
      role: string;
      project_member_id?: number;
    }>();

    for (const task of allProjectTasks) {
      const assigneeDetails: any[] =
        task.assigneeDetails && task.assigneeDetails.length > 0
          ? task.assigneeDetails
          : (task.assignees || [])
              .map((assigneeId: any) => {
                const member = teamMembers.find((m) => String(m.id) === String(assigneeId));
                return member
                  ? { id: member.id, type: 'team', name: member.name, email: member.email }
                  : null;
              })
              .filter(Boolean);

      for (const assignee of assigneeDetails) {
        if (assignee.type && assignee.type !== 'team') continue;

        const memberId = String(assignee.id);
        if (memberMap.has(memberId)) continue;

        const projectMember = projectMembers.find(
          (m) => String(m.user_id || m.team_member_id) === memberId
        );

        memberMap.set(memberId, {
          id: memberId,
          name: assignee.name || projectMember?.name || 'Unknown User',
          email: assignee.email || projectMember?.email,
          role: projectMember?.role || 'member',
          project_member_id: projectMember?.project_member_id ?? projectMember?.id,
        });
      }
    }

    return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProjectTasks, teamMembers, projectMembers]);

  const getTasksForMember = useCallback((memberId: string) => {
    return allProjectTasks.filter(
      (task: any) =>
        task.assignees &&
        task.assignees.map((id: any) => String(id)).includes(String(memberId))
    );
  }, [allProjectTasks]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, selectedPriority, selectedAssignee, selectedStage]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedTasks(new Set());
  }, [debouncedSearch, selectedStatus, selectedPriority, selectedAssignee, selectedStage, currentPage]);

  // Task selection functions
  const toggleTaskSelection = (taskId: string) => {
    if (selectedTasks.has(taskId)) {
      setSelectedTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      return;
    }
    if (selectedTasks.size >= MAX_BULK_ROWS_ADMIN) {
      showToast(`You can select at most ${MAX_BULK_ROWS_ADMIN} tasks at once.`, 'error');
      return;
    }
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  const selectAllTasks = () => {
    const allTaskIds = projectTasks.slice(0, MAX_BULK_ROWS_ADMIN).map(task => task.id.toString());
    if (projectTasks.length > MAX_BULK_ROWS_ADMIN) {
      showToast(`Selected the first ${MAX_BULK_ROWS_ADMIN} tasks (maximum at once).`, 'info');
    }
    setSelectedTasks(new Set(allTaskIds));
  };

  const clearAllSelections = () => {
    setSelectedTasks(new Set());
  };

  const isAllSelected = () => {
    return projectTasks.length > 0 && projectTasks.every(task => selectedTasks.has(task.id.toString()));
  };

  const isPartiallySelected = () => {
    return selectedTasks.size > 0 && selectedTasks.size < projectTasks.length;
  };

  // Bulk delete function
  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;

    try {
      // Convert Set to Array and ensure they are numbers, filtering out invalid IDs
      const taskIds = Array.from(selectedTasks)
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0);

      // Validate we have valid IDs
      if (taskIds.length === 0) {
        console.error('No valid tasks selected for deletion');
        return;
      }

      // Call bulk delete API
      await taskService.bulkDelete(taskIds);

      // Clear selections
      setSelectedTasks(new Set());
      setIsBulkDeleteModalOpen(false);

      // Refresh project tasks
      const tasksData = await taskService.getAll({ all: 'true' });
      const tasksArray = tasksData.data || tasksData;
      const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
      
      // Update all project tasks - filtering will be handled by the useEffect
      setAllProjectTasks(projectTasksArray);
      
      // Also refresh the current project to update progress
      const currentProjectData = await projectService.getById(project.id);
      setCurrentProject(currentProjectData);

    } catch (err: any) {
      console.error('❌ Bulk delete error:', err);
      
      // Refresh the task list even on error to show current state
      try {
        const tasksData = await taskService.getAll({ all: 'true' });
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        setAllProjectTasks(projectTasksArray);
        
        const currentProjectData = await projectService.getById(project.id);
        setCurrentProject(currentProjectData);
      } catch (refreshErr) {
        console.error('Failed to refresh after error:', refreshErr);
      }
      
      // Clear selections on error too
      setSelectedTasks(new Set());
      setIsBulkDeleteModalOpen(false);
    }
  };

  const handleAddMember = async (memberId: number, role: string = 'member') => {
    try {
      await projectService.addMember(project.id, { 
        user_id: memberId, 
        user_type: 'team',
        role 
      });
      
      // Refresh project members
      const members = await projectService.getMembers(project.id);
      setProjectMembers(members.data || members);
      setIsAddMemberModalOpen(false);
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleAddTeam = async (teamId: number, role: string = 'member') => {
    try {
      await projectService.addTeam(project.id, { 
        team_id: teamId, 
        role 
      });
      
      // Refresh project members and teams
      const [members, teams] = await Promise.all([
        projectService.getMembers(project.id),
        projectService.getTeams(project.id)
      ]);
      setProjectMembers(members.data || members);
      setProjectTeams(teams.data || teams);
      setIsAddTeamModalOpen(false);
    } catch (error) {
      console.error('Failed to add team:', error);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await projectService.removeMember(project.id, memberId);
      
      // Refresh project members
      const members = await projectService.getMembers(project.id);
      setProjectMembers(members.data || members);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleOpenFlagModal = (member: any) => {
    setFlaggingMember({ 
      id: member.user_id || member.team_member_id || member.id, 
      name: member.name 
    });
    setShowFlagModal(true);
  };

  const handleRemoveTeam = async (teamId: number) => {
    try {
      await projectService.removeTeam(project.id, teamId);
      
      // Refresh project members and teams
      const [members, teams] = await Promise.all([
        projectService.getMembers(project.id),
        projectService.getTeams(project.id)
      ]);
      setProjectMembers(members.data || members);
      setProjectTeams(teams.data || teams);
    } catch (error) {
      console.error('Failed to remove team:', error);
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      // Auto-calculate progress based on status
      const autoProgress = taskData.status ? calculateTaskProgress(taskData.status) : 0;
      
      // Build component path for display
      let componentPath = '';
      if (taskData.gradeId) {
        const grade = grades.find(g => g.id === parseInt(taskData.gradeId || '0'));
        if (grade) {
          componentPath = grade.name;
          if (taskData.bookId) {
            const book = books.find(b => b.id === parseInt(taskData.bookId || '0'));
            if (book) {
              componentPath += ` > ${book.name}`;
              if (taskData.unitId) {
                const unit = units.find(u => u.id === parseInt(taskData.unitId || '0'));
                if (unit) {
                  componentPath += ` > ${unit.name}`;
                  if (taskData.lessonId) {
                    const lesson = lessons.find(l => l.id === parseInt(taskData.lessonId || '0'));
                    if (lesson) {
                      componentPath += ` > ${lesson.name}`;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Convert skill names to skill IDs
      const skillIds = (taskData.skills || []).map((skillName: string) => {
        const skill = skills.find(s => s.name === skillName);
        return skill ? skill.id : null;
      }).filter(id => id !== null);

      // Create new task via API
      const createData = {
        name: taskData.name || '',
        description: taskData.description || '',
        project_id: parseInt(project.id),
        category_stage_id: parseInt(taskData.stageId || ''), 
        status: taskData.status || 'not-started',
        priority: taskData.priority || 'medium',
        start_date: taskData.startDate || new Date().toISOString().split('T')[0],
        end_date: taskData.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_hours: taskData.estimatedHours || 8,
        assignees: taskData.assignees || [],
        teamAssignees: taskData.teamAssignees || [],
        skills: skillIds,
        component_path: componentPath,
        // Add educational hierarchy IDs
        grade_id: taskData.gradeId ? parseInt(taskData.gradeId) : null,
        book_id: taskData.bookId ? parseInt(taskData.bookId) : null,
        unit_id: taskData.unitId ? parseInt(taskData.unitId) : null,
        lesson_id: taskData.lessonId ? parseInt(taskData.lessonId) : null
      };
      

      
      const newTask = await taskService.create(createData);
      
      // Refresh project tasks
      const tasksData = await taskService.getAll({ all: 'true' });
      const tasksArray = tasksData.data || tasksData;
      const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
      
      // Update all project tasks - filtering will be handled by the useEffect
      setAllProjectTasks(projectTasksArray);
      
      // Also refresh the current project to update progress
      const currentProjectData = await projectService.getById(project.id);
      setCurrentProject(currentProjectData);
      
      setIsCreateTaskModalOpen(false);
    } catch (error) {
      console.error('❌ Failed to create task from ProjectDetails:', error);
    }
  };

  const [isBulkCreateModalOpen, setIsBulkCreateModalOpen] = useState(false);
  const [bulkCreatePreview, setBulkCreatePreview] = useState<any>(null);
  const [selectedStages, setSelectedStages] = useState<number[]>([]);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  const handleBulkCreateTasks = async () => {
    try {
      setLoading(true);
      
      // Get the bulk create preview first
      const previewResult = await apiService.get(`/tasks/project/${project.id}/bulk-create-preview`);

      if (previewResult.success) {
        setBulkCreatePreview(previewResult.data);
        setSelectedStages([]); // Reset selection
        setIsBulkCreateModalOpen(true);
      } else {
        throw new Error(previewResult.error?.message || 'Failed to get bulk create preview');
      }
    } catch (error: any) {
      console.error('❌ Failed to get bulk create preview:', error);
      alert(`❌ Error: ${error.message || 'Failed to get bulk create preview'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBulkCreate = async () => {
    if (selectedStages.length === 0) {
      alert('Please select at least one stage to create tasks for.');
      return;
    }

    try {
      setIsCreatingTasks(true);
      
      // Call the bulk create API with selected stages
      const result = await apiService.post(`/tasks/project/${project.id}/bulk-create`, {
        selected_stage_ids: selectedStages
      });

      if (result.success) {
        // Show success message
        alert(`🎉 Successfully created ${result.data.created_tasks} tasks!\n\n` +
              `Project: ${result.data.project_name}\n` +
              `Selected Stages: ${selectedStages.length}\n` +
              `Created: ${result.data.created_tasks}\n` +
              `Skipped: ${result.data.skipped_tasks}`);
        
        // Refresh project tasks
        const tasksData = await taskService.getAll({ all: 'true' });
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        
        setAllProjectTasks(projectTasksArray);
        
        // Refresh the current project to update progress
        const currentProjectData = await projectService.getById(project.id);
        setCurrentProject(currentProjectData);
        
        // Close modal
        setIsBulkCreateModalOpen(false);
        setBulkCreatePreview(null);
        setSelectedStages([]);
        
      } else {
        throw new Error(result.error?.message || 'Failed to bulk create tasks');
      }
    } catch (error: any) {
      console.error('❌ Failed to bulk create tasks:', error);
      alert(`❌ Error: ${error.message || 'Failed to bulk create tasks'}`);
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const handleEditProject = async (projectData: Partial<Project>) => {
    try {
      setLoading(true);
      
      // Call the API to update the project
      const updatedProjectData = await projectService.update(project.id, projectData);
      
      // Update the local state with the response from the API
      const updatedProject: Project = {
        ...project,
        ...updatedProjectData,
        start_date: projectData.start_date || project.start_date,
        end_date: projectData.end_date || project.end_date,
      };
      
      // Update the current project state immediately
      setCurrentProject(updatedProject);
      
      // Call the onUpdate callback to update the parent component
      if (onUpdate) {
        onUpdate(updatedProject);
      }
      
      dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
      setIsEditProjectModalOpen(false);
      
    } catch (error) {
      console.error('❌ Failed to update project:', error);
      // You might want to show an error message to the user here
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'educational-hierarchy', label: 'Educational Hierarchy', icon: GraduationCap },
    { key: 'tasks', label: 'Tasks', icon: CheckSquare },
    { key: 'timeline', label: 'Timeline', icon: Calendar },
    { key: 'team', label: 'Team', icon: Users },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Project Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-blue-50">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Progress</p>
                <p className="text-2xl font-bold text-gray-900">{projectProgress.progress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckSquare className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-purple-50">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Team</p>
                <p className="text-2xl font-bold text-gray-900">{membersWithAssignedTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-orange-50">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Days Left</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.ceil((new Date(project.end_date || project.endDate || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Flag className="w-5 h-5 mr-2 text-blue-600" />
            Stage Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectStages && projectStages.length > 0 ? (
            <div className="space-y-4">
              {projectStages.map((stage) => {
                // Get all tasks for this stage
                const stageTasks = allProjectTasks.filter((task: any) => 
                  task.category_stage_id === stage.id || task.stage_id === stage.id
                );
                
                // Calculate completion stats
                const totalTasks = stageTasks.length;
                const completedTasks = stageTasks.filter((task: any) => task.status === 'completed').length;
                const inProgressTasks = stageTasks.filter((task: any) => 
                  task.status === 'in-progress' || task.status === 'under-review'
                ).length;
                
                // Calculate progress percentage
                const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                
                // Determine stage status
                let stageStatus = 'not-started';
                let statusColor = 'gray';
                
                if (progressPercentage === 100) {
                  stageStatus = 'completed';
                  statusColor = 'green';
                } else if (progressPercentage > 0) {
                  stageStatus = 'in-progress';
                  statusColor = 'blue';
                }
                
                return (
                  <div key={stage.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-semibold text-gray-900">{stage.name}</h4>
                          <Badge variant={
                            stageStatus === 'completed' ? 'success' :
                            stageStatus === 'in-progress' ? 'primary' : 'default'
                          } size="sm">
                            {stageStatus === 'completed' ? 'Completed' :
                             stageStatus === 'in-progress' ? 'In Progress' : 'Not Started'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{progressPercentage}%</div>
                        <div className="text-sm text-gray-600">
                          {completedTasks}/{totalTasks} tasks
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{progressPercentage}%</span>
                      </div>
                      <ProgressBar value={progressPercentage} />
                    </div>
                    
                    {/* Task Statistics */}
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{totalTasks}</div>
                        <div className="text-xs text-gray-600">Total Tasks</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">{completedTasks}</div>
                        <div className="text-xs text-gray-600">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">{inProgressTasks}</div>
                        <div className="text-xs text-gray-600">In Progress</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <Flag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No stages found for this project</p>
              <p className="text-sm text-gray-400 mt-1">Stages will appear here once tasks are created</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Description */}
      <Card>
        <CardHeader>
          <CardTitle>Project Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{project.description}</p>
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-1" />
              Start: {new Date(project.start_date || project.startDate || '').toLocaleDateString()}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-1" />
              End: {new Date(project.end_date || project.endDate || '').toLocaleDateString()}
            </div>
            <Badge variant={
              project.status === 'active' ? 'primary' :
              project.status === 'completed' ? 'success' :
              project.status === 'on-hold' ? 'warning' : 'default'
            }>
              {project.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimeline = () => {
    const getStatusColor = (status: string, type: string) => {
      if (type === 'milestone') {
        return status === 'completed' ? 'bg-green-500' : 'bg-gray-400';
      }
      switch (status) {
        case 'completed': return 'bg-green-500';
        case 'in-progress': return 'bg-blue-500';
        case 'under-review': return 'bg-yellow-500';
        case 'resubmitted': return 'bg-yellow-500';
        case 'not-started': return 'bg-gray-400';
        case 'blocked': return 'bg-red-500';
        default: return 'bg-gray-400';
      }
    };

    return (
      <div className="space-y-6">
        {/* Timeline Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
            <p className="text-sm text-gray-600">Track project milestones, stages, and key tasks</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span>Not Started</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span>Overdue</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {/* Timeline items */}
              <div className="space-y-8">
                {timelineItems.map((item) => (
                  <div key={item.id} className="relative flex items-start">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-12 h-12 rounded-full ${getStatusColor(item.status, item.type)} flex items-center justify-center`}>
                      {item.type === 'milestone' && <Flag className="w-5 h-5 text-white" />}
                      {item.type === 'stage' && <BarChart3 className="w-5 h-5 text-white" />}
                      {item.type === 'task' && <CheckSquare className="w-5 h-5 text-white" />}
                    </div>

                    {/* Timeline content */}
                    <div className="ml-6 flex-1">
                      <div className={`p-4 rounded-lg border-2 ${
                        isTimelineItemOverdue(item) ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-gray-900">{item.title}</h4>
                              {item.type === 'stage' && item.weight && (
                                <Badge variant="secondary" size="sm">
                                  {item.weight}% weight
                                </Badge>
                              )}
                              {item.priority && (
                                <Badge variant={
                                  item.priority === 'urgent' ? 'danger' :
                                  item.priority === 'high' ? 'warning' : 'primary'
                                } size="sm">
                                  {item.priority}
                                </Badge>
                              )}
                              {isTimelineItemOverdue(item) && (
                                <Badge variant="danger" size="sm">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                            
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {item.date.toLocaleDateString()}
                                {item.endDate && ` - ${item.endDate.toLocaleDateString()}`}
                              </div>
                              
                              {item.assignees && item.assignees.length > 0 && (
                                <div className="flex items-center">
                                  <Users className="w-4 h-4 mr-1" />
                                  {item.assignees.length} assigned
                                </div>
                              )}
                            </div>

                            {/* Progress bar for stages and tasks */}
                            {(item.type === 'stage' || item.type === 'task') && item.progress !== undefined && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-gray-600">Progress</span>
                                  <span className="font-medium">{item.progress}%</span>
                                </div>
                                <ProgressBar value={item.progress} showLabel={false} />
                              </div>
                            )}
                          </div>

                          <Badge variant={
                            item.status === 'completed' ? 'success' :
                            item.status === 'in-progress' ? 'primary' :
                            item.status === 'under-review' || item.status === 'resubmitted' ? 'warning' :
                            item.status === 'blocked' ? 'danger' : 'default'
                          }>
                            {item.status.replace('-', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {timelineItems.filter(item => item.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">Completed Items</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {countTimelineItemsInProgress(timelineItems)}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {timelineItems.filter((item) => isTimelineItemOverdue(item)).length}
                </div>
                <div className="text-sm text-gray-600">Overdue Items</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderStages = () => (
    <div className="space-y-6">
      {project.stages && project.stages.length > 0 ? (
        project.stages.map((stage) => {
          const stageTasks = projectTasks.filter(task => task.stageId === stage.id);
          const stageProgress = calculateStageProgress(stage.id, projectTasks);
          
          return (
            <Card key={stage.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      Stage {stage.order}: {stage.name}
                      <Badge variant="secondary" size="sm" className="ml-2">
                        {stage.weight}% weight
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
                  </div>
                  <Badge variant={
                    stage.status === 'completed' ? 'success' :
                    stage.status === 'in-progress' ? 'primary' :
                    stage.status === 'under-review' ? 'warning' : 'default'
                  }>
                    {stage.status.replace('-', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Start: {new Date(stage.startDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    End: {new Date(stage.endDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {stageTasks.length} tasks
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{stageProgress.progress}%</span>
                  </div>
                  <ProgressBar value={stageProgress.progress} />
                </div>

                {stageTasks.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-900">Recent Tasks:</h5>
                    {stageTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{task.name}</span>
                        <Badge variant={
                          task.status === 'completed' ? 'success' :
                          task.status === 'in-progress' ? 'primary' :
                          task.status === 'under-review' ? 'warning' :
                          task.status === 'blocked' ? 'danger' : 'default'
                        } size="sm">
                          {task.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    ))}
                    {stageTasks.length > 3 && (
                      <p className="text-xs text-gray-500">+{stageTasks.length - 3} more tasks</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Flag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Stages Defined</h3>
            <p className="text-gray-600">This project doesn't have any stages configured yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTasks = () => {
    // Show task details if a task is selected
    if (selectedTaskId) {
      return (
        <TaskDetails 
          taskId={selectedTaskId} 
          onBack={() => setSelectedTaskId(null)}
        />
      );
    }

    const handleEditTask = (task: any) => {
      setEditingTask(task);
      setIsEditModalOpen(true);
    };

      const handleUpdateTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        // Build component path for display (same logic as handleCreateTask)
        let componentPath = '';
        if (taskData.gradeId) {
          const grade = grades.find(g => g.id === parseInt(taskData.gradeId || '0'));
          if (grade) {
            componentPath = grade.name;
            if (taskData.bookId) {
              const book = books.find(b => b.id === parseInt(taskData.bookId || '0'));
              if (book) {
                componentPath += ` > ${book.name}`;
                if (taskData.unitId) {
                  const unit = units.find(u => u.id === parseInt(taskData.unitId || '0'));
                  if (unit) {
                    componentPath += ` > ${unit.name}`;
                    if (taskData.lessonId) {
                      const lesson = lessons.find(l => l.id === parseInt(taskData.lessonId || '0'));
                      if (lesson) {
                        componentPath += ` > ${lesson.name}`;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Update existing task
        const updateData = {
          name: taskData.name,
          description: taskData.description,
          project_id: parseInt(taskData.projectId || '1'),
          category_stage_id: parseInt(taskData.stageId || ''),
          ...pickTaskUpdateStatus(taskData.status),
          priority: taskData.priority,
          start_date: taskData.startDate,
          end_date: taskData.endDate,
          estimated_hours: parseInt(String(taskData.estimatedHours || 0)),
          actual_hours: parseInt(String(taskData.actualHours || 0)),
          assignees: taskData.assignees || [],
          skills: taskData.skills,
          // Add educational hierarchy IDs
          grade_id: taskData.gradeId ? parseInt(taskData.gradeId) : null,
          book_id: taskData.bookId ? parseInt(taskData.bookId) : null,
          unit_id: taskData.unitId ? parseInt(taskData.unitId) : null,
          lesson_id: taskData.lessonId ? parseInt(taskData.lessonId) : null,
          component_path: componentPath
        };
        
        await taskService.update(editingTask.id, updateData);
        
        // Refresh project tasks immediately
        const tasksData = await taskService.getAll({ all: 'true' });
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        
        // Update all project tasks - filtering will be handled by the useEffect
        setAllProjectTasks(projectTasksArray);
        
        // Also refresh the current project to update progress
        const currentProjectData = await projectService.getById(project.id);
        setCurrentProject(currentProjectData);
      }
      
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('❌ Failed to update task:', error);
    }
  };

    const handleDeleteTask = async (task: any) => {
      if (!confirm(`Are you sure you want to delete the task "${task.name}"? This action cannot be undone.`)) {
        return;
      }

      try {
        await taskService.delete(task.id);
        
              // Refresh project tasks
      const tasksData = await taskService.getAll({ all: 'true' });
      const tasksArray = tasksData.data || tasksData;
      const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
      
      // Update all project tasks - filtering will be handled by the useEffect
      setAllProjectTasks(projectTasksArray);
      
      // Also refresh the current project to update progress
      const currentProjectData = await projectService.getById(project.id);
      setCurrentProject(currentProjectData);
      
      } catch (err: any) {
        console.error('❌ Delete task error:', err);
      }
    };

    const handleApproveTask = async (task: any) => {
      try {
        await taskService.reviewTask(task.id, 'approve');
        
        // Refresh project tasks
        const tasksData = await taskService.getAll({ all: 'true' });
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        
        // Update all project tasks - filtering will be handled by the useEffect
        setAllProjectTasks(projectTasksArray);
        
        // Also refresh the current project to update progress
        const currentProjectData = await projectService.getById(project.id);
        setCurrentProject(currentProjectData);
        
      } catch (err: any) {
        console.error('❌ Approve task error:', err);
      }
    };

    const handleDenyTask = async (task: any) => {
      try {
        await taskService.reviewTask(task.id, 'deny');
        
        // Refresh project tasks
        const tasksData = await taskService.getAll({ all: 'true' });
        const tasksArray = tasksData.data || tasksData;
        const projectTasksArray = tasksArray.filter((task: any) => task.project_id === Number(project.id));
        
        // Update all project tasks - filtering will be handled by the useEffect
        setAllProjectTasks(projectTasksArray);
        
        // Also refresh the current project to update progress
        const currentProjectData = await projectService.getById(project.id);
        setCurrentProject(currentProjectData);
        
      } catch (err: any) {
        console.error('❌ Deny task error:', err);
      }
    };


    const getStatusVariant = (status: TaskStatus) => {
      switch (status) {
        case 'not-started': return 'default';
        case 'in-progress': return 'primary';
        case 'under-review': return 'warning';
        case 'completed': return 'success';
        case 'blocked': return 'danger';
        default: return 'default';
      }
    };

    const getPriorityVariant = (priority: Priority) => {
      switch (priority) {
        case 'low': return 'default';
        case 'medium': return 'primary';
        case 'high': return 'warning';
        case 'urgent': return 'danger';
        default: return 'default';
      }
    };

    const isOverdue = (task: any) => {
      const endDate = task.end_date || task.endDate;
      if (!endDate) return false;
      
      // Get today's date at midnight (start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get the end date at midnight (start of day)
      const dueDate = new Date(endDate);
      dueDate.setHours(0, 0, 0, 0);
      
      // Task is overdue if due date is before today AND not completed
      return dueDate < today && task.status !== 'completed';
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Project Tasks</h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleBulkCreateTasks}
              disabled={loading}
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            >
              Bulk Create Tasks
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateTaskModalOpen(true)}>
              Add Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="under-review">Under Review</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="overdue">Overdue</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Assignees</option>
              <option value="none">No Assignees</option>
              {teamMembers.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className={`border rounded-lg px-3 py-2 text-sm ${selectedStage !== 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300'}`}
            >
              <option value="all">All Stages</option>
              {(projectStages || []).map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>

            {selectedStage !== 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {(projectStages || []).find(s => s.id === parseInt(selectedStage))?.name || 'Unknown Stage'}
                </span>
                <button
                  onClick={() => setSelectedStage('all')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  title="Clear stage filter"
                >
                  Clear Stage
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Selection Controls */}
        {projectTasks.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isAllSelected()}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected();
                    }}
                    onChange={() => {
                      if (isAllSelected()) {
                        clearAllSelections();
                      } else {
                        selectAllTasks();
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {isAllSelected() ? 'Deselect All' : 'Select All'}
                  </span>
                </div>
                
                {selectedTasks.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllSelections}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>

              {selectedTasks.size > 0 && (
                <BulkTaskSelectionActions
                  selectedTaskIds={[
                    ...allProjectTasks
                      .filter((task) => selectedTasks.has(task.id.toString()))
                      .map((task) => task.id),
                    ...Array.from(selectedTasks).filter(
                      (id) => !allProjectTasks.some((task) => task.id.toString() === id)
                    ),
                  ]}
                  selectedTaskNames={[
                    ...allProjectTasks
                      .filter((task) => selectedTasks.has(task.id.toString()))
                      .map((task) => task.name),
                    ...Array.from(selectedTasks)
                      .filter((id) => !allProjectTasks.some((task) => task.id.toString() === id))
                      .map((id) => `Task ${id}`),
                  ]}
                  selectedTasks={allProjectTasks.filter((task) => selectedTasks.has(task.id.toString()))}
                  teamMembers={teamMembers}
                  onSuccess={async () => {
                    setSelectedTasks(new Set());
                    await refreshProjectTaskData();
                  }}
                  onDelete={() => setIsBulkDeleteModalOpen(true)}
                />
              )}
            </div>
          </div>
        )}

        {/* Show message when selected stage has no tasks */}
        {selectedStage !== 'all' && projectTasks.length === 0 && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  <strong>No tasks found</strong> for stage "{(projectStages || []).find(s => s.id === parseInt(selectedStage))?.name || 'Unknown Stage'}".
                  This stage currently has no assigned tasks in this project.
                </p>
              </div>
            </div>
          </div>
        )}

        {projectTasks.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={isAllSelected()}
                          ref={(input) => {
                            if (input) input.indeterminate = isPartiallySelected();
                          }}
                          onChange={() => {
                            if (isAllSelected()) {
                              clearAllSelections();
                            } else {
                              selectAllTasks();
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Task Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assignees
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projectTasks.map((task) => {
                      // Use assigneeDetails from API response directly; fall back to teamMembers lookup with normalized IDs
                      const assignedUsers: any[] = task.assigneeDetails && task.assigneeDetails.length > 0
                        ? task.assigneeDetails
                        : teamMembers.filter((u: any) =>
                            task.assignees &&
                            task.assignees.map((id: any) => String(id)).includes(String(u.id))
                          );
                      const overdue = isOverdue(task);
                      const stage = stages.find(s => s.id === task.category_stage_id || task.stage_id);
                      
                      return (
                        <tr key={task.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50' : ''} ${task.status === 'under-review' ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id.toString())}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleTaskSelection(task.id.toString());
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 sm:px-6 py-4 align-top max-w-0">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 flex items-start gap-1 min-w-0">
                                <span className="line-clamp-2 break-words min-w-0" title={task.name}>
                                  {task.name}
                                </span>
                                {overdue && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                                {task.status === 'under-review' && <Clock className="w-4 h-4 text-yellow-500 shrink-0" />}
                              </div>
                              <div className="text-sm text-gray-500 min-w-0">
                                {task.component_path && (
                                  <div
                                    className="text-xs text-purple-600 mt-1 bg-purple-100 p-1 rounded-md inline-block max-w-full truncate"
                                    title={task.component_path}
                                  >
                                    📚 {task.component_path}
                                  </div>
                                )}
                                {task.description && (
                                  <div className="mt-1 text-xs line-clamp-1 break-words" title={task.description}>
                                    {task.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {stage ? (
                                <div className="font-medium text-blue-600">{stage.name}</div>
                              ) : (
                                <span className="text-gray-400">Unknown Stage</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getStatusVariant(task.status)}>
                              {task.status.replace('-', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getPriorityVariant(task.priority)}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              {assignedUsers.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {assignedUsers.slice(0, 3).map(user => (
                                    <span 
                                      key={user.id}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                      {user.name}
                                    </span>
                                  ))}
                                  {assignedUsers.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                      +{assignedUsers.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {assignedUsers.length === 0 && (
                                <span className="text-xs text-gray-400">No assignees</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                              {task.end_date || task.endDate ? new Date(task.end_date || task.endDate || '').toLocaleDateString() : 'No due date'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${getTaskDisplayProgress(task)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{getTaskDisplayProgress(task)}%</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(task.id.toString());
                                }}
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              {/* Show Approve/Deny buttons only for tasks under review */}
                              {task.status === 'under-review' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveTask(task);
                                    }}
                                    title="Approve Task"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <CheckSquare className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDenyTask(task);
                                    }}
                                    title="Deny Task"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTask(task);
                                }}
                                title="Edit Task"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task);
                                }}
                                title="Delete Task"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalTasks)} of {totalTasks} tasks
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "primary" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        Last
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">Page size:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Tasks Yet</h3>
              <p className="text-gray-600 mb-4">Start by creating your first task for this project.</p>
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateTaskModalOpen(true)}>
                Create First Task
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Task Modal */}
        <CreateTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          onSubmit={handleUpdateTask}
          users={teamMembers}
          teams={allTeams}
          skills={skills}
          projects={projects}
          stages={stages}
          grades={grades}
          books={books}
          units={units}
          lessons={lessons}
          editingTask={editingTask}
        />
      </div>
    );
  };

  const renderTeam = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Project Team</h3>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsAddTeamModalOpen(true)}
            className="flex items-center space-x-2"
            variant="outline"
          >
            <Users className="w-4 h-4" />
            <span>Add Team</span>
          </Button>
          <Button 
            onClick={() => setIsAddMemberModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </Button>
        </div>
      </div>
      
      {/* Teams Section */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Assigned Teams</h4>
        {projectTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {projectTeams.map((team) => (
               <Card key={team.id}>
                 <CardContent className="p-4">
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center space-x-3">
                       <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
                         <Users className="w-5 h-5" />
                       </div>
                       <div>
                         <h5 className="font-medium text-gray-900">{team.team_name}</h5>
                         <Badge variant="secondary" className="text-xs">{team.role}</Badge>
                       </div>
                     </div>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => handleRemoveTeam(team.id)}
                       className="text-red-600 hover:text-red-700 hover:bg-red-50"
                     >
                       <X className="w-4 h-4" />
                     </Button>
                   </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Members</span>
                      <span className="font-medium">{team.member_count} / {team.max_capacity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min((team.member_count / team.max_capacity) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No teams assigned to this project</p>
          </div>
        )}
      </div>

      {/* Members with assigned tasks */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Members with Assigned Tasks</h4>
        <p className="text-sm text-gray-500">
          Team members who currently have at least one task assigned in this project.
        </p>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading team members...</div>
        </div>
      ) : membersWithAssignedTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {membersWithAssignedTasks.map((member) => {
            const memberTasks = getTasksForMember(member.id);
            const completedTasks = memberTasks.filter(task => task.status === 'completed');
            const completionRate = memberTasks.length > 0 ? Math.round((completedTasks.length / memberTasks.length) * 100) : 0;
            
            return (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {member.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{member.name || 'Unknown User'}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{member.role || 'member'}</Badge>
                        </div>
                        {member.email && (
                          <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenFlagModal(member)}
                        className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        title="Flag Employee"
                      >
                        <Flag className="w-4 h-4" />
                      </Button>
                      {member.project_member_id != null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.project_member_id!)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remove from project team"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Tasks Assigned</span>
                      <span className="font-medium">{memberTasks.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-medium text-green-600">{completedTasks.length}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Completion Rate</span>
                        <span className="font-medium">{completionRate}%</span>
                      </div>
                      <ProgressBar value={completionRate} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
                 <Card>
           <CardContent className="p-8 text-center">
             <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Members</h3>
             <p className="text-gray-600 mb-4">No team members have tasks assigned in this project yet.</p>
             <Button 
               onClick={() => setActiveTab('tasks')}
               className="flex items-center space-x-2 mx-auto"
             >
               <CheckSquare className="w-4 h-4" />
               <span>Go to Tasks</span>
             </Button>
           </CardContent>
         </Card>
       )}
       </div>
     </div>
   );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{currentProject.name}</h1>
            <p className="text-gray-600">{currentProject.category}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={
            currentProject.status === 'active' ? 'primary' :
            currentProject.status === 'completed' ? 'success' :
            currentProject.status === 'on-hold' ? 'warning' : 'default'
          }>
            {currentProject.status}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditProjectModalOpen(true)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Project
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-medium text-gray-900">{projectProgress.progress}%</span>
            </div>
            <ProgressBar value={projectProgress.progress} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'stages' && renderStages()}
        {activeTab === 'educational-hierarchy' && <EducationalHierarchy projectId={Number(currentProject.id)} />}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'timeline' && renderTimeline()}
        {activeTab === 'team' && renderTeam()}
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        users={teamMembers}
        teams={allTeams}
        skills={skills}
        projects={projects}
        stages={stages}
        grades={grades}
        books={books}
        units={units}
        lessons={lessons}
      />

        <EditProjectModal
          isOpen={isEditProjectModalOpen}
          onClose={() => setIsEditProjectModalOpen(false)}
          onSubmit={handleEditProject}
          project={currentProject}
          categories={categories || localCategories}
        />

        {/* Flag Employee Modal */}
        {flaggingMember && (
          <FlagEmployeeModal
            isOpen={showFlagModal}
            onClose={() => {
              setShowFlagModal(false);
              setFlaggingMember(null);
            }}
            memberId={flaggingMember.id}
            memberName={flaggingMember.name}
            onSuccess={() => {
              // Flag success callback
            }}
          />
        )}

             {/* Add Member Modal */}
       <AddMemberModal
         isOpen={isAddMemberModalOpen}
         onClose={() => setIsAddMemberModalOpen(false)}
         onSubmit={handleAddMember}
         availableMembers={availableTeamMembers}
         projectMembers={projectMembers}
       />
       
       {/* Add Team Modal */}
       <AddTeamModal
         isOpen={isAddTeamModalOpen}
         onClose={() => setIsAddTeamModalOpen(false)}
         onSubmit={handleAddTeam}
         availableTeams={availableTeams}
         projectTeams={projectTeams}
       />

       {/* Bulk Create Tasks Modal */}
       <BulkCreateTasksModal
         isOpen={isBulkCreateModalOpen}
         onClose={() => {
           setIsBulkCreateModalOpen(false);
           setBulkCreatePreview(null);
           setSelectedStages([]);
         }}
         onSubmit={handleConfirmBulkCreate}
         preview={bulkCreatePreview}
         selectedStages={selectedStages}
         setSelectedStages={setSelectedStages}
         isCreating={isCreatingTasks}
       />

       {/* Bulk Delete Confirmation Modal */}
       <Modal
         isOpen={isBulkDeleteModalOpen}
         onClose={() => setIsBulkDeleteModalOpen(false)}
         title="Confirm Bulk Delete"
         size="md"
       >
         <div className="space-y-4">
           <div className="flex items-center space-x-3">
             <div className="flex-shrink-0">
               <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                 <Trash2 className="w-6 h-6 text-red-600" />
               </div>
             </div>
             <div>
               <h3 className="text-lg font-medium text-gray-900">
                 Delete {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''}?
               </h3>
               <p className="text-sm text-gray-500">
                 This action cannot be undone. The selected tasks will be permanently deleted.
               </p>
             </div>
           </div>

           {selectedTasks.size > 0 && (
             <div className="bg-gray-50 p-3 rounded-lg">
               <h4 className="text-sm font-medium text-gray-700 mb-2">Tasks to be deleted:</h4>
               <div className="max-h-32 overflow-y-auto space-y-1">
                 {Array.from(selectedTasks).map(taskId => {
                   const task = projectTasks.find(t => t.id.toString() === taskId);
                   return task ? (
                     <div key={taskId} className="text-sm text-gray-600 flex items-center">
                       <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                       {task.name}
                     </div>
                   ) : null;
                 })}
               </div>
             </div>
           )}

           <div className="flex justify-end space-x-3 pt-4">
             <Button
               type="button"
               variant="outline"
               onClick={() => setIsBulkDeleteModalOpen(false)}
             >
               Cancel
             </Button>
             <Button
               type="button"
               variant="danger"
               onClick={handleBulkDelete}
               className="bg-red-600 hover:bg-red-700 text-white"
             >
               <Trash2 className="w-4 h-4 mr-2" />
               Delete {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
             </Button>
           </div>
         </div>
       </Modal>
     </div>
   );
 }

// Add Team Modal Component
interface AddTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (teamId: number, role: string) => void;
  availableTeams: any[];
  projectTeams: any[];
}

function AddTeamModal({ isOpen, onClose, onSubmit, availableTeams, projectTeams }: AddTeamModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');

  const assignedTeamIds = projectTeams.map(pt => pt.team_id);
  const unassignedTeams = availableTeams.filter(team => 
    !assignedTeamIds.includes(team.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeamId) {
      onSubmit(selectedTeamId, selectedRole);
      setSelectedTeamId(null);
      setSelectedRole('member');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Team to Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team
          </label>
          <select
            value={selectedTeamId || ''}
            onChange={(e) => setSelectedTeamId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Choose a team...</option>
            {unassignedTeams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} - {team.member_count || 0} members
              </option>
            ))}
          </select>
          {unassignedTeams.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              All teams are already assigned to this project.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
                     <select
             value={selectedRole}
             onChange={(e) => setSelectedRole(e.target.value)}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
           >
             <option value="member">Member</option>
             <option value="admin">Admin</option>
             <option value="owner">Owner</option>
             <option value="viewer">Viewer</option>
           </select>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> When you assign a team to this project, all team members will automatically be added as individual project members.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!selectedTeamId || unassignedTeams.length === 0}
          >
            Add Team
          </Button>
        </div>
      </form>
    </Modal>
  );
 }

// Add Member Modal Component
interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (memberId: number, role: string) => void;
  availableMembers: any[];
  projectMembers: any[];
}

function AddMemberModal({ isOpen, onClose, onSubmit, availableMembers, projectMembers }: AddMemberModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');

  const assignedMemberIds = projectMembers.map(pm => pm.user_id || pm.team_member_id);
  const unassignedMembers = availableMembers.filter(member => 
    !assignedMemberIds.includes(member.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberId) {
      onSubmit(selectedMemberId, selectedRole);
      setSelectedMemberId(null);
      setSelectedRole('member');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team Member
          </label>
          <select
            value={selectedMemberId || ''}
            onChange={(e) => setSelectedMemberId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Choose a team member...</option>
            {unassignedMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.email})
              </option>
            ))}
          </select>
          {unassignedMembers.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              All team members are already assigned to this project.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!selectedMemberId || unassignedMembers.length === 0}
          >
            Add Member
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Bulk Create Tasks Modal Component
interface BulkCreateTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  preview: any;
  selectedStages: number[];
  setSelectedStages: (stages: number[]) => void;
  isCreating: boolean;
}

function BulkCreateTasksModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  preview, 
  selectedStages, 
  setSelectedStages, 
  isCreating 
}: BulkCreateTasksModalProps) {
  const handleStageToggle = (stageId: number) => {
    if (selectedStages.includes(stageId)) {
      setSelectedStages(selectedStages.filter(id => id !== stageId));
    } else {
      setSelectedStages([...selectedStages, stageId]);
    }
  };

  const handleSelectAll = () => {
    if (preview?.stages) {
      setSelectedStages(preview.stages.map((stage: any) => stage.stage_id));
    }
  };

  const handleSelectNone = () => {
    setSelectedStages([]);
  };

  const getTotalTasksToCreate = () => {
    if (!preview?.stages) return 0;
    return preview.stages
      .filter((stage: any) => selectedStages.includes(stage.stage_id))
      .reduce((sum: number, stage: any) => sum + stage.would_create, 0);
  };

  const getTotalTasksToSkip = () => {
    if (!preview?.stages) return 0;
    return preview.stages
      .filter((stage: any) => selectedStages.includes(stage.stage_id))
      .reduce((sum: number, stage: any) => sum + stage.would_skip, 0);
  };

  if (!preview) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Create Tasks">
      <div className="space-y-6">
        {/* Project Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Project: {preview.project_name}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">Total Stages:</span>
              <span className="ml-2 text-blue-700">{preview.total_stages}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Hierarchy Units:</span>
              <span className="ml-2 text-blue-700">{preview.total_lowest_units}</span>
            </div>
          </div>
        </div>

        {/* Stage Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Select Stages</h3>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectNone}
                className="text-xs"
              >
                Select None
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {preview.stages.map((stage: any) => (
              <div
                key={stage.stage_id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedStages.includes(stage.stage_id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleStageToggle(stage.stage_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedStages.includes(stage.stage_id)}
                      onChange={() => handleStageToggle(stage.stage_id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <h4 className="font-medium text-gray-900">{stage.stage_name}</h4>
                      {stage.stage_description && (
                        <p className="text-sm text-gray-600">{stage.stage_description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-green-600 font-medium">+{stage.would_create}</span>
                      {stage.would_skip > 0 && (
                        <span className="text-gray-500 ml-2">({stage.would_skip} exist)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stage.would_create + stage.would_skip} total
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {selectedStages.length > 0 && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-800">Selected Stages:</span>
                <span className="ml-2 text-green-700">{selectedStages.length}</span>
              </div>
              <div>
                <span className="font-medium text-green-800">Tasks to Create:</span>
                <span className="ml-2 text-green-700 font-bold">{getTotalTasksToCreate()}</span>
              </div>
              {getTotalTasksToSkip() > 0 && (
                <div className="col-span-2">
                  <span className="font-medium text-green-800">Tasks to Skip:</span>
                  <span className="ml-2 text-green-700">{getTotalTasksToSkip()} (already exist)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={selectedStages.length === 0 || isCreating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Tasks...
              </>
            ) : (
              `Create ${getTotalTasksToCreate()} Tasks`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}