import React, { useMemo, useState } from 'react';
import { 
  Tag, 
  Pencil, 
  ChevronRight,
  RotateCcw,
  Repeat,
  MoreVertical,
  Download
} from 'lucide-react';
import type { Transaction, CategoryData, UserRole, DayGroup } from '../../types';
import { ICON_MAP } from '../modals/CategoryModal';
import { TransactionActionSheet } from '../modals/TransactionActionSheet';
import { useAuth } from '../../context/AuthContext';
import { formatSettlementDisplayTitle } from '../../services/splitService';
import { formatINR } from '../../utils/formatUtils';

interface OverviewTabProps {
  transactions: Transaction[];
  categories: Record<string, CategoryData>;
  selectedPeriod: 'current_month' | 'last_month' | 'ytd';
  onSelectPeriod: (period: 'current_month' | 'last_month' | 'ytd') => void;
  showPeriodDropdown: boolean;
  setShowPeriodDropdown: (show: boolean) => void;
  userRole: UserRole;
  onOpenAddExpense: () => void;
  onEditExpense: (tx: Transaction) => void;
  onDeleteExpense: (txId: string) => void;
  onSettleExpense: (tx: Transaction) => void;
  onUndoSettleExpense: (tx: Transaction) => void;
  groupName: string;
  onNavigateToTransactions?: () => void;
  geminiEnabled?: boolean;
  onOpenExportLedger?: () => void;
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
    return { displayDate: `Today · ${d} ${shortMonths[m]}`, monthKey, sortKey };
  }
  if (diffDays === 1) {
    return { displayDate: `Yesterday · ${d} ${shortMonths[m]}`, monthKey, sortKey };
  }

  const dayOfWeek = dayNames[txDate.getDay()];
  if (y === now.getFullYear()) {
    return { displayDate: `${dayOfWeek}, ${d} ${shortMonths[m]}`, monthKey, sortKey };
  }
  return { displayDate: `${dayOfWeek}, ${d} ${shortMonths[m]} ${y}`, monthKey, sortKey };
}

