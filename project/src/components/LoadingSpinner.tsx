import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Curriculum Data</h2>
        <p className="text-gray-600">Connecting to database and initializing data...</p>
      </div>
    </div>
  );
};