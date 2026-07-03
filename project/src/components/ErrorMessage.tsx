import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Error</h2>
        </div>
        <p className="text-gray-600 leading-relaxed">{message}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};