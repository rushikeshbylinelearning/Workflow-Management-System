import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { 
  BarChart3, 
  PieChart,
  Activity,
  Target,
  FolderOpen,
  BookOpen,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Filter,
  ChevronDown,
  Eye,
  EyeOff,
  Users,
  Calendar,
  X,
  Search,
  GraduationCap
} from 'lucide-react';
import { taskService, projectService, stageService, teamService } from '../services/apiService';
import { isTaskOverdue } from '../utils/analyticsHelpers';
import { ProjectHierarchyView } from './ProjectHierarchyView';

// Curriculum Development Dashboard Data Structure
const curriculumData = {
  // Summary Metrics
  summary: {
    totalProjects: 5,
    inProgress: 3,
    completed: 0,
    totalBooks: 22,
    avgProgress: 7.7
  },

  // Distribution Data
  distribution: {
    projects: { total: 5, completed: 0, inProgress: 3, overdue: 0, pending: 2 },
    books: { total: 22, completed: 0, inProgress: 5, overdue: 0, pending: 17 },
    lessons: { total: 26, completed: 0, inProgress: 5, overdue: 0, pending: 21 }
  },

  // Development Stages Progress
  developmentStages: [
    { name: 'Content', completed: 1, inProgress: 13, overdue: 0, pending: 38, total: 52 },
    { name: 'Storyboarding', completed: 1, inProgress: 13, overdue: 0, pending: 38, total: 52 },
    { name: 'Design', completed: 1, inProgress: 13, overdue: 0, pending: 38, total: 52 },
    { name: 'Development', completed: 1, inProgress: 13, overdue: 0, pending: 38, total: 52 },
    { name: 'QA', completed: 1, inProgress: 13, overdue: 0, pending: 38, total: 52 }
  ],

  // Individual Curriculum Projects
  projects: [
    {
      id: 1,
      name: 'ICT Curriculum Development',
      subtitle: 'Comprehensive ICT curriculum for grades 1-12',
      status: 'IN PROGRESS',
      progress: 18.5,
      startDate: '1/1/2024',
      targetDate: '7/31/2024',
      projectedCompletion: '10/8/2024',
      tasks: 6,
      taskProgress: 33
    },
    {
      id: 2,
      name: 'KG Curriculum Development',
      subtitle: 'Kindergarten curriculum development program',
      status: 'IN PROGRESS',
      progress: 18.5,
      startDate: '2/1/2024',
      targetDate: '10/31/2024',
      projectedCompletion: '10/8/2024',
      tasks: 7,
      taskProgress: 28
    },
    {
      id: 3,
      name: 'Science Curriculum Development',
      subtitle: 'Primary Science curriculum for grades 1-8',
      status: 'PENDING',
      progress: 0.0,
      startDate: '3/1/2024',
      targetDate: '7/30/2024',
      projectedCompletion: '7/18/2024',
      tasks: 4,
      taskProgress: 0
    },
    {
      id: 4,
      name: 'Mathematics Curriculum Development',
      subtitle: 'Primary Mathematics curriculum for grades 1-8',
      status: 'PENDING',
      progress: 0.0,
      startDate: '4/1/2024',
      targetDate: '9/3/2024',
      projectedCompletion: '7/18/2024',
      tasks: 3,
      taskProgress: 0
    },
    {
      id: 5,
      name: 'English Language Arts Curriculum',
      subtitle: 'Comprehensive ELA curriculum for grades 1-8',
      status: 'PENDING',
      progress: 0.0,
      startDate: '5/1/2024',
      targetDate: '6/15/2024',
      projectedCompletion: '7/18/2024',
      tasks: 2,
      taskProgress: 0
    },
    {
      id: 6,
      name: 'Social Studies Curriculum',
      subtitle: 'Primary Social Studies curriculum for grades 1-8',
      status: 'PENDING',
      progress: 0.0,
      startDate: '6/1/2024',
      targetDate: '8/15/2024',
      projectedCompletion: '8/30/2024',
      tasks: 5,
      taskProgress: 0
    }
  ]
};

