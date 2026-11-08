import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  ReceiptText, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  Search,
  Check,
  RotateCcw,
  Clock,
  ChevronDown,
  X,
  MoreVertical,
  Pencil,
  AlertTriangle,
  Info
} from 'lucide-react';
import type { ExpenseGroup, Transaction, UserRole, DayGroup } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  getGroupMembersList, 
  matchMemberKeys, 
  getReconciledExpenseStatusMap, 
  getMemberDisplayName, 
  formatSettlementDisplayTitle,
  formatTimeAgo,
  getDaysRemainingInTrash,
  evaluateTransactionDeleteRule,
  validateSettlementRestore,
  canEditExpense,
  canDeleteExpense,
  canUndoSettlement as canUndoSettlementCheck,
  canRestoreExpense,
  canRestoreSettlement,
  getExpenseLockInfo,
  type SettlementRestoreValidation
} from '../../services/splitService';
import { isWithinPast30Days } from '../../services/expenseService';
import { TransactionActionSheet } from '../modals/TransactionActionSheet';

interface SplitGroupViewProps {
  group: ExpenseGroup;
  transactions: Transaction[];
  userRole?: UserRole;
  onOpenAddExpense: () => void;
  onEditExpense: (tx: Transaction) => void;
  onDeleteExpense: (txId: string) => void;
  onRestoreExpense?: (txId: string) => void;
  onPermanentDeleteExpense?: (txId: string) => void;
  onOpenInviteModal?: () => void;
  onShowToast?: (toast: { message: string; subMessage?: string; type: 'success' | 'error' | 'info' }) => void;
  onUndoSettleExpense?: (tx: Transaction) => void;
  onUpdateExpense?: (tx: Transaction) => void;
}

/**
 * Determines whether an expense is fully settled.
 * An expense is completed if:
 * 1. Explicitly marked settled (tx.settled === true), OR
 * 2. It is a debt settlement record, OR
 * 3. All non-payer participants have settled their individual shares (via settledMembers).
 */
export function isExpenseCompleted(
  tx: Transaction,
  group?: ExpenseGroup,
  currentUid?: string,
  currentEmail?: string,
  statusMap?: Record<string, { isFullySettled: boolean }>
): boolean {
  if (tx.isSettlement) return true;
  if (statusMap && statusMap[tx.id]) {
    return Boolean(statusMap[tx.id].isFullySettled);
  }
  return false;
}

function formatDayHeading(dateStr?: string): { displayDate: string; monthKey: string; sortKey: string } {
  if (!dateStr) return { displayDate: 'Undated', monthKey: 'Undated', sortKey: '0000-00-00' };
  
  const datePart = dateStr.split('T')[0];
  const [yStr, mStr, dStr] = datePart.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return { displayDate: dateStr, monthKey: 'Other', sortKey: datePart };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDate = new Date(y, m, d);

  const diffTime = today.getTime() - txDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthKey = `${monthNames[m]} ${y}`;
  const sortKey = datePart;

  if (diffDays === 0) {
    return { displayDate: 'Today', monthKey, sortKey };
  }
  if (diffDays === 1) {
    return { displayDate: 'Yesterday', monthKey, sortKey };
  }
  if (diffDays > 1 && diffDays < 7) {
    return { displayDate: `${dayNames[txDate.getDay()]}, ${d} ${shortMonths[m]}`, monthKey, sortKey };
  }

  return { displayDate: `${d} ${shortMonths[m]} ${y}`, monthKey, sortKey };
}

