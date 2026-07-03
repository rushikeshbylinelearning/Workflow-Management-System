import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { Edit3, Save, X, Plus, Trash2 } from 'lucide-react';
import { CrossCuttingCompetency } from '../types/curriculum';

const componentLabels = {
  'computational-thinking': 'Computational Thinking Evolution',
  'ethical-development': 'Ethical Development Progression',
  'innovation-skills': 'Innovation Skills Trajectory',
  'technical-skills': 'Technical Skills Scaffolding'
};

const componentColors = {
  'computational-thinking': 'bg-blue-50 border-blue-200 text-blue-800',
  'ethical-development': 'bg-green-50 border-green-200 text-green-800',
  'innovation-skills': 'bg-purple-50 border-purple-200 text-purple-800',
  'technical-skills': 'bg-orange-50 border-orange-200 text-orange-800'
};

export const CrossCuttingCompetencies: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [editingCompetency, setEditingCompetency] = useState<string | null>(null);
  const [progressionData, setProgressionData] = useState<string[]>([]);

  const getCompetencyForGradeBand = (gradeBandId: string, component: string) => {
    return data.crossCuttingCompetencies.find(
      cc => cc.gradeBandId === gradeBandId && cc.component === component
    );
  };

  const startEdit = (gradeBandId: string, component: string) => {
    const existing = getCompetencyForGradeBand(gradeBandId, component);
    setEditingCompetency(`${gradeBandId}-${component}`);
    setProgressionData(existing?.progression || []);
  };

  const saveProgression = (gradeBandId: string, component: string) => {
    const existingIndex = data.crossCuttingCompetencies.findIndex(
      cc => cc.gradeBandId === gradeBandId && cc.component === component
    );

    const newCompetency: CrossCuttingCompetency = {
      id: `cc-${gradeBandId}-${component}`,
      gradeBandId,
      component: component as any,
      progression: progressionData
    };

    let updatedCompetencies;
    if (existingIndex >= 0) {
      updatedCompetencies = [...data.crossCuttingCompetencies];
      updatedCompetencies[existingIndex] = newCompetency;
    } else {
      updatedCompetencies = [...data.crossCuttingCompetencies, newCompetency];
    }

    updateData({ ...data, crossCuttingCompetencies: updatedCompetencies });
    setEditingCompetency(null);
    setProgressionData([]);
  };

  const addProgression = () => {
    setProgressionData(prev => [...prev, 'New progression step']);
  };

  const updateProgression = (index: number, value: string) => {
    setProgressionData(prev => prev.map((prog, i) => i === index ? value : prog));
  };

  const removeProgression = (index: number) => {
    setProgressionData(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cross-Cutting Competency Development</h2>
        <p className="text-gray-600 mt-1">Four essential competency components across all grade bands</p>
      </div>

      <div className="space-y-8">
        {data.gradeBands.map((gradeBand) => (
          <div key={gradeBand.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {gradeBand.name} ({gradeBand.cycle}) - {gradeBand.ages}
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(componentLabels).map(([component, label]) => {
                const competency = getCompetencyForGradeBand(gradeBand.id, component);
                const isEditing = editingCompetency === `${gradeBand.id}-${component}`;
                const currentData = isEditing ? progressionData : (competency?.progression || []);

                return (
                  <div key={component} className={`border rounded-lg p-4 ${componentColors[component as keyof typeof componentColors]}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">{label}</h4>
                      
                      {isAdminMode && !isEditing && (
                        <button
                          onClick={() => startEdit(gradeBand.id, component)}
                          className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      )}
                      
                      {isEditing && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveProgression(gradeBand.id, component)}
                            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingCompetency(null);
                              setProgressionData([]);
                            }}
                            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {currentData.map((progression, index) => (
                        <div key={index} className="bg-white rounded-md p-3 border border-gray-200">
                          {isEditing ? (
                            <div className="flex items-start space-x-2">
                              <div className="text-gray-500 font-medium text-sm mt-2">{index + 1}.</div>
                              <textarea
                                value={progression}
                                onChange={(e) => updateProgression(index, e.target.value)}
                                rows={2}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                              <button
                                onClick={() => removeProgression(index)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start space-x-3">
                              <div className="text-gray-500 font-medium text-sm mt-0.5">{index + 1}.</div>
                              <p className="text-gray-700 text-sm leading-relaxed">{progression}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {isEditing && (
                        <button
                          onClick={addProgression}
                          className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-white rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Progression Step</span>
                        </button>
                      )}
                      
                      {currentData.length === 0 && !isEditing && (
                        <div className="bg-white rounded-md p-3 border border-gray-200">
                          <p className="text-gray-500 text-sm italic">No progression steps defined</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};