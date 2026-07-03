import React, { useState } from 'react';
import { CurriculumProvider, useCurriculum } from './context/CurriculumContext';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { Header } from './components/Header';
import { GradeBandOverview } from './components/GradeBandOverview';
import { GradeConfiguration } from './components/GradeConfiguration';
import { AIStrandsMatrix } from './components/AIStrandsMatrix';
import { GradeCompetencies } from './components/GradeCompetencies';
import { LearningProgressionIndicators } from './components/LearningProgressionIndicators';
import { CrossCuttingCompetencies } from './components/CrossCuttingCompetencies';
import { HomePage } from './components/HomePage';
import { TeacherPD } from './components/TeacherPD';
import { SafeEmulators } from './components/SafeEmulators';
import { UNESCOFramework } from './components/UNESCOFramework';
import { LessonPlanning } from './components/LessonPlanning';
import { 
  BarChart3, 
  Grid3X3, 
  Target, 
  TrendingUp, 
  Layers, 
  BookOpen,
  Home,
  GraduationCap,
  Shield,
  Globe,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

type TabType = 'home' | 'overview' | 'grades' | 'unesco-framework' | 'ai-strands' | 'competencies' | 'progression-indicators' | 'cross-cutting' | 'teacher-pd' | 'safe-emulators' | 'lesson-planning';

const menuStructure = [
  { id: 'home', name: 'Home', icon: Home, type: 'single' as const },
  { id: 'overview', name: 'Overview', icon: BarChart3, type: 'single' as const },
  { id: 'grades', name: 'Grade Config', icon: BookOpen, type: 'single' as const },
  { 
    id: 'frameworks', 
    name: 'AI Frameworks', 
    icon: Grid3X3, 
    type: 'dropdown' as const,
    subItems: [
      { id: 'unesco-framework', name: 'UNESCO AI Framework', icon: Globe },
      { id: 'ai-strands', name: 'AI Strands Matrix', icon: Grid3X3 }
    ]
  },
  { id: 'competencies', name: 'Competencies', icon: Target, type: 'single' as const },
  { 
    id: 'progressions', 
    name: 'Learning Progressions', 
    icon: TrendingUp, 
    type: 'dropdown' as const,
    subItems: [
      { id: 'progression-indicators', name: 'Progression Indicators', icon: TrendingUp },
      { id: 'cross-cutting', name: 'Cross-Cutting Competencies', icon: Layers }
    ]
  },
  { 
    id: 'support', 
    name: 'Support & Tools', 
    icon: GraduationCap, 
    type: 'dropdown' as const,
    subItems: [
      { id: 'teacher-pd', name: 'Teacher Professional Development', icon: GraduationCap },
      { id: 'safe-emulators', name: 'Safe & Secure Emulators', icon: Shield },
      { id: 'lesson-planning', name: 'Lesson Planning', icon: BookOpen }
    ]
  }
];

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  return (
    <CurriculumProvider>
      <AppContent 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMenuExpanded={isMenuExpanded}
        setIsMenuExpanded={setIsMenuExpanded}
        activePopup={activePopup}
        setActivePopup={setActivePopup}
      />
    </CurriculumProvider>
  );
}