export function SplitGroupView({
  group,
  transactions,
  userRole,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onRestoreExpense,
  onPermanentDeleteExpense,
  onOpenInviteModal,
  onShowToast,
  onUndoSettleExpense,
  onUpdateExpense
}: SplitGroupViewProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [actionMenu, setActionMenu] = useState<{ tx: Transaction; rect: DOMRect } | null>(null);
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [settlementToUndo, setSettlementToUndo] = useState<Transaction | null>(null);
  const [txToPurgeForever, setTxToPurgeForever] = useState<Transaction | null>(null);
  const [permissionDeniedMsg, setPermissionDeniedMsg] = useState<string | null>(null);
  const [settlementConflict, setSettlementConflict] = useState<SettlementRestoreValidation | null>(null);

  const members = useMemo(() => {
    return getGroupMembersList(group, user?.uid, user?.email || undefined);
  }, [group, user]);

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

  // Group expenses are separate from debt settlement records and recently deleted records
  const expenseTransactions = useMemo(() => transactions.filter(t => !t.isSettlement && !t.isDeleted), [transactions]);
  const settlementTransactions = useMemo(() => transactions.filter(t => t.isSettlement && !t.isDeleted), [transactions]);
  const deletedTransactions = useMemo(() => transactions.filter(t => Boolean(t.isDeleted) && isWithinPast30Days(t.deletedAt)), [transactions]);

  // Sub-tabs: 'open' (expenses with pending dues), 'all' (all expenses), 'settled' (recorded settlements), 'trash' (recently deleted)
  type SplitSubTab = 'open' | 'all' | 'settled' | 'trash';
  const [subTab, setSubTab] = useState<SplitSubTab>('open');

  // FIFO running reconciliation across group expenses (clears mutual reciprocal debts automatically)
  const statusMap = useMemo(() => {
    return getReconciledExpenseStatusMap(transactions, group, user?.uid, user?.email || undefined);
  }, [transactions, group, user]);

  // Counts reflect actual expenses, settlements, and trash
  const counts = useMemo(() => {
    let openCount = 0;
    expenseTransactions.forEach(t => {
      const isSettled = Boolean(statusMap[t.id]?.isFullySettled);
      if (!isSettled) {
        openCount++;
      }
    });

    return {
      open: openCount,
      all: expenseTransactions.length,
      settled: settlementTransactions.length,
      trash: deletedTransactions.length
    };
  }, [expenseTransactions, settlementTransactions, deletedTransactions, statusMap]);

  // Filtered transactions based on subTab (open vs all vs settled vs trash) and search query
  const filteredTransactions = useMemo(() => {
    let list: Transaction[] = [];

    if (subTab === 'open') {
      list = expenseTransactions.filter(t => !statusMap[t.id]?.isFullySettled);
    } else if (subTab === 'all') {
      list = [...expenseTransactions];
    } else if (subTab === 'settled') {
      list = [...settlementTransactions];
    } else {
      list = [...deletedTransactions];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.paidByName && t.paidByName.toLowerCase().includes(q)) ||
        (t.settledToName && t.settledToName.toLowerCase().includes(q)) ||
        (t.lastEditedByName && t.lastEditedByName.toLowerCase().includes(q)) ||
        (t.deletedByName && t.deletedByName.toLowerCase().includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q))
      );
    }

    // Sort newest date first
    list.sort((a, b) => {
      const dateA = a.date ? a.date.split('T')[0] : '';
      const dateB = b.date ? b.date.split('T')[0] : '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const createdA = a.createdAt || a.id || '';
      const createdB = b.createdAt || b.id || '';
      return createdB.localeCompare(createdA);
    });

    return list;
  }, [expenseTransactions, settlementTransactions, deletedTransactions, subTab, searchQuery, statusMap]);

  // Group by day for clean, readable ledger layout
  const dayGroups = useMemo(() => {
    const groups: DayGroup[] = [];
    const groupMap = new Map<string, DayGroup>();

    for (const tx of filteredTransactions) {
      const { displayDate, sortKey } = formatDayHeading(tx.date);
      const dateKey = tx.date ? tx.date.split('T')[0] : 'undated';

      let dGroup = groupMap.get(dateKey);
      if (!dGroup) {
        dGroup = {
          dateKey,
          displayDate,
          sortKey,
          transactions: []
        };
        groupMap.set(dateKey, dGroup);
        groups.push(dGroup);
      }
      dGroup.transactions.push(tx);
    }

    return groups;
  }, [filteredTransactions]);

  const isViewer = userRole === 'viewer';
  const canManageExpenses = userRole === 'owner' || userRole === 'editor' || !user;

  // Strict Central Permissions:
  const canEdit = (tx: Transaction) => {
    return canEditExpense(tx, user, userRole, group, transactions).allowed;
  };

  const canDelete = (tx: Transaction) => {
    return canDeleteExpense(tx, user, userRole, group, transactions).allowed;
  };

  const canUndoSettlement = (s: Transaction) => {
    return canUndoSettlementCheck(s, user, userRole, group).allowed;
  };

  const handleEditExpenseClick = (tx: Transaction) => {
    const check = canEditExpense(tx, user, userRole, group, transactions);
    if (!check.allowed) {
      if (onShowToast) onShowToast({ message: check.reason || 'Only the payer, the person who added it, or the group owner can edit this.', type: 'info' });
      return;
    }
    setTxToEdit(tx);
  };

  const handleDeleteExpenseClick = (tx: Transaction) => {
    const check = canDeleteExpense(tx, user, userRole, group, transactions);
    if (!check.allowed) {
      if (onShowToast) onShowToast({ message: check.reason || "Can't delete this expense.", type: 'info' });
      return;
    }
    setTxToDelete(tx);
  };



  const toggleExpand = (txId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedTxIds(prev => ({
      ...prev,
      [txId]: !prev[txId]
    }));
  };

  return (
    <div className="space-y-3.5 pb-28 font-sans">
      {/* 1. Sub Tabs Segmented Control: Open Expenses | All Expenses | Settled (Apple / Google Style) */}
      <div className="flex p-1 rounded-2xl bg-surface-hover border border-border text-sm shadow-2xs">
        <button
          type="button"
          onClick={() => setSubTab('open')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'open'
              ? 'bg-surface text-text-primary shadow-xs font-semibold'
              : 'text-text-secondary hover:text-text-primary font-medium'
          }`}
        >
          <span className="truncate">Open</span>
          <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold tabular-nums transition-colors ${
            subTab === 'open' 
              ? 'bg-google-blue/15 text-google-blue dark:bg-blue-400/20 dark:text-blue-300' 
              : 'bg-surface-active/60 text-text-secondary border border-border/40 font-medium'
          }`}>
            {counts.open}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('all')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'all'
              ? 'bg-surface text-text-primary shadow-xs font-semibold'
              : 'text-text-secondary hover:text-text-primary font-medium'
          }`}
        >
          <span className="truncate">All</span>
          <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold tabular-nums transition-colors ${
            subTab === 'all' 
              ? 'bg-google-blue/15 text-google-blue dark:bg-blue-400/20 dark:text-blue-300' 
              : 'bg-surface-active/60 text-text-secondary border border-border/40 font-medium'
          }`}>
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('settled')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'settled'
              ? 'bg-surface text-text-primary shadow-xs font-semibold'
              : 'text-text-secondary hover:text-text-primary font-medium'
          }`}
        >
          <span className="truncate">Settled</span>
          <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold tabular-nums transition-colors ${
            subTab === 'settled' 
              ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300' 
              : 'bg-surface-active/60 text-text-secondary border border-border/40 font-medium'
          }`}>
            {counts.settled}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('trash')}
          className={`flex-1 py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'trash'
              ? 'bg-surface text-text-primary shadow-xs font-semibold'
              : 'text-text-secondary hover:text-text-primary font-medium'
          }`}
          title="Recently Deleted entries (past 30 days)"
        >
          <span className="truncate">Trash</span>
          <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold tabular-nums transition-colors ${
            subTab === 'trash' 
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' 
              : counts.trash > 0
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium'
                : 'bg-surface-active/60 text-text-secondary border border-border/40 font-medium'
          }`}>
            {counts.trash}
          </span>
        </button>
      </div>

      {/* 2. Search Bar - Clean, high contrast, comfortable 14px text */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search expense, payer, notes..."
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface border border-border text-sm text-text-primary outline-none focus:border-google-blue transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-surface-hover cursor-pointer"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 3. Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="py-12 sm:py-16 px-4 rounded-3xl bg-surface border border-border text-center space-y-3 my-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto bg-surface-hover text-text-secondary">
            {subTab === 'open' ? (
              <CheckCircle2 size={24} className="text-emerald-500" strokeWidth={2.2} />
            ) : subTab === 'settled' ? (
              <RotateCcw size={24} className="text-google-blue" strokeWidth={2} />
            ) : subTab === 'trash' ? (
              <Trash2 size={24} className="text-amber-500" strokeWidth={2} />
            ) : (
              <ReceiptText size={24} strokeWidth={2} />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-text-primary">
              {searchQuery 
                ? 'No matching results' 
                : subTab === 'open'
                  ? 'All expenses are settled!'
                  : subTab === 'settled'
                    ? 'No settlements recorded yet'
                    : subTab === 'trash'
                      ? 'No deleted transactions'
                      : 'No expenses yet'}
            </h3>
            <p className="text-sm text-text-secondary max-w-xs mx-auto leading-relaxed">
              {searchQuery 
                ? 'Try searching with a different term or payer name.' 
                : subTab === 'open'
                  ? 'There are no open expenses pending settlement in this group.'
                  : subTab === 'settled'
                    ? 'When members settle debts via UPI or cash, recorded payments appear here with an option to undo.'
                    : subTab === 'trash'
                      ? 'Transactions deleted from this group in the past 30 days will appear here for audit and one-tap restore.'
                      : 'Add your first shared expense to start splitting costs.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-full bg-surface-hover hover:bg-surface-active border border-border text-sm font-semibold text-text-primary cursor-pointer transition-colors"
              >
                Clear Search
              </button>
            ) : subTab === 'open' && counts.all > 0 ? (
              <button
                type="button"
                onClick={() => setSubTab('all')}
                className="px-4 py-2 rounded-full bg-surface-hover hover:bg-surface-active border border-border text-sm font-semibold text-text-primary cursor-pointer transition-colors"
              >
                View All Expenses ({counts.all})
              </button>
            ) : subTab === 'settled' && counts.all > 0 ? (
              <button
                type="button"
                onClick={() => setSubTab('open')}
                className="px-4 py-2 rounded-full bg-surface-hover hover:bg-surface-active border border-border text-sm font-semibold text-text-primary cursor-pointer transition-colors"
              >
                View Open Expenses ({counts.open})
              </button>
            ) : subTab === 'trash' && counts.all > 0 ? (
              <button
                type="button"
                onClick={() => setSubTab('open')}
                className="px-4 py-2 rounded-full bg-surface-hover hover:bg-surface-active border border-border text-sm font-semibold text-text-primary cursor-pointer transition-colors"
              >
                Back to Open Expenses
              </button>
            ) : !isViewer && (
              <button
                type="button"
                onClick={onOpenAddExpense}
                className="px-4 py-2.5 rounded-full bg-google-blue hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors active:scale-95"
              >
                <Plus size={16} />
                <span>Add Expense</span>
              </button>
            )}
          </div>
        </div>
      ) : subTab === 'settled' ? (
        /* 4. Settlements Tab: Dedicated view of all recorded debt settlements with instant Undo */
        <div className="space-y-2.5">
          {filteredTransactions.map((s) => (
            <div 
              key={s.id}
              className="p-4 sm:p-5 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-text-primary text-sm sm:text-base truncate flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{formatSettlementDisplayTitle(s, group, user?.uid, user?.email || undefined)}</span>
                </div>
                <div className="text-xs text-text-secondary mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{s.date}</span>
                  <span>·</span>
                  <span>{s.note || 'Settlement payment'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ₹{s.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-text-secondary font-medium">
                    Settled
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const check = canUndoSettlementCheck(s, user, userRole, group);
                    if (!check.allowed) {
                      if (onShowToast) onShowToast({ message: check.reason || 'Only the payer, receiver, or group owner can undo this payment.', type: 'info' });
                      return;
                    }
                    setSettlementToUndo(s);
                  }}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                    canUndoSettlement(s)
                      ? 'bg-surface-hover hover:bg-red-500/10 border-border hover:border-red-500/30 text-text-secondary hover:text-google-red cursor-pointer'
                      : 'bg-surface-hover/30 border-border/50 text-text-secondary/35 cursor-not-allowed'
                  }`}
                  title={canUndoSettlement(s) ? 'Undo this settlement' : (canUndoSettlementCheck(s, user, userRole, group).reason || 'Cannot undo')}
                >
                  <RotateCcw size={13} />
                  <span>Undo</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : subTab === 'trash' ? (
        /* 5. Trash Tab: Dedicated view of deleted transactions in past 30 days */
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-text-primary flex items-start gap-2.5">
            <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold text-text-primary">30-Day Recovery Guarantee:</span>
              <span className="text-text-secondary ml-1">
                Transactions deleted in this group are preserved here for 30 days. Restoring any transaction brings back its shares and re-evaluates all group balances.
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const isSettlement = Boolean(tx.isSettlement);
              const daysLeft = getDaysRemainingInTrash(tx.deletedAt);
              const restoreValidation = isSettlement
                ? validateSettlementRestore(tx, transactions, group, user?.uid, user?.email || undefined)
                : { canRestore: true, title: '', message: '', payerName: '', receiverName: '', amount: tx.amount, currentNetOwed: 0 };

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 rounded-2xl bg-surface border border-border flex items-start justify-between gap-3 shadow-2xs bg-amber-500/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-primary line-through opacity-70 truncate">
                        {isSettlement 
                          ? formatSettlementDisplayTitle(tx, group, user?.uid, user?.email || undefined)
                          : tx.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        <span>{daysLeft}d left</span>
                      </span>
                      {isSettlement && (
                        <>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Settlement
                          </span>
                          {!restoreValidation.canRestore && (
                            <span 
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 shrink-0 flex items-center gap-1 cursor-pointer hover:bg-amber-500/25 transition-colors"
                              onClick={() => setSettlementConflict(restoreValidation as SettlementRestoreValidation)}
                              title="Click to view details"
                            >
                              <AlertTriangle size={10} />
                              <span>Already Settled</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="text-xs text-text-secondary mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Deleted by {tx.deletedByName || 'Member'}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(tx.deletedAt)}</span>
                      <span>·</span>
                      <span>Originally on {tx.date}</span>
                    </div>

                    <div className="text-[11px] text-text-secondary/80 mt-1">
                      Paid by <strong className="font-semibold text-text-primary">{tx.paidByName || 'Member'}</strong>
                      {!isSettlement && tx.splitMembers && tx.splitMembers.length > 0 && (
                        <span> · Split among {tx.splitMembers.length} members</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch gap-2">
                    <div className="font-bold text-base sm:text-lg text-text-primary/70 line-through">
                      ₹{tx.amount.toLocaleString('en-IN')}
                    </div>

                    {!isViewer && (
                      <div className="flex items-center gap-1.5">
                        {onRestoreExpense && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isSettlement) {
                                const check = canRestoreSettlement(tx, user, userRole, group, transactions);
                                if (!check.allowed) {
                                  if (onShowToast) onShowToast({ message: check.reason || 'Cannot restore this settlement.', type: 'error' });
                                  return;
                                }
                                onRestoreExpense(tx.id);
                              } else {
                                const check = canRestoreExpense(tx, user, userRole, group, transactions);
                                if (!check.allowed) {
                                  if (onShowToast) onShowToast({ message: check.reason || 'Cannot restore this expense.', type: 'error' });
                                  return;
                                }
                                onRestoreExpense(tx.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs border active:scale-95 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            title="Restore this transaction"
                          >
                            <RotateCcw size={12} strokeWidth={2.5} />
                            <span>Restore</span>
                          </button>
                        )}
                        {userRole === 'owner' && onPermanentDeleteExpense && (
                          <button
                            type="button"
                            onClick={() => setTxToPurgeForever(tx)}
                            className="p-1.5 text-text-secondary hover:text-google-red hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                            title="Delete permanently"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {dayGroups.map((dGroup) => (
            <div key={dGroup.dateKey} className="space-y-2">
              {/* Day Heading */}
              <div className="flex items-center justify-between px-1 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <span>{dGroup.displayDate}</span>
                <span>{dGroup.transactions.length} {dGroup.transactions.length === 1 ? 'item' : 'items'}</span>
              </div>

              {/* Transactions in this Day */}
              <div className="space-y-2.5">
                {dGroup.transactions.map((tx) => {
                  const isCompleted = Boolean(statusMap[tx.id]?.isFullySettled);
                  const payerKey = tx.paidBy || tx.createdBy || '';
                  const payerIsMe = isMe(payerKey);

                  // Authoritative resolution of payer display name:
                  // Guarantees it will never display 'You' unless payerIsMe is true!
                  let payerName = 'Member';
                  if (payerIsMe) {
                    payerName = 'You';
                  } else {
                    const payerMember = members.find(m => matchMemberKeys(m.key, payerKey, group, user?.uid, user?.email || undefined));
                    if (payerMember && !payerMember.isCurrentUser) {
                      payerName = payerMember.name;
                    } else if (tx.paidByName && tx.paidByName.trim().toLowerCase() !== 'you') {
                      payerName = tx.paidByName;
                    } else if (payerKey) {
                      const resolved = getMemberDisplayName(payerKey, group, user?.uid, user?.email || undefined);
                      payerName = resolved.trim().toLowerCase() === 'you' ? 'Member' : resolved;
                    }
                  }

                  const isExpanded = Boolean(expandedTxIds[tx.id]);

                  // Participants and individual shares
                  const participants = tx.splitMembers && tx.splitMembers.length > 0 
                    ? tx.splitMembers 
                    : members.map(m => m.key);
                  const participantCount = participants.length > 0 ? participants.length : 1;

                  // Current user's cut
                  let yourShare = 0;
                  if (tx.splitMode === 'exact' && tx.splits) {
                    const myKey = user?.uid || user?.email || '';
                    yourShare = tx.splits[myKey] || tx.splits[myNormEmail] || 0;
                  } else if (participants.some(p => isMe(p))) {
                    yourShare = Math.round((tx.amount / participantCount) * 100) / 100;
                  }

                  const isUserInvolved = payerIsMe || participants.some(p => isMe(p));
                  const amountLent = payerIsMe ? Math.max(0, tx.amount - yourShare) : 0;

                  // Member settlement breakdown: strictly authoritative to this expense's dues & FIFO clearing
                  const isMemberSettledHelper = (mKey: string) => {
                    if (isCompleted) return true;
                    if (matchMemberKeys(mKey, payerKey, group, user?.uid, user?.email || undefined)) return true;
                    const normK = mKey.toLowerCase().trim();
                    return Boolean(statusMap[tx.id]?.settledMemberKeys?.has(normK));
                  };

                  const nonPayerParticipants = participants.filter(p => !matchMemberKeys(p, payerKey, group, user?.uid, user?.email || undefined));
                  const nonPayerSettledCount = nonPayerParticipants.filter(p => isMemberSettledHelper(p)).length;

                  const isMyShareSettled = payerIsMe || isCompleted || isMemberSettledHelper(myNormKey) || isMemberSettledHelper(myNormEmail);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => toggleExpand(tx.id)}
                      className={`p-4 sm:p-5 rounded-2xl bg-surface border transition-all duration-200 flex flex-col gap-2.5 shadow-2xs hover:shadow-xs cursor-pointer select-none ${
                        isCompleted
                          ? 'border-border/80 opacity-95'
                          : 'border-border hover:border-google-blue/30 active:bg-surface-hover/60'
                      }`}
                    >
                      {/* Row 1: Title & Total Amount + Actions */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-text-primary text-base sm:text-lg tracking-tight truncate flex-1">
                          {tx.name}
                        </span>

                        {/* Top Right: Bold Amount and Action Menu */}
                        <div 
                          className="flex items-center gap-2 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-bold text-base sm:text-lg text-text-primary tabular-nums">
                            ₹{tx.amount.toLocaleString('en-IN')}
                          </span>

                          {!isViewer && (
                            <>
                              {/* Desktop: Inline Edit / Delete (quietly disabled style when not allowed) */}
                              <div className="hidden sm:flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditExpenseClick(tx)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    canEdit(tx)
                                      ? 'text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer'
                                      : 'text-text-secondary/35 hover:bg-surface-hover/50 cursor-not-allowed'
                                  }`}
                                  title={canEdit(tx) ? 'Edit Expense' : (canEditExpense(tx, user, userRole, group, transactions).reason || 'Cannot edit')}
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpenseClick(tx)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                    canDelete(tx)
                                      ? 'text-text-secondary hover:text-google-red hover:bg-red-500/10 cursor-pointer'
                                      : 'text-text-secondary/35 hover:bg-surface-hover/50 cursor-not-allowed'
                                  }`}
                                  title={canDelete(tx) ? 'Delete Expense' : (canDeleteExpense(tx, user, userRole, group, transactions).reason || 'Cannot delete')}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>

                              {/* Mobile: 3-dots Context Menu Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setActionMenu({ tx, rect });
                                }}
                                className="sm:hidden w-8 h-8 -mr-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer active:scale-90"
                                title="More options"
                                aria-label="More options"
                              >
                                <MoreVertical size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Metadata (Payer, Count, Last Edited By, Note) - High Contrast & Legible 14px Font */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary font-medium leading-normal">
                        <span>
                          Paid by <strong className="font-semibold text-text-primary">{payerName}</strong>
                        </span>
                        <span aria-hidden="true" className="text-text-secondary/40">·</span>
                        <span>
                          {participantCount > 0 ? `${participantCount} people` : 'Equal split'}
                        </span>
                        {tx.lastEditedByName && (
                          <>
                            <span aria-hidden="true" className="text-text-secondary/40">·</span>
                            <span 
                              className="inline-flex items-center gap-1 text-xs text-text-secondary/80 bg-surface-hover/70 px-1.5 py-0.5 rounded-md font-medium" 
                              title={tx.lastEditedAt ? `Edited on ${new Date(tx.lastEditedAt).toLocaleString()}` : ''}
                            >
                              <Pencil size={10} className="shrink-0 text-text-secondary/60" />
                              <span>Edited by {tx.lastEditedByName}</span>
                              {tx.lastEditedAt && <span className="text-[11px] text-text-secondary/60">({formatTimeAgo(tx.lastEditedAt)})</span>}
                            </span>
                          </>
                        )}
                        {tx.note && tx.note.toLowerCase().trim() !== 'settled' && (
                          <>
                            <span aria-hidden="true" className="text-text-secondary/40">·</span>
                            <span className="italic text-text-secondary/80 max-w-[240px] truncate">{tx.note}</span>
                          </>
                        )}
                      </div>

                      {/* Row 3: Status Pill & Individual Standing (Comfortable, Zero Pill Clutter) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs sm:text-sm">
                        {/* Left: Settlement Status */}
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                              <Check size={12} strokeWidth={2.5} />
                              <span>Settled</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-surface-hover border border-border/60 px-2.5 py-1 rounded-full">
                              <Clock size={12} className="text-amber-500" />
                              <span>
                                {nonPayerSettledCount > 0 
                                  ? `${nonPayerSettledCount} of ${nonPayerParticipants.length} settled` 
                                  : `${nonPayerParticipants.length} pending`}
                              </span>
                            </span>
                          )}

                        </div>

                        {/* Right: Current User Standing & Expand Chevron */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                          {payerIsMe ? (
                            <span className="text-xs sm:text-sm font-semibold text-google-green tabular-nums">
                              {amountLent > 0 ? `You lent ₹${amountLent.toLocaleString('en-IN')}` : 'You paid'}
                            </span>
                          ) : isUserInvolved ? (
                            isMyShareSettled ? (
                              <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                Paid ₹{yourShare.toLocaleString('en-IN')} ✓
                              </span>
                            ) : (
                              <span className="text-xs sm:text-sm font-semibold text-google-red tabular-nums">
                                You owe ₹{yourShare.toLocaleString('en-IN')}
                              </span>
                            )
                          ) : (
                            <span className="text-xs sm:text-sm text-text-secondary/70">
                              Not involved
                            </span>
                          )}

                          {participantCount > 1 && (
                            <ChevronDown 
                              size={15} 
                              className={`text-text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180 text-google-blue' : ''}`}
                            />
                          )}
                        </div>
                      </div>

                      {/* Expandable Member Settlement Breakdown & Clubbed Settlements */}
                      {isExpanded && participantCount > 1 && (
                        <div 
                          className="mt-2 pt-3 border-t border-border/60 space-y-3 animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                            Member Dues Breakdown
                          </div>

                          <div className="space-y-2">
                            {participants.map((mKey) => {
                              const isPayerOfTx = matchMemberKeys(mKey, payerKey, group, user?.uid, user?.email || undefined);
                              const isMemberMe = isMe(mKey);
                              const memberObj = members.find(m => matchMemberKeys(m.key, mKey, group, user?.uid, user?.email || undefined));

                              let displayName = 'Member';
                              if (isMemberMe) {
                                displayName = 'You';
                              } else if (memberObj && !memberObj.isCurrentUser) {
                                displayName = memberObj.name;
                              } else if (isPayerOfTx && tx.paidByName && tx.paidByName.trim().toLowerCase() !== 'you') {
                                displayName = tx.paidByName;
                              } else {
                                const resolved = getMemberDisplayName(mKey, group, user?.uid, user?.email || undefined);
                                displayName = resolved.trim().toLowerCase() === 'you' ? 'Member' : resolved;
                              }

                              let cutAmount = 0;
                              if (tx.splitMode === 'exact' && tx.splits && tx.splits[mKey] !== undefined) {
                                cutAmount = tx.splits[mKey];
                              } else {
                                cutAmount = Math.round((tx.amount / participantCount) * 100) / 100;
                              }

                              const isMemberSettled = isMemberSettledHelper(mKey);

                              return (
                                <div 
                                  key={mKey} 
                                  className="flex items-center justify-between text-xs sm:text-sm py-2 px-3 rounded-xl bg-surface-hover/60 border border-border/40 gap-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-surface-active text-text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                      {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-text-primary truncate">
                                      {displayName}
                                    </span>
                                    {isPayerOfTx && (
                                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-google-blue/10 text-google-blue">
                                        Payer
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="font-semibold tabular-nums text-text-primary text-sm">
                                      ₹{cutAmount.toLocaleString('en-IN')}
                                    </span>

                                    {isPayerOfTx ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-google-green">
                                        <Check size={13} strokeWidth={2.5} /> Paid
                                      </span>
                                    ) : isMemberSettled ? (
                                      <span 
                                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg"
                                        title={statusMap[tx.id]?.clearedByOffsetMemberKeys?.has(mKey.toLowerCase().trim()) ? 'Balanced by counter-expenses in this group' : 'Paid'}
                                      >
                                        <Check size={12} strokeWidth={2.5} />
                                        <span>{statusMap[tx.id]?.clearedByOffsetMemberKeys?.has(mKey.toLowerCase().trim()) ? 'Balanced' : 'Paid'}</span>
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Transaction Action Sheet (Anchored popup at 3-dots: Edit & Delete only) */}
      <TransactionActionSheet
        isOpen={Boolean(actionMenu)}
        onClose={() => setActionMenu(null)}
        transaction={actionMenu?.tx || null}
        anchorRect={actionMenu?.rect || null}
        isSplitGroup={true}
        onEditExpense={actionMenu?.tx ? (tx) => {
          setActionMenu(null);
          handleEditExpenseClick(tx);
        } : undefined}
        onDeleteExpense={actionMenu?.tx ? (txId) => {
          setActionMenu(null);
          const target = transactions.find(t => t.id === txId);
          if (target) handleDeleteExpenseClick(target);
          else onDeleteExpense(txId);
        } : undefined}
      />

      {/* Edit Expense Confirmation Modal */}
      {txToEdit && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setTxToEdit(null)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-xl space-y-4 animate-in zoom-in-95 duration-150 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center">
              <Pencil size={20} strokeWidth={2.2} />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-text-primary">
                Edit this expense?
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                Editing <span className="font-semibold text-text-primary">"{txToEdit.name}"</span> (₹{txToEdit.amount.toLocaleString('en-IN')}) will update shares and recalculate balances for all participants.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTxToEdit(null)}
                className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-sm font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = txToEdit;
                  setTxToEdit(null);
                  onEditExpense(target);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-google-blue hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Continue to Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Context-aware for Settlement vs Settled Expense vs Standard Expense) */}
      {txToDelete && (() => {
        const isSettlement = Boolean(txToDelete.isSettlement);
        const isSettledExpense = Boolean(statusMap[txToDelete.id]?.isFullySettled);

        return (
          <div 
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans"
            onClick={() => setTxToDelete(null)}
          >
            <div 
              className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-xl space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isSettlement ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-google-red/10 text-google-red'
              }`}>
                {isSettlement ? <RotateCcw size={20} strokeWidth={2.2} /> : <Trash2 size={20} strokeWidth={2.2} />}
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-base text-text-primary">
                  {isSettlement 
                    ? 'Undo settlement payment?' 
                    : isSettledExpense 
                      ? 'Delete settled expense?' 
                      : 'Move expense to Trash?'}
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {isSettlement ? (
                    <>
                      Deleting the settlement of <strong className="text-text-primary">₹{txToDelete.amount.toLocaleString('en-IN')}</strong> will reopen cleared debts and move the record to <strong className="text-text-primary">Recently Deleted (kept for 30 days)</strong>.
                    </>
                  ) : isSettledExpense ? (
                    <>
                      <strong className="text-text-primary">"{txToDelete.name}"</strong> (₹{txToDelete.amount.toLocaleString('en-IN')}) was marked as settled. Deleting it will cancel settled participant shares, reopen debt balances, and move the item to <strong className="text-text-primary">Recently Deleted (kept for 30 days)</strong>.
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete <strong className="text-text-primary">"{txToDelete.name}"</strong> (₹{txToDelete.amount.toLocaleString('en-IN')})? It will be moved to <strong className="text-text-primary">Recently Deleted</strong> (retained for 30 days) and balances will recalculate immediately.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTxToDelete(null)}
                  className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-sm font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = txToDelete.id;
                    setTxToDelete(null);
                    onDeleteExpense(id);
                  }}
                  className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs ${
                    isSettlement
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-google-red hover:bg-red-600'
                  }`}
                >
                  {isSettlement 
                    ? 'Undo Settlement' 
                    : isSettledExpense 
                      ? 'Delete Settled' 
                      : 'Move to Trash'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Permanent Purge Confirmation Modal (Trash Sub-Tab only, Owner only) */}
      {txToPurgeForever && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans"
          onClick={() => setTxToPurgeForever(null)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-google-red/10 text-google-red flex items-center justify-center">
              <Trash2 size={20} strokeWidth={2.2} />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-text-primary">
                Permanently delete transaction?
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                Are you sure you want to permanently erase <strong className="text-text-primary">"{txToPurgeForever.name}"</strong> (₹{txToPurgeForever.amount.toLocaleString('en-IN')})? This transaction will be completely purged from history and <strong className="text-google-red">cannot be restored</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTxToPurgeForever(null)}
                className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-sm font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = txToPurgeForever.id;
                  setTxToPurgeForever(null);
                  if (onPermanentDeleteExpense) {
                    onPermanentDeleteExpense(id);
                  } else {
                    onDeleteExpense(id);
                  }
                }}
                className="flex-1 py-2.5 rounded-2xl bg-google-red hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Settlement Confirmation Modal */}
      {settlementToUndo && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSettlementToUndo(null)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-xl space-y-4 animate-in zoom-in-95 duration-150 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <RotateCcw size={20} strokeWidth={2.2} />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-text-primary">
                Undo this settlement?
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                The payment of <span className="font-semibold text-text-primary">₹{settlementToUndo.amount.toLocaleString('en-IN')}</span> ({formatSettlementDisplayTitle(settlementToUndo, group, user?.uid, user?.email || undefined)}) will be removed, and all expenses settled by this payment will be reopened in the Open tab.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSettlementToUndo(null)}
                className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-sm font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = settlementToUndo;
                  setSettlementToUndo(null);
                  if (onUndoSettleExpense) {
                    onUndoSettleExpense(target);
                  } else {
                    onDeleteExpense(target.id);
                  }
                }}
                className="flex-1 py-2.5 rounded-2xl bg-google-red hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Undo Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Restore Conflict / Cannot Restore Modal */}
      {settlementConflict && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans"
          onClick={() => setSettlementConflict(null)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={20} strokeWidth={2.2} />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-base text-text-primary">
                {settlementConflict.title}
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {settlementConflict.message}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-hover/70 border border-border/60 text-xs space-y-2">
              <div className="flex justify-between items-center text-text-secondary">
                <span>Deleted settlement:</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  ₹{settlementConflict.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-text-secondary">
                <span>Current balance owed:</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {settlementConflict.currentNetOwed <= 0.01 
                    ? '₹0 (All settled)' 
                    : `₹${settlementConflict.currentNetOwed.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSettlementConflict(null)}
                className="w-full py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-sm font-semibold cursor-pointer transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
