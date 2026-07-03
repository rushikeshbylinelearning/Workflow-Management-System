import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { Edit3, Save, X, Plus, Trash2, Calendar, Target, BookOpen, Award } from 'lucide-react';

const termColors = {
  term1: 'bg-blue-50 border-blue-200 text-blue-800',
  term2: 'bg-green-50 border-green-200 text-green-800',
  term3: 'bg-purple-50 border-purple-200 text-purple-800'
};

const termIcons = {
  term1: '🌱',
  term2: '🌿',
  term3: '🌳'
};

const termLabels = {
  term1: 'Term 1 - Foundation',
  term2: 'Term 2 - Development', 
  term3: 'Term 3 - Mastery'
};

export const GradeCompetencies: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [competencyData, setCompetencyData] = useState<{
    term1: string[];
    term2: string[];
    term3: string[];
  }>({ term1: [], term2: [], term3: [] });
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  React.useEffect(() => {
    if (data.grades.length > 0 && !selectedGrade) {
      setSelectedGrade(data.grades[0].id);
    }
  }, [data.grades, selectedGrade]);

  const startEdit = (gradeId: string) => {
    const grade = data.grades.find(g => g.id === gradeId);
    if (grade) {
      setEditingGrade(gradeId);
      setCompetencyData(grade.competencies);
    }
  };

  const saveCompetencies = () => {
    if (editingGrade) {
      const updatedGrades = data.grades.map(grade =>
        grade.id === editingGrade 
          ? { ...grade, competencies: competencyData }
          : grade
      );
      updateData({ ...data, grades: updatedGrades });
      setEditingGrade(null);
      setCompetencyData({ term1: [], term2: [], term3: [] });
    }
  };

  const cancelEdit = () => {
    setEditingGrade(null);
    setCompetencyData({ term1: [], term2: [], term3: [] });
  };

  const addCompetency = (term: 'term1' | 'term2' | 'term3') => {
    setCompetencyData(prev => ({
      ...prev,
      [term]: [...prev[term], 'New competency']
    }));
  };

  const updateCompetency = (term: 'term1' | 'term2' | 'term3', index: number, value: string) => {
    setCompetencyData(prev => ({
      ...prev,
      [term]: prev[term].map((comp, i) => i === index ? value : comp)
    }));
  };

  const removeCompetency = (term: 'term1' | 'term2' | 'term3', index: number) => {
    setCompetencyData(prev => ({
      ...prev,
      [term]: prev[term].filter((_, i) => i !== index)
    }));
  };

  const selectedGradeData = selectedGrade ? data.grades.find(g => g.id === selectedGrade) : null;

  if (!selectedGradeData) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No grades configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Core Competencies by Term</h2>
          <p className="text-gray-600 mt-1">Learning objectives organized by academic terms</p>
        </div>
        
        {/* Grade Selector */}
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Select Grade:</span>
          <div className="flex flex-wrap gap-2">
            {data.grades.map((grade) => {
              const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
              return (
                <button
                  key={grade.id}
                  onClick={() => setSelectedGrade(grade.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
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

      {/* Grade Overview Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{selectedGradeData.name}</h3>
              <p className="text-blue-700 font-medium">{selectedGradeData.yearTheme}</p>
              <p className="text-sm text-gray-600 mt-1 italic">"{selectedGradeData.essentialQuestion}"</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Object.values(selectedGradeData.competencies).flat().length}
                </div>
                <div className="text-xs text-gray-500">Total Competencies</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{selectedGradeData.weeklyHours}</div>
                <div className="text-xs text-gray-500">Hours/Week</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['term1', 'term2', 'term3'] as const).map((term, termIndex) => {
          const isEditing = editingGrade === selectedGradeData.id;
          const competencies = isEditing ? competencyData : selectedGradeData.competencies;
          const termCompetencies = competencies[term];
          
          return (
            <div key={term} className={`border-2 rounded-xl overflow-hidden ${termColors[term]}`}>
              {/* Term Header */}
              <div className="p-4 bg-white bg-opacity-60 border-b border-opacity-30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{termIcons[term]}</span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{termLabels[term]}</h4>
                      <p className="text-sm opacity-75">
                        {termCompetencies.length} competenc{termCompetencies.length === 1 ? 'y' : 'ies'}
                      </p>
                    </div>
                  </div>
                  
                  {isEditing && (
                    <button
                      onClick={() => addCompetency(term)}
                      className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-lg transition-all shadow-sm"
                      title="Add Competency"
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Competencies List */}
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {termCompetencies.map((competency, index) => (
                  <div key={index} className="bg-white bg-opacity-80 rounded-lg p-3 shadow-sm">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 mt-1">
                            {index + 1}
                          </div>
                          <textarea
                            value={competency}
                            onChange={(e) => updateCompetency(term, index, e.target.value)}
                            rows={2}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                            placeholder="Enter competency description..."
                          />
                          <button
                            onClick={() => removeCompetency(term, index)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Remove Competency"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed flex-1">{competency}</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {termCompetencies.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">No competencies defined for this term</p>
                    {isAdminMode && !isEditing && (
                      <button
                        onClick={() => startEdit(selectedGradeData.id)}
                        className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Add competencies
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        {isAdminMode && editingGrade !== selectedGradeData.id && (
          <button
            onClick={() => startEdit(selectedGradeData.id)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Edit3 className="w-5 h-5" />
            <span>Edit Competencies</span>
          </button>
        )}
        
        {editingGrade === selectedGradeData.id && (
          <div className="flex space-x-3">
            <button
              onClick={saveCompetencies}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
            >
              <Save className="w-5 h-5" />
              <span>Save Changes</span>
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center space-x-2 px-6 py-3 text-gray-600 hover:text-gray-900 border-2 border-gray-300 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};