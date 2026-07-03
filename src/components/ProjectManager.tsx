/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Calendar, 
  Users, 
  Filter,
  Grid,
  List,
  Loader2,
  AlertTriangle,
  Trash2,
  Pencil,
  CheckSquare,
  Search,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { Modal } from './ui/Modal';
import { Project, ProjectStatus } from '../types';
import { ProjectDetails } from './ProjectDetails';
import { projectService, categoryService, stageService, taskService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

// Category-specific stage templates
const stageTemplates = {
  'eLearning Design': [
    { id: '1', name: 'Content Strategy', description: 'Define learning objectives and content outline', order: 1 },
    { id: '2', name: 'Instructional Design', description: 'Create detailed instructional design document', order: 2 },
    { id: '3', name: 'Storyboarding', description: 'Visual planning and storyboard creation', order: 3 },
    { id: '4', name: 'Content Development', description: 'Content creation and writing phase', order: 4 },
    { id: '5', name: 'Media Production', description: 'Graphics, animations, and multimedia creation', order: 5 },
    { id: '6', name: 'Development & Integration', description: 'Technical development and LMS integration', order: 6 },
    { id: '7', name: 'Review & QA', description: 'Quality assurance and review process', order: 7 },
    { id: '8', name: 'Deployment', description: 'Final deployment and launch', order: 8 },
  ],
  'Curriculum Design': [
    { id: '9', name: 'Curriculum Analysis', description: 'Analyze curriculum requirements and standards', order: 1 },
    { id: '10', name: 'Scope & Sequence', description: 'Define scope and sequence of curriculum', order: 2 },
    { id: '11', name: 'Learning Objectives', description: 'Define detailed learning objectives', order: 3 },
    { id: '12', name: 'Content Creation', description: 'Develop curriculum content and materials', order: 4 },
    { id: '13', name: 'Assessment Design', description: 'Create assessments and evaluation tools', order: 5 },
    { id: '14', name: 'Teacher Resources', description: 'Develop teacher guides and resources', order: 6 },
    { id: '15', name: 'Pilot Testing', description: 'Pilot test with target audience', order: 7 },
    { id: '16', name: 'Revision & Finalization', description: 'Revise based on feedback and finalize', order: 8 },
  ],
  'IT Applications': [
    { id: '17', name: 'Requirements Analysis', description: 'Gather and analyze system requirements', order: 1 },
    { id: '18', name: 'System Design', description: 'Design system architecture and database', order: 2 },
    { id: '19', name: 'UI/UX Design', description: 'Design user interface and user experience', order: 3 },
    { id: '20', name: 'Frontend Development', description: 'Develop user interface and client-side logic', order: 4 },
    { id: '21', name: 'Backend Development', description: 'Develop server-side logic and APIs', order: 5 },
    { id: '22', name: 'Database Implementation', description: 'Implement database and data models', order: 6 },
    { id: '23', name: 'Integration Testing', description: 'Test system integration and APIs', order: 7 },
    { id: '24', name: 'User Acceptance Testing', description: 'Conduct user acceptance testing', order: 8 },
    { id: '25', name: 'Deployment & Launch', description: 'Deploy to production and launch', order: 9 },
  ],
};

export function ProjectManager() {
  const { user } = useAuth();
  
  // Check if user is logged in (either admin or team member)
  const isAuthenticated = () => {
    if (user) return true;
    const teamToken = sessionStorage.getItem('teamToken');
    const teamUserData = sessionStorage.getItem('teamUserData');
    return !!(teamToken && teamUserData);
  };
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Backend data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasksByProject, setTasksByProject] = useState<Record<string, number>>({});
  const [allStages, setAllStages] = useState<any[]>([]);

  // Fetch data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [projectsResponse, categoriesData, allTasksResponse, stagesData] = await Promise.all([
          projectService.getAll(),
          categoryService.getAll(),
          taskService.getAll({ all: 'true' }),
          stageService.getAll()
        ]);
        
        // Handle projects response (could be paginated or direct array)
        const projectsData = projectsResponse && projectsResponse.data ? projectsResponse.data : (Array.isArray(projectsResponse) ? projectsResponse : []);
        
        setProjects(projectsData);
        setCategories(categoriesData);
        setAllStages(stagesData || []);

        // Handle tasks response (could be paginated or direct array)
        const allTasks = allTasksResponse && allTasksResponse.data ? allTasksResponse.data : (Array.isArray(allTasksResponse) ? allTasksResponse : []);

        // Aggregate task counts per project (handle different id field names)
        const counts: Record<string, number> = {};
        (allTasks || []).forEach((t: any) => {
          const pid = (t.project_id ?? t.projectId ?? '').toString();
          if (!pid) return;
          counts[pid] = (counts[pid] || 0) + 1;
        });
        setTasksByProject(counts);

      } catch (err: any) {
        console.error('ProjectManager fetch error:', err);
        setError(err.message || 'Failed to load projects data');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data if user is authenticated
    if (isAuthenticated()) {
      fetchData();
    }
    
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast lookup for category names by id
  const categoryIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    (categories || []).forEach((c: any) => {
      if (c && (c.id !== undefined) && c.name) {
        map[String(c.id)] = c.name;
      }
    });
    return map;
  }, [categories]);

  const getProjectCategoryName = (project: any) => {
    const direct = project?.category;
    if (direct && typeof direct === 'string' && direct.trim() !== '') return direct;
    const id = project?.category_id ?? project?.categoryId;
    if (id !== undefined && id !== null) {
      const name = categoryIdToName[String(id)];
      if (name) return name;
    }
    return 'Uncategorized';
  };

  const stageIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    (allStages || []).forEach((s: any) => {
      if (s && (s.id !== undefined) && s.name) {
        map[String(s.id)] = s.name;
      }
    });
    return map;
  }, [allStages]);

  const filteredProjects = projects.filter(project => {
    if (selectedCategory !== 'all' && getProjectCategoryName(project) !== selectedCategory) return false;
    if (selectedStatus !== 'all' && project.status !== selectedStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesName = project.name?.toLowerCase().includes(q);
      const matchesDesc = project.description?.toLowerCase().includes(q);
      const matchesCategory = getProjectCategoryName(project).toLowerCase().includes(q);
      if (!matchesName && !matchesDesc && !matchesCategory) return false;
    }
    return true;
  });

  const handleCreateProject = async (projectData: Partial<Project> & { currentStageId?: number }) => {
    try {
      setError(null);
      
      // Prepare project data for backend
      const backendProjectData = {
        name: projectData.name || '',
        description: projectData.description || '',
        category_id: projectData.category_id || categories[0]?.id,
        current_stage_id: projectData.currentStageId || null,
        start_date: projectData.start_date || new Date().toISOString().split('T')[0],
        end_date: projectData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'planning',
        progress: 0
      };
      
      
      // Create project via API
      const newProject = await projectService.create(backendProjectData);
      
      // Add to local state
      setProjects(prev => [...prev, newProject]);
      setIsCreateModalOpen(false);
      
    } catch (err: any) {
      console.error('❌ Create project error:', err);
      setError(err.message || 'Failed to create project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      setError(null);
      
      if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        return;
      }
      
      
      // Delete project via API
      await projectService.delete(projectId);
      
      // Remove from local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // Close project details if this project was selected
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
      
    } catch (err: any) {
      console.error('❌ Delete project error:', err);
      setError(err.message || 'Failed to delete project');
    }
  };

  const getStatusVariant = (status: ProjectStatus) => {
    switch (status) {
      case 'active': return 'primary';
      case 'completed': return 'success';
      case 'on-hold': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getDaysLeft = (end: string | Date | undefined) => {
    if (!end) return null;
    const endDate = new Date(end);
    const today = new Date();
    // Normalize to start of day for consistency
    endDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffMs = endDate.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  if (selectedProject) {
    return (
      <ProjectDetails 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        onUpdate={(updatedProject) => {
          setSelectedProject(updatedProject);
          // Also update the project in the projects list
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        }}
        categories={categories}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and track your project portfolio</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and track your project portfolio</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
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
            <h1 className="text-2xl md:text-3xl font-bold">Projects</h1>
            <p className="text-white/80">Manage and track your project portfolio</p>
          </div>
          <Button 
            variant="dark"
            icon={<Plus className="w-4 h-4" />} 
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Filters and View Controls */} 
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-52"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent outline-none text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500">Status</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent outline-none text-sm"
            >
              <option value="all">All</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? '' : 'hover:bg-gray-100'}
            title="Grid view"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? '' : 'hover:bg-gray-100'}
            title="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {filteredProjects.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No projects found</p>
          {searchTerm && (
            <p className="text-sm text-gray-400 mt-1">
              No results for "<span className="font-medium">{searchTerm}</span>". Try a different search.
            </p>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className={`relative overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border-0 bg-white/90 backdrop-blur-sm ${project.status === 'active' ? 'ring-1 ring-blue-200' : ''}`}
              onClick={() => setSelectedProject(project)}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                      {project.name}
                      {/* current stage badge if available */}
                      
                    </CardTitle>
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border border-blue-200">{getProjectCategoryName(project)}</Badge>
                      {(() => {
                        const id = (project as any).current_stage_id ?? (project as any).currentStageId;
                        const name = id !== undefined && id !== null ? stageIdToName[String(id)] : null;
                        return name ? (
                          <Badge variant="secondary" className="text-[11px] px-2 mx-3 py-0.5 bg-purple-50 text-purple-700 border border-purple-200">
                            {name}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(project);
                      }}
                      title="Edit Project"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      title="Delete Project"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 line-clamp-2">{project.description}</p>

                {getProjectCategoryName(project) === 'IT Applications' && (
                  <div className="mt-1">
                    <div className="text-xs text-gray-500">IT Applications Phases</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {stageTemplates['IT Applications'].slice(0, 3).map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px] px-2 py-0.5">
                          {s.name}
                        </Badge>
                      ))}
                      {stageTemplates['IT Applications'].length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                          +{stageTemplates['IT Applications'].length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${project.progress >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : project.progress >= 50 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : project.progress >= 25 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="inline-flex items-center text-gray-700">
                      <CheckSquare className="w-4 h-4 mr-1 text-blue-600" />
                      <span className="font-medium">{tasksByProject[(project.id as any)?.toString()] || 0}</span>
                      <span className="ml-1 text-gray-500">tasks</span>
                    </div>
                    <div className="inline-flex items-center text-gray-700">
                      <Users className="w-4 h-4 mr-1 text-purple-600" />
                      <span className="font-medium">{project.userCount || 0}</span>
                      <span className="ml-1 text-gray-500">team</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="inline-flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {project.end_date || project.endDate ? new Date(project.end_date || project.endDate || '').toLocaleDateString() : 'No due date'}
                  </div>
                  {(() => {
                    const days = getDaysLeft((project.end_date as any) || (project.endDate as any));
                    if (days === null) return null;
                    const label = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days left`;
                    const cls = days < 0 ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-green-600';
                    return <span className={`font-medium ${cls}`}>{label}</span>;
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tasks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Left
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {project.name}
                            {(() => {
                              const id = (project as any).current_stage_id ?? (project as any).currentStageId;
                              const name = id !== undefined && id !== null ? stageIdToName[String(id)] : null;
                              return name ? (
                                <Badge variant="secondary" className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200">
                                  {name}
                                </Badge>
                              ) : null;
                            })()}
                          </div>
                          <div className="text-sm text-gray-500">{project.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getProjectCategoryName(project)}
                        
                        
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(project.status)}>
                          {project.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-24">
                          <ProgressBar value={project.progress} showLabel={false} />
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{project.progress}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(tasksByProject[(project.id as any)?.toString()] || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1 text-gray-400" />
                          {project.userCount || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.end_date || project.endDate ? new Date(project.end_date || project.endDate || '').toLocaleDateString() : 'No due date'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const days = getDaysLeft((project.end_date as any) || (project.endDate as any));
                          if (days === null) return '-';
                          return days < 0 ? `${Math.abs(days)} overdue` : days === 0 ? 'Due today' : `${days} days`;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProject(project);
                            }}
                            title="Edit Project"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            title="Delete Project"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        categories={categories}
      />
    </div>
  );
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: Partial<Project> & { currentStageId?: number }) => void;
  categories: any[];
}

function CreateProjectModal({ isOpen, onClose, onSubmit, categories }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: null as number | null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Handle category change
  const handleCategoryChange = (categoryId: number | null) => {
    setFormData({ ...formData, category_id: categoryId });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      start_date: formData.start_date,
      end_date: formData.end_date,
    });
    setFormData({
      name: '',
      description: '',
      category_id: null,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter project name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Project description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={formData.category_id || ''}
            onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a category</option>
            {categories && categories.length > 0 ? (
              categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))
            ) : (
              <option value="" disabled>No categories available</option>
            )}
          </select>
        </div>



        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}