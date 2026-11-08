import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, Clock, Tag } from 'lucide-react';
import type { ShoppingItem, CategoryData } from '../../types';

interface EditShoppingModalProps {
  isOpen: boolean;
  item: ShoppingItem | null;
  categories: Record<string, CategoryData>;
  onClose: () => void;
  onSave: (itemId: string, updates: { name: string; category?: string; byWhen?: string }) => Promise<void>;
}

export function EditShoppingModal({
  isOpen,
  item,
  categories,
  onClose,
  onSave
}: EditShoppingModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [byWhen, setByWhen] = useState('whenever');
  const [customDate, setCustomDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
      setCategory(item.category || 'other');
      
      const val = item.byWhen || 'whenever';
      if (val === 'whenever' || val === 'today' || val === 'tomorrow') {
        setByWhen(val);
        setCustomDate('');
      } else {
        setByWhen('custom');
        setCustomDate(val);
      }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const finalByWhen = byWhen === 'custom' ? (customDate || 'whenever') : byWhen;
      await onSave(item.id, {
        name: name.trim(),
        category,
        byWhen: finalByWhen
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 font-sans flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-base font-semibold text-text-primary">
            Edit Item
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
              Item Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Almond milk, Detergent..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover/50 border border-border text-base sm:text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-google-blue transition-all font-medium"
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(categories).map(([key, cat]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-google-blue bg-google-blue/10 text-google-blue font-semibold'
                        : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: cat.hex }} 
                    />
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* By When Date Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1.5">
              By When
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setByWhen('whenever');
                  setCustomDate('');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer text-center ${
                  byWhen === 'whenever'
                    ? 'border-google-blue bg-google-blue/10 text-google-blue font-semibold'
                    : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'
                }`}
              >
                Whenever
              </button>

              <button
                type="button"
                onClick={() => {
                  setByWhen('today');
                  setCustomDate('');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  byWhen === 'today'
                    ? 'border-google-blue bg-google-blue/10 text-google-blue font-semibold'
                    : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'
                }`}
              >
                <Clock size={12} className={byWhen === 'today' ? 'text-google-blue' : 'text-amber-500'} />
                <span>Today</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setByWhen('tomorrow');
                  setCustomDate('');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  byWhen === 'tomorrow'
                    ? 'border-google-blue bg-google-blue/10 text-google-blue font-semibold'
                    : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'
                }`}
              >
                <Calendar size={12} className={byWhen === 'tomorrow' ? 'text-google-blue' : 'text-blue-500'} />
                <span>Tomorrow</span>
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-xs text-text-secondary shrink-0">Or pick date:</span>
              <input
                type="date"
                min={todayIso}
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) {
                    setByWhen('custom');
                  }
                }}
                className={`flex-1 px-3 py-1.5 rounded-xl border text-base sm:text-sm outline-none bg-surface text-text-primary transition-all ${
                  byWhen === 'custom' && customDate 
                    ? 'border-google-blue ring-1 ring-google-blue/20' 
                    : 'border-border'
                }`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
