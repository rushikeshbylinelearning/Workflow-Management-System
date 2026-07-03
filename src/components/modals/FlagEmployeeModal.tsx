import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { performanceFlagService } from '../../services/apiService';
import { Flag, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface FlagEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: number;
  memberName: string;
  onSuccess?: () => void;
  taskId?: number;
  taskName?: string;
}

export function FlagEmployeeModal({ 
  isOpen, 
  onClose, 
  memberId, 
  memberName, 
  onSuccess,
  taskId,
  taskName
}: FlagEmployeeModalProps) {
  const [type, setType] = useState<'red' | 'orange' | 'yellow' | 'green'>('yellow');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the flag');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await performanceFlagService.add({
        team_member_id: memberId,
        type,
        reason,
        ...(taskId != null ? { task_id: taskId } : {}),
      });
      
      setReason('');
      setType('yellow');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to add performance flag:', err);
      setError(err.message || 'Failed to add flag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const flagTypes = [
    { value: 'green', label: 'Positive (Green)', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    { value: 'yellow', label: 'Observation (Yellow)', icon: Info, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    { value: 'orange', label: 'Warning (Orange)', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { value: 'red', label: 'Critical (Red)', icon: Flag, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Flag Employee: ${memberName}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {taskName && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Related Task:</strong> {taskName}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Flag Type</label>
          <div className="grid grid-cols-2 gap-3">
            {flagTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value as any)}
                className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                  type === t.value 
                    ? `${t.bg} ${t.border} ring-2 ring-offset-1 ring-blue-500` 
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <t.icon className={`w-5 h-5 ${t.color}`} />
                <span className={`text-sm font-medium ${type === t.value ? t.color : 'text-gray-600'}`}>
                  {t.label.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
            Reason / Comments
          </label>
          <textarea
            id="reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe the reason for this flag..."
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className={`px-6 ${
              type === 'red' ? 'bg-red-600 hover:bg-red-700' :
              type === 'orange' ? 'bg-orange-500 hover:bg-orange-600' :
              type === 'yellow' ? 'bg-yellow-500 hover:bg-yellow-600' :
              'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            {loading ? 'Adding Flag...' : 'Add Flag'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
