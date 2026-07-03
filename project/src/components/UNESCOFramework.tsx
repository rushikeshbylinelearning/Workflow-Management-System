import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { Edit3, Save, X, Plus, Trash2, Globe, Brain, Target, Heart, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { UNESCOCompetency } from '../types/curriculum';

const levelColors = {
  1: 'bg-green-100 text-green-800 border-green-200',
  2: 'bg-blue-100 text-blue-800 border-blue-200',
  3: 'bg-purple-100 text-purple-800 border-purple-200'
};

const aspectIcons = {
  'human-centred': Brain,
  'ethics': Shield,
  'techniques': Target,
  'system-design': Heart
};

const aspectColors = {
  'human-centred': 'bg-blue-500',
  'ethics': 'bg-red-500',
  'techniques': 'bg-green-500',
  'system-design': 'bg-purple-500'
};

export const UNESCOFramework: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 'all'>('all');
  const [selectedAspect, setSelectedAspect] = useState<string | 'all'>('all');
  const [expandedCompetencies, setExpandedCompetencies] = useState<string[]>([]);
  const [editingCompetency, setEditingCompetency] = useState<string | null>(null);
  const [competencyData, setCompetencyData] = useState<Partial<UNESCOCompetency>>({});

  const filteredCompetencies = data.unescoCompetencies.filter(comp => {
    const levelMatch = selectedLevel === 'all' || comp.level === selectedLevel;
    const aspectMatch = selectedAspect === 'all' || comp.aspect === selectedAspect;
    return levelMatch && aspectMatch;
  });

  const toggleExpanded = (competencyId: string) => {
    setExpandedCompetencies(prev => 
      prev.includes(competencyId) 
        ? prev.filter(id => id !== competencyId)
        : [...prev, competencyId]
    );
  };

  const startEdit = (competency: UNESCOCompetency) => {
    setEditingCompetency(competency.id);
    setCompetencyData(competency);
  };

  const saveCompetency = () => {
    if (editingCompetency && competencyData) {
      const updatedCompetencies = data.unescoCompetencies.map(comp =>
        comp.id === editingCompetency ? { ...comp, ...competencyData } as UNESCOCompetency : comp
      );
      updateData({ ...data, unescoCompetencies: updatedCompetencies });
      setEditingCompetency(null);
      setCompetencyData({});
    }
  };

  const cancelEdit = () => {
    setEditingCompetency(null);
    setCompetencyData({});
  };

  const addNewCompetency = () => {
    const newCompetency: UNESCOCompetency = {
      id: `unesco-${Date.now()}`,
      code: 'U1.K1',
      level: 1,
      levelName: 'Understand',
      aspect: 'knowledge',
      aspectName: 'Knowledge and Understanding',
      title: 'New Competency',
      description: 'Competency description'
    };
    updateData({ 
      ...data, 
      unescoCompetencies: [...data.unescoCompetencies, newCompetency] 
    });
    setEditingCompetency(newCompetency.id);
    setCompetencyData(newCompetency);
  };

  const deleteCompetency = (competencyId: string) => {
    if (confirm('Are you sure you want to delete this competency?')) {
      const updatedCompetencies = data.unescoCompetencies.filter(comp => comp.id !== competencyId);
      updateData({ ...data, unescoCompetencies: updatedCompetencies });
    }
  };

  const competenciesByLevel = {
    1: data.unescoCompetencies.filter(c => c.level === 1).length,
    2: data.unescoCompetencies.filter(c => c.level === 2).length,
    3: data.unescoCompetencies.filter(c => c.level === 3).length
  };

  const competenciesByAspect = {
    'human-centred': data.unescoCompetencies.filter(c => c.aspect === 'human-centred').length,
    'ethics': data.unescoCompetencies.filter(c => c.aspect === 'ethics').length,
    'techniques': data.unescoCompetencies.filter(c => c.aspect === 'techniques').length,
    'system-design': data.unescoCompetencies.filter(c => c.aspect === 'system-design').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Globe className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">UNESCO AI Competency Framework</h1>
              <p className="text-lg opacity-90 mt-1">Three levels across four key aspects of AI literacy</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{data.unescoCompetencies.length}</div>
            <div className="text-sm opacity-75">Total Competencies</div>
          </div>
        </div>
      </div>

      {/* Framework Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Framework Structure</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Levels */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Three Levels of Competency</h3>
            <div className="space-y-3">
              {[
                { level: 1, name: 'Understand', description: 'Basic awareness and comprehension of AI concepts', count: competenciesByLevel[1] },
                { level: 2, name: 'Apply', description: 'Practical application of AI knowledge and skills', count: competenciesByLevel[2] },
                { level: 3, name: 'Create', description: 'Innovation and creation of AI solutions', count: competenciesByLevel[3] }
              ].map((item) => (
                <div key={item.level} className={`border-2 rounded-lg p-4 ${levelColors[item.level as keyof typeof levelColors]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Level {item.level}: {item.name}</h4>
                    <span className="text-sm font-bold">{item.count} competencies</span>
                  </div>
                  <p className="text-sm opacity-80">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Aspects */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Four Key Aspects</h3>
            <div className="space-y-3">
              {[
                { key: 'human-centred', name: 'Human-centred mindset', description: 'Recognizing AI as human-led and maintaining human agency', count: competenciesByAspect['human-centred'] },
                { key: 'ethics', name: 'Ethics of AI', description: 'Understanding ethical principles and responsible AI practices', count: competenciesByAspect['ethics'] },
                { key: 'techniques', name: 'AI Techniques & Applications', description: 'Technical knowledge and practical application skills', count: competenciesByAspect['techniques'] },
                { key: 'system-design', name: 'AI System Design', description: 'Designing and iterating AI systems with human-centred approaches', count: competenciesByAspect['system-design'] }
              ].map((aspect) => {
                const Icon = aspectIcons[aspect.key as keyof typeof aspectIcons];
                return (
                  <div key={aspect.key} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-lg ${aspectColors[aspect.key as keyof typeof aspectColors]} text-white`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">{aspect.name}</h4>
                          <span className="text-sm font-bold text-blue-600">{aspect.count}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{aspect.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter Competencies</h3>
            <p className="text-sm text-gray-600">Explore competencies by level and aspect</p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 items-end">
            {isAdminMode && (
              <button
                onClick={addNewCompetency}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Competency</span>
              </button>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Levels</option>
                <option value={1}>Level 1: Understand</option>
                <option value={2}>Level 2: Apply</option>
                <option value={3}>Level 3: Create</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Aspect</label>
              <select
                value={selectedAspect}
                onChange={(e) => setSelectedAspect(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Aspects</option>
                <option value="human-centred">Human-centred mindset</option>
                <option value="ethics">Ethics of AI</option>
                <option value="techniques">AI Techniques & Applications</option>
                <option value="system-design">AI System Design</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Competencies List */}
      <div className="space-y-4">
        {filteredCompetencies.map((competency) => {
          const isExpanded = expandedCompetencies.includes(competency.id);
          const isEditing = editingCompetency === competency.id;
          const AspectIcon = aspectIcons[competency.aspect];
          
          return (
            <div key={competency.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all relative group">
              {isAdminMode && !isEditing && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex space-x-2 z-10">
                  <button
                    onClick={() => startEdit(competency)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCompetency(competency.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`p-3 rounded-lg ${aspectColors[competency.aspect]} text-white`}>
                      <AspectIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={competencyData.code || ''}
                            onChange={(e) => setCompetencyData({ ...competencyData, code: e.target.value })}
                            className="text-sm font-mono bg-gray-100 px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{competency.code}</span>
                        )}
                        <span className={`px-3 py-1 text-sm rounded-full border-2 ${levelColors[competency.level]}`}>
                          Level {competency.level}: {competency.levelName}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {competency.aspectName}
                        </span>
                      </div>
                      
                      {isEditing ? (
                        <input
                          type="text"
                          value={competencyData.title || ''}
                          onChange={(e) => setCompetencyData({ ...competencyData, title: e.target.value })}
                          className="text-lg font-semibold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none w-full"
                        />
                      ) : (
                        <h3 className="text-lg font-semibold text-gray-900">{competency.title}</h3>
                      )}
                    </div>
                  </div>
                  
                  {isEditing && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={saveCompetency}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  {isEditing ? (
                    <textarea
                      value={competencyData.description || ''}
                      onChange={(e) => setCompetencyData({ ...competencyData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-600">{competency.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpanded(competency.id)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  <div className="text-xs text-gray-500">
                    ID: {competency.id}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Curricular Goals</h4>
                        <div className="space-y-2">
                          {competency.curricularGoals.map((goal, index) => (
                            <div key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                              <div className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                {index + 1}
                              </div>
                              <p className="leading-relaxed">{goal}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Competency Details</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Code:</span>
                            <span className="font-mono font-bold">{competency.code}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Level:</span>
                            <span className="font-medium">{competency.level} - {competency.levelName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Aspect:</span>
                            <span className="font-medium">{competency.aspectName}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-200">
                            <span className="text-gray-600">Usage:</span>
                            <p className="text-gray-700 mt-1">This competency can be mapped to activities in lessons to ensure comprehensive coverage of the UNESCO AI framework.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCompetencies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Globe className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No competencies match the selected filters</p>
          <button
            onClick={() => {
              setSelectedLevel('all');
              setSelectedAspect('all');
            }}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};