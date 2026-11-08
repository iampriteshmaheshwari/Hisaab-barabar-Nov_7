import React, { useEffect } from 'react';
import { 
  X, 
  Calculator, 
  CheckCircle2, 
  ArrowRight,
  Split
} from 'lucide-react';
import type { PairwiseCalculationBreakdown } from '../../services/splitService';

interface CalculationBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: PairwiseCalculationBreakdown | null;
}

export function CalculationBreakdownModal({
  isOpen,
  onClose,
  breakdown
}: CalculationBreakdownModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !breakdown) return null;

  const {
    memberA,
    memberB,
    activeItems = [],
    settledItems = [],
    appliedSettlements = [],
    totalAOwedB,
    totalBOwedA,
    directNet,
    simplifiedAmount,
    simplifiedRoute
  } = breakdown;

  // directNet > 0: memberA owes memberB
  // directNet < 0: memberB owes memberA
  const isDirectOwed = directNet > 0.01;
  const isDirectOwing = directNet < -0.01;
  const absDirect = Math.abs(directNet);
  const displayAmount = absDirect;

  const getGrammarOwes = (subject: string, target: string) => {
    return subject === 'You' ? `You owe ${target}` : `${subject} owes ${target}`;
  };

  // Consistent color styling matching user perspective:
  // When 'You' receive money -> GREEN (+). When 'You' pay money -> RED (-).
  const isYouReceiver = memberB.name === 'You';
  const isYouPayer = memberA.name === 'You';

  let netColorClass = 'text-text-primary';
  let netSign = '';
  let netSubject = '';

  if (isDirectOwed) {
    // memberA owes memberB
    netSubject = getGrammarOwes(memberA.name, memberB.name);
    if (isYouReceiver) {
      netColorClass = 'text-google-green';
      netSign = '+ ';
    } else if (isYouPayer) {
      netColorClass = 'text-google-red';
      netSign = '- ';
    } else {
      netColorClass = 'text-text-primary';
      netSign = '';
    }
  } else if (isDirectOwing) {
    // memberB owes memberA
    netSubject = getGrammarOwes(memberB.name, memberA.name);
    if (isYouReceiver) {
      netColorClass = 'text-google-red';
      netSign = '- ';
    } else if (isYouPayer) {
      netColorClass = 'text-google-green';
      netSign = '+ ';
    } else {
      netColorClass = 'text-text-primary';
      netSign = '';
    }
  } else {
    netSubject = 'All Settled Up';
    netColorClass = 'text-google-green';
  }

  // Cross-bills exist only when both members have open bills against each other
  const hasCrossBills = totalAOwedB > 0.01 && totalBOwedA > 0.01;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 border border-google-blue/20">
              <Calculator size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-text-primary tracking-tight leading-snug">
                Calculation Breakdown
              </h3>
              <p className="text-xs text-text-secondary font-medium truncate">
                {memberA.name} ↔ {memberB.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Case 1: Simplified Group Settlement (When no direct shared bills exist between A and B) */}
          {activeItems.length === 0 && simplifiedRoute ? (
            <div className="space-y-3">
              {/* Clean Group Balance Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-google-blue bg-google-blue/10 px-2.5 py-0.5 rounded-full border border-google-blue/20">
                    Group Balance Settlement
                  </span>
                  <span className="text-xs text-text-secondary font-medium">
                    Simplified Transfer
                  </span>
                </div>

                <div>
                  <div className="text-3xl font-bold font-mono text-text-primary tabular-nums tracking-tight">
                    ₹{(simplifiedAmount || absDirect).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs sm:text-sm text-text-secondary font-medium mt-0.5">
                    <span className="text-text-primary font-semibold">{memberA.name}</span> pays <span className="text-text-primary font-semibold">{memberB.name}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 text-xs text-text-secondary leading-relaxed">
                  This payment balances individual group credits and debts, minimizing the total transfers needed across the group.
                </div>
              </div>
            </div>
          ) : activeItems.length === 0 ? (
            /* Case 2: Truly all settled */
            <div className="py-8 px-4 text-center space-y-2 rounded-2xl bg-surface-hover/60 border border-border">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 size={20} strokeWidth={2.2} />
              </div>
              <h4 className="font-semibold text-sm sm:text-base text-text-primary">
                All Settled Up
              </h4>
              <p className="text-xs text-text-secondary">
                No active open expenses between {memberA.name} and {memberB.name}.
              </p>
            </div>
          ) : (
            /* Case 3: Direct Ledger Items */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider px-1">
                <span>Active Bills</span>
                <span className="px-2 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-[11px] font-bold tabular-nums">
                  {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="space-y-2.5">
                {activeItems.map((item) => {
                  const isOwed = item.type === 'you_owed_them';
                  const isOwing = item.type === 'they_owed_you';

                  return (
                    <div 
                      key={item.id} 
                      className="p-3.5 sm:p-4 rounded-2xl border border-border bg-surface text-xs sm:text-sm flex flex-col gap-1.5 shadow-2xs"
                    >
                      {/* Top row: Expense Name + Net amount */}
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-text-primary text-sm sm:text-base tracking-tight leading-snug break-words">
                          {item.expenseName}
                        </span>

                        <span className={`font-bold tabular-nums shrink-0 font-mono text-sm sm:text-base ${
                          isOwed 
                            ? 'text-google-red' 
                            : isOwing 
                            ? 'text-google-green' 
                            : 'text-text-primary'
                        }`}>
                          {isOwed ? '- ' : isOwing ? '+ ' : ''}₹{item.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Sub row: Who paid, whose share, and date (zero truncation!) */}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-text-secondary font-medium leading-relaxed pt-0.5">
                        <span className="break-words text-text-secondary/90">
                          {item.description}
                        </span>
                        {item.date && (
                          <span className="shrink-0 text-[11px] text-text-secondary/70 tabular-nums font-mono ml-auto">
                            {item.date}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recorded Settlement Payments Applied (Transparent deductions) */}
              {appliedSettlements.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider px-1">
                    <span>Settlements Recorded</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tabular-nums">
                      {appliedSettlements.length} {appliedSettlements.length === 1 ? 'payment' : 'payments'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {appliedSettlements.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-3 sm:p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-xs sm:text-sm flex items-center justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-text-primary text-xs sm:text-sm truncate">
                              {s.description}
                            </div>
                            {s.date && (
                              <div className="text-[11px] text-text-secondary mt-0.5">
                                {s.date} · Peer payment recorded
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono text-xs sm:text-sm shrink-0">
                          -₹{s.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Net Calculation for Direct Items (Zero duplication, 100% color consistency) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-hover/80 border border-border space-y-2.5">
                <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Net Calculation
                </div>
                
                <div className="space-y-2 text-xs sm:text-sm text-text-secondary">
                  {/* If direct settlement payments occurred, display the subtotal before and after */}
                  {appliedSettlements.length > 0 && (
                    <div className="space-y-1 pb-2 border-b border-border/60">
                      <div className="flex items-center justify-between font-medium">
                        <span>Original bills subtotal</span>
                        <span className="font-semibold text-text-primary tabular-nums font-mono">
                          ₹{(displayAmount + appliedSettlements.reduce((sum, s) => sum + s.amount, 0)).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-medium text-emerald-600 dark:text-emerald-400">
                        <span>Settlements deducted</span>
                        <span className="font-semibold tabular-nums font-mono">
                          - ₹{appliedSettlements.reduce((sum, s) => sum + s.amount, 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* If mutual cross-bills exist, display the 2 opposing amounts before the net total */}
                  {hasCrossBills && (
                    <div className="space-y-1.5 pb-2 border-b border-border/60">
                      <div className="flex items-center justify-between font-medium">
                        <span className="leading-snug break-words">{getGrammarOwes(memberA.name, memberB.name)}</span>
                        <span className="font-semibold text-text-primary tabular-nums shrink-0 font-mono ml-2">
                          ₹{totalAOwedB.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between font-medium">
                        <span className="leading-snug break-words">{getGrammarOwes(memberB.name, memberA.name)}</span>
                        <span className="font-semibold text-text-primary tabular-nums shrink-0 font-mono ml-2">
                          - ₹{totalBOwedA.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Net Total Row: Always color-consistent (Green for credit, Red for debt) */}
                  <div className="flex items-center justify-between pt-0.5 text-sm sm:text-base font-bold text-text-primary gap-2">
                    <span className="leading-snug break-words">{netSubject}</span>
                    <span className={`tabular-nums text-base sm:text-lg font-mono shrink-0 font-bold ${netColorClass}`}>
                      {displayAmount === 0 ? '₹0' : `${netSign}₹${displayAmount.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-surface shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-xs sm:text-sm font-semibold cursor-pointer transition-colors active:scale-98"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
