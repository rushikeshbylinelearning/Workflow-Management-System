import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { 
  Shield, 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Eye, 
  Lock, 
  CheckCircle,
  AlertTriangle,
  Monitor,
  Code,
  Brain,
  Database,
  Cpu,
  Zap,
  Users,
  BookOpen,
  Target,
  Clock,
  Star,
  Download,
  Globe,
  Edit3,
  Save,
  X,
  Plus,
  Trash2
} from 'lucide-react';

type EmulatorType = 'visual-programming' | 'data-analysis' | 'neural-network' | 'robotics' | 'nlp' | 'computer-vision';
type GradeLevel = 'elementary' | 'middle' | 'high';

interface Emulator {
  id: string;
  title: string;
  description: string;
  type: EmulatorType;
  gradeLevel: GradeLevel;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  features: string[];
  safetyFeatures: string[];
  learningObjectives: string[];
  isActive: boolean;
}

const emulators: Emulator[] = [
  {
    id: 'visual-ai-builder',
    title: 'Visual AI Builder',
    description: 'Drag-and-drop interface for building simple AI models without coding',
    type: 'visual-programming',
    gradeLevel: 'elementary',
    duration: '45 min',
    difficulty: 'Beginner',
    features: ['Block-based Programming', 'Real-time Preview', 'Pre-built Templates', 'Export Options'],
    safetyFeatures: ['No Internet Access', 'Filtered Content', 'Teacher Dashboard', 'Session Recording'],
    learningObjectives: ['Understand AI workflow', 'Learn pattern recognition', 'Practice logical thinking'],
    isActive: false
  },
  {
    id: 'data-detective',
    title: 'Data Detective',
    description: 'Interactive data analysis and visualization tool for young learners',
    type: 'data-analysis',
    gradeLevel: 'middle',
    duration: '60 min',
    difficulty: 'Intermediate',
    features: ['Interactive Charts', 'Data Import', 'Statistical Tools', 'Collaborative Features'],
    safetyFeatures: ['Sandboxed Environment', 'Data Privacy Protection', 'Content Moderation', 'Usage Analytics'],
    learningObjectives: ['Data interpretation skills', 'Statistical reasoning', 'Critical thinking'],
    isActive: true
  },
  {
    id: 'neural-playground',
    title: 'Neural Network Playground',
    description: 'Visual neural network simulator for understanding deep learning concepts',
    type: 'neural-network',
    gradeLevel: 'high',
    duration: '90 min',
    difficulty: 'Advanced',
    features: ['Interactive Neurons', 'Training Visualization', 'Parameter Adjustment', 'Performance Metrics'],
    safetyFeatures: ['Controlled Parameters', 'Safe Datasets', 'Guided Tutorials', 'Progress Tracking'],
    learningObjectives: ['Neural network architecture', 'Training processes', 'Model optimization'],
    isActive: false
  },
  {
    id: 'ai-robot-sim',
    title: 'AI Robot Simulator',
    description: 'Virtual robotics environment with AI-powered autonomous behaviors',
    type: 'robotics',
    gradeLevel: 'middle',
    duration: '75 min',
    difficulty: 'Intermediate',
    features: ['3D Environment', 'Sensor Simulation', 'Behavior Programming', 'Challenge Scenarios'],
    safetyFeatures: ['Virtual Environment', 'Safe Interactions', 'Supervised Learning', 'Error Prevention'],
    learningObjectives: ['Robotics principles', 'AI decision making', 'Problem solving'],
    isActive: false
  },
  {
    id: 'language-lab',
    title: 'AI Language Lab',
    description: 'Natural language processing experiments in a controlled environment',
    type: 'nlp',
    gradeLevel: 'high',
    duration: '60 min',
    difficulty: 'Advanced',
    features: ['Text Analysis', 'Sentiment Detection', 'Language Models', 'Translation Tools'],
    safetyFeatures: ['Content Filtering', 'Privacy Protection', 'Ethical Guidelines', 'Supervised Access'],
    learningObjectives: ['Language understanding', 'AI communication', 'Ethical considerations'],
    isActive: true
  },
  {
    id: 'vision-explorer',
    title: 'Computer Vision Explorer',
    description: 'Image recognition and computer vision concepts through interactive demos',
    type: 'computer-vision',
    gradeLevel: 'middle',
    duration: '50 min',
    difficulty: 'Intermediate',
    features: ['Image Processing', 'Object Detection', 'Feature Recognition', 'Real-time Analysis'],
    safetyFeatures: ['Curated Images', 'No Camera Access', 'Safe Recognition', 'Teacher Controls'],
    learningObjectives: ['Visual perception', 'Pattern recognition', 'AI applications'],
    isActive: false
  }
];

