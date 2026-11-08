import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Transaction, ExpenseGroup } from '../../types';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';

interface SettleModalProps {
  isOpen?: boolean;
  tx: Transaction | null;
  activeGroup?: ExpenseGroup | null;
  onClose: () => void;
  onSave: (refundAmount: number, note: string) => Promise<void>;
}

export function SettleModal({
  isOpen = true,
  tx,
  onClose,
  onSave
}: SettleModalProps) {
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tx && isOpen) {
      setRefundAmount(tx.amount.toString());
      setNote('Refunded');
    }
  }, [tx, isOpen]);

  // Dynamic amount in words in Indian numbering format
  const amountInWords = useMemo(() => amountToIndianWords(refundAmount), [refundAmount]);

  if (!tx || !isOpen) return null;

  const currentRefund = parseFloat(refundAmount) || 0;
  const remaining = Math.max(0, tx.amount - currentRefund);
  const isFull = currentRefund >= tx.amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(refundAmount);
    if (isNaN(num) || num <= 0) return;

    setIsSubmitting(true);
    try {
      const finalNote = note.trim() || 'Refunded';
      await onSave(num, finalNote);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 font-sans flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle for Mobile */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Refunded / Returned
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {tx.name} · Original: <span className="font-semibold text-text-primary">₹{tx.amount.toLocaleString('en-IN')}</span>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] space-y-4">
          {/* Hero Refund Amount Input matching ExpenseModal */}
          <div className="py-2 text-center">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-1">
              Refund Amount
            </label>
            <div className="inline-flex items-center justify-center">
              <span className="text-2xl font-light text-text-secondary mr-1">₹</span>
              <input
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={tx.amount}
                autoFocus
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0"
                className="w-48 text-center text-4xl font-semibold tracking-tight bg-transparent outline-none text-text-primary placeholder:text-text-secondary/40 tabular-nums"
              />
            </div>
            {amountInWords ? (
              <div className="mt-1 px-4 animate-in fade-in slide-in-from-top-1 duration-150">
                <p className="text-xs font-medium text-google-blue dark:text-blue-400 text-center select-none">
                  {amountInWords}
                </p>
              </div>
            ) : null}
          </div>

          {/* Reason / Reference */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
              Reason (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Returned item, order cancelled, reimbursement"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-hover/70 border border-border text-base sm:text-sm text-text-primary placeholder:text-text-secondary/60 outline-none focus:border-google-blue focus:bg-surface transition-all"
            />
          </div>

          {/* Remaining in Ledger Outcome */}
          <div className="p-3.5 rounded-2xl bg-surface-hover/60 border border-border flex items-center justify-between text-xs sm:text-sm">
            <span className="text-text-secondary">Expense in Ledger After Refund</span>
            <span className="font-semibold font-mono text-text-primary tabular-nums">
              {isFull ? '₹0 (Fully Refunded)' : `₹${remaining.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || currentRefund <= 0}
              className="flex-1 h-11 rounded-2xl bg-google-blue hover:bg-google-blue-hover text-white text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving...' : 'Confirm'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
