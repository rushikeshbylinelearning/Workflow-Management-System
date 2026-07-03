import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  FileText, 
  Users, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { taskService, projectService, stageService, teamService, gradeService, bookService, lessonService, unitService } from '../services/apiService';

interface ProjectHierarchyViewProps {
  projectId: string;
  onBack: () => void;
}

interface HierarchyItem {
  id: string;
  name: string;
  type: string; // Dynamic type based on actual data
  parentId?: string;
  children?: HierarchyItem[];
  progress: number;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  totalTasks: number;
  completedTasks: number;
  stages: StageProgress[];
  level: number; // Hierarchy level (0 = grade, 1 = book/unit, 2 = lesson, etc.)
  hasChildren: boolean;
}

interface StageProgress {
  id: number;
  name: string;
  completed: number;
  total: number;
  percentage: number;
}

export function ProjectHierarchyView({ projectId, onBack }: ProjectHierarchyViewProps) {
  const [project, setProject] = useState<any>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedLeafItems, setExpandedLeafItems] = useState<Set<string>>(new Set()); // For lesson Subject Content
  const [loading, setLoading] = useState(true);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [allTeamMembers, setAllTeamMembers] = useState<any[]>([]);
  const [allAdminUsers, setAllAdminUsers] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, tasksData, stagesData, teamMembersData, gradesData, booksData, lessonsData, unitsData] = await Promise.all([
        projectService.getById(projectId),
        taskService.getAll({ project_id: projectId, all: 'true' }),
        stageService.getAll(),
        teamService.getMembers(),
        // We need to fetch grades, books, units, and lessons for this project
        gradeService.getByProject(projectId),
        bookService.getAll(),
        lessonService.getAll(),
        // Fetch units as well since tasks have unit_id
        unitService.getAll()
      ]);

      const projectInfo = projectData.data || projectData;
      const tasks = tasksData.data || tasksData;
      const stages = stagesData.data || stagesData;
      const teamMembersList = teamMembersData.data || teamMembersData;
      const gradesList = gradesData.data || gradesData;
      const booksList = booksData.data || booksData;
      const lessonsList = lessonsData.data || lessonsData;
      const unitsList = unitsData.data || unitsData;

      setProject(projectInfo);
      setAllTeamMembers(teamMembersList);
      setAllTasks(tasks);
      setGrades(gradesList);
      setBooks(booksList);
      setLessons(lessonsList);
      setUnits(unitsList);
      
      // Debug: Log available tasks and their component paths
      
      // Debug: Log grades, books, units, and lessons
      
      // Build hierarchy from tasks
      const hierarchyData = buildHierarchyFromTasks(tasks, stages);
      setHierarchy(hierarchyData);
      
      // Debug: Log built hierarchy
      
      // Don't auto-expand anything - let users choose what to expand
      setExpandedItems(new Set());
    } catch (error) {
      console.error('Failed to fetch project data:', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

    const buildHierarchyFromTasks = (tasks: any[], stages: any[]): HierarchyItem[] => {
    const hierarchyMap = new Map<string, HierarchyItem>();
    const rootItems: HierarchyItem[] = [];

    // If no tasks, return empty hierarchy
    if (!tasks || tasks.length === 0) {
      return [];
    }

    // Process each task to build hierarchy
    tasks.forEach((task: any) => {
      const componentPath = task.component_path || '';
      if (!componentPath) return;

        const pathParts = componentPath.split('>').map((part: string) => part.trim());
        
        // Build hierarchy levels dynamically
        let currentParentId = '';
        pathParts.forEach((part: string, index: number) => {
          const itemId = pathParts.slice(0, index + 1).join('>');
          const level = index;
          
          // Determine type based on level and naming pattern
          let type = 'item';
          if (level === 0) {
            type = 'grade';
          } else if (level === 1) {
            // Check if this looks like a book/unit or lesson
            if (part.startsWith('B') || part.startsWith('U')) {
              type = 'book';
            } else if (part.startsWith('L')) {
              type = 'lesson';
            } else {
              type = 'book'; // Default to book for middle level
            }
          } else if (level === 2) {
            type = 'lesson';
          } else {
            type = 'item';
          }
        
        if (!hierarchyMap.has(itemId)) {
          const newItem: HierarchyItem = {
            id: itemId,
            name: part,
            type,
            parentId: currentParentId,
            progress: 0,
            status: 'not-started',
            totalTasks: 0,
            completedTasks: 0,
            stages: [],
            level,
            hasChildren: false
          };
          
          // Debug: Log hierarchy item creation
          
          hierarchyMap.set(itemId, newItem);
          
          if (currentParentId) {
            const parent = hierarchyMap.get(currentParentId);
            if (parent) {
              if (!parent.children) parent.children = [];
              parent.children.push(newItem);
              parent.hasChildren = true;
            }
          } else {
            rootItems.push(newItem);
          }
        }
        
        currentParentId = itemId;
      });
    });

    // Calculate progress and status for each hierarchy item
    hierarchyMap.forEach(item => {
      // Get tasks that belong to this specific hierarchy level
      const itemTasks = tasks.filter(task => {
        const taskPath = task.component_path || '';
        if (taskPath === item.id) return true; // Exact match
        
        // Check if this task belongs to this hierarchy level
        const taskParts = taskPath.split('>').map((part: string) => part.trim());
        const itemParts = item.id.split('>').map((part: string) => part.trim());
        
        // Task should have at least as many parts as the item
        if (taskParts.length < itemParts.length) return false;
        
        // Check if the task path starts with this item's path
        for (let i = 0; i < itemParts.length; i++) {
          if (taskParts[i] !== itemParts[i]) return false;
        }
        return true;
      });
      
      item.totalTasks = itemTasks.length;
      item.completedTasks = itemTasks.filter(task => task.status === 'completed').length;
      
      // Calculate progress based on task statuses, not just completion
      if (itemTasks.length > 0) {
        let totalProgress = 0;
        itemTasks.forEach(task => {
          switch (task.status) {
            case 'completed':
              totalProgress += 100;
              break;
            case 'in-progress':
              totalProgress += 50;
              break;
            case 'under-review':
              totalProgress += 75;
              break;
            case 'blocked':
              totalProgress += 25;
              break;
            case 'not-started':
            default:
              totalProgress += 0;
              break;
          }
        });
        item.progress = Math.round(totalProgress / itemTasks.length);
      } else {
        item.progress = 0;
      }
      
      // Determine status based on progress
      if (item.progress === 100) item.status = 'completed';
      else if (item.progress > 0) item.status = 'in-progress';
      else item.status = 'not-started';
      
      // Calculate stage progress for this hierarchy item
      item.stages = stages.map(stage => {
        const stageTasks = itemTasks.filter(task => 
          task.category_stage_id === stage.id || task.stage_id === stage.id
        );
        
        // Since there's always exactly 1 task per stage, calculate progress based on status
        if (stageTasks.length === 1) {
          const task = stageTasks[0];
          let percentage = 0;
          
          // Calculate percentage based on task status
          switch (task.status) {
            case 'completed':
              percentage = 100;
              break;
            case 'in-progress':
              percentage = 50; // Show as 50% when in progress
              break;
            case 'under-review':
              percentage = 75; // Show as 75% when under review
              break;
            case 'blocked':
              percentage = 25; // Show as 25% when blocked
              break;
            case 'not-started':
            default:
              percentage = 0;
              break;
          }
          
          return {
            id: stage.id,
            name: stage.name,
            completed: percentage === 100 ? 1 : 0,
            total: 1,
            percentage: percentage
          };
        }
        
        // Fallback for edge cases (shouldn't happen in normal usage)
        const completed = stageTasks.filter(task => task.status === 'completed').length;
        const total = stageTasks.length;
        
        return {
          id: stage.id,
          name: stage.name,
          completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      }).filter(stage => stage.total > 0);
    });

    // Sort root items by name to ensure proper order (G1, G2, G3, G4)
    rootItems.sort((a, b) => {
      // Extract numeric part from grade names (G1, G2, G3, G4)
      const aNum = parseInt(a.name.replace(/\D/g, ''));
      const bNum = parseInt(b.name.replace(/\D/g, ''));
      
      // If both are numeric grades, sort numerically
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // Otherwise, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    // Sort children within each hierarchy item
    hierarchyMap.forEach(item => {
      if (item.children && item.children.length > 0) {
        item.children.sort((a, b) => {
          // Extract numeric part from names (U1, U2, L1, L2, etc.)
          const aNum = parseInt(a.name.replace(/\D/g, ''));
          const bNum = parseInt(b.name.replace(/\D/g, ''));
          
          // If both are numeric, sort numerically
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          
          // Otherwise, sort alphabetically
          return a.name.localeCompare(b.name);
        });
      }
    });

    return rootItems;
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const toggleLeafExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedLeafItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedLeafItems(newExpanded);
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
      
      // Refresh project data to show updated progress
      await fetchProjectData();
      
      setIsAssignmentModalOpen(false);
      setSelectedTask(null);
      
      alert('Task assigned successfully!');
    } catch (error) {
      console.error('Failed to assign task:', error);
      alert('Failed to assign task. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grade': return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'book': return <BookOpen className="w-4 h-4 text-orange-600" />;
      case 'lesson': return <FileText className="w-4 h-4 text-green-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string, childrenCount: number) => {
    switch (type) {
      case 'grade': return `${childrenCount} books`;
      case 'book': return `${childrenCount} lessons`;
      case 'lesson': return `${childrenCount} tasks`;
      default: return `${childrenCount} items`;
    }
  };

  const renderHierarchyItem = (item: HierarchyItem, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const indentClass = `ml-${level * 6}`;
    
    // Alternate background colors: white for even levels, gray for odd levels
    const getAlternatingBackground = (level: number) => {
      return level % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    };

    return (
      <div key={item.id} className={`${indentClass} space-y-3`}>
        <div className={`flex items-center space-x-3 p-3 ${getAlternatingBackground(level)} border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors`}>
          {/* Expand/Collapse Button for items with children */}
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          
          {/* Chevron for leaf nodes (lessons) and grades with NO children to show Subject Content */}
          {!hasChildren && item.stages.length > 0 && (
            <button
              onClick={() => toggleLeafExpanded(item.id)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {expandedLeafItems.has(item.id) ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          
          {/* Icon and Name */}
          <div className="flex items-center space-x-2">
            <div className="text-gray-500">
              {getTypeIcon(item.type)}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{item.name}</h3>
              {hasChildren && (
                <p className="text-sm text-gray-500">
                  {getTypeLabel(item.type, item.children?.length || 0)}
                </p>
              )}
              {!hasChildren && item.type === 'lesson' && (
                <p className="text-sm text-gray-500">
                  {item.totalTasks} tasks
                </p>
              )}
            </div>
          </div>

          {/* Progress and Status */}
          <div className="ml-auto flex items-center space-x-4">
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                  {item.status.replace('-', ' ')}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.progress}%
                </span>
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full ${getProgressColor(item.progress)} transition-all duration-300`}
                  style={{ width: `${item.progress}%` }}
                ></div>
              </div>
            </div>
            
          </div>
        </div>

                            {/* Stage Progress - for leaf nodes (lessons) and grades with NO children */}
          {!hasChildren && item.stages.length > 0 && expandedLeafItems.has(item.id) && (
            <div className={`ml-12 space-y-3 ${getAlternatingBackground(level + 1)} rounded-lg p-2`}>
              {/* Subject Content Header */}
              <div className="flex items-center space-x-2 p-2">
                <span className="text-sm font-medium text-gray-700">Subject Content:</span>
                <span className="text-xs text-gray-500">({item.stages.length} stages)</span>
              </div>
              
              {/* Stage Progress Grid */}
              <div className="grid grid-cols-5 gap-3">
                {item.stages.map((stage, index) => {
                  // Debug logging
                
                  return (
                    <div 
                      key={index} 
                      className="text-center space-y-1 bg-gray-50 rounded-lg p-1 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:shadow-sm transition-all"
                      onClick={async () => {
                        
                        try {
                          // Parse the hierarchy item ID to get the individual IDs
                          const hierarchyParts = item.id.split('>').map((part: string) => part.trim());
                          let gradeId = null, bookId = null, unitId = null, lessonId = null;
                          
                          
                          // Extract IDs based on hierarchy level
                          if (hierarchyParts.length >= 1) {
                            // Find grade by name (e.g., "G1" -> find grade with name "G1")
                            const grade = grades.find((g: any) => g.name === hierarchyParts[0]);
                            gradeId = grade?.id;
                          }
                          
                          if (hierarchyParts.length >= 2) {
                            const secondPart = hierarchyParts[1];
                            if (secondPart.startsWith('U')) {
                              // This is a unit (U1, U2, etc.)
                              const unit = units.find((u: any) => u.name === secondPart && u.grade_id === gradeId);
                              unitId = unit?.id;
                              bookId = unitId; // book_id = unit_id for units
                            } else if (secondPart.startsWith('L')) {
                              // This is a lesson (L1, L2, etc.) - no unit level
                              const lesson = lessons.find((l: any) => l.name === secondPart && l.grade_id === gradeId);
                              lessonId = lesson?.id;
                              unitId = null;
                              bookId = lessonId; // book_id = lesson_id for direct lessons
                            }
                          }
                          
                          if (hierarchyParts.length >= 3) {
                            // This means we have G1 > U1 > L1 structure
                            const thirdPart = hierarchyParts[2];
                            if (thirdPart.startsWith('L')) {
                              // L1, L2, L3 are lessons that belong to the unit
                              // Find the lesson by name and grade_id
                              const lesson = lessons.find((l: any) => l.name === thirdPart && l.grade_id === gradeId);
                              lessonId = lesson?.id;
                            }
                          }
                          
                          // Debug: Log all extracted IDs
                          
                          // Make API call to get the specific task using taskService
                          // Prepare API parameters, handling null values properly
                          const apiParams: any = {
                            grade_id: gradeId,
                            stage_id: stage.id,
                            project_id: projectId
                          };
                          
                          // Add unit_id if available (this is the key fix!)
                          if (unitId !== null && unitId !== undefined) {
                            apiParams.unit_id = unitId;
                          }
                          
                          // Add book_id if available
                          if (bookId !== null && bookId !== undefined) {
                            apiParams.book_id = bookId;
                          }
                          
                          // Add lesson_id if available
                          if (lessonId !== null && lessonId !== undefined) {
                            apiParams.lesson_id = lessonId;
                          }
                          
                          
                          const taskData = await taskService.getAll(apiParams);
                          
                          
                          if (taskData && taskData.data && taskData.data.length > 0) {
                            const foundTask = taskData.data[0];
                            
                            // Verify this is the correct task by checking component_path
                            if (foundTask.component_path === item.id) {
                              // handleTaskClick(foundTask);
                            } else {
                              console.warn('⚠️ Task component_path mismatch:', {
                                expected: item.id,
                                actual: foundTask.component_path
                              });
                              // Still show the task but log the warning
                              // handleTaskClick(foundTask);
                            }
                          } else {
                            console.warn(`❌ No task found for ${item.id} - ${stage.name}`);
                            console.warn('🔍 Task search parameters:', apiParams);
                            
                            // Show user-friendly error
                            alert(`No task found for ${item.id} - ${stage.name}. Please check the task configuration.`);
                          }
                        } catch (error) {
                          console.error('❌ Error fetching task:', error);
                          alert('Error fetching task. Please try again.');
                        }
                      }}
                      title={`Click to assign ${stage.name} task`}
                    >
                      {/* Stage title */}
                      <div className="text-xs font-medium text-gray-700 mb-2">{stage.name}</div>
                      
                      {/* Icon, progress bar, and percentage in one row */}
                      <div className="flex items-center justify-center space-x-2">
                        {/* Icon next to progress bar */}
                        {stage.percentage === 100 ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-gray-400" />
                        )}
                        
                        {/* Progress bar */}
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              stage.percentage === 100 ? 'bg-green-500' : 
                              stage.percentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${stage.percentage}%` }}
                          ></div>
                        </div>
                        
                        {/* Percentage */}
                        <span className="text-xs text-gray-600 font-medium">{stage.percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="space-y-3">
            {item.children?.map(child => renderHierarchyItem(child, level + 1))}
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
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200"
        >
          Assign Task
        </button>
      </div>
    </form>
  );
};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading project hierarchy...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Analytics
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600">Project hierarchy and progress tracking</p>
          </div>
        </div>
        
        {/* Project Summary Card */}
        <Card className="w-80">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-lg font-bold text-gray-900">
                  {hierarchy.length > 0 ? hierarchy[0].progress : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${getProgressColor(hierarchy.length > 0 ? hierarchy[0].progress : 0)}`}
                  style={{ width: `${hierarchy.length > 0 ? hierarchy[0].progress : 0}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Start Date</p>
                  <p className="font-medium">
                    {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">End Date</p>
                  <p className="font-medium">
                    {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium">{project.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Tasks</p>
                  <p className="font-medium">
                    {hierarchy.length > 0 ? hierarchy[0].totalTasks : 0}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hierarchy Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Project Hierarchy & Progress
          </CardTitle>
          <p className="text-sm text-gray-600">
            Click on arrows to expand/collapse sections. View detailed progress for each level.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {hierarchy.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hierarchy found for this project</p>
              <p className="text-sm text-gray-400 mt-1">Create some tasks with component paths to see the hierarchy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchy.map(item => renderHierarchyItem(item))}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <span className="text-xs text-gray-900 font-medium truncate">{project?.name}</span>
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