const typeIcons = {
  'visual-programming': Code,
  'data-analysis': Database,
  'neural-network': Brain,
  'robotics': Cpu,
  'nlp': Zap,
  'computer-vision': Eye
};

const typeColors = {
  'visual-programming': 'bg-blue-500',
  'data-analysis': 'bg-green-500',
  'neural-network': 'bg-purple-500',
  'robotics': 'bg-orange-500',
  'nlp': 'bg-pink-500',
  'computer-vision': 'bg-indigo-500'
};

const gradeLevelColors = {
  elementary: 'bg-green-100 text-green-800',
  middle: 'bg-blue-100 text-blue-800',
  high: 'bg-purple-100 text-purple-800'
};

export const SafeEmulators: React.FC = () => {
  const { isAdminMode } = useCurriculum();
  const [selectedEmulator, setSelectedEmulator] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<GradeLevel | 'all'>('all');
  const [filterType, setFilterType] = useState<EmulatorType | 'all'>('all');
  const [editingEmulator, setEditingEmulator] = useState<string | null>(null);
  const [emulatorList, setEmulatorList] = useState(emulators);

  const addNewEmulator = () => {
    const newEmulator: Emulator = {
      id: `emulator-${Date.now()}`,
      title: 'New Emulator',
      description: 'Emulator description',
      type: 'visual-programming',
      gradeLevel: 'elementary',
      duration: '30 min',
      difficulty: 'Beginner',
      features: ['New Feature'],
      safetyFeatures: ['Safe Feature'],
      learningObjectives: ['Learning Objective'],
      isActive: false
    };
    setEmulatorList([...emulatorList, newEmulator]);
    setEditingEmulator(newEmulator.id);
  };

  const filteredEmulators = emulatorList.filter(emulator => {
    const gradeMatch = filterGrade === 'all' || emulator.gradeLevel === filterGrade;
    const typeMatch = filterType === 'all' || emulator.type === filterType;
    return gradeMatch && typeMatch;
  });

  const activeEmulators = emulatorList.filter(e => e.isActive).length;

  const startEmulator = (emulatorId: string) => {
    // Simulate starting an emulator
    console.log(`Starting emulator: ${emulatorId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Shield className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Safe & Secure Emulators</h1>
              <p className="text-lg opacity-90 mt-1">Guided AI simulations in protected environments</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{activeEmulators}</div>
            <div className="text-sm opacity-75">Active Sessions</div>
          </div>
        </div>
      </div>

      {/* Safety Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Safety & Security Features</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Lock, title: 'Sandboxed Environment', description: 'Isolated execution prevents system access' },
            { icon: Eye, title: 'Teacher Monitoring', description: 'Real-time oversight and session recording' },
            { icon: Shield, title: 'Content Filtering', description: 'Age-appropriate and curriculum-aligned content' },
            { icon: Users, title: 'Supervised Learning', description: 'Guided experiences with safety guardrails' }
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <Icon className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter Emulators</h3>
            <p className="text-sm text-gray-600">Find the right simulation for your curriculum needs</p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 items-end">
            {isAdminMode && (
              <button
                onClick={addNewEmulator}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Emulator</span>
              </button>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Grade Level</label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="all">All Grades</option>
                <option value="elementary">Elementary</option>
                <option value="middle">Middle School</option>
                <option value="high">High School</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="visual-programming">Visual Programming</option>
                <option value="data-analysis">Data Analysis</option>
                <option value="neural-network">Neural Networks</option>
                <option value="robotics">Robotics</option>
                <option value="nlp">Natural Language</option>
                <option value="computer-vision">Computer Vision</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Emulators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredEmulators.map((emulator) => {
          const TypeIcon = typeIcons[emulator.type];
          const isSelected = selectedEmulator === emulator.id;
          const isEditing = editingEmulator === emulator.id;
          
          return (
            <div key={emulator.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all relative group">
              {isAdminMode && !isEditing && (
                <button
                  onClick={() => setEditingEmulator(emulator.id)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all z-10"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 ${typeColors[emulator.type]} rounded-lg`}>
                      <TypeIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={emulator.title}
                            onChange={(e) => {
                              const updatedEmulators = emulatorList.map(em => 
                                em.id === emulator.id ? { ...em, title: e.target.value } : em
                              );
                              setEmulatorList(updatedEmulators);
                            }}
                            className="text-xl font-semibold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none w-full mb-2"
                          />
                          <textarea
                            value={emulator.description}
                            onChange={(e) => {
                              const updatedEmulators = emulatorList.map(em => 
                                em.id === emulator.id ? { ...em, description: e.target.value } : em
                              );
                              setEmulatorList(updatedEmulators);
                            }}
                            rows={2}
                            className="w-full text-gray-600 text-sm bg-transparent border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </>
                      ) : (
                        <>
                          <h3 className="text-xl font-semibold text-gray-900">{emulator.title}</h3>
                          <p className="text-gray-600 text-sm">{emulator.description}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {emulator.isActive && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Active</span>
                      </div>
                    )}
                    {isEditing && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingEmulator(null)}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingEmulator(null)}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mb-4 grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      <select
                        value={emulator.gradeLevel}
                        onChange={(e) => {
                          const updatedEmulators = emulatorList.map(em => 
                            em.id === emulator.id ? { ...em, gradeLevel: e.target.value as GradeLevel } : em
                          );
                          setEmulatorList(updatedEmulators);
                        }}
                        className="bg-transparent text-xs focus:outline-none"
                      >
                        <option value="elementary">Elementary</option>
                        <option value="middle">Middle</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={emulator.duration}
                      onChange={(e) => {
                        const updatedEmulators = emulatorList.map(em => 
                          em.id === emulator.id ? { ...em, duration: e.target.value } : em
                        );
                        setEmulatorList(updatedEmulators);
                      }}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <select
                      value={emulator.difficulty}
                      onChange={(e) => {
                        const updatedEmulators = emulatorList.map(em => 
                          em.id === emulator.id ? { ...em, difficulty: e.target.value as any } : em
                        );
                        setEmulatorList(updatedEmulators);
                      }}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center space-x-4 mb-4 text-sm">
                  <span className={`px-2 py-1 rounded-full ${gradeLevelColors[emulator.gradeLevel]}`}>
                    {emulator.gradeLevel.charAt(0).toUpperCase() + emulator.gradeLevel.slice(1)}
                  </span>
                  <div className="flex items-center space-x-1 text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{emulator.duration}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-500">
                    <Star className="w-4 h-4" />
                    <span>{emulator.difficulty}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Key Features</h4>
                    <div className="flex flex-wrap gap-2">
                      {emulator.features.slice(0, 3).map((feature, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {feature}
                        </span>
                      ))}
                      {emulator.features.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          +{emulator.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Safety Features</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {emulator.safetyFeatures.slice(0, 4).map((safety, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span>{safety}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedEmulator(isSelected ? null : emulator.id)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    {isSelected ? 'Hide Details' : 'View Details'}
                  </button>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEmulator(emulator.id)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <Play className="w-4 h-4" />
                      <span>Launch</span>
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Learning Objectives</h4>
                        <ul className="space-y-2">
                          {emulator.learningObjectives.map((objective, index) => (
                            <li key={index} className="flex items-start space-x-2 text-sm text-gray-600">
                              <Target className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{objective}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">All Features</h4>
                        <ul className="space-y-2">
                          {emulator.features.map((feature, index) => (
                            <li key={index} className="flex items-start space-x-2 text-sm text-gray-600">
                              <CheckCircle className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
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

      {/* Usage Guidelines */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-orange-600 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Usage Guidelines & Best Practices</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">For Teachers</h3>
            <ul className="space-y-2">
              {[
                'Review emulator content before student use',
                'Monitor student sessions actively',
                'Establish clear usage guidelines',
                'Debrief after simulation sessions',
                'Document learning outcomes'
              ].map((guideline, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>{guideline}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">For Students</h3>
            <ul className="space-y-2">
              {[
                'Follow teacher instructions carefully',
                'Report any unusual behavior immediately',
                'Respect simulation environment limits',
                'Focus on learning objectives',
                'Ask questions when uncertain'
              ].map((guideline, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>{guideline}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};