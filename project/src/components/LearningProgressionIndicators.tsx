import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { Edit3, Save, X, Plus, Trash2, Brain, Database, Wrench, Shield, Globe, Lightbulb, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { LearningProgressionIndicator } from '../types/curriculum';

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

const strandBorderColors = {
  'strand-1': 'border-blue-200',
  'strand-2': 'border-green-200',
  'strand-3': 'border-purple-200',
  'strand-4': 'border-red-200',
  'strand-5': 'border-yellow-200',
  'strand-6': 'border-pink-200',
  'strand-7': 'border-indigo-200'
};

export const LearningProgressionIndicators: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null);
  const [indicatorData, setIndicatorData] = useState<string[]>([]);
  const [expandedBands, setExpandedBands] = useState<string[]>([]);
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);

  const getIndicatorsForGradeBand = (gradeBandId: string, strandId: string) => {
    return data.learningProgressionIndicators.find(
      lpi => lpi.gradeBandId === gradeBandId && lpi.strandId === strandId
    );
  };

  const startEdit = (gradeBandId: string, strandId: string) => {
    const existing = getIndicatorsForGradeBand(gradeBandId, strandId);
    setEditingIndicator(`${gradeBandId}-${strandId}`);
    setIndicatorData(existing?.indicators || []);
  };

  const saveIndicators = (gradeBandId: string, strandId: string) => {
    const existingIndex = data.learningProgressionIndicators.findIndex(
      lpi => lpi.gradeBandId === gradeBandId && lpi.strandId === strandId
    );

    const newIndicator: LearningProgressionIndicator = {
      id: `lpi-${gradeBandId}-${strandId}`,
      gradeBandId,
      strandId,
      indicators: indicatorData
    };

    let updatedIndicators;
    if (existingIndex >= 0) {
      updatedIndicators = [...data.learningProgressionIndicators];
      updatedIndicators[existingIndex] = newIndicator;
    } else {
      updatedIndicators = [...data.learningProgressionIndicators, newIndicator];
    }

    updateData({ ...data, learningProgressionIndicators: updatedIndicators });
    setEditingIndicator(null);
    setIndicatorData([]);
  };

  const addIndicator = () => {
    setIndicatorData(prev => [...prev, 'New learning indicator']);
  };

  const updateIndicator = (index: number, value: string) => {
    setIndicatorData(prev => prev.map((ind, i) => i === index ? value : ind));
  };

  const removeIndicator = (index: number) => {
    setIndicatorData(prev => prev.filter((_, i) => i !== index));
  };

  const toggleBand = (bandId: string) => {
    setExpandedBands(prev => 
      prev.includes(bandId) 
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Learning Progression Indicators</h2>
          <p className="text-gray-600 mt-1">Strand-specific progression indicators for each grade band</p>
        </div>
        
        {/* Strand Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Filter by Strand:</span>
          <select
            value={selectedStrand || ''}
            onChange={(e) => setSelectedStrand(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Strands</option>
            {data.aiStrands.map((strand) => (
              <option key={strand.id} value={strand.id}>
                {strand.code} - {strand.shortName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Strands Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Strands Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.aiStrands.map((strand) => {
            const Icon = strandIcons[strand.id as keyof typeof strandIcons];
            const isSelected = selectedStrand === strand.id;
            return (
              <button
                key={strand.id}
                onClick={() => setSelectedStrand(isSelected ? null : strand.id)}
                className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? `${strandBorderColors[strand.id as keyof typeof strandBorderColors]} bg-gray-50` 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${strandColors[strand.id as keyof typeof strandColors]} text-white`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">{strand.code}</div>
                  <div className="text-xs text-gray-600">{strand.shortName}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {data.gradeBands.map((gradeBand) => {
          const isExpanded = expandedBands.includes(gradeBand.id);
          const strandsToShow = selectedStrand 
            ? data.aiStrands.filter(s => s.id === selectedStrand)
            : data.aiStrands;
          
          const hasIndicators = strandsToShow.some(strand => 
            getIndicatorsForGradeBand(gradeBand.id, strand.id)?.indicators.length > 0
          );

          return (
            <div key={gradeBand.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleBand(gradeBand.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <h3 className="text-xl font-semibold text-gray-900">
                        {gradeBand.name} ({gradeBand.cycle})
                      </h3>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      {gradeBand.grades}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {strandsToShow.filter(strand => 
                          getIndicatorsForGradeBand(gradeBand.id, strand.id)?.indicators.length > 0
                        ).length}
                      </div>
                      <div className="text-xs text-gray-500">Strands Defined</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {strandsToShow.reduce((total, strand) => 
                          total + (getIndicatorsForGradeBand(gradeBand.id, strand.id)?.indicators.length || 0), 0
                        )}
                      </div>
                      <div className="text-xs text-gray-500">Total Indicators</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="border-t border-gray-100 p-6 bg-gray-50">
                  <div className="grid gap-6">
                    {strandsToShow.map((strand) => {
                      const indicators = getIndicatorsForGradeBand(gradeBand.id, strand.id);
                      const isEditing = editingIndicator === `${gradeBand.id}-${strand.id}`;
                      const currentData = isEditing ? indicatorData : (indicators?.indicators || []);
                      const Icon = strandIcons[strand.id as keyof typeof strandIcons];

                      return (
                        <div key={strand.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-lg ${strandColors[strand.id as keyof typeof strandColors]} text-white`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-lg font-medium text-gray-900">{strand.code} - {strand.name}</h4>
                                  <p className="text-sm text-gray-600">{strand.shortName}</p>
                                </div>
                              </div>
                              
                              {isAdminMode && !isEditing && (
                                <button
                                  onClick={() => startEdit(gradeBand.id, strand.id)}
                                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>
                              )}
                              
                              {isEditing && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => saveIndicators(gradeBand.id, strand.id)}
                                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                  >
                                    <Save className="w-4 h-4" />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingIndicator(null);
                                      setIndicatorData([]);
                                    }}
                                    className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="space-y-3">
                              {currentData.map((indicator, index) => (
                                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                                    {index + 1}
                                  </div>
                                  {isEditing ? (
                                    <div className="flex-1 flex items-start space-x-2">
                                      <textarea
                                        value={indicator}
                                        onChange={(e) => updateIndicator(index, e.target.value)}
                                        rows={2}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="Enter learning progression indicator..."
                                      />
                                      <button
                                        onClick={() => removeIndicator(index)}
                                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-gray-700 text-sm leading-relaxed flex-1">{indicator}</p>
                                  )}
                                </div>
                              ))}
                              
                              {isEditing && (
                                <button
                                  onClick={addIndicator}
                                  className="flex items-center space-x-2 px-4 py-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border-2 border-dashed border-blue-300 w-full"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Add Learning Progression Indicator</span>
                                </button>
                              )}
                              
                              {currentData.length === 0 && !isEditing && (
                                <div className="text-center py-8">
                                  <div className="text-gray-400 mb-2">
                                    <Icon className="w-12 h-12 mx-auto" />
                                  </div>
                                  <p className="text-gray-500 text-sm">No progression indicators defined for this strand</p>
                                  {isAdminMode && (
                                    <button
                                      onClick={() => startEdit(gradeBand.id, strand.id)}
                                      className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                      Add indicators
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};