export function OverviewTab({
  transactions,
  categories,
  selectedPeriod,
  onSelectPeriod,
  userRole,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onSettleExpense,
  onUndoSettleExpense,
  groupName,
  onNavigateToTransactions,
  geminiEnabled = false,
  onOpenExportLedger
}: OverviewTabProps) {
  const { user } = useAuth();
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const [actionMenu, setActionMenu] = useState<{ tx: Transaction; rect: DOMRect } | null>(null);

  // Accurately filter transactions based on selectedPeriod
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 8 = Sep)

    return transactions.filter((tx) => {
      if (!tx.date) return true;
      const parts = tx.date.split('-');
      if (parts.length >= 2) {
        const txYear = parseInt(parts[0], 10);
        const txMonth = parseInt(parts[1], 10) - 1; // 0-indexed

        if (isNaN(txYear) || isNaN(txMonth)) return true;

        if (selectedPeriod === 'current_month') {
          return txYear === currentYear && txMonth === currentMonth;
        }
        if (selectedPeriod === 'last_month') {
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return txYear === prevYear && txMonth === prevMonth;
        }
        if (selectedPeriod === 'ytd') {
          return txYear === currentYear;
        }
      }
      return true;
    });
  }, [transactions, selectedPeriod]);

  const totalAmount = filteredTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  // Group totals by category from filteredTransactions
  const categoryTotals = filteredTransactions.reduce((acc, tx) => {
    if (tx.amount > 0) {
      if (!acc[tx.category]) acc[tx.category] = 0;
      acc[tx.category] += tx.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const categoryEntries: [string, number][] = (Object.entries(categoryTotals) as [string, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  // Group recent transactions into clean Day Cards matching the Ledger tab
  const recentDayGroups = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      const dateA = a.date ? a.date.split('T')[0] : '';
      const dateB = b.date ? b.date.split('T')[0] : '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const createdA = a.createdAt || a.id || '';
      const createdB = b.createdAt || b.id || '';
      return createdB.localeCompare(createdA);
    });

    const recentTxs = sorted.slice(0, 5);
    const groups: DayGroup[] = [];
    const groupMap = new Map<string, DayGroup>();

    for (const tx of recentTxs) {
      const { displayDate } = formatDayHeading(tx.date);
      const dateKey = tx.date ? tx.date.split('T')[0] : 'undated';

      let dGroup = groupMap.get(dateKey);
      if (!dGroup) {
        dGroup = {
          dateKey,
          displayDate,
          dayTotal: 0,
          transactions: []
        };
        groupMap.set(dateKey, dGroup);
        groups.push(dGroup);
      }

      dGroup.dayTotal += tx.amount;
      dGroup.transactions.push(tx);
    }

    return groups;
  }, [filteredTransactions]);

  const getPeriodText = () => {
    const now = new Date();
    if (selectedPeriod === 'current_month') {
      return now.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (selectedPeriod === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return prev.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    return `Year to Date ${now.getFullYear()}`;
  };

  return (
    <div className="space-y-4 pb-20 font-sans">
      {/* Hero Overview Card (Apple Wallet / Material 3 Surface) */}
      <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-border shadow-xs">
        {/* Top bar: Period Filter Pills */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="inline-flex p-0.5 rounded-full bg-surface-hover border border-border">
            <button
              type="button"
              onClick={() => onSelectPeriod('current_month')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                selectedPeriod === 'current_month'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => onSelectPeriod('last_month')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                selectedPeriod === 'last_month'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => onSelectPeriod('ytd')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                selectedPeriod === 'ytd'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              YTD
            </button>
          </div>

          <span className="text-xs sm:text-sm text-text-secondary font-medium">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'expense' : 'expenses'}
          </span>
        </div>

        {/* Big Balance Display */}
        <div className="space-y-1">
          <span className="text-xs sm:text-sm font-medium text-text-secondary tracking-tight">
            Total Spent
          </span>
          <div className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-text-primary">
            {formatINR(totalAmount, { symbol: true })}
          </div>
        </div>

        {/* Category Proportional Bar (Apple / Google style bar) */}
        {totalAmount > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            {/* Multi-segmented bar */}
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-surface-hover mb-3">
              {categoryEntries.map(([catKey, val]) => {
                const percent = (val / totalAmount) * 100;
                const catData = categories[catKey] || { hex: '#888888' };
                return (
                  <div
                    key={catKey}
                    style={{ width: `${percent}%`, backgroundColor: catData.hex }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                    title={`${categories[catKey]?.name || catKey}: ${formatINR(val, { symbol: true })}`}
                  />
                );
              })}
            </div>

            {/* Category breakdown chips */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
              {categoryEntries.slice(0, 4).map(([catKey, val]) => {
                const percent = Math.round((val / totalAmount) * 100);
                const catData = categories[catKey] || { name: catKey, hex: '#888888' };
                return (
                  <div key={catKey} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catData.hex }} />
                    <span className="text-text-secondary truncate">{catData.name}</span>
                    <span className="font-medium text-text-primary">{formatINR(val, { symbol: true })}</span>
                    <span className="text-xs text-text-secondary font-medium">({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-text-secondary uppercase">
            Activity for {selectedPeriod === 'current_month' ? 'This Month' : selectedPeriod === 'last_month' ? 'Last Month' : 'This Year'}
          </span>
          <div className="flex items-center gap-3">
            {onOpenExportLedger && userRole !== 'viewer' && filteredTransactions.length > 0 && (
              <button
                type="button"
                onClick={onOpenExportLedger}
                className="text-xs text-text-secondary hover:text-google-blue font-medium flex items-center gap-1 transition-colors cursor-pointer select-none"
                title="Export this period's ledger in Excel, CSV, or PDF"
              >
                <Download size={12} className="text-google-blue" />
                <span>Export</span>
              </button>
            )}
            {onNavigateToTransactions && (geminiEnabled || filteredTransactions.length > 4) && (
              <button
                type="button"
                onClick={onNavigateToTransactions}
                className="text-xs text-google-blue hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Full ledger</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-10 px-4 text-center bg-surface rounded-3xl border border-border text-xs text-text-secondary space-y-2">
            <p className="font-medium text-text-primary text-sm">No expenses recorded for {getPeriodText()}</p>
            <p className="text-text-secondary">Transactions recorded for this period will appear here.</p>
            {selectedPeriod !== 'current_month' ? (
              <button
                type="button"
                onClick={() => onSelectPeriod('current_month')}
                className="mt-2 inline-block px-3 py-1.5 rounded-full bg-surface-hover hover:bg-surface-active text-google-blue font-semibold cursor-pointer transition-colors"
              >
                Back to This Month
              </button>
            ) : (
              canEdit && (
                <button
                  type="button"
                  onClick={onOpenAddExpense}
                  className="mt-2 inline-block px-3 py-1.5 rounded-full bg-google-blue hover:bg-google-blue-hover text-white font-medium cursor-pointer transition-colors"
                >
                  + Add Expense
                </button>
              )
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {recentDayGroups.map((dayGroup) => (
              <div
                key={dayGroup.dateKey}
                className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs"
              >
                {/* Subtle Day Header with Day Subtotal matching Ledger tab */}
                <div className="px-3.5 sm:px-4 py-1.5 bg-surface-hover/30 border-b border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-text-primary">
                      {dayGroup.displayDate}
                    </span>
                    <span className="text-text-secondary/50">·</span>
                    <span className="text-text-secondary text-[11px]">
                      {dayGroup.transactions.length} {dayGroup.transactions.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-text-primary text-xs">
                    {formatINR(dayGroup.dayTotal, { symbol: true })}
                  </span>
                </div>

                {/* Transaction Rows for this day */}
                <div className="divide-y divide-border">
                  {dayGroup.transactions.map((tx) => {
                    const catData = categories[tx.category] || { name: tx.category, iconName: 'Tag', hex: '#888888' };
                    const isScheduled = Boolean(tx.recurringExpenseId);
                    const IconComp = isScheduled ? Repeat : (ICON_MAP[catData.iconName] || Tag);
                    const isAutoNote = tx.note && (tx.note.toLowerCase().startsWith('scheduled ') || tx.note.toLowerCase().startsWith('scheduled bill'));
                    const customNote = isAutoNote ? null : tx.note;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => canEdit && onEditExpense(tx)}
                        className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                          canEdit ? 'hover:bg-surface-hover/60 cursor-pointer active:bg-surface-hover/90' : 'hover:bg-surface-hover/40'
                        }`}
                      >
                        {/* Left: Icon + Title */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform"
                            style={{ backgroundColor: `${catData.hex}14`, color: catData.hex }}
                          >
                            <IconComp size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm sm:text-base font-medium text-text-primary truncate">
                                {tx.isSettlement 
                                  ? `Settlement: ${formatSettlementDisplayTitle(tx, undefined, user?.uid, user?.email || undefined)}` 
                                  : tx.name}
                              </span>
                              {tx.settled && (
                                <span className="text-xs sm:text-sm font-semibold text-google-blue dark:text-blue-400 bg-google-blue/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                                  Refunded
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm text-text-secondary truncate mt-0.5">
                              <span>{catData.name}</span>
                              {isScheduled && <span> · Scheduled</span>}
                              {customNote && <span className="italic"> · {customNote}</span>}
                              {tx.createdByName && <span> · {tx.createdByName}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Context Actions */}
                        <div 
                          className="flex items-center gap-2 sm:gap-3 shrink-0" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-right min-w-[64px] sm:min-w-[80px]">
                            <div className="text-sm sm:text-base font-semibold text-text-primary tabular-nums">
                              {formatINR(tx.amount, { symbol: true })}
                            </div>
                            {tx.settled && tx.originalAmount && (
                              <div className="text-xs text-text-secondary line-through tabular-nums">
                                {formatINR(tx.originalAmount, { symbol: true })}
                              </div>
                            )}
                          </div>

                          {canEdit && (
                            <>
                              {/* Desktop: Direct inline action buttons */}
                              <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 shrink-0">
                                {/* Fixed slot for Refund / Undo to prevent column jumping */}
                                <div className="w-[60px] sm:w-[68px] flex justify-end">
                                  {!tx.settled ? (
                                    <button
                                      type="button"
                                      onClick={() => onSettleExpense(tx)}
                                      className="h-7 px-2.5 rounded-lg bg-google-blue/10 hover:bg-google-blue/20 text-google-blue dark:text-blue-400 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
                                      title="Refund expense"
                                    >
                                      Refund
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onUndoSettleExpense(tx)}
                                      title="Undo refund / restore original amount"
                                      className="h-7 px-2 rounded-lg bg-surface-hover hover:bg-surface-active text-text-secondary hover:text-google-blue text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                                    >
                                      <RotateCcw size={11} />
                                      <span>Undo</span>
                                    </button>
                                  )}
                                </div>

                                {/* Fixed slot for Edit Pencil */}
                                <button
                                  type="button"
                                  onClick={() => onEditExpense(tx)}
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  title="Edit expense"
                                >
                                  <Pencil size={13} />
                                </button>
                              </div>

                              {/* Mobile: Clean 3-dots button (maximizes title and category visibility) */}
                              <div className="flex sm:hidden items-center shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActionMenu({ tx, rect });
                                  }}
                                  className="w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                                  title="More options"
                                  aria-label="More options"
                                >
                                  <MoreVertical size={16} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Transaction Action Menu (Anchored directly at 3-dots) */}
      <TransactionActionSheet
        isOpen={Boolean(actionMenu)}
        onClose={() => setActionMenu(null)}
        transaction={actionMenu?.tx || null}
        anchorRect={actionMenu?.rect || null}
        categories={categories}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
        onRefundExpense={onSettleExpense}
        onUndoSettleExpense={onUndoSettleExpense}
      />
    </div>
  );
}
