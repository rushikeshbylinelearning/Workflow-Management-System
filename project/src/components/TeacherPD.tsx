import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Video, 
  Award, 
  Clock, 
  Target, 
  CheckCircle,
  PlayCircle,
  Download,
  Calendar,
  Star,
  TrendingUp,
  Brain,
  Shield,
  Lightbulb,
  Globe,
  ChevronRight,
  User,
  Edit3,
  Save,
  X,
  Plus,
  Trash2
} from 'lucide-react';

type PDModuleType = 'foundation' | 'intermediate' | 'advanced' | 'specialist';

interface PDModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  type: PDModuleType;
  topics: string[];
  resources: string[];
  completed: boolean;
}

const pdModules: PDModule[] = [
  {
    id: 'ai-foundations',
    title: 'AI Foundations for Educators',
    description: 'Essential AI concepts and terminology for K-12 teachers',
    duration: '4 hours',
    type: 'foundation',
    topics: ['What is AI?', 'Machine Learning Basics', 'AI in Daily Life', 'Educational Applications'],
    resources: ['Video Lectures', 'Interactive Demos', 'Glossary', 'Assessment Quiz'],
    completed: true
  },
  {
    id: 'curriculum-integration',
    title: 'Integrating AI into Curriculum',
    description: 'Practical strategies for incorporating AI education across subjects',
    duration: '6 hours',
    type: 'intermediate',
    topics: ['Cross-curricular Connections', 'Age-appropriate Activities', 'Assessment Strategies', 'Project Ideas'],
    resources: ['Lesson Plans', 'Activity Templates', 'Rubrics', 'Case Studies'],
    completed: true
  },
  {
    id: 'ethical-ai',
    title: 'Teaching AI Ethics and Responsibility',
    description: 'Addressing bias, fairness, and ethical considerations in AI education',
    duration: '5 hours',
    type: 'intermediate',
    topics: ['AI Bias', 'Privacy Concerns', 'Algorithmic Fairness', 'Student Discussions'],
    resources: ['Discussion Guides', 'Scenario Cards', 'Research Articles', 'Video Resources'],
    completed: false
  },
  {
    id: 'hands-on-tools',
    title: 'Hands-on AI Tools and Platforms',
    description: 'Practical experience with age-appropriate AI tools and platforms',
    duration: '8 hours',
    type: 'advanced',
    topics: ['Visual Programming', 'AI Simulators', 'Data Analysis Tools', 'Creative AI'],
    resources: ['Tool Tutorials', 'Practice Exercises', 'Project Templates', 'Troubleshooting Guide'],
    completed: false
  },
  {
    id: 'assessment-evaluation',
    title: 'Assessing AI Learning Outcomes',
    description: 'Methods for evaluating student understanding and progress in AI education',
    duration: '4 hours',
    type: 'advanced',
    topics: ['Formative Assessment', 'Portfolio Development', 'Peer Evaluation', 'Reflection Techniques'],
    resources: ['Assessment Tools', 'Rubric Templates', 'Student Examples', 'Feedback Strategies'],
    completed: false
  },
  {
    id: 'ai-specialist',
    title: 'AI Education Specialist Certification',
    description: 'Advanced certification for AI education leaders and specialists',
    duration: '20 hours',
    type: 'specialist',
    topics: ['Curriculum Design', 'Teacher Mentoring', 'Program Evaluation', 'Research Methods'],
    resources: ['Certification Exam', 'Capstone Project', 'Mentorship Program', 'Continuing Education'],
    completed: false
  }
];

const moduleTypeConfig = {
  foundation: { color: 'bg-blue-100 text-blue-800', label: 'Foundation' },
  intermediate: { color: 'bg-green-100 text-green-800', label: 'Intermediate' },
  advanced: { color: 'bg-purple-100 text-purple-800', label: 'Advanced' },
  specialist: { color: 'bg-orange-100 text-orange-800', label: 'Specialist' }
};

