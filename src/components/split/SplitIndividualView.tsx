import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Smartphone, 
  X, 
  ChevronRight, 
  Users 
} from 'lucide-react';
import type { ExpenseGroup, Transaction, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  calculateSplitGroupSummary, 
  getGroupMembersList,
  recordSettlementPayment,
  getPairwiseCalculationBreakdown,
  matchMemberKeys,
  canMarkAsReceived,
  type PairwiseCalculationBreakdown,
  type SimplifiedDebt
} from '../../services/splitService';
import { CalculationBreakdownModal } from './CalculationBreakdownModal';

interface SplitIndividualViewProps {
  group: ExpenseGroup;
  transactions: Transaction[];
  userRole: UserRole;
  onOpenSettleModal: (debtor: { key: string; name: string }, creditor: { key: string; name: string }, amount: number) => void;
  onRecordSettlement?: (debtor: { key: string; name: string }, creditor: { key: string; name: string }, amount: number) => Promise<void>;
  onOpenInviteModal?: () => void;
  onOpenAddExpense?: () => void;
  onShowToast?: (msg: string | { message: string; subMessage?: string; type?: 'info' | 'success' | 'warning' | 'error' }) => void;
}

export function SplitIndividualView({
  group,
  transactions,
  userRole,
  onOpenSettleModal,
  onRecordSettlement,
  onShowToast
}: SplitIndividualViewProps) {
  const { user } = useAuth();
  const [confirmDebt, setConfirmDebt] = useState<{
    debtor: { key: string; name: string };
    creditor: { key: string; name: string };
    amount: number;
  } | null>(null);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<PairwiseCalculationBreakdown | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  const members = useMemo(() => {
    return getGroupMembersList(group, user?.uid, user?.email || undefined);
  }, [group, user]);

  const summary = useMemo(() => {
    return calculateSplitGroupSummary(transactions, group, user?.uid, user?.email || undefined);
  }, [transactions, group, user]);

  const {
    yourNetBalance,
    simplifiedDebts
  } = summary;

  const isViewer = userRole === 'viewer';
  const effectiveUid = user?.uid || (group.createdBy === 'guest' || group.id.startsWith('local_') ? 'guest' : undefined);
  const myNormKey = (effectiveUid || '').toLowerCase();
  const myNormEmail = (user?.email || '').toLowerCase().trim();

  const isMe = (keyOrEmail?: string) => {
    if (!keyOrEmail) return false;
    const norm = keyOrEmail.toLowerCase().trim();
    if (norm === 'you') return true;
    if (!user && (norm === 'guest' || norm === 'local_user')) return true;
    if (myNormKey && norm === myNormKey) return true;
    if (myNormEmail && norm === myNormEmail) return true;
    const myKey = effectiveUid || myNormEmail;
    return Boolean(myKey && matchMemberKeys(keyOrEmail, myKey, group, user?.uid, user?.email || undefined));
  };

  // Partition simplified debts into personal debts vs other group members' settlements
  const { myDebts, otherDebts } = useMemo(() => {
    const mine: SimplifiedDebt[] = [];
    const others: SimplifiedDebt[] = [];

    simplifiedDebts.forEach(d => {
      const isMeDebtor = isMe(d.fromKey) || d.fromName === 'You';
      const isMeCreditor = isMe(d.toKey) || d.toName === 'You';
      if (isMeDebtor || isMeCreditor) {
        mine.push(d);
      } else {
        others.push(d);
      }
    });

    return { myDebts: mine, otherDebts: others };
  }, [simplifiedDebts, myNormKey, myNormEmail, user]);

  const handleOpenBreakdown = (d: SimplifiedDebt) => {
    const bd = getPairwiseCalculationBreakdown(
      transactions,
      group,
      d.fromKey,
      d.toKey,
      user?.uid,
      user?.email || undefined,
      d.amount
    );
    setSelectedBreakdown(bd);
    setShowBreakdownModal(true);
  };

  // Determine balance status
  const isOwed = yourNetBalance > 0.01;
  const youOwe = yourNetBalance < -0.01;

  // Handle direct settlement recording after user confirmation
  const handleExecuteSettlement = async () => {
    if (!confirmDebt) return;
    setIsSubmittingSettlement(true);
    try {
      if (onRecordSettlement) {
        await onRecordSettlement(confirmDebt.debtor, confirmDebt.creditor, confirmDebt.amount);
      } else {
        const today = new Date().toISOString().split('T')[0];
        await recordSettlementPayment(
          group.id,
          confirmDebt.debtor,
          confirmDebt.creditor,
          confirmDebt.amount,
          today,
          'Peer settlement recorded',
          user,
          group
        );
        if (onShowToast) {
          onShowToast({
            message: `₹${confirmDebt.amount.toLocaleString('en-IN')} marked as settled`,
            subMessage: `${confirmDebt.debtor.name} → ${confirmDebt.creditor.name} · Open dues reconciled`,
            type: 'success'
          });
        }
      }
      setConfirmDebt(null);
    } catch (err: any) {
      if (onShowToast) {
        onShowToast({
          message: 'Failed to record settlement',
          subMessage: err?.message || 'Please try again',
          type: 'error'
        });
      }
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 font-sans">
      {/* 1. Hero Balance Card: Dynamic Plain-Language Settlement Status */}
      <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-xs space-y-1">
        <span className="text-xs sm:text-sm font-medium text-text-secondary tracking-tight">
          {isOwed ? 'Overall, you are owed' : youOwe ? 'Overall, you owe' : 'Settlement Status'}
        </span>

        <div className={`text-3xl sm:text-4xl font-semibold tracking-[-0.03em] ${
          isOwed 
            ? 'text-google-green tabular-nums' 
            : youOwe 
              ? 'text-google-red tabular-nums' 
              : 'text-text-primary'
        }`}>
          {isOwed ? (
            `+₹${yourNetBalance.toLocaleString('en-IN')}`
          ) : youOwe ? (
            `₹${Math.abs(yourNetBalance).toLocaleString('en-IN')}`
          ) : (
            <span className="flex items-center gap-2 text-2xl sm:text-3xl">
              <CheckCircle2 size={24} className="text-google-green shrink-0" />
              <span>All settled up</span>
            </span>
          )}
        </div>

      </div>

      {/* 2. Your Actionable Settlements (Directly involving current user) */}
      {myDebts.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Your Settlements
            </span>
            <span className="px-2 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-[11px] font-bold tabular-nums">
              {myDebts.length} {myDebts.length === 1 ? 'payment' : 'payments'}
            </span>
          </div>

          <div className="space-y-2.5">
            {myDebts.map((d, index) => {
              const isMeDebtor = isMe(d.fromKey) || d.fromName === 'You';
              const isMeCreditor = isMe(d.toKey) || d.toName === 'You';

              const debtorName = isMeDebtor ? 'You' : d.fromName;
              const creditorName = isMeCreditor ? 'You' : d.toName;

              return (
                <div
                  key={`my_${index}`}
                  className="p-4 rounded-2xl sm:rounded-3xl border border-border bg-surface hover:border-google-blue/30 transition-all flex flex-col gap-3 shadow-2xs"
                >
                  {/* Row 1: Direction on left, Amount + Details button on right */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 min-w-0 font-semibold text-sm sm:text-base flex-wrap sm:flex-nowrap">
                      <span className={`${isMeDebtor ? 'text-google-red font-bold' : 'text-text-primary'} break-words`}>
                        {debtorName}
                      </span>
                      <ArrowRight size={13} className="text-text-secondary shrink-0" />
                      <span className={`${isMeCreditor ? 'text-google-green font-bold' : 'text-text-primary'} break-words`}>
                        {creditorName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                      <span className="text-base sm:text-lg font-bold text-text-primary tabular-nums font-mono">
                        ₹{d.amount.toLocaleString('en-IN')}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenBreakdown(d)}
                        className="py-1 px-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-google-blue hover:bg-surface-hover border border-border/50 transition-colors flex items-center gap-0.5 cursor-pointer active:scale-95 shrink-0"
                        title="View calculation breakdown"
                      >
                        <span>Details</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Actions */}
                  {!isViewer && (
                    <div className="pt-2.5 border-t border-border/50">
                      {isMeDebtor ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenSettleModal(
                                { key: d.fromKey, name: d.fromName },
                                { key: d.toKey, name: d.toName },
                                d.amount
                              );
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-google-blue hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <Smartphone size={14} />
                            <span>Pay via UPI</span>
                          </button>

                          {(() => {
                            const markCheck = canMarkAsReceived(d.fromKey, d.toKey, user, userRole, group);
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!markCheck.allowed) {
                                    if (onShowToast) onShowToast({ message: markCheck.reason || 'Only the person who receives the payment or the group owner can mark this as received.', type: 'info' });
                                    return;
                                  }
                                  setConfirmDebt({
                                    debtor: { key: d.fromKey, name: d.fromName },
                                    creditor: { key: d.toKey, name: d.toName },
                                    amount: d.amount
                                  });
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                                  markCheck.allowed
                                    ? 'bg-surface-hover hover:bg-surface-active border-border text-text-primary cursor-pointer hover:border-emerald-500/40'
                                    : 'bg-surface-hover/30 border-border/50 text-text-secondary/35 cursor-not-allowed'
                                }`}
                                title={markCheck.allowed ? 'Record as Settled' : (markCheck.reason || 'Cannot record settlement')}
                              >
                                <CheckCircle2 size={14} className={markCheck.allowed ? 'text-emerald-500' : 'text-text-secondary/35'} />
                                <span>Record as Settled</span>
                              </button>
                            );
                          })()}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDebt({
                              debtor: { key: d.fromKey, name: d.fromName },
                              creditor: { key: d.toKey, name: d.toName },
                              amount: d.amount
                            });
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 size={15} />
                          <span>Mark as Received</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Other Member Settlements (Between other members - strictly informational, no action buttons) */}
      {otherDebts.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="px-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Users size={13} className="text-text-secondary" />
              <span>Other Member Settlements</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-hover text-text-secondary text-[11px] font-bold tabular-nums border border-border">
              {otherDebts.length} {otherDebts.length === 1 ? 'payment' : 'payments'}
            </span>
          </div>

          <div className="space-y-2">
            {otherDebts.map((d, index) => (
              <div
                key={`other_${index}`}
                className="p-3.5 rounded-2xl border border-border/80 bg-surface/70 transition-all flex items-center justify-between gap-2.5 shadow-2xs"
              >
                {/* Names on left */}
                <div className="flex items-center gap-1.5 min-w-0 font-medium text-xs sm:text-sm text-text-primary flex-wrap sm:flex-nowrap">
                  <span className="font-semibold break-words">{d.fromName}</span>
                  <ArrowRight size={12} className="text-text-secondary shrink-0" />
                  <span className="font-semibold break-words">{d.toName}</span>
                </div>

                {/* Amount + Details button on right (No Settle button!) */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <span className="text-sm sm:text-base font-bold text-text-primary tabular-nums font-mono">
                    ₹{d.amount.toLocaleString('en-IN')}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenBreakdown(d)}
                    className="py-1 px-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-google-blue hover:bg-surface-hover border border-border/50 transition-colors flex items-center gap-0.5 cursor-pointer active:scale-95 shrink-0"
                    title="View calculation breakdown"
                  >
                    <span>Details</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Subtle & Intuitive Confirmation Dialog (Apple / Google Style) */}
      {confirmDebt && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isSubmittingSettlement && setConfirmDebt(null)}
        >
          <div 
            className="bg-surface w-full max-w-xs rounded-3xl p-5 border border-border shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={20} strokeWidth={2.4} />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-base sm:text-lg text-text-primary tracking-tight">
                {confirmDebt.creditor.name === 'You' || confirmDebt.creditor.key === user?.uid
                  ? `Mark ₹${confirmDebt.amount.toLocaleString('en-IN')} as received?`
                  : confirmDebt.debtor.name === 'You' || confirmDebt.debtor.key === user?.uid
                    ? `Mark ₹${confirmDebt.amount.toLocaleString('en-IN')} as paid?`
                    : `Settle ₹${confirmDebt.amount.toLocaleString('en-IN')}?`}
              </h4>
              <p className="text-xs text-text-secondary font-medium">
                {confirmDebt.debtor.name} → {confirmDebt.creditor.name}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingSettlement}
                onClick={() => setConfirmDebt(null)}
                className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-xs sm:text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingSettlement}
                onClick={handleExecuteSettlement}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-xs active:scale-95 disabled:opacity-50"
              >
                {isSubmittingSettlement 
                  ? 'Saving...' 
                  : confirmDebt.creditor.name === 'You' || confirmDebt.creditor.key === user?.uid
                    ? 'Confirm Received'
                    : confirmDebt.debtor.name === 'You' || confirmDebt.debtor.key === user?.uid
                      ? 'Confirm Paid'
                      : 'Confirm Settled'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Breakdown Modal */}
      <CalculationBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        breakdown={selectedBreakdown}
      />
    </div>
  );
}
