import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { BookOpen, Clock, Target, Users, Monitor, CheckCircle, Lightbulb, Play, ArrowRight, Calendar, FileText, Download, Printer, Share2, Edit3, Save, X, Plus, Trash2, ChevronRight, ChevronDown, Award, Brain, Database, Wrench, Shield, Globe, Star, Sparkles, Video, TowerControl as GameController2, MessageCircle, Presentation as PresentationChart, Zap } from 'lucide-react';

interface LessonPlan {
  id: string;
  gradeId: string;
  lessonId: string;
  learningHours: number;
  createdAt: string;
  activities: LessonPlanActivity[];
}

interface LessonPlanActivity {
  id: string;
  title: string;
  type: 'classroom' | 'online' | 'assessment' | 'project';
  duration: number;
  description: string;
  aiStrands: string[];
  unescoCompetencies: string[];
  order: number;
  materials: string[];
  instructions: string[];
  isAISuggested?: boolean;
}

const activityTypeConfig = {
  classroom: { icon: Users, color: 'bg-blue-100 text-blue-800', label: 'Classroom', bgColor: 'bg-blue-50' },
  online: { icon: Monitor, color: 'bg-green-100 text-green-800', label: 'Online', bgColor: 'bg-green-50' },
  assessment: { icon: CheckCircle, color: 'bg-orange-100 text-orange-800', label: 'Assessment', bgColor: 'bg-orange-50' },
  project: { icon: Lightbulb, color: 'bg-purple-100 text-purple-800', label: 'Project', bgColor: 'bg-purple-50' }
};

