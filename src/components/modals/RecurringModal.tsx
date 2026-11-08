import React, { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
import type { CategoryData, ExpenseGroup, UserRole, RecurringExpense } from '../../types';
import { getLocalTodayIso } from '../../services/expenseService';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    amount: number;
    category: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    groupId: string;
  }) => Promise<void>;
  categories: Record<string, CategoryData>;
  groups: ExpenseGroup[];
  activeGroupId: string;
  userRole: UserRole;
  initialRecurring?: RecurringExpense | null;
}

export function RecurringModal({
  isOpen,
  onClose,
  onSave,
  categories,
  groups,
  activeGroupId,
  userRole,
  initialRecurring
}: RecurringModalProps) {
  const getDefaultCategory = () => {
    if (initialRecurring?.category && categories[initialRecurring.category]) {
      return initialRecurring.category;
    }
    if ('other' in categories) return 'other';
    const keys = Object.keys(categories);
    return keys[0] || 'other';
  };

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(getLocalTodayIso());
  const [endDate, setEndDate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(activeGroupId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic amount in words in Indian numbering format (matching ExpenseModal)
  const amountInWords = useMemo(() => amountToIndianWords(amount), [amount]);

  useEffect(() => {
    if (isOpen) {
      if (initialRecurring) {
        setName(initialRecurring.name);
        setAmount(String(initialRecurring.amount));
        setCategory(initialRecurring.category || getDefaultCategory());
        setFrequency(initialRecurring.frequency || 'monthly');
        setStartDate(initialRecurring.startDate || getLocalTodayIso());
        setEndDate(initialRecurring.endDate || '');
        setSelectedGroupId(initialRecurring.groupId || activeGroupId);
      } else {
        setName('');
        setAmount('');
        setCategory(getDefaultCategory());
        setFrequency('monthly');
        setStartDate(getLocalTodayIso());
        setEndDate('');
        setSelectedGroupId(activeGroupId);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, initialRecurring, activeGroupId, categories]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialRecurring);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || !name.trim()) return;
    if (endDate && startDate && endDate < startDate) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: initialRecurring?.id,
        name: name.trim(),
        amount: num,
        category,
        frequency,
        startDate: startDate || getLocalTodayIso(),
        endDate: endDate.trim() ? endDate.trim() : undefined,
        groupId: selectedGroupId
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 font-sans flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="text-base font-semibold text-text-primary">
            {isEditing ? 'Edit Recurring Bill' : 'New Recurring Bill'}
          </span>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] space-y-4">
          <div className="py-2 text-center">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1">
              Amount
            </label>
            <div className="inline-flex items-center justify-center">
              <span className="text-2xl font-light text-text-secondary mr-1">₹</span>
              <input
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                autoFocus={!isEditing}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-48 text-center text-4xl font-semibold tracking-tight bg-transparent outline-none text-text-primary placeholder:text-text-secondary/40"
              />
            </div>
            {/* Dynamic Amount in Words in Indian Format */}
            {amountInWords ? (
              <div className="mt-1 px-4 animate-in fade-in slide-in-from-top-1 duration-150">
                <p
                  aria-live="polite"
                  className="text-xs sm:text-[13px] font-medium text-google-blue dark:text-blue-400 tracking-normal text-center leading-relaxed select-none max-w-xs sm:max-w-sm mx-auto"
                >
                  {amountInWords}
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
              Bill / Subscription Name
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WiFi, Rent, Netflix"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue cursor-pointer"
              >
                {Object.entries(categories).map(([k, c]) => (
                  <option key={k} value={k}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Start Date
              </label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs sm:text-sm font-medium text-text-secondary">
                  End Date <span className="text-text-secondary/60 font-normal">(Optional)</span>
                </label>
                {endDate && (
                  <button
                    type="button"
                    onClick={() => setEndDate('')}
                    className="text-[11px] text-google-blue hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue"
              />
            </div>
          </div>

          {groups.length > 1 && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Ledger Group
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-2xl bg-surface-hover/70 border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue cursor-pointer"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !amount}
            className="w-full h-11 bg-google-blue hover:bg-blue-700 disabled:opacity-40 text-white rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <Check size={16} />
            <span>{isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Recurring Bill')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
