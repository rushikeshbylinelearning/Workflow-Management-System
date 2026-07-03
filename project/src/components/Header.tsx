import React from 'react';
import { BookOpen, Settings, Eye, Lock, Edit3, Save, X } from 'lucide-react';
import { useCurriculum } from '../context/CurriculumContext';

export const Header: React.FC = () => {
  const { isAdminMode, setIsAdminMode, data, updateData } = useCurriculum();
  const [isEditingHeader, setIsEditingHeader] = React.useState(false);
  const [headerData, setHeaderData] = React.useState({
    title: 'AI Curriculum Designer',
    subtitle: 'Pre-K to Grade 12 Curriculum Development'
  });

  const saveHeader = () => {
    // In a real app, this would update the global settings
    setIsEditingHeader(false);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              {isEditingHeader ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={headerData.title}
                    onChange={(e) => setHeaderData({ ...headerData, title: e.target.value })}
                    className="text-xl font-bold text-gray-900 bg-transparent border-b border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={headerData.subtitle}
                    onChange={(e) => setHeaderData({ ...headerData, subtitle: e.target.value })}
                    className="text-sm text-gray-600 bg-transparent border-b border-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-gray-900">{headerData.title}</h1>
                  <p className="text-sm text-gray-600">{headerData.subtitle}</p>
                </>
              )}
            </div>
            {isAdminMode && (
              <div className="ml-4">
                {isEditingHeader ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={saveHeader}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingHeader(false)}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingHeader(true)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setIsAdminMode(false)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  !isAdminMode 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>View Mode</span>
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isAdminMode 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Admin Mode</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isAdminMode ? 'bg-orange-400' : 'bg-green-400'}`}></div>
              <span className="text-gray-600">
                {isAdminMode ? 'Admin' : 'Viewer'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};