const AppContent: React.FC<{
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isMenuExpanded: boolean;
  setIsMenuExpanded: (expanded: boolean) => void;
  activePopup: string | null;
  setActivePopup: (popup: string | null) => void;
}> = ({ 
  activeTab, 
  setActiveTab, 
  isMenuExpanded, 
  setIsMenuExpanded, 
  activePopup, 
  setActivePopup 
}) => {
  const { isLoading, error } = useCurriculum();

  const getCurrentPageName = () => {
    // Check if it's a top-level menu item
    const topLevelItem = menuStructure.find(item => item.id === activeTab);
    if (topLevelItem) {
      return topLevelItem.name;
    }
    
    // Check if it's a sub-item within a dropdown
    for (const menuItem of menuStructure) {
      if (menuItem.subItems) {
        const subItem = menuItem.subItems.find(sub => sub.id === activeTab);
        if (subItem) {
          return subItem.name;
        }
      }
    }
    
    return 'Home';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <GradeBandOverview />;
      case 'grades':
        return <GradeConfiguration />;
      case 'unesco-framework':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">UNESCO AI Competency Framework</h2>
              <p className="text-gray-600 mb-8">Official UNESCO framework for AI literacy in K-12 education</p>
            </div>
            <UNESCOFramework />
          </div>
        );
      case 'ai-strands':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Strands Coverage Matrix</h2>
              <p className="text-gray-600 mb-8">Visual allocation of curriculum time across the 7 AI strands</p>
            </div>
            <AIStrandsMatrix />
          </div>
        );
      case 'competencies':
        return <GradeCompetencies />;
      case 'progression-indicators':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Learning Progression Indicators</h2>
              <p className="text-gray-600 mb-8">Strand-specific progression indicators for each grade band</p>
            </div>
            <LearningProgressionIndicators />
          </div>
        );
      case 'cross-cutting':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Cross-Cutting Competencies</h2>
              <p className="text-gray-600 mb-8">Four essential competency components across all grade bands</p>
            </div>
            <CrossCuttingCompetencies />
          </div>
        );
      case 'teacher-pd':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Teacher Professional Development</h2>
              <p className="text-gray-600 mb-8">Empowering educators for AI curriculum delivery</p>
            </div>
            <TeacherPD />
          </div>
        );
      case 'safe-emulators':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Safe & Secure Emulators</h2>
              <p className="text-gray-600 mb-8">Guided AI simulations in protected environments</p>
            </div>
            <SafeEmulators />
          </div>
        );
      case 'lesson-planning':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Lesson Planning</h2>
              <p className="text-gray-600 mb-8">Create structured lesson plans based on curriculum activities</p>
            </div>
            <LessonPlanning />
          </div>
        );
      default:
        return <HomePage />;
    }
  };

  const handleMenuClick = (menuId: string) => {
    const menuItem = menuStructure.find(item => item.id === menuId);
    if (menuItem?.type === 'single') {
      setActiveTab(menuId as TabType);
      setIsMenuExpanded(false);
      setActivePopup(null);
    } else if (menuItem?.type === 'dropdown') {
      setActivePopup(activePopup === menuId ? null : menuId);
    }
  };

  const handleSubItemClick = (subItemId: string) => {
    setActiveTab(subItemId as TabType);
    setActivePopup(null);
    setIsMenuExpanded(false);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <Header />

        {/* Navigation */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              {/* Menu Toggle Button */}
              <button
                onClick={() => setIsMenuExpanded(!isMenuExpanded)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isMenuExpanded ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
                <span className="font-medium">
                  {isMenuExpanded ? 'Close Menu' : 'Open Menu'}
                </span>
              </button>

              {/* Current Page Indicator */}
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="text-sm">Current:</span>
                <span className="font-medium text-gray-900">
                  {getCurrentPageName()}
                </span>
              </div>
            </div>

            {/* Expandable Menu */}
            {isMenuExpanded && (
              <div className="border-t border-gray-200 py-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {menuStructure.map((menuItem) => {
                    const Icon = menuItem.icon;
                    const isActive = menuItem.type === 'single' 
                      ? activeTab === menuItem.id
                      : menuItem.subItems?.some(sub => activeTab === sub.id);
                    
                    return (
                      <div key={menuItem.id} className="relative">
                        <button
                          onClick={() => handleMenuClick(menuItem.id)}
                          className={`w-full flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                            isActive
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <Icon className="w-6 h-6 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <div className="font-medium">{menuItem.name}</div>
                            {menuItem.type === 'dropdown' && (
                              <div className="text-xs text-gray-500 mt-1">
                                {menuItem.subItems?.length} options
                              </div>
                            )}
                          </div>
                          {menuItem.type === 'dropdown' && (
                            <ChevronDown className="w-4 h-4 flex-shrink-0" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Popup Cards for Sub-menus */}
        {activePopup && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setActivePopup(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      {(() => {
                        const menuItem = menuStructure.find(item => item.id === activePopup);
                        const Icon = menuItem?.icon;
                        return Icon ? <Icon className="w-8 h-8 text-blue-600" /> : null;
                      })()}
                      <h2 className="text-2xl font-bold text-gray-900">
                        {menuStructure.find(item => item.id === activePopup)?.name}
                      </h2>
                    </div>
                    <button
                      onClick={() => setActivePopup(null)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {menuStructure.find(item => item.id === activePopup)?.subItems?.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = activeTab === subItem.id;
                      
                      return (
                        <button
                          key={subItem.id}
                          onClick={() => handleSubItemClick(subItem.id)}
                          className={`flex items-center space-x-4 p-6 rounded-lg border-2 transition-all text-left ${
                            isSubActive
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-600'
                          }`}
                        >
                          <div className={`p-3 rounded-lg ${
                            isSubActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <SubIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{subItem.name}</h3>
                            <p className="text-sm opacity-75">
                              {subItem.id === 'unesco-framework' && 'Official UNESCO framework for AI literacy'}
                              {subItem.id === 'ai-strands' && 'Visual allocation across 7 AI strands'}
                              {subItem.id === 'progression-indicators' && 'Strand-specific progression indicators'}
                              {subItem.id === 'cross-cutting' && 'Four essential competency components'}
                              {subItem.id === 'teacher-pd' && 'Professional development for educators'}
                              {subItem.id === 'safe-emulators' && 'Secure AI simulations and tools'}
                              {subItem.id === 'lesson-planning' && 'Create structured lesson plans from curriculum'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="transition-all duration-300 ease-in-out">
            {renderContent()}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-gray-500">
              <p>AI Curriculum Designer • Pre-K to Grade 12 • Comprehensive Curriculum Development Platform</p>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default App;