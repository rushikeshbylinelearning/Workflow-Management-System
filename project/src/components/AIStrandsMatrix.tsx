import React, { useState, useMemo } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { Edit3, Save, X, Brain, Database, Wrench, Shield, Globe, Lightbulb, Users, BarChart3, Eye } from 'lucide-react';

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

const strandColorClasses = {
  'strand-1': 'bg-blue-500',
  'strand-2': 'bg-green-500',
  'strand-3': 'bg-purple-500',
  'strand-4': 'bg-red-500',
  'strand-5': 'bg-yellow-500',
  'strand-6': 'bg-pink-500',
  'strand-7': 'bg-indigo-500'
};

const strandBorderColors = {
  'strand-1': 'border-blue-500',
  'strand-2': 'border-green-500',
  'strand-3': 'border-purple-500',
  'strand-4': 'border-red-500',
  'strand-5': 'border-yellow-500',
  'strand-6': 'border-pink-500',
  'strand-7': 'border-indigo-500'
};

export const AIStrandsMatrix: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [tempStrandValues, setTempStrandValues] = useState<{ [key: string]: number }>({});
  const [viewMode, setViewMode] = useState<'individual' | 'comparison'>('individual');
  const [selectedGradesForComparison, setSelectedGradesForComparison] = useState<string[]>([]);
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);

  const selectedGradeData = useMemo(() => {
    if (!selectedGrade) return data.grades[0] || null;
    return data.grades.find(g => g.id === selectedGrade) || data.grades[0] || null;
  }, [selectedGrade, data.grades]);

  React.useEffect(() => {
    if (data.grades.length > 0 && !selectedGrade) {
      setSelectedGrade(data.grades[0].id);
      setSelectedGradesForComparison([data.grades[0].id]);
    }
  }, [data.grades, selectedGrade]);

  const startEdit = (gradeId: string) => {
    const grade = data.grades.find(g => g.id === gradeId);
    if (grade) {
      setEditingGrade(gradeId);
      setTempStrandValues(grade.aiStrandsCoverage);
    }
  };

  const saveStrands = () => {
    if (editingGrade) {
      const updatedGrades = data.grades.map(grade =>
        grade.id === editingGrade 
          ? { ...grade, aiStrandsCoverage: tempStrandValues }
          : grade
      );
      updateData({ ...data, grades: updatedGrades });
      setEditingGrade(null);
      setTempStrandValues({});
    }
  };

  const cancelEdit = () => {
    setEditingGrade(null);
    setTempStrandValues({});
  };

  const updateStrandValue = (strandId: string, value: number) => {
    setTempStrandValues(prev => ({ ...prev, [strandId]: value }));
  };

  const getTotalPercentage = (coverage: { [key: string]: number }) => {
    return Object.values(coverage).reduce((sum, val) => sum + val, 0);
  };

  const toggleGradeForComparison = (gradeId: string) => {
    setSelectedGradesForComparison(prev => 
      prev.includes(gradeId) 
        ? prev.filter(id => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  const getMaxValue = () => {
    let max = 0;
    selectedGradesForComparison.forEach(gradeId => {
      const grade = data.grades.find(g => g.id === gradeId);
      if (grade) {
        Object.values(grade.aiStrandsCoverage).forEach(value => {
          if (value > max) max = value;
        });
      }
    });
    return Math.max(max, 50); // Minimum scale of 50
  };
  if (!selectedGradeData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No grades configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Strands Coverage Matrix</h2>
          <p className="text-gray-600 mt-1">Visual allocation of curriculum time across the 7 AI strands</p>
        </div>
        
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('individual')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'individual' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Individual</span>
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'comparison' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Comparison</span>
          </button>
        </div>
      </div>

      {/* AI Strands Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Strands Reference</h3>
        <p className="text-sm text-gray-600 mb-6">Click on any strand to view its definition and focus areas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.aiStrands.map((strand) => {
            const Icon = strandIcons[strand.id as keyof typeof strandIcons];
            const isSelected = selectedStrand === strand.id;
            return (
              <div
                key={strand.id}
                className={`rounded-lg border-2 transition-all ${
                  isSelected 
                    ? `${strandBorderColors[strand.id as keyof typeof strandBorderColors]} bg-gray-50` 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => setSelectedStrand(isSelected ? null : strand.id)}
                  className="w-full flex items-center space-x-3 p-3"
                >
                  <div className={`p-2 rounded-lg ${strandColors[strand.id as keyof typeof strandColors]} text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-medium text-gray-900">{strand.code}</div>
                    <div className="text-xs text-gray-600">{strand.shortName}</div>
                  </div>
                </button>
                
                {isSelected && (
                  <div className="px-3 pb-3 border-t border-gray-200 mt-2 pt-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{strand.name}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{strand.definition}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {viewMode === 'individual' && (
        <>
          {/* Grade Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Select Grade to View/Edit</h3>
              <div className="flex flex-wrap gap-2">
                {data.grades.map((grade) => {
                  const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                  return (
                    <button
                      key={grade.id}
                      onClick={() => setSelectedGrade(grade.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedGrade === grade.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div>{grade.name}</div>
                      <div className="text-xs opacity-75">{gradeBand?.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Grade Strands Visualization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedGradeData.name} - AI Strands Coverage</h3>
                <p className="text-gray-600">{selectedGradeData.yearTheme}</p>
              </div>
              
              {isAdminMode && editingGrade !== selectedGradeData.id && (
                <button
                  onClick={() => startEdit(selectedGradeData.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Coverage</span>
                </button>
              )}
              
              {editingGrade === selectedGradeData.id && (
                <div className="flex space-x-2">
                  <button
                    onClick={saveStrands}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>

            {/* Visual Coverage Display */}
            <div className="space-y-6">
              {/* Progress Bar Visualization */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Overall Coverage</span>
                  <span className={`text-sm font-bold ${
                    getTotalPercentage(editingGrade === selectedGradeData.id ? tempStrandValues : selectedGradeData.aiStrandsCoverage) === 100 
                      ? 'text-green-600' 
                      : 'text-orange-600'
                  }`}>
                    {getTotalPercentage(editingGrade === selectedGradeData.id ? tempStrandValues : selectedGradeData.aiStrandsCoverage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {data.aiStrands.map((strand) => {
                      const coverage = editingGrade === selectedGradeData.id ? tempStrandValues : selectedGradeData.aiStrandsCoverage;
                      const percentage = coverage[strand.id] || 0;
                      return (
                        <div
                          key={strand.id}
                          className={`${strandColors[strand.id as keyof typeof strandColors]} transition-all duration-300`}
                          style={{ width: `${percentage}%` }}
                          title={`${strand.shortName}: ${percentage}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Individual Strand Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.aiStrands.map((strand) => {
                  const Icon = strandIcons[strand.id as keyof typeof strandIcons];
                  const coverage = editingGrade === selectedGradeData.id ? tempStrandValues : selectedGradeData.aiStrandsCoverage;
                  const percentage = coverage[strand.id] || 0;
                  
                  return (
                    <div key={strand.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${strandColors[strand.id as keyof typeof strandColors]} text-white`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{strand.code} - {strand.shortName}</h4>
                          <p className="text-xs text-gray-600 truncate">{strand.name}</p>
                        </div>
                      </div>
                      
                      {editingGrade === selectedGradeData.id ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={percentage}
                            onChange={(e) => updateStrandValue(strand.id, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <div className="flex justify-between items-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={percentage}
                              onChange={(e) => updateStrandValue(strand.id, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${strandColors[strand.id as keyof typeof strandColors]} transition-all duration-300`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="text-center">
                            <span className="text-lg font-bold text-gray-900">{percentage}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'comparison' && (
        <>
          {/* Grade Selection for Comparison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Grades to Compare</h3>
            <div className="flex flex-wrap gap-2">
              {data.grades.map((grade) => {
                const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                const isSelected = selectedGradesForComparison.includes(grade.id);
                return (
                  <button
                    key={grade.id}
                    onClick={() => toggleGradeForComparison(grade.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div>{grade.name}</div>
                    <div className="text-xs opacity-75">{gradeBand?.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparison Bar Charts */}
          <div className="space-y-6">
            {/* Stacked Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">AI Strands Coverage - Stacked Comparison</h3>
              
              <div className="space-y-4">
                {selectedGradesForComparison.map((gradeId) => {
                  const grade = data.grades.find(g => g.id === gradeId);
                  if (!grade) return null;
                  
                  const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                  const total = Object.values(grade.aiStrandsCoverage).reduce((sum, val) => sum + val, 0);
                  
                  return (
                    <div key={gradeId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900">{grade.name}</h4>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {gradeBand?.name}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-600">
                          Total: {total}%
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                        <div className="flex h-8">
                          {data.aiStrands.map((strand) => {
                            const percentage = grade.aiStrandsCoverage[strand.id] || 0;
                            const Icon = strandIcons[strand.id as keyof typeof strandIcons];
                            
                            return (
                              <div
                                key={strand.id}
                                className={`${strandColorClasses[strand.id as keyof typeof strandColorClasses]} flex items-center justify-center text-white text-xs font-medium transition-all duration-500 relative group`}
                                style={{ width: `${percentage}%` }}
                                title={`${strand.code}: ${percentage}%`}
                              >
                                {percentage >= 8 && (
                                  <div className="flex items-center space-x-1">
                                    <Icon className="w-3 h-3" />
                                    <span>{percentage}%</span>
                                  </div>
                                )}
                                {percentage > 0 && percentage < 8 && (
                                  <span className="text-xs">{percentage}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Strand Legend for this grade */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {data.aiStrands.map((strand) => {
                          const percentage = grade.aiStrandsCoverage[strand.id] || 0;
                          if (percentage === 0) return null;
                          
                          return (
                            <div key={strand.id} className="flex items-center space-x-1 text-xs">
                              <div className={`w-3 h-3 rounded ${strandColorClasses[strand.id as keyof typeof strandColorClasses]}`}></div>
                              <span className="text-gray-600">{strand.code}: {percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Individual Strand Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Individual Strand Comparison</h3>
              
              <div className="space-y-8">
                {data.aiStrands.map((strand) => {
                  const Icon = strandIcons[strand.id as keyof typeof strandIcons];
                  const maxValue = getMaxValue();
                  
                  return (
                    <div key={strand.id} className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${strandColorClasses[strand.id as keyof typeof strandColorClasses]} text-white`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{strand.code} - {strand.name}</h4>
                          <p className="text-sm text-gray-600">{strand.shortName}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {selectedGradesForComparison.map((gradeId) => {
                          const grade = data.grades.find(g => g.id === gradeId);
                          if (!grade) return null;
                          
                          const percentage = grade.aiStrandsCoverage[strand.id] || 0;
                          const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                          
                          return (
                            <div key={gradeId} className="flex items-center space-x-3">
                              <div className="w-24 text-sm font-medium text-gray-700 truncate">
                                {grade.name}
                              </div>
                              <div className="flex-1 flex items-center space-x-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                                  <div
                                    className={`h-6 rounded-full ${strandColorClasses[strand.id as keyof typeof strandColorClasses]} transition-all duration-500 flex items-center justify-end pr-2`}
                                    style={{ width: `${(percentage / maxValue) * 100}%` }}
                                  >
                                    <span className="text-white text-xs font-bold">
                                      {percentage > 0 ? `${percentage}%` : ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="w-12 text-sm font-bold text-gray-900">
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};