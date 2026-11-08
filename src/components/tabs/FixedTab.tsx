import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Repeat, 
  Plus, 
  Trash2, 
  Power,
  Pencil,
  AlertTriangle,
  X
} from 'lucide-react';
import type { RecurringExpense, CategoryData, UserRole } from '../../types';
import { getLocalTodayIso } from '../../services/expenseService';
import { formatINR } from '../../utils/formatUtils';

interface FixedTabProps {
  recurringExpenses: RecurringExpense[];
  categories: Record<string, CategoryData>;
  userRole: UserRole;
  onOpenAddRecurring: () => void;
  onEditRecurring: (rec: RecurringExpense) => void;
  onToggleStatus: (rec: RecurringExpense) => Promise<void>;
  onDeleteRecurring: (recId: string) => Promise<void>;
  groupName: string;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return dateStr;
  }
}

export function FixedTab({
  recurringExpenses,
  categories,
  userRole,
  onOpenAddRecurring,
  onEditRecurring,
  onToggleStatus,
  onDeleteRecurring,
  groupName
}: FixedTabProps) {
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const todayStr = getLocalTodayIso();

  // Delete bill confirmation state
  const [billToDelete, setBillToDelete] = useState<RecurringExpense | null>(null);

  // Escape key handler for delete confirmation
  useEffect(() => {
    if (!billToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBillToDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billToDelete]);

  const totalMonthly = Math.round(
    recurringExpenses
      .filter(r => {
        const isActive = (r.status || 'active') === 'active';
        const hasEnded = Boolean(r.endDate && r.endDate < todayStr);
        return isActive && !hasEnded;
      })
      .reduce((acc, r) => {
        const freq = (r.frequency || 'monthly').toLowerCase();
        if (freq === 'daily') return acc + r.amount * 30;
        if (freq === 'weekly') return acc + (r.amount * 52) / 12;
        if (freq === 'quarterly') return acc + r.amount / 3;
        if (freq === 'yearly') return acc + r.amount / 12;
        return acc + r.amount;
      }, 0)
  );

  return (
    <div className="space-y-4 pb-4 font-sans">
      {/* Monthly Commitment Card */}
      <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-xs flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-text-secondary tracking-tight">
            Monthly Fixed Bills
          </span>
          <div className="text-3xl font-semibold tracking-[-0.03em] text-text-primary mt-0.5">
            {formatINR(totalMonthly, { symbol: true })}{' '}
            <span className="text-xs font-normal text-text-secondary">/ mo</span>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onOpenAddRecurring}
            className="h-9 px-3.5 rounded-full bg-google-blue hover:bg-blue-700 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>Add Bill</span>
          </button>
        )}
      </div>

      {/* Commitments List */}
      <div className="space-y-2">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          Scheduled ({recurringExpenses.length})
        </div>

        {recurringExpenses.length === 0 ? (
          <div className="py-12 text-center bg-surface rounded-3xl border border-border text-xs text-text-secondary">
            No recurring bills set up.
          </div>
        ) : (
          <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
            {recurringExpenses.map((rec) => {
              const catData = categories[rec.category] || { name: rec.category, hex: '#888888' };
              const isActive = (rec.status || 'active') === 'active';
              const hasEnded = Boolean(rec.endDate && rec.endDate < todayStr);

              return (
                <div
                  key={rec.id}
                  className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors ${
                    !isActive || hasEnded ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${catData.hex}14`, color: catData.hex }}
                    >
                      <Repeat size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm sm:text-base font-medium text-text-primary truncate">
                          {rec.name}
                        </span>
                        {!isActive && (
                          <span className="text-xs text-text-secondary px-2 py-0.5 rounded-md bg-surface-hover">
                            Paused
                          </span>
                        )}
                        {hasEnded && (
                          <span className="text-xs text-text-secondary px-2 py-0.5 rounded-md bg-surface-hover">
                            Ended
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-text-secondary truncate mt-0.5">
                        <span className="capitalize">{rec.frequency || 'Monthly'}</span>
                        <span> · {catData.name}</span>
                        {rec.endDate && <span> · Until {formatShortDate(rec.endDate)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm sm:text-base font-semibold text-text-primary">
                      {formatINR(rec.amount, { symbol: true })}
                    </span>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditRecurring(rec)}
                          className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(rec)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isActive 
                              ? 'text-text-secondary hover:text-amber-600' 
                              : 'text-emerald-600'
                          }`}
                          title={isActive ? 'Pause' : 'Activate'}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillToDelete(rec)}
                          className="p-1.5 text-text-secondary hover:text-google-red rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Fixed Bill Confirmation Modal (Native Apple/Google style) */}
      {billToDelete && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[100] w-screen h-screen min-h-[100dvh] bg-black/15 dark:bg-black/35 backdrop-blur-[5px] transition-all duration-200 animate-in fade-in cursor-pointer select-none touch-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBillToDelete(null);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBillToDelete(null);
            }}
            aria-hidden="true"
          />
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 select-none pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bill-dialog-title"
          >
            <div 
              className="w-full max-w-xs bg-surface border border-border shadow-2xl rounded-3xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10 pointer-events-auto text-left font-sans"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-google-red flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </div>
                <button
                  type="button"
                  onClick={() => setBillToDelete(null)}
                  className="w-7 h-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>

              <div className="space-y-1">
                <h4 id="delete-bill-dialog-title" className="text-sm sm:text-base font-semibold text-text-primary">
                  Delete Fixed Bill?
                </h4>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-text-primary">"{billToDelete.name}"</span> ({formatINR(billToDelete.amount, { symbol: true })})? This will stop future recurring charges and cannot be undone.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBillToDelete(null)}
                  className="flex-1 h-9.5 rounded-xl border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = billToDelete.id;
                    setBillToDelete(null);
                    onDeleteRecurring(id);
                  }}
                  className="flex-1 h-9.5 rounded-xl bg-google-red hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Trash2 size={14} strokeWidth={2} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
