import React, { useState } from 'react';
import { useCurriculum } from '../context/CurriculumContext';
import { 
  Edit3, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  BookOpen, 
  Clock, 
  Target, 
  Upload,
  FileText,
  Download,
  Settings,
  Users,
  Calendar,
  Award,
  TrendingUp
} from 'lucide-react';

export const GradeConfiguration: React.FC = () => {
  const { data, updateData, isAdminMode } = useCurriculum();
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'resources'>('overview');

  const handleFileUpload = (gradeId: string, type: 'student' | 'teacher') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.epub,.html';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Show success message
        alert(`${type === 'student' ? 'Student Book' : 'Teacher Guide'} uploaded successfully!\n\nFile: ${file.name}\n\nIn production, this would be processed and made available in the flipbook viewer.`);
      }
    };
    input.click();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Grade Configuration Overview</h3>
              <p className="text-gray-600 mb-4">
                Configure and manage grade-specific settings, competencies, and resources for your AI curriculum.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: BookOpen, label: 'Total Grades', value: data.grades.length, color: 'bg-blue-500' },
                  { icon: Clock, label: 'Avg Weekly Hours', value: `${(data.grades.reduce((sum, g) => sum + g.weeklyHours, 0) / data.grades.length || 0).toFixed(1)}h`, color: 'bg-green-500' },
                  { icon: Target, label: 'Grade Bands', value: data.gradeBands.length, color: 'bg-purple-500' }
                ].map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
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
            </div>

            {/* Grades List */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Configured Grades</h3>
                {isAdminMode && (
                  <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span>Add Grade</span>
                  </button>
                )}
              </div>
              
              <div className="grid gap-4">
                {data.grades.map((grade) => {
                  const gradeBand = data.gradeBands.find(band => band.id === grade.gradeBandId);
                  return (
                    <div key={grade.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{grade.name}</h4>
                            <p className="text-sm text-gray-600">{gradeBand?.name} • {grade.yearTheme}</p>
                            <p className="text-xs text-gray-500 italic">"{grade.essentialQuestion}"</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">{grade.weeklyHours}</div>
                            <div className="text-xs text-gray-500">Hours/Week</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">{grade.annualHours}</div>
                            <div className="text-xs text-gray-500">Annual Hours</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-600">{grade.projectTimePercent}%</div>
                            <div className="text-xs text-gray-500">Projects</div>
                          </div>
                          
                          {isAdminMode && (
                            <button
                              onClick={() => setEditingGrade(grade.id)}
                              className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Grade Details Configuration</h3>
              <p className="text-gray-600">Detailed configuration options for individual grades.</p>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Resource Management</h3>
              <p className="text-gray-600">Upload and manage student books, teacher guides, and other resources.</p>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.grades.map((grade) => (
                  <div key={grade.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">{grade.name}</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Student Book</p>
                          <p className="text-xs text-gray-600">{grade.resources?.studentBook || 'Not uploaded'}</p>
                        </div>
                        <button
                          onClick={() => handleFileUpload(grade.id, 'student')}
                          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload</span>
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Teacher Guide</p>
                          <p className="text-xs text-gray-600">{grade.resources?.teacherGuide || 'Not uploaded'}</p>
                        </div>
                        <button
                          onClick={() => handleFileUpload(grade.id, 'teacher')}
                          className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Settings className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Grade Configuration</h1>
              <p className="text-lg opacity-90 mt-1">Configure grades, competencies, and learning resources</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{data.grades.length}</div>
            <div className="text-sm opacity-75">Configured Grades</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'details', label: 'Details', icon: Settings },
            { id: 'resources', label: 'Resources', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};