const aiSuggestedActivities = [
  {
    id: 'ai-group-discussion',
    title: 'AI Ethics Group Discussion',
    type: 'classroom' as const,
    description: 'Students discuss ethical implications of AI in small groups and present findings',
    baseMinutes: 25,
    materials: ['Discussion prompt cards', 'Flip chart paper', 'Markers', 'Timer'],
    instructions: [
      'Divide class into groups of 4-5 students',
      'Provide each group with AI ethics scenario cards',
      'Allow 15 minutes for group discussion and preparation',
      'Have each group present their conclusions (2-3 minutes each)',
      'Facilitate whole-class reflection on different perspectives'
    ],
    aiStrands: ['strand-4', 'strand-7'],
    unescoCompetencies: ['4.2.1', '4.1.3']
  },
  {
    id: 'ai-learning-game',
    title: 'AI Pattern Recognition Game',
    type: 'classroom' as const,
    description: 'Interactive game where students identify patterns like AI algorithms do',
    baseMinutes: 20,
    materials: ['Pattern cards', 'Game boards', 'Tokens', 'Answer sheets'],
    instructions: [
      'Explain how AI systems recognize patterns in data',
      'Demonstrate the game with a simple example',
      'Students work in pairs to identify increasingly complex patterns',
      'Discuss how this relates to machine learning',
      'Connect to real-world AI applications'
    ],
    aiStrands: ['strand-1', 'strand-2'],
    unescoCompetencies: ['4.3.1', '4.1.1']
  },
  {
    id: 'ai-video-analysis',
    title: 'AI in Daily Life Video Analysis',
    type: 'online' as const,
    description: 'Watch and analyze videos showing AI applications in everyday situations',
    baseMinutes: 30,
    materials: ['Video playlist', 'Analysis worksheets', 'Computers/tablets', 'Headphones'],
    instructions: [
      'Introduce the video series and learning objectives',
      'Students watch videos individually or in pairs',
      'Complete analysis worksheet identifying AI applications',
      'Discuss findings in small groups',
      'Create a class mind map of AI in daily life'
    ],
    aiStrands: ['strand-5', 'strand-1'],
    unescoCompetencies: ['4.1.1', '4.3.1']
  },
  {
    id: 'ai-design-challenge',
    title: 'Design an AI Solution',
    type: 'project' as const,
    description: 'Students design an AI solution for a real-world problem in their community',
    baseMinutes: 45,
    materials: ['Design thinking templates', 'Poster paper', 'Colored pens', 'Sticky notes'],
    instructions: [
      'Present a community problem that could benefit from AI',
      'Guide students through design thinking process',
      'Students brainstorm AI-powered solutions',
      'Create visual prototypes of their AI system',
      'Present solutions to class for feedback'
    ],
    aiStrands: ['strand-6', 'strand-1', 'strand-4'],
    unescoCompetencies: ['4.1.4', '4.3.3', '4.2.3']
  },
  {
    id: 'ai-data-storytelling',
    title: 'Tell Stories with Data',
    type: 'classroom' as const,
    description: 'Students learn how AI uses data by creating stories from simple datasets',
    baseMinutes: 35,
    materials: ['Sample datasets', 'Chart paper', 'Calculators', 'Presentation materials'],
    instructions: [
      'Introduce concept of data storytelling',
      'Provide students with age-appropriate datasets',
      'Guide them to find patterns and trends',
      'Students create visual stories from their data',
      'Present findings and discuss how AI might use similar data'
    ],
    aiStrands: ['strand-2', 'strand-3'],
    unescoCompetencies: ['4.3.1', '4.3.2']
  },
  {
    id: 'ai-bias-detective',
    title: 'AI Bias Detective Activity',
    type: 'assessment' as const,
    description: 'Students identify potential bias in AI systems through case study analysis',
    baseMinutes: 25,
    materials: ['Case study handouts', 'Detective worksheets', 'Magnifying glasses (props)', 'Evidence charts'],
    instructions: [
      'Explain concept of AI bias in age-appropriate terms',
      'Provide case studies of AI systems with potential bias',
      'Students work as "bias detectives" to identify issues',
      'Complete evidence charts with their findings',
      'Discuss solutions and prevention strategies'
    ],
    aiStrands: ['strand-4', 'strand-7'],
    unescoCompetencies: ['4.2.1', '4.2.2']
  },
  {
    id: 'ai-future-presentation',
    title: 'AI Future Scenarios Presentation',
    type: 'project' as const,
    description: 'Students research and present on how AI might change society in the future',
    baseMinutes: 40,
    materials: ['Research templates', 'Presentation software', 'Props/costumes', 'Evaluation rubrics'],
    instructions: [
      'Assign different future scenarios to student groups',
      'Provide research guidelines and reliable sources',
      'Students prepare creative presentations (skits, talks, demos)',
      'Include both benefits and challenges of AI advancement',
      'Audience provides feedback using structured rubrics'
    ],
    aiStrands: ['strand-7', 'strand-5'],
    unescoCompetencies: ['4.1.3', '4.2.3']
  },
  {
    id: 'ai-algorithm-dance',
    title: 'Algorithm Dance Challenge',
    type: 'classroom' as const,
    description: 'Students create dance sequences to understand how algorithms work step-by-step',
    baseMinutes: 30,
    materials: ['Music player', 'Algorithm cards', 'Space for movement', 'Video recording device'],
    instructions: [
      'Explain algorithms as step-by-step instructions',
      'Demonstrate with a simple dance sequence',
      'Students create their own "algorithm dances"',
      'Other students follow the dance algorithms',
      'Discuss how this relates to computer programming and AI'
    ],
    aiStrands: ['strand-1', 'strand-3'],
    unescoCompetencies: ['4.3.1', '4.1.1']
  }
];
const strandIcons = {
  'strand-1': Brain,
  'strand-2': Database,
  'strand-3': Wrench,
  'strand-4': Shield,
  'strand-5': Globe,
  'strand-6': Lightbulb,
  'strand-7': Users
};

const strandColors = {
  'strand-1': 'bg-blue-500',
  'strand-2': 'bg-green-500',
  'strand-3': 'bg-purple-500',
  'strand-4': 'bg-red-500',
  'strand-5': 'bg-yellow-500',
  'strand-6': 'bg-pink-500',
  'strand-7': 'bg-indigo-500'
};