export const TeacherPD: React.FC = () => {
  const { isAdminMode } = useCurriculum();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<PDModuleType | 'all'>('all');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [modules, setModules] = useState(pdModules);

  const addNewModule = () => {
    const newModule: PDModule = {
      id: `module-${Date.now()}`,
      title: 'New Module',
      description: 'Module description',
      duration: '2 hours',
      type: 'foundation',
      topics: ['New Topic'],
      resources: ['New Resource'],
      completed: false
    };
    setModules([...modules, newModule]);
    setEditingModule(newModule.id);
  };

  const filteredModules = filterType === 'all' 
    ? modules 
    : modules.filter(module => module.type === filterType);

  const completedModules = modules.filter(m => m.completed).length;
  const totalHours = modules.reduce((total, module) => 
    total + parseInt(module.duration.split(' ')[0]), 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <GraduationCap className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Teacher Professional Development</h1>
              <p className="text-lg opacity-90 mt-1">Empowering educators for AI curriculum delivery</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{completedModules}/{modules.length}</div>
            <div className="text-sm opacity-75">Modules Completed</div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { icon: BookOpen, label: 'Total Modules', value: modules.length, color: 'bg-blue-500' },
          { icon: Clock, label: 'Total Hours', value: `${totalHours}h`, color: 'bg-green-500' },
          { icon: Award, label: 'Certifications', value: '3', color: 'bg-purple-500' },
          { icon: Users, label: 'Participants', value: '2,500+', color: 'bg-orange-500' }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 ${stat.color} rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filter by Level</h3>
          {isAdminMode && (
            <button
              onClick={addNewModule}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Module</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'foundation', label: 'Foundation' },
            { id: 'intermediate', label: 'Intermediate' },
            { id: 'advanced', label: 'Advanced' },
            { id: 'specialist', label: 'Specialist' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === filter.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* PD Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredModules.map((module) => {
          const typeConfig = moduleTypeConfig[module.type];
          const isEditing = editingModule === module.id;
          return (
            <div key={module.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all relative group">
              {isAdminMode && !isEditing && (
                <button
                  onClick={() => setEditingModule(module.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all z-10"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={module.title}
                          onChange={(e) => {
                            const updatedModules = modules.map(m => 
                              m.id === module.id ? { ...m, title: e.target.value } : m
                            );
                            setModules(updatedModules);
                          }}
                          className="text-xl font-semibold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none flex-1"
                        />
                      ) : (
                        <h3 className="text-xl font-semibold text-gray-900">{module.title}</h3>
                      )}
                      {module.completed && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={module.description}
                        onChange={(e) => {
                          const updatedModules = modules.map(m => 
                            m.id === module.id ? { ...m, description: e.target.value } : m
                          );
                          setModules(updatedModules);
                        }}
                        rows={2}
                        className="w-full text-gray-600 bg-transparent border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                      />
                    ) : (
                      <p className="text-gray-600 mb-3">{module.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm">
                      <span className={`px-2 py-1 rounded-full ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Clock className="w-4 h-4" />
                        {isEditing ? (
                          <input
                            type="text"
                            value={module.duration}
                            onChange={(e) => {
                              const updatedModules = modules.map(m => 
                                m.id === module.id ? { ...m, duration: e.target.value } : m
                              );
                              setModules(updatedModules);
                            }}
                            className="bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-20"
                          />
                        ) : (
                          <span>{module.duration}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => setEditingModule(null)}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingModule(null)}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Key Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {module.topics.slice(0, 3).map((topic, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {topic}
                        </span>
                      ))}
                      {module.topics.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          +{module.topics.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Resources Included</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {module.resources.map((resource, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span>{resource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedModule(selectedModule === module.id ? null : module.id)}
                    className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    <span>View Details</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${
                      selectedModule === module.id ? 'rotate-90' : ''
                    }`} />
                  </button>
                  
                  <div className="flex space-x-2">
                    {module.completed ? (
                      <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                        Completed
                      </button>
                    ) : (
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                        Start Module
                      </button>
                    )}
                  </div>
                </div>

                {selectedModule === module.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Complete Topic List</h4>
                        <ul className="space-y-2">
                          {module.topics.map((topic, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                              <Target className="w-3 h-3 text-indigo-500" />
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Learning Resources</h4>
                        <ul className="space-y-2">
                          {module.resources.map((resource, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                              <Download className="w-3 h-3 text-green-500" />
                              <span>{resource}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Support Resources */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Additional Support Resources</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Comprehensive support to ensure successful implementation of AI curriculum
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: 'Peer Community',
              description: 'Connect with other educators implementing AI curriculum',
              action: 'Join Community'
            },
            {
              icon: Video,
              title: 'Live Webinars',
              description: 'Monthly sessions with AI education experts and practitioners',
              action: 'View Schedule'
            },
            {
              icon: BookOpen,
              title: 'Resource Library',
              description: 'Extensive collection of lesson plans, activities, and assessments',
              action: 'Browse Library'
            }
          ].map((resource, index) => {
            const Icon = resource.icon;
            return (
              <div key={index} className="bg-white rounded-lg p-6 border border-blue-200 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{resource.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{resource.description}</p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  {resource.action}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};