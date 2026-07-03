import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { ChevronDown, ChevronRight, Clock, Target, BookOpen, Layers } from 'lucide-react';

// Separate component for cross-cutting competency items to avoid conditional hooks
const CrossCuttingCompetencyItem: React.FC<{
  component: {
    key: string;
    label: string;
    color: string;
    icon: string;
  };
  competency: any;
}> = ({ component, competency }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`border rounded-lg ${component.color} overflow-hidden`}>
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-lg">{component.icon}</span>
            <div>
              <div className="text-sm font-medium">{component.label}</div>
              <div className="text-xs opacity-75">
                {competency ? `${competency.progression.length} steps` : 'Not defined'}
              </div>
            </div>
          </div>
          <div className="text-xs">
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </div>
      
      {isExpanded && competency && (
        <div className="px-4 pb-3 border-t border-opacity-20">
          <div className="space-y-2 mt-3">
            {competency.progression.map((step: string, index: number) => (
              <div key={index} className="flex items-start space-x-2 text-xs">
                <div className="flex-shrink-0 w-5 h-5 bg-white bg-opacity-60 rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <p className="text-xs leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const GradeBandOverview: React.FC = () => {
  const { data } = useCurriculum();
  const [expandedBands, setExpandedBands] = useState<string[]>([]);

  const toggleBand = (bandId: string) => {
    setExpandedBands(prev => 
      prev.includes(bandId) 
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    );
  };

  return (
    <div className="space-y-6 mb-8">
      {data.gradeBands.map((band) => {
        const gradesInBand = data.grades.filter(grade => grade.gradeBandId === band.id);
        const totalGrades = gradesInBand.length;
        const avgWeeklyHours = totalGrades > 0 
          ? (gradesInBand.reduce((sum, grade) => sum + grade.weeklyHours, 0) / totalGrades).toFixed(1)
          : '0';
        const avgAnnualHours = totalGrades > 0 
          ? Math.round(gradesInBand.reduce((sum, grade) => sum + grade.annualHours, 0) / totalGrades)
          : 0;
        const isExpanded = expandedBands.includes(band.id);

        return (
          <div key={band.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
            <div 
              className="p-6 cursor-pointer"
              onClick={() => toggleBand(band.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-semibold text-gray-900">{band.name}</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      {band.cycle}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <p>{band.grades}</p>
                    <p>{band.ages}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{totalGrades}</div>
                    <div className="text-xs text-gray-500">Grades</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">{avgWeeklyHours}</div>
                    <div className="text-xs text-gray-500">Avg Hrs/Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{avgAnnualHours}</div>
                    <div className="text-xs text-gray-500">Avg Annual Hrs</div>
                  </div>
                  
                  <div className="ml-4">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {isExpanded && (
              <>
                <div className="border-t border-gray-100 bg-gray-50 p-6">
                  <div className="grid gap-4">
                    {gradesInBand.length > 0 ? (
                      gradesInBand.map((grade) => (
                        <div key={grade.id} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{grade.name}</h4>
                              <p className="text-sm text-gray-600 mt-1">{grade.yearTheme}</p>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1 text-blue-600">
                                <Clock className="w-4 h-4" />
                                <span>{grade.weeklyHours}h/week</span>
                              </div>
                              <div className="flex items-center space-x-1 text-teal-600">
                                <Target className="w-4 h-4" />
                                <span>{grade.projectTimePercent}% projects</span>
                              </div>
                              <div className="flex items-center space-x-1 text-orange-600">
                                <Target className="w-4 h-4" />
                                <span>{grade.assessmentTimePercent}% assessment</span>
                              </div>
                              <div className="flex items-center space-x-1 text-green-600">
                                <BookOpen className="w-4 h-4" />
                                <span>{grade.annualHours}h/year</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No grades configured for this band</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Cross-Cutting Competencies Summary */}
                <div className="mt-6 pt-6 border-t border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Layers className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">Cross-Cutting Competency Development</h4>
                        <p className="text-sm text-gray-600">Four essential competency components across this grade band</p>
                      </div>
                    </div>
                    <div className="text-sm text-purple-600 font-medium">
                      {data.crossCuttingCompetencies.filter(cc => cc.gradeBandId === band.id).length} components defined
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[
                      { 
                        key: 'computational-thinking', 
                        label: 'Computational Thinking', 
                        color: 'bg-blue-50 text-blue-700 border-blue-200',
                        icon: '🧠'
                      },
                      { 
                        key: 'ethical-development', 
                        label: 'Ethical Development', 
                        color: 'bg-green-50 text-green-700 border-green-200',
                        icon: '⚖️'
                      },
                      { 
                        key: 'innovation-skills', 
                        label: 'Innovation Skills', 
                        color: 'bg-purple-50 text-purple-700 border-purple-200',
                        icon: '💡'
                      },
                      { 
                        key: 'technical-skills', 
                        label: 'Technical Skills', 
                        color: 'bg-orange-50 text-orange-700 border-orange-200',
                        icon: '🔧'
                      }
                    ].map((component) => {
                      const competency = data.crossCuttingCompetencies.find(
                        cc => cc.gradeBandId === band.id && cc.component === component.key
                      );
                      
                      return (
                        <CrossCuttingCompetencyItem
                          key={component.key}
                          component={component}
                          competency={competency}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};