export function CoreAnalytics() {
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions'>('overview');
  const [selectedFilter, setSelectedFilter] = useState('Standard Bar Chart');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Real data state
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTask, setHoveredTask] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [allTeamMembers, setAllTeamMembers] = useState<any[]>([]);
  const [allAdminUsers, setAllAdminUsers] = useState<any[]>([]);
  const [hierarchySearch, setHierarchySearch] = useState<string>('');
  const [showHierarchyView, setShowHierarchyView] = useState(false);
  const [selectedProjectForHierarchy, setSelectedProjectForHierarchy] = useState<string>('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Fetch real data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tasksData, projectsData, stagesData, teamMembersData] = await Promise.all([
          taskService.getAll({ all: 'true' }),
          projectService.getAll(),
          stageService.getAll(),
          teamService.getMembers()
        ]);

        setAllTasks(tasksData.data ?? []);
        setProjects(projectsData.data ?? []);
        setStages(Array.isArray(stagesData) ? stagesData : (stagesData?.data ?? []));
        setAllTeamMembers(Array.isArray(teamMembersData) ? teamMembersData : (teamMembersData?.data ?? []));
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate real analytics data
  const getTaskStatusCounts = () => {
    const counts = {
      total: allTasks.length,
      completed: allTasks.filter((task: any) => task.status === 'completed').length,
      inProgress: allTasks.filter((task: any) => 
        task.status === 'in-progress' || task.status === 'under-review'
      ).length,
      notStarted: allTasks.filter((task: any) => task.status === 'not-started').length,
      overdue: allTasks.filter((task: any) => isTaskOverdue(task)).length
    };
    return counts;
  };

  const getStageProgress = () => {
    if (!selectedProject || selectedProject === 'all') {
      return [];
    }

    // Get the selected project
    const project = projects.find(p => p.id.toString() === selectedProject);
    if (!project) return [];

    // Get stages for the selected project's category only
    const projectStages = stages.filter(stage => {
      // Check if this stage belongs to the project's category
      // We need to check if the stage is linked to the project's category
      // This is a simplified check - you might need to adjust based on your data structure
      return true; // For now, show all stages that have tasks for this project
    });

    const stageProgress = projectStages.map(stage => {
      // Only get tasks for this specific project and stage
      const stageTasks = allTasks.filter((task: any) => 
        (task.category_stage_id === stage.id || task.stage_id === stage.id) &&
        task.project_id?.toString() === selectedProject
      );
      
      const total = stageTasks.length;
      const completed = stageTasks.filter((task: any) => task.status === 'completed').length;
      const inProgress = stageTasks.filter((task: any) => 
        task.status === 'in-progress' || task.status === 'under-review'
      ).length;
      const overdue = stageTasks.filter((task: any) => {
        if (task.status === 'completed') return false;
        const endDate = task.end_date || task.endDate;
        if (!endDate) return false;
        return new Date(endDate) < new Date();
      }).length;
      const pending = total - completed - inProgress - overdue;

      return {
        name: stage.name,
        total,
        completed,
        inProgress,
        overdue,
        pending
      };
    });

    // Only return stages that actually have tasks for this project
    return stageProgress.filter(stage => stage.total > 0);
  };

  const getTaskColor = (task: any) => {
    if (task.status === 'completed') return 'bg-green-500';
    if (task.status === 'in-progress' || task.status === 'under-review') return 'bg-blue-500';
    
    // Check if overdue
    const endDate = task.end_date || task.endDate;
    if (endDate && new Date(endDate) < new Date()) return 'bg-red-500';
    
    return 'bg-orange-300';
  };

  const getTaskTooltip = (task: any) => {
    const project = projects.find((p: any) => p.id === task.project_id);
    const stage = stages.find((s: any) => s.id === task.category_stage_id || s.id === task.stage_id);
    
    // Handle assignees - now with names from assigneeDetails
    let assigneeText = 'Unassigned';
    if (task.assigneeDetails && Array.isArray(task.assigneeDetails) && task.assigneeDetails.length > 0) {
      if (task.assigneeDetails.length === 1) {
        assigneeText = task.assigneeDetails[0].name || 'Unknown Assignee';
      } else {
        const names = task.assigneeDetails.map((a: any) => a.name || 'Unknown').join(', ');
        assigneeText = names;
      }
    }
    
    return {
      name: task.name,
      project: project?.name || 'Unknown Project',
      stage: stage?.name || 'Unknown Stage',
      status: task.status,
      componentPath: task.component_path || '',
      dueDate: task.end_date || task.endDate,
      assignee: assigneeText
    };
  };

  // Handle task assignment
  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsAssignmentModalOpen(true);
  };

  const handleAssignTask = async (taskId: string, assigneeId: string, status: string, endDate: string) => {
    try {
      // Update task with new assignee, status, and end date
      const updateData: any = {
        status
      };

      // Add end date if provided
      if (endDate) {
        updateData.end_date = endDate;
      }

      // Add assignee if provided - send as array of IDs
      if (assigneeId) {
        updateData.assignees = [assigneeId]; // Backend expects array of IDs
      }

      await taskService.update(taskId, updateData);
      
      // Refresh tasks data
      const tasksData = await taskService.getAll({ all: 'true' });
      setAllTasks(tasksData.data ?? []);
      
      setIsAssignmentModalOpen(false);
      setSelectedTask(null);
      
      alert('Task assigned successfully!');
    } catch (error) {
      console.error('Failed to assign task:', error);
      alert('Failed to assign task. Please try again.');
    }
  };

  const handleProjectClick = (projectId: string) => {
    setSelectedProjectForHierarchy(projectId);
    setShowHierarchyView(true);
  };

  const getProjectPredictions = () => {
    return projects.map((project: any) => {
      const projectTasks = allTasks.filter((t: any) => t.project_id === project.id);
      const completed = projectTasks.filter((t: any) => t.status === 'completed').length;
      const total = projectTasks.length;
      const progressRate = total > 0 ? completed / total : 0;
      const remaining = total - completed;
      const startDate = project.start_date ? new Date(project.start_date) : new Date();
      const endDate = project.end_date ? new Date(project.end_date) : null;
      const elapsedDays = Math.max(1, (Date.now() - startDate.getTime()) / (1000 * 3600 * 24));
      const tasksPerDay = completed / elapsedDays;
      const estimatedDaysLeft = tasksPerDay > 0 ? Math.ceil(remaining / tasksPerDay) : null;
      const projectedDate = estimatedDaysLeft
        ? new Date(Date.now() + estimatedDaysLeft * 24 * 3600 * 1000)
        : null;
      const onTrack = endDate && projectedDate ? projectedDate <= endDate : null;

      return {
        id: project.id,
        name: project.name,
        progress: total > 0 ? Math.round(progressRate * 100) : 0,
        remaining,
        estimatedDaysLeft,
        projectedDate,
        targetDate: endDate,
        onTrack,
      };
    });
  };

  const handleBackToAnalytics = () => {
    setShowHierarchyView(false);
    setSelectedProjectForHierarchy('');
  };

  // Organize tasks by hierarchy and stages for selected project
  const getOrganizedTasks = () => {
    if (!selectedProject) return { hierarchies: [], stageNames: [], organized: {} };
    
    const projectTasks = allTasks.filter((task: any) => task.project_id === parseInt(selectedProject));
    const organized: { [key: string]: { [key: string]: any } } = {};
    
    projectTasks.forEach((task: any) => {
      const componentPath = task.component_path || '';
      const stage = stages.find((s: any) => s.id === task.category_stage_id || s.id === task.stage_id);
      const stageName = stage?.name || 'Unknown';
      
      if (!organized[componentPath]) {
        organized[componentPath] = {};
      }
      
      organized[componentPath][stageName] = task;
    });
    
    return { hierarchies: [], stageNames: [], organized };
  };

  // Get unique hierarchies and stages for table headers
  const getTableData = () => {
    if (!selectedProject) return { hierarchies: [], stageNames: [], organized: {} };
    
    const projectTasks = allTasks.filter((task: any) => task.project_id === parseInt(selectedProject));
    const organized: { [key: string]: { [key: string]: any } } = {};
    
    projectTasks.forEach((task: any) => {
      const componentPath = task.component_path || '';
      const stage = stages.find((s: any) => s.id === task.category_stage_id || s.id === task.stage_id);
      const stageName = stage?.name || 'Unknown';
      
      if (!organized[componentPath]) {
        organized[componentPath] = {};
      }
      
      organized[componentPath][stageName] = task;
    });
    
    let hierarchies = Object.keys(organized).sort();
    
    // Filter hierarchies based on search term
    if (hierarchySearch.trim()) {
      const searchTerm = hierarchySearch.toLowerCase().trim();
      hierarchies = hierarchies.filter(hierarchy => 
        hierarchy.toLowerCase().includes(searchTerm)
      );
    }
    
    const allStages = new Set<string>();
    
    // Collect all unique stages for this project
    Object.values(organized).forEach(stageTasks => {
      Object.keys(stageTasks).forEach(stage => allStages.add(stage));
    });
    
    // Get stage names and sort them by order_index from the database
    const stageNames = Array.from(allStages)
      .map(stageName => {
        const stage = stages.find(s => s.name === stageName);
        return {
          name: stageName,
          orderIndex: stage?.order_index || 0
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(stage => stage.name);
    
    return { hierarchies, stageNames, organized };
  };

  // Get project-specific stages
  const getProjectStages = () => {
    if (!selectedProject) return [];
    
    const project = projects.find((p: any) => p.id === parseInt(selectedProject));
    if (!project) return [];
    
    // Get stages that are linked to this project's category
    return stages.filter((stage: any) => {
      // This is a simplified filter - you might need to adjust based on your data structure
      return true; // For now, show all stages for the selected project
    }).sort((a: any, b: any) => {
      // Sort by order_index to maintain proper stage sequence
      return (a.order_index || 0) - (b.order_index || 0);
    });
  };

  const renderIconGrid = (type: 'projects' | 'books' | 'lessons') => {
    const data = curriculumData.distribution[type];
    const total = data.total;
    const completed = data.completed;
    const inProgress = data.inProgress;
    
    const icons = [];
    for (let i = 0; i < total; i++) {
      let iconClass = 'w-6 h-6 rounded-full border-2 ';
      if (i < completed) {
        iconClass += 'bg-green-500 border-green-500';
      } else if (i < completed + inProgress) {
        iconClass += 'bg-blue-500 border-blue-500';
      } else {
        iconClass += 'bg-orange-200 border-orange-300';
      }
      icons.push(
        <div key={i} className={iconClass}></div>
      );
    }

    return (
      <div className="grid grid-cols-6 gap-1">
        {icons}
      </div>
    );
  };

  const renderStackedBar = (type: 'projects' | 'books' | 'lessons') => {
    const data = curriculumData.distribution[type];
    const total = data.total;
    const completedPercent = (data.completed / total) * 100;
    const inProgressPercent = (data.inProgress / total) * 100;
    const overduePercent = (data.overdue / total) * 100;
    const pendingPercent = (data.pending / total) * 100;

    return (
      <div className="space-y-2">
        <div className="flex space-x-1">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1 h-8 bg-gray-200 rounded relative overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-green-500" 
                style={{ width: `${completedPercent}%` }}
              ></div>
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500" 
                style={{ width: `${inProgressPercent}%`, left: `${completedPercent}%` }}
              ></div>
              <div 
                className="absolute left-0 top-0 h-full bg-red-500" 
                style={{ width: `${overduePercent}%`, left: `${completedPercent + inProgressPercent}%` }}
              ></div>
              <div 
                className="absolute left-0 top-0 h-full bg-orange-500" 
                style={{ width: `${pendingPercent}%`, left: `${completedPercent + inProgressPercent + overduePercent}%` }}
              ></div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>Completed: {data.completed}%</span>
          <span>In Progress: {inProgressPercent.toFixed(1)}%</span>
          <span>Overdue: {overduePercent.toFixed(1)}%</span>
          <span>Pending: {pendingPercent.toFixed(1)}%</span>
        </div>
      </div>
    );
  };

  // Show hierarchy view if selected
  if (showHierarchyView && selectedProjectForHierarchy) {
    return (
      <ProjectHierarchyView
        projectId={selectedProjectForHierarchy}
        onBack={handleBackToAnalytics}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Curriculum Development Dashboard</h1>
            <p className="text-white/80">Monitor project progress and track development milestones.</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'overview' ? 'primary' : 'dark'}
              size="sm"
              onClick={() => setActiveTab('overview')}
              title="View live project metrics, task matrix, and stage progress from the backend"
              className={activeTab === 'overview' ? 'bg-white text-gray-900 font-semibold shadow-sm' : ''}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'predictions' ? 'primary' : 'dark'}
              size="sm"
              onClick={() => setActiveTab('predictions')}
              title="See projected completion dates based on current task completion velocity"
              className={activeTab === 'predictions' ? 'bg-white text-gray-900 font-semibold shadow-sm' : ''}
            >
              Predictions
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedProject && selectedProject !== 'all' ? 
                    projects.find(p => p.id.toString() === selectedProject)?.name || 'N/A' : 
                    projects.length
                  }
                </p>
                <p className="text-sm text-gray-600">
                  {selectedProject && selectedProject !== 'all' ? 'Selected Project' : 'Total Projects'}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedProject && selectedProject !== 'all' ? 
                    allTasks.filter((task: any) => 
                      task.project_id?.toString() === selectedProject && 
                      ['in-progress', 'under-review'].includes(task.status)
                    ).length : 
                    getTaskStatusCounts().inProgress
                  }
                </p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedProject && selectedProject !== 'all' ? 
                    allTasks.filter((task: any) => 
                      task.project_id?.toString() === selectedProject && task.status === 'completed'
                    ).length : 
                    getTaskStatusCounts().completed
                  }
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedProject && selectedProject !== 'all' ? 
                    allTasks.filter((task: any) => 
                      task.project_id?.toString() === selectedProject
                    ).length : 
                    getTaskStatusCounts().total
                  }
                </p>
                <p className="text-sm text-gray-600">Total Tasks</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedProject && selectedProject !== 'all' ? 
                    allTasks.filter((task: any) => {
                      if (task.project_id?.toString() !== selectedProject || task.status === 'completed') return false;
                      const endDate = task.end_date || task.endDate;
                      if (!endDate) return false;
                      return new Date(endDate) < new Date();
                    }).length : 
                    getTaskStatusCounts().overdue
                  }
                </p>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTab === 'predictions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              Project Completion Predictions
            </CardTitle>
            <p className="text-sm text-gray-600">
              Estimated finish dates based on current task completion rate (tasks completed per day).
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading predictions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-600">
                      <th className="p-3">Project</th>
                      <th className="p-3">Progress</th>
                      <th className="p-3">Remaining Tasks</th>
                      <th className="p-3">Est. Days Left</th>
                      <th className="p-3">Projected Finish</th>
                      <th className="p-3">Target Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getProjectPredictions().map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3">{p.progress}%</td>
                        <td className="p-3">{p.remaining}</td>
                        <td className="p-3">{p.estimatedDaysLeft ?? '—'}</td>
                        <td className="p-3">
                          {p.projectedDate ? p.projectedDate.toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3">
                          {p.targetDate ? p.targetDate.toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3">
                          {p.onTrack === null ? (
                            <span className="text-gray-500">No target</span>
                          ) : p.onTrack ? (
                            <span className="text-green-600 font-medium">On track</span>
                          ) : (
                            <span className="text-red-600 font-medium">At risk</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'overview' && (
      <>
      {/* Task Matrix - Organized by Hierarchy and Stages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Task Matrix - Hierarchy vs Stages
          </CardTitle>
          <p className="text-sm text-gray-600">Select a project to view tasks organized by hierarchy and stages.</p>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading tasks...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Project Selector and Search */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Select Project:</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    title="Choose a project to load its task matrix (hierarchy × stages) from the backend"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a project...</option>
                    {projects.map((project: any) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {selectedProject && (
                    <span className="text-sm text-gray-600">
                      {projects.find((p: any) => p.id === parseInt(selectedProject))?.name}
                    </span>
                  )}
                </div>
                
                {/* Hierarchy Search */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Search Hierarchy:</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search Grade, Book, Unit, Lesson"
                      value={hierarchySearch}
                      onChange={(e) => setHierarchySearch(e.target.value)}
                      title="Filter the task matrix rows by grade, book, unit, or lesson name"
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
                    />
                    {hierarchySearch && (
                      <button
                        onClick={() => setHierarchySearch('')}
                        title="Clear hierarchy search filter"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                </div>
              </div>
            </div>

              {selectedProject ? (
                (() => {
                  const { hierarchies, stageNames, organized } = getTableData();
                  
                  if (hierarchies.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No tasks found for this project</p>
                        <p className="text-sm text-gray-400 mt-1">Try creating some tasks or selecting a different project</p>
          </div>
                    );
                  }
                  
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left p-3 font-semibold text-gray-700 bg-gray-50 sticky left-0 z-10 min-w-[120px]">
                              Hierarchy
                            </th>
                            {stageNames.map((stage) => (
                              <th key={stage} className="text-center p-3 font-semibold text-gray-700 bg-gray-50 min-w-[100px]">
                                {stage}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hierarchies.map((hierarchy) => (
                            <tr key={hierarchy} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-900 sticky left-0 z-10 bg-white min-w-[120px]">
                                {hierarchy}
                              </td>
                              {stageNames.map((stage) => {
                                const task = organized[hierarchy][stage];
                                if (!task) {
                                  return (
                                    <td key={stage} className="p-3 text-center">
                                      <div className="w-6 h-6 rounded-full bg-gray-200 mx-auto"></div>
                                    </td>
                                  );
                                }
                                
                                const tooltip = getTaskTooltip(task);
                                return (
                                  <td key={stage} className="p-3 text-center">
                                    <div
                                      className={`w-6 h-6 rounded-full cursor-pointer transition-all duration-200 hover:scale-125 hover:shadow-lg mx-auto ${getTaskColor(task)}`}
                                      onMouseEnter={(e) => {
                                        setHoveredTask(tooltip);
                                        setTooltipPosition({ x: e.clientX, y: e.clientY });
                                      }}
                                      onMouseLeave={() => setHoveredTask(null)}
                                      onClick={() => handleTaskClick(task)}
                                      title={`${tooltip.componentPath} - ${tooltip.stage} (Click to assign)`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Please select a project to view the task matrix</p>
                  <p className="text-sm text-gray-400 mt-1">Choose a project from the dropdown above</p>
                </div>
              )}
              
              {/* Hover Tooltip */}
              {hoveredTask && (
                <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm pointer-events-none" 
                     style={{
                       left: `${tooltipPosition.x + 10}px`,
                       top: `${tooltipPosition.y - 10}px`
                     }}>
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-900">{hoveredTask.name}</div>
                    <div className="text-sm text-gray-600">
                      <div><strong>Project:</strong> {hoveredTask.project}</div>
                      <div><strong>Stage:</strong> {hoveredTask.stage}</div>
                      <div><strong>Hierarchy:</strong> {hoveredTask.componentPath}</div>
                      <div><strong>Status:</strong> 
                        <span className={`ml-1 px-2 py-1 rounded text-xs ${
                          hoveredTask.status === 'completed' ? 'bg-green-100 text-green-800' :
                          hoveredTask.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          hoveredTask.status === 'under-review' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {hoveredTask.status.replace('-', ' ')}
                        </span>
      </div>
                      {hoveredTask.dueDate && (
                        <div><strong>Due:</strong> {new Date(hoveredTask.dueDate).toLocaleDateString()}</div>
                      )}
                      <div><strong>Assignee:</strong> {hoveredTask.assignee}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span>In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-300 rounded-full"></div>
                  <span>Not Started</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span>Overdue</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                  <span>No Task</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{getTaskStatusCounts().completed}</div>
                  <div className="text-xs text-green-700">Completed</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{getTaskStatusCounts().inProgress}</div>
                  <div className="text-xs text-blue-700">In Progress</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">{getTaskStatusCounts().notStarted}</div>
                  <div className="text-xs text-orange-700">Not Started</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-red-600">{getTaskStatusCounts().overdue}</div>
                  <div className="text-xs text-red-700">Overdue</div>
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

      {/* Advanced Analytics Suite */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
                Advanced Analytics Suite
              </CardTitle>
              <p className="text-sm text-gray-600">Comprehensive data visualization and insights.</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Project Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Project:</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  title="Select a project to view stage-by-stage progress charts"
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Select a Project</option>
                  {projects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" title="Filter options (coming soon)">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button variant="outline" size="sm" title="Switch chart display style (coming soon)">
                {selectedFilter}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Project Selection Required */}
            {(!selectedProject || selectedProject === 'all') ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-lg font-medium">Select a Project to View Analytics</p>
                  <p className="text-sm">Choose a project from the dropdown above to see detailed progress analytics.</p>
                </div>
              </div>
            ) : (
              <>
            <h3 className="font-semibold text-gray-900">Development Stages Progress</h3>
                <p className="text-sm text-gray-600">
                  {getStageProgress().length} stages with {allTasks.filter((task: any) => 
                    task.project_id?.toString() === selectedProject
                  ).length} total tasks
                </p>
                
                {getStageProgress().map((stage, index) => (
                  <div key={index} className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-gray-600">{stage.total} items</span>
                </div>
                    <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                  <div 
                        className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300" 
                    style={{ width: `${(stage.completed / stage.total) * 100}%` }}
                  ></div>
                  <div 
                        className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300" 
                    style={{ 
                      width: `${(stage.inProgress / stage.total) * 100}%`, 
                      left: `${(stage.completed / stage.total) * 100}%` 
                    }}
                  ></div>
                  <div 
                        className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-300" 
                    style={{ 
                      width: `${(stage.overdue / stage.total) * 100}%`, 
                      left: `${((stage.completed + stage.inProgress) / stage.total) * 100}%` 
                    }}
                  ></div>
                  <div 
                        className="absolute left-0 top-0 h-full bg-orange-500 transition-all duration-300" 
                    style={{ 
                      width: `${(stage.pending / stage.total) * 100}%`, 
                      left: `${((stage.completed + stage.inProgress + stage.overdue) / stage.total) * 100}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Completed: {stage.completed}</span>
                  <span>In Progress: {stage.inProgress}</span>
                  <span>Overdue: {stage.overdue}</span>
                  <span>Pending: {stage.pending}</span>
                </div>
              </div>
            ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => {
          const projectTasks = allTasks.filter((task: any) => task.project_id === project.id);
          const completedTasks = projectTasks.filter((task: any) => task.status === 'completed').length;
          const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
          
          return (
          <Card 
            key={project.id} 
            className="group hover:shadow-lg transition-shadow cursor-pointer hover:scale-105 transform transition-all duration-200"
            onClick={() => handleProjectClick(project.id.toString())}
            title="Open full grade → book → unit → lesson hierarchy view for this project"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center">
                    {project.name}
                    <span className="ml-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to view hierarchy
                    </span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{project.subtitle}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getProgressColor(progress)}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Start Date</p>
                  <p className="font-medium">{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">End Date</p>
                  <p className="font-medium">{project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium">{project.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Tasks</p>
                  <p className="font-medium">{projectTasks.length} tasks</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Task Progress</span>
                  <span>{completedTasks}/{projectTasks.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className="h-1 rounded-full bg-blue-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
        })}
      </div>

      {/* Debug Info Panel */}
      {showDebugInfo && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Debug Info (Development Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">Available Stages (from backend):</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {stages.map((stage: any) => (
                  <div key={stage.id} className="text-yellow-700">
                    ID: {stage.id} - {stage.name}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">Tasks by Stage:</h4>
              <div className="space-y-1 text-sm">
                {getStageProgress().map((stage) => (
                  <div key={stage.name} className="text-yellow-700">
                    {stage.name}: {stage.total} tasks ({stage.completed} completed)
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Toggle Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          title="Toggle developer debug panel showing raw stage and task counts from the backend"
          className="flex items-center gap-2"
        >
          {showDebugInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
        </Button>
      </div>
      </>
      )}

      {/* Task Assignment Modal */}
      {isAssignmentModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Task</h3>
              <button
                onClick={() => setIsAssignmentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Task Details */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-900">Task Details</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-xs font-semibold text-gray-700">Name:</span>
                    <span className="text-xs text-gray-900 font-medium truncate">{selectedTask.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-xs font-semibold text-gray-700">Project:</span>
                    <span className="text-xs text-gray-900 font-medium truncate">{projects.find((p: any) => p.id === selectedTask.project_id)?.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-xs font-semibold text-gray-700">Stage:</span>
                    <span className="text-xs text-gray-900 font-medium truncate">{stages.find((s: any) => s.id === selectedTask.category_stage_id)?.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-blue-100 col-span-2">
                    <span className="text-xs font-semibold text-gray-700">Hierarchy:</span>
                    <div className="flex items-center space-x-1">
                      {selectedTask.component_path?.split('>').map((part: string, index: number) => (
                        <React.Fragment key={index}>
                          {index > 0 && <span className="text-gray-400 mx-1">&gt;</span>}
                          <div className="flex items-center space-x-1">
                            {part.trim().startsWith('G') && (
                              <GraduationCap className="w-3 h-3 text-blue-600" />
                            )}
                            {part.trim().startsWith('B') && (
                              <BookOpen className="w-3 h-3 text-orange-600" />
                            )}
                            {part.trim().startsWith('U') && (
                              <BookOpen className="w-3 h-3 text-orange-600" />
                            )}
                            {part.trim().startsWith('L') && (
                              <FileText className="w-3 h-3 text-green-600" />
                            )}
                            <span className="text-xs text-gray-900 font-medium">{part.trim()}</span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Form */}
              <TaskAssignmentForm
                task={selectedTask}
                teamMembers={allTeamMembers}
                onAssign={handleAssignTask}
                onCancel={() => setIsAssignmentModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Assignment Form Component
interface TaskAssignmentFormProps {
  task: any;
  teamMembers: any[];
  onAssign: (taskId: string, assigneeId: string, status: string, endDate: string) => void;
  onCancel: () => void;
}

function TaskAssignmentForm({ task, teamMembers, onAssign, onCancel }: TaskAssignmentFormProps) {
  // Pre-fill with existing task data
  const [assigneeId, setAssigneeId] = useState(() => {
    // Extract assignee ID from task.assigneeDetails if available
    if (task.assigneeDetails && Array.isArray(task.assigneeDetails) && task.assigneeDetails.length > 0) {
      return task.assigneeDetails[0].id?.toString() || '';
    }
    return '';
  });
  const [status, setStatus] = useState(task.status || 'not-started');
  const [endDate, setEndDate] = useState(() => {
    // Format existing end_date for date input
    if (task.end_date || task.endDate) {
      const date = new Date(task.end_date || task.endDate);
      return date.toISOString().split('T')[0];
    }
    return '';
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(task.id, assigneeId, status, endDate);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Assignee Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assign to Team Member
        </label>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
        >
          <option value="">Select team member...</option>
          {teamMembers.map((member: any) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
        >
          <option value="not-started">Not Started</option>
          <option value="in-progress">In Progress</option>
          <option value="under-review">Under Review</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* End Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Due Date
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-6">
        <button
          type="button"
          onClick={onCancel}
          title="Close without saving assignment changes"
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          title="Save assignee, status, and due date to the backend"
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200"
        >
          Assign Task
        </button>
      </div>
    </form>
  );
}