export const LessonPlanning: React.FC = () => {
  const { data } = useCurriculum();
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [learningHours, setLearningHours] = useState<number>(60);
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlan | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<string[]>([]);
  const [includeAISuggestions, setIncludeAISuggestions] = useState<boolean>(true);

  const selectedGradeData = selectedGrade ? data.grades.find(g => g.id === selectedGrade) : null;
  const selectedLessonData = selectedLesson && selectedGradeData 
    ? (selectedGradeData.lessons || []).find(l => l.id === selectedLesson) 
    : null;

  const generateLessonPlan = () => {
    if (!selectedGradeData || !selectedLessonData) return;

    let baseActivities = (selectedLessonData.activities || []);
    let allActivities = [...baseActivities];
    
    // Add AI-suggested activities if enabled and needed
    if (includeAISuggestions) {
      const currentDuration = baseActivities.reduce((total, activity) => total + activity.duration, 0);
      const remainingTime = learningHours - currentDuration;
      
      if (remainingTime > 15 || baseActivities.length < 2) {
        // Select appropriate AI activities based on grade level and remaining time
        const suitableActivities = selectAISuggestedActivities(selectedGradeData, remainingTime);
        allActivities = [...baseActivities, ...suitableActivities];
      }
    }
    
    const totalActivityDuration = allActivities.reduce((total, activity) => total + activity.duration, 0);
    const scaleFactor = totalActivityDuration > 0 ? learningHours / totalActivityDuration : 1;

    const planActivities: LessonPlanActivity[] = allActivities.map((activity, index) => ({
      id: activity.id,
      title: activity.title,
      type: activity.type,
      duration: Math.round(activity.duration * scaleFactor),
      description: activity.description,
      aiStrands: activity.aiStrands || [],
      unescoCompetencies: activity.unescoCompetencies || [],
      order: index + 1,
      materials: activity.materials || generateMaterials(activity.type),
      instructions: activity.instructions || generateInstructions(activity.type, activity.title),
      isAISuggested: activity.isAISuggested || false
    }));

    const lessonPlan: LessonPlan = {
      id: `plan-${Date.now()}`,
      gradeId: selectedGrade,
      lessonId: selectedLesson,
      learningHours,
      createdAt: new Date().toISOString(),
      activities: planActivities
    };

    setGeneratedPlan(lessonPlan);
  };

  const selectAISuggestedActivities = (grade: any, remainingTime: number) => {
    const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
    let selectedActivities: any[] = [];
    
    // Filter activities based on grade level appropriateness
    let suitableActivities = aiSuggestedActivities.filter(activity => {
      if (!gradeBand) return true;
      
      // Age-appropriate filtering
      if (gradeBand.id === 'early-years') {
        return ['ai-learning-game', 'ai-algorithm-dance', 'ai-video-analysis'].includes(activity.id);
      } else if (gradeBand.id === 'elementary') {
        return !['ai-bias-detective', 'ai-future-presentation'].includes(activity.id);
      }
      return true; // All activities suitable for middle/high school
    });
    
    // Select activities that fit within remaining time
    let timeUsed = 0;
    for (const activity of suitableActivities) {
      if (timeUsed + activity.baseMinutes <= remainingTime + 10) { // 10 min buffer
        selectedActivities.push({
          ...activity,
          duration: activity.baseMinutes,
          isAISuggested: true
        });
        timeUsed += activity.baseMinutes;
        
        if (selectedActivities.length >= 3) break; // Max 3 suggested activities
      }
    }
    
    return selectedActivities;
  };
  const generateMaterials = (type: string): string[] => {
    const baseMaterials = ['Whiteboard/Projector', 'Student worksheets', 'Timer'];
    
    switch (type) {
      case 'online':
        return [...baseMaterials, 'Computers/Tablets', 'Internet access', 'Online platform login'];
      case 'project':
        return [...baseMaterials, 'Project materials', 'Collaboration tools', 'Presentation equipment'];
      case 'assessment':
        return [...baseMaterials, 'Assessment rubrics', 'Feedback forms', 'Recording sheets'];
      default:
        return baseMaterials;
    }
  };

  const generateInstructions = (type: string, title: string): string[] => {
    const baseInstructions = [
      'Begin with a brief review of previous learning',
      'Introduce the activity objectives clearly',
      'Provide step-by-step guidance throughout'
    ];

    switch (type) {
      case 'online':
        return [
          ...baseInstructions,
          'Ensure all students can access the online platform',
          'Monitor student progress through digital tools',
          'Provide technical support as needed'
        ];
      case 'project':
        return [
          ...baseInstructions,
          'Form appropriate groups or individual assignments',
          'Set clear project milestones and deadlines',
          'Facilitate collaboration and peer feedback'
        ];
      case 'assessment':
        return [
          ...baseInstructions,
          'Explain assessment criteria clearly',
          'Provide examples of expected outcomes',
          'Offer formative feedback during the process'
        ];
      default:
        return [
          ...baseInstructions,
          'Encourage active participation from all students',
          'Use questioning techniques to check understanding',
          'Summarize key learning points at the end'
        ];
    }
  };

  const toggleActivityExpansion = (activityId: string) => {
    setExpandedActivities(prev => 
      prev.includes(activityId) 
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const exportLessonPlan = () => {
    if (!generatedPlan) return;
    
    const planData = {
      ...generatedPlan,
      gradeName: selectedGradeData?.name,
      lessonTitle: selectedLessonData?.title,
      exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(planData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `lesson-plan-${selectedGradeData?.name}-${selectedLessonData?.title}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lesson Planning</h1>
              <p className="text-lg opacity-90 mt-1">Create structured lesson plans from curriculum activities</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{data.grades.length}</div>
            <div className="text-sm opacity-75">Grades Available</div>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Lesson Plan</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Grade Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Grade</label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedLesson('');
                setGeneratedPlan(null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choose a grade...</option>
              {data.grades.map((grade) => {
                const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                return (
                  <option key={grade.id} value={grade.id}>
                    {grade.name} - {gradeBand?.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Lesson Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Lesson</label>
            <select
              value={selectedLesson}
              onChange={(e) => {
                setSelectedLesson(e.target.value);
                setGeneratedPlan(null);
              }}
              disabled={!selectedGrade}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            >
              <option value="">Choose a lesson...</option>
              {(selectedGradeData?.lessons || []).map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title} ({(lesson.activities || []).length} activities)
                </option>
              ))}
            </select>
          </div>

          {/* Learning Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learning Hours (minutes)</label>
            <input
              type="number"
              value={learningHours}
              onChange={(e) => {
                setLearningHours(parseInt(e.target.value) || 60);
                setGeneratedPlan(null);
              }}
              min="15"
              max="480"
              step="15"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 45-90 minutes</p>
          </div>
        </div>

        {/* AI Suggestions Toggle */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI-Powered Activity Suggestions</h3>
                <p className="text-sm text-gray-600">Enhance your lesson with AI-suggested activities when needed</p>
              </div>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAISuggestions}
                onChange={(e) => {
                  setIncludeAISuggestions(e.target.checked);
                  setGeneratedPlan(null);
                }}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable AI Suggestions</span>
            </label>
          </div>
          
          {includeAISuggestions && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Users, label: 'Group Activities', color: 'text-blue-600' },
                { icon: MessageCircle, label: 'Discussions', color: 'text-green-600' },
                { icon: GameController2, label: 'Learning Games', color: 'text-purple-600' },
                { icon: Video, label: 'Video Analysis', color: 'text-red-600' }
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-gray-700">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Generate Button */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedLessonData && (
              <div className="flex items-center space-x-4">
                <span>Original duration: {(selectedLessonData.activities || []).reduce((total, activity) => total + activity.duration, 0)} minutes</span>
                <span>•</span>
                <span>Activities: {(selectedLessonData.activities || []).length}</span>
                {includeAISuggestions && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 font-medium">AI suggestions enabled</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={generateLessonPlan}
            disabled={!selectedGrade || !selectedLesson}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md relative"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                {includeAISuggestions ? <Sparkles className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>Generate Lesson Plan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Lesson Plan */}
      {generatedPlan && (
        <div className="space-y-6">
          {/* Plan Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedLessonData?.title}</h2>
                <p className="text-gray-600">{selectedGradeData?.name} • {generatedPlan.learningHours} minutes</p>
                <p className="text-sm text-gray-500 mt-1">Generated on {new Date(generatedPlan.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={exportLessonPlan}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Plan Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{generatedPlan.learningHours}</div>
                <div className="text-sm text-gray-600">Total Minutes</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{generatedPlan.activities.length}</div>
                <div className="text-sm text-gray-600">Activities</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  {[...new Set(generatedPlan.activities.flatMap(a => a.aiStrands))].length}
                </div>
                <div className="text-sm text-gray-600">AI Strands</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <Globe className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-600">
                  {[...new Set(generatedPlan.activities.flatMap(a => a.unescoCompetencies))].length}
                </div>
                <div className="text-sm text-gray-600">UNESCO Goals</div>
              </div>
            </div>
          </div>

          {/* Learning Pathway */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Learning Pathway</h3>
            
            <div className="space-y-4">
              {generatedPlan.activities.map((activity, index) => {
                const typeConfig = activityTypeConfig[activity.type];
                const TypeIcon = typeConfig.icon;
                const isExpanded = expandedActivities.includes(activity.id);
                
                return (
                  <div key={activity.id} className={`border-2 rounded-xl overflow-hidden ${typeConfig.bgColor} border-gray-200 relative`}>
                    {/* Activity Number Badge */}
                    <div className={`absolute -left-4 top-6 w-8 h-8 ${activity.isAISuggested ? 'bg-blue-600' : 'bg-green-600'} text-white rounded-full flex items-center justify-center text-sm font-bold z-10`}>
                      {activity.order}
                      {activity.isAISuggested && (
                        <Sparkles className="w-3 h-3 absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full p-0.5" />
                      )}
                    </div>
                    
                    {/* Connection Line */}
                    {index < generatedPlan.activities.length - 1 && (
                      <div className={`absolute -left-4 top-14 w-0.5 h-16 ${activity.isAISuggested ? 'bg-blue-300' : 'bg-green-300'}`}></div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-lg ${typeConfig.color.replace('text-', 'bg-').replace('-800', '-600')} text-white`}>
                            <TypeIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-lg font-semibold text-gray-900">{activity.title}</h4>
                              {activity.isAISuggested && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center space-x-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>AI Suggested</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className={`px-2 py-1 rounded-full ${typeConfig.color}`}>
                                {typeConfig.label}
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{activity.duration} minutes</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => toggleActivityExpansion(activity.id)}
                          className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      <p className="text-gray-700 mb-4">{activity.description}</p>
                      
                      {/* AI Strands and UNESCO Competencies */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 mb-2">AI Strands</h5>
                          <div className="flex flex-wrap gap-2">
                            {activity.aiStrands.map((strandId) => {
                              const strand = data.aiStrands.find(s => s.id === strandId);
                              const StrandIcon = strandIcons[strandId as keyof typeof strandIcons];
                              return strand ? (
                                <div key={strandId} className="flex items-center space-x-2 px-2 py-1 bg-white rounded border">
                                  <div className={`p-1 rounded ${strandColors[strandId as keyof typeof strandColors]} text-white`}>
                                    <StrandIcon className="w-3 h-3" />
                                  </div>
                                  <span className="text-xs font-medium">{strand.code}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 mb-2">UNESCO Competencies</h5>
                          <div className="flex flex-wrap gap-2">
                            {activity.unescoCompetencies.map((goalCode) => {
                              const baseCode = goalCode.split('.').slice(0, 3).join('.');
                              const comp = data.unescoCompetencies.find(c => c.code === baseCode);
                              return comp ? (
                                <div key={goalCode} className="flex items-center space-x-2 px-2 py-1 bg-white rounded border border-blue-200">
                                  <span className="text-xs font-medium text-blue-700">{goalCode}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Required Materials</h5>
                              <ul className="space-y-2">
                                {activity.materials.map((material, idx) => (
                                  <li key={idx} className="flex items-center space-x-2 text-sm text-gray-700">
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    <span>{material}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 mb-3">Teaching Instructions</h5>
                              <ol className="space-y-2">
                                {activity.instructions.map((instruction, idx) => (
                                  <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                                    <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                      {idx + 1}
                                    </span>
                                    <span>{instruction}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">AI-Enhanced Lesson Planning</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Select the grade level from your configured grades</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Choose a specific lesson with its activities</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Set your available learning time in minutes</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Enable AI suggestions for enhanced activities</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>Generate your structured lesson plan</span>
              </li>
            </ol>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">AI-Enhanced Features</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Automatic time scaling based on your available hours</span>
              </li>
              <li className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>AI-suggested activities when lesson needs enhancement</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Learning pathway with sequential activities</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>AI strand and UNESCO competency mapping</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Generated materials list and teaching instructions</span>
              </li>
              <li className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span>Age-appropriate activity suggestions</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Export and print functionality</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span>AI Activity Types</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Group Discussions</span>
            </div>
            <div className="flex items-center space-x-2">
              <GameController2 className="w-4 h-4 text-purple-600" />
              <span>Learning Games</span>
            </div>
            <div className="flex items-center space-x-2">
              <Video className="w-4 h-4 text-red-600" />
              <span>Video Analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <PresentationChart className="w-4 h-4 text-green-600" />
              <span>Design Challenges</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};