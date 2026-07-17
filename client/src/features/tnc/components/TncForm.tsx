import React, { useState, useEffect } from 'react';
import { Plus, Save, X, Loader2, CreditCard, Truck } from 'lucide-react';
import { Tnc, CreateTncInput } from '../types';
import { Button } from '@/components/ui';

interface TncFormProps {
  editingTnc: Tnc | null;
  existingTypes: string[];
  onSubmit: (data: CreateTncInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TncForm: React.FC<TncFormProps> = ({
  editingTnc,
  onSubmit,
  onCancel,
  isLoading,
}) => {
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Payment');

  useEffect(() => {
    if (editingTnc) {
      setDescription(editingTnc.description);
      setType(editingTnc.type);
    } else {
      setDescription('');
      setType('Payment');
    }
  }, [editingTnc]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ type, description });
    if (!editingTnc) {
      setDescription('');
      setType('Payment');
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
      {/* Header with gradient + centered segmented toggle */}
      <div
        className={`px-6 py-5 border-b border-[var(--border)] ${
          editingTnc
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
        }`}
      >
        <p className="text-white/80 text-sm">
          {editingTnc
            ? 'Update the existing term or condition'
            : 'Create a new payment or delivery term'}
        </p>

        {/* Centered segmented toggle — Payment T&C / Delivery T&C */}
        <div className="flex justify-center mt-4">
          <div className="relative flex items-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-1 shadow-lg">
            {/* Animated sliding pill */}
            <div
              className="absolute top-1 bottom-1 transition-all duration-300 ease-out rounded-lg bg-white shadow-md"
              style={{
                width: 'calc(50% - 4px)',
                left: type === 'Payment' ? '4px' : 'calc(50%)',
              }}
            />

            {/* Payment T&C tab */}
            <button
              type="button"
              onClick={() => setType('Payment')}
              className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 min-w-[140px] justify-center ${
                type === 'Payment' ? 'text-blue-600' : 'text-white/80 hover:text-white'
              }`}
            >
              <CreditCard size={15} />
              <span>Payment T&amp;C</span>
            </button>

            {/* Delivery T&C tab */}
            <button
              type="button"
              onClick={() => setType('Delivery')}
              className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 min-w-[140px] justify-center ${
                type === 'Delivery' ? 'text-blue-600' : 'text-white/80 hover:text-white'
              }`}
            >
              <Truck size={15} />
              <span>Delivery T&amp;C</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Description — full width since toggle above is the type selector */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Term Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--surface-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all resize-none overflow-y-auto outline-none placeholder:text-[var(--text-secondary)]"
              placeholder="Enter the term or condition details..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {description.length}/500 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !description.trim() || !type.trim()}
              className={`min-w-[140px] ${
                editingTnc
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
              }`}
              leftIcon={
                isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingTnc ? (
                  <Save size={18} />
                ) : (
                  <Plus size={18} />
                )
              }
            >
              {isLoading ? 'Saving...' : editingTnc ? 'Update Term' : 'Add Term'}
            </Button>

            {editingTnc && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                leftIcon={<X size={18} />}
                className="text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
