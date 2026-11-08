import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';
import type { CategoryData, Transaction, ExpenseGroup, UserRole } from '../../types';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; amount: number; category: string; date: string; groupId: string }) => Promise<void>;
  onDelete?: (txId: string) => void;
  categories: Record<string, CategoryData>;
  groups: ExpenseGroup[];
  activeGroupId: string;
  userRole: UserRole;
  initialTx?: Transaction | null;
}

export function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  categories,
  groups,
  activeGroupId,
  userRole,
  initialTx = null
}: ExpenseModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(initialTx?.groupId || activeGroupId);
  const [name, setName] = useState(initialTx?.name || '');
  const [category, setCategory] = useState(initialTx?.category || (categories['other'] ? 'other' : Object.keys(categories)[0] || 'other'));
  const [date, setDate] = useState(initialTx?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>(initialTx ? initialTx.amount.toString() : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic amount in words in Indian numbering format
  const amountInWords = React.useMemo(() => amountToIndianWords(amount), [amount]);

  // Synchronize state when modal opens or initialTx / activeGroupId changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedGroupId(initialTx?.groupId || activeGroupId);
      setName(initialTx?.name || '');
      setCategory(initialTx?.category || (categories['other'] ? 'other' : Object.keys(categories)[0] || 'other'));
      setDate(initialTx?.date || new Date().toISOString().split('T')[0]);
      setAmount(initialTx && initialTx.amount > 0 ? initialTx.amount.toString() : '');
    }
  }, [isOpen, initialTx, activeGroupId, categories]);

  if (!isOpen) return null;

  const isViewer = userRole === 'viewer';
  const isEditing = Boolean(initialTx && initialTx.id && initialTx.id.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        amount: numAmount,
        category,
        date,
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
        {/* Grab Handle for Mobile */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="text-base font-semibold text-text-primary">
            {isEditing ? 'Edit Expense' : 'New Expense'}
          </span>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] overflow-y-auto no-scrollbar space-y-4">
          {/* Big Amount Input */}
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
                autoFocus
                value={amount}
                disabled={isViewer}
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

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
              Description
            </label>
            <input
              required
              type="text"
              value={name}
              disabled={isViewer}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dinner, Groceries, Electricity"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-hover/70 border border-border text-base sm:text-sm text-text-primary outline-none focus:border-google-blue focus:bg-surface transition-all"
            />
          </div>

          {/* Category Pills Selector */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categories).map(([key, cat]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isViewer}
                    onClick={() => setCategory(key)}
                    className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-google-blue text-white shadow-xs'
                        : 'bg-surface-hover hover:bg-surface-active text-text-secondary border border-border'
                    }`}
                  >
                    <span 
                      className="w-1.5 h-1.5 rounded-full" 
                      style={{ backgroundColor: isSelected ? '#FFFFFF' : cat.hex }} 
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group & Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Group
              </label>
              <select
                value={selectedGroupId}
                disabled={isViewer}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-base sm:text-sm text-text-primary outline-none focus:border-google-blue cursor-pointer"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Date
              </label>
              <input
                required
                type="date"
                value={date}
                disabled={isViewer}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-base sm:text-sm text-text-primary outline-none focus:border-google-blue"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isViewer || isSubmitting || !name.trim() || !amount}
              className="w-full h-11 bg-google-blue hover:bg-blue-700 disabled:opacity-40 text-white rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Check size={16} />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
