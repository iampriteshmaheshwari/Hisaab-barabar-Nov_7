import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Pencil, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  X,
  AlertTriangle
} from 'lucide-react';
import type { Transaction, CategoryData } from '../../types';
import { formatTimeAgo } from '../../services/splitService';
import { formatINR } from '../../utils/formatUtils';

export interface TransactionActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  anchorRect?: DOMRect | null;
  categories?: Record<string, CategoryData>;
  isSplitGroup?: boolean;
  onEditExpense: (tx: Transaction) => void;
  onDeleteExpense?: (txId: string) => void;
  onRefundExpense?: (tx: Transaction) => void;
  onUndoSettleExpense?: (tx: Transaction) => void;
}

export function TransactionActionSheet({
  isOpen,
  onClose,
  transaction,
  anchorRect,
  categories,
  isSplitGroup = false,
  onEditExpense,
  onDeleteExpense,
  onRefundExpense,
  onUndoSettleExpense,
}: TransactionActionMenuProps) {
  // Local state for delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset confirmation state whenever dialog closes or transaction changes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
    }
  }, [isOpen, transaction]);

  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dismiss on scroll or window resize while menu is open (if not in confirm state)
  useEffect(() => {
    if (!isOpen || showDeleteConfirm) return;
    const handleDismiss = () => {
      onClose();
    };
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [isOpen, showDeleteConfirm, onClose]);

  if (!isOpen || !transaction) return null;

  const catData = (categories && categories[transaction.category]) || { 
    name: transaction.category || 'Expense' 
  };

  const isSplit = Boolean(
    isSplitGroup || 
    transaction.splitMode || 
    (transaction.splitMembers && transaction.splitMembers.length > 0) ||
    transaction.groupId?.includes('split')
  );

  // Compute native-style dropdown coordinates anchored directly at the 3-dots button
  const menuWidth = 240; // px (w-60)
  const hasRefundAction = !isSplit && Boolean((onRefundExpense && !transaction.settled && !transaction.isSettlement) || (onUndoSettleExpense && (transaction.settled || transaction.note?.toLowerCase().trim() === 'settled') && !transaction.isSettlement));
  const estimatedHeight = 110 + (onDeleteExpense ? 44 : 0) + (hasRefundAction ? 44 : 0) + (!transaction.isSettlement ? 44 : 0);

  let style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 110,
  };

  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const openUpward = spaceBelow < estimatedHeight + 20 && anchorRect.top > estimatedHeight + 20;

    if (openUpward) {
      style.bottom = `${Math.max(16, window.innerHeight - anchorRect.top + 6)}px`;
    } else {
      style.top = `${Math.min(window.innerHeight - estimatedHeight - 16, anchorRect.bottom + 6)}px`;
    }

    // Align to the right edge of the 3-dots button with safety margin
    const rightCoord = window.innerWidth - anchorRect.right;
    style.right = `${Math.max(16, Math.min(window.innerWidth - menuWidth - 16, rightCoord))}px`;
  } else {
    // Safe fallback centered
    style.top = '30%';
    style.right = '16px';
  }

  const content = (
    <>
      {/* 
        Full-screen Translucent Backdrop covering 100% of the entire viewport 
        (Rendered via React Portal directly into document.body with z-[100])
        Reduced blur effect to backdrop-blur-[5px] for crisp, elegant translucency
        Includes touch-none, e.preventDefault() and e.stopPropagation() on touch/click 
        to guarantee zero touch bleed-through or ghost clicks into underlying transaction rows.
      */}
      <div 
        className="fixed inset-0 z-[100] w-screen h-screen min-h-[100dvh] bg-black/15 dark:bg-black/35 backdrop-blur-[5px] transition-all duration-200 animate-in fade-in cursor-pointer select-none touch-none"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Delete Confirmation Dialog Modal */}
      {showDeleteConfirm ? (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 select-none pointer-events-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div 
            className="w-full max-w-xs bg-surface border border-border shadow-2xl rounded-3xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10 pointer-events-auto text-left font-sans"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                transaction.isSettlement 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                  : 'bg-red-500/10 text-google-red'
              }`}>
                {transaction.isSettlement ? (
                  <RotateCcw size={20} strokeWidth={2.2} />
                ) : (
                  <AlertTriangle size={20} strokeWidth={2.2} />
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Cancel"
                aria-label="Cancel"
              >
                <X size={15} strokeWidth={2.2} />
              </button>
            </div>

            <div className="space-y-1.5">
              <h4 id="delete-dialog-title" className="text-sm sm:text-base font-semibold text-text-primary">
                {transaction.isSettlement 
                  ? 'Undo Settlement Payment?' 
                  : transaction.settled || (transaction.settledMembers && transaction.settledMembers.length > 0)
                    ? 'Delete Settled Expense?' 
                    : 'Delete Expense?'}
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                {transaction.isSettlement ? (
                  <>
                    Are you sure you want to cancel the settlement of <span className="font-semibold text-text-primary">{formatINR(transaction.amount, { symbol: true })}</span>? This will re-open the debt between <span className="font-semibold text-text-primary">{transaction.paidByName || 'Payer'}</span> and <span className="font-semibold text-text-primary">{transaction.settledToName || 'Receiver'}</span>, and restore any cleared bills back to Open.
                  </>
                ) : transaction.settled || (transaction.settledMembers && transaction.settledMembers.length > 0) ? (
                  <>
                    Are you sure you want to delete <span className="font-semibold text-text-primary">"{transaction.name}"</span> ({formatINR(transaction.amount, { symbol: true })})? This expense was already settled by group members. Deleting it will recalculate all member dues and reopen balances.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete <span className="font-semibold text-text-primary">"{transaction.name}"</span> ({formatINR(transaction.amount, { symbol: true })})? It will be moved to Recently Deleted and kept for 30 days.
                  </>
                )}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9.5 rounded-xl border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteExpense) {
                    onDeleteExpense(transaction.id);
                  }
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                className={`flex-1 h-9.5 rounded-xl text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                  transaction.isSettlement 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-google-red hover:bg-red-700'
                }`}
              >
                {transaction.isSettlement ? (
                  <>
                    <RotateCcw size={14} strokeWidth={2} />
                    <span>Undo Settlement</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} strokeWidth={2} />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Anchored Context Menu (Apple iOS UIMenu & Google Material 3 Popup) */
        <div
          style={style}
          className="w-60 bg-surface/98 dark:bg-surface/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-1.5 text-left font-sans animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10"
          role="menu"
          aria-orientation="vertical"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Header with Expense Title, Subtitle, and Cross (X) Close Symbol */}
          <div className="px-3 pt-2 pb-1.5 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight truncate leading-tight">
                {transaction.name}
              </div>
              <div className="text-[11px] sm:text-xs text-text-secondary truncate flex items-center gap-1.5 mt-0.5">
                <span>{catData.name}</span>
                <span className="text-text-secondary/40">·</span>
                <span className="font-semibold font-mono text-text-primary">
                  {formatINR(transaction.amount, { symbol: true })}
                </span>
                {transaction.settled && !isSplit && (
                  <>
                    <span className="text-text-secondary/40">·</span>
                    <span className="text-[10px] font-semibold text-google-blue dark:text-blue-400">
                      Refunded
                    </span>
                  </>
                )}
              </div>
              {transaction.lastEditedByName && (
                <div className="text-[10px] text-text-secondary/80 flex items-center gap-1 mt-1 truncate">
                  <Pencil size={9} className="shrink-0 text-text-secondary/60" />
                  <span>
                    Edited by {transaction.lastEditedByName}
                    {transaction.lastEditedAt ? ` · ${formatTimeAgo(transaction.lastEditedAt)}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Cross Symbol to close the menu */}
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5 active:scale-90"
              title="Close"
              aria-label="Close"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>

          {/* Hairline Divider below Header */}
          <div className="h-px bg-border/60 mx-1 mb-1" />

          {/* Action Items */}
          <div className="space-y-0.5">
            {/* Refund Expense (strictly for personal/budget expense tracker entries, never split ledgers) */}
            {!isSplit && onRefundExpense && !transaction.settled && !transaction.isSettlement && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRefundExpense(transaction);
                  onClose();
                }}
                className="w-full h-9.5 px-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium text-text-primary hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer select-none text-left"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <RotateCcw size={15} className="text-text-secondary shrink-0" />
                </div>
                <span className="truncate whitespace-nowrap">Refunded / Returned</span>
              </button>
            )}

            {/* Undo Refund (strictly for personal/budget expense tracker entries, never split ledgers) */}
            {!isSplit && onUndoSettleExpense && (transaction.settled || transaction.note?.toLowerCase().trim() === 'settled') && !transaction.isSettlement && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onUndoSettleExpense(transaction);
                  onClose();
                }}
                className="w-full h-9.5 px-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium text-text-primary hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer select-none text-left"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <RotateCcw size={15} className="text-text-secondary shrink-0" />
                </div>
                <span className="truncate">Undo Refund</span>
              </button>
            )}

            {/* Edit (only for real expenses, settlements cannot be edited as expenses) */}
            {!transaction.isSettlement && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onEditExpense(transaction);
                  onClose();
                }}
                className="w-full h-9.5 px-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium text-text-primary hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer select-none"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Pencil size={15} className="text-text-secondary shrink-0" />
                </div>
                <span>Edit</span>
              </button>
            )}
          </div>

          {/* Delete / Undo Settlement */}
          {onDeleteExpense && (
            <>
              <div className="h-px bg-border/60 mx-1 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowDeleteConfirm(true);
                }}
                className={`w-full h-9.5 px-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none ${
                  transaction.isSettlement
                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/15'
                    : 'text-google-red hover:bg-red-500/10 active:bg-red-500/15'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {transaction.isSettlement ? (
                    <RotateCcw size={15} className="shrink-0" />
                  ) : (
                    <Trash2 size={15} className="shrink-0" />
                  )}
                </div>
                <span>{transaction.isSettlement ? 'Undo Settlement' : 'Delete'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  // Render via portal directly to document.body so backdrop covers 100% of the screen without clipping
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// Export alias
export const TransactionActionMenu = TransactionActionSheet;
