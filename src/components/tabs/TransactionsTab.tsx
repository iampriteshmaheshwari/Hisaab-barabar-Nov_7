import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Zap, 
  TrendingUp, 
  Tag, 
  Pencil, 
  Trash2, 
  RotateCcw,
  X,
  Calendar,
  SlidersHorizontal,
  Check,
  Repeat,
  MoreVertical,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';
import type { Transaction, CategoryData, UserRole, DayGroup } from '../../types';
import { ICON_MAP } from '../modals/CategoryModal';
import { createPortal } from 'react-dom';
import { TransactionActionSheet } from '../modals/TransactionActionSheet';
import { useAuth } from '../../context/AuthContext';
import { formatSettlementDisplayTitle } from '../../services/splitService';
import { formatINR } from '../../utils/formatUtils';

interface TransactionsTabProps {
  transactions: Transaction[];
  categories: Record<string, CategoryData>;
  userRole: UserRole;
  onOpenAddExpense: () => void;
  onEditExpense: (tx: Transaction) => void;
  onDeleteExpense: (txId: string) => void;
  onSettleExpense: (tx: Transaction) => void;
  onUndoSettleExpense: (tx: Transaction) => void;
  groupName: string;
  onOpenExportLedger?: () => void;
  onOpenImportLedger?: () => void;
  canImport?: boolean;
}

export type DateRangePreset = 'all' | 'today' | 'this_month' | 'this_quarter' | 'this_year' | 'custom';

// Helper to format human-friendly day and month groupings
function formatDayHeading(dateStr?: string): { displayDate: string; monthKey: string; sortKey: string } {
  if (!dateStr) return { displayDate: 'Undated', monthKey: 'Undated', sortKey: '0000-00-00' };
  
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length < 3) return { displayDate: dateStr, monthKey: 'Other', sortKey: datePart };

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

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

export function TransactionsTab({
  transactions,
  categories,
  userRole,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onSettleExpense,
  onUndoSettleExpense,
  groupName,
  onOpenExportLedger,
  onOpenImportLedger,
  canImport
}: TransactionsTabProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'settled'>('all');
  
  // Date Filtering State (Today is accessible as a 1-tap quick toggle on the main bar)
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Amount Range Filtering State
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Sort Order State: 'added' (default), 'amount_desc', 'amount_asc'
  const [sortBy, setSortBy] = useState<'added' | 'amount_desc' | 'amount_asc'>('added');

  // Creator Filter State (Multi-select)
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);

  // Mobile Action Menu State for 3-dots popup
  const [actionMenu, setActionMenu] = useState<{ tx: Transaction; rect: DOMRect } | null>(null);

  // Desktop Delete Confirmation State
  const [desktopDeleteTx, setDesktopDeleteTx] = useState<Transaction | null>(null);

  // Advanced Filter Modal Toggle (keeps main view ultra-clean)
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Keyboard accessibility: dismiss filter modal on Escape
  React.useEffect(() => {
    if (!showFiltersModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFiltersModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFiltersModal]);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  // Extract all unique creators from transactions
  const availableCreators = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const tx of transactions) {
      const id = tx.createdBy || tx.createdByName || 'unknown';
      const name = tx.createdByName || (tx.createdBy === 'guest' ? 'Guest' : 'Member');
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [transactions]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    datePreset !== 'all' ||
    customStartDate ||
    customEndDate ||
    minAmount.trim() ||
    maxAmount.trim() ||
    selectedCreators.length > 0 ||
    sortBy !== 'added'
  );

  // Active filter count for the badge (excluding text search)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (datePreset !== 'all') count++;
    if (minAmount.trim() || maxAmount.trim()) count++;
    if (selectedCreators.length > 0) count++;
    if (sortBy !== 'added') count++;
    return count;
  }, [selectedCategory, selectedStatus, datePreset, minAmount, maxAmount, selectedCreators, sortBy]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSelectedCreators([]);
    setSortBy('added');
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();
    const curQuarter = Math.floor(curMonth / 3);

    const min = minAmount.trim() !== '' ? parseFloat(minAmount) : null;
    const max = maxAmount.trim() !== '' ? parseFloat(maxAmount) : null;

    return transactions.filter((tx) => {
      // 1. Text Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = tx.name.toLowerCase().includes(query);
        const matchesNote = Boolean(tx.note && tx.note.toLowerCase().includes(query));
        const matchesCreator = Boolean(tx.createdByName && tx.createdByName.toLowerCase().includes(query));
        if (!matchesName && !matchesNote && !matchesCreator) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatus === 'active' && tx.settled) return false;
      if (selectedStatus === 'settled' && !tx.settled) return false;

      // 4. Amount Range Filter
      if (min !== null && !isNaN(min) && tx.amount < min) return false;
      if (max !== null && !isNaN(max) && tx.amount > max) return false;

      // 5. Date Filter
      if (datePreset !== 'all') {
        if (!tx.date) return false;
        const datePart = tx.date.split('T')[0];
        const [yStr, mStr, dStr] = datePart.split('-');
        const txYear = parseInt(yStr, 10);
        const txMonth = parseInt(mStr, 10) - 1;
        const txDay = parseInt(dStr, 10);

        if (isNaN(txYear) || isNaN(txMonth)) return true;

        if (datePreset === 'today') {
          if (txYear !== curYear || txMonth !== curMonth || txDay !== curDay) return false;
        } else if (datePreset === 'this_month') {
          if (txYear !== curYear || txMonth !== curMonth) return false;
        } else if (datePreset === 'this_quarter') {
          const txQuarter = Math.floor(txMonth / 3);
          if (txYear !== curYear || txQuarter !== curQuarter) return false;
        } else if (datePreset === 'this_year') {
          if (txYear !== curYear) return false;
        } else if (datePreset === 'custom') {
          if (customStartDate && datePart < customStartDate) return false;
          if (customEndDate && datePart > customEndDate) return false;
        }
      }

      // 6. Creator Filter (Multi-select)
      if (selectedCreators.length > 0) {
        const creatorId = tx.createdBy || tx.createdByName || 'unknown';
        if (!selectedCreators.includes(creatorId)) return false;
      }

      return true;
    });
  }, [
    transactions,
    searchTerm,
    selectedCategory,
    selectedStatus,
    minAmount,
    maxAmount,
    datePreset,
    customStartDate,
    customEndDate,
    selectedCreators
  ]);

  // Aggregate total sum of filtered transactions
  const totalFiltered = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  // Helper to extract timestamp when transaction was added
  const getAddedTimestamp = (tx: Transaction): string => {
    if (tx.createdAt) return tx.createdAt;
    const match = tx.id && tx.id.match(/^tx_(\d+)/);
    if (match) {
      try {
        return new Date(parseInt(match[1], 10)).toISOString();
      } catch {}
    }
    return tx.id || '';
  };

  // Sort chronologically descending (newest date first, then by chosen sort order within each date)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const dateA = a.date ? a.date.split('T')[0] : '';
      const dateB = b.date ? b.date.split('T')[0] : '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      // Transactions on the SAME date:
      if (sortBy === 'amount_desc') {
        const diff = (b.amount || 0) - (a.amount || 0);
        if (diff !== 0) return diff;
        // Secondary: when added
        const createdA = getAddedTimestamp(a);
        const createdB = getAddedTimestamp(b);
        return createdB.localeCompare(createdA);
      }

      if (sortBy === 'amount_asc') {
        const diff = (a.amount || 0) - (b.amount || 0);
        if (diff !== 0) return diff;
        // Secondary: when added
        const createdA = getAddedTimestamp(a);
        const createdB = getAddedTimestamp(b);
        return createdB.localeCompare(createdA);
      }

      // Default: 'added' - sorted by when those were added (most recently added first)
      const createdA = getAddedTimestamp(a);
      const createdB = getAddedTimestamp(b);
      const cmp = createdB.localeCompare(createdA);
      if (cmp !== 0) return cmp;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [filteredTransactions, sortBy]);

  // Group by Month and Day for subtle visual differentiation
  interface MonthGroup {
    monthKey: string;
    monthTotal: number;
    days: DayGroup[];
  }

  const monthGroups = useMemo(() => {
    const groups: MonthGroup[] = [];
    const monthMap = new Map<string, MonthGroup>();

    for (const tx of sortedTransactions) {
      const { displayDate, monthKey } = formatDayHeading(tx.date);
      const dateKey = tx.date ? tx.date.split('T')[0] : 'undated';

      let mGroup = monthMap.get(monthKey);
      if (!mGroup) {
        mGroup = {
          monthKey,
          monthTotal: 0,
          days: []
        };
        monthMap.set(monthKey, mGroup);
        groups.push(mGroup);
      }

      mGroup.monthTotal += tx.amount;

      let dGroup = mGroup.days.find(d => d.dateKey === dateKey);
      if (!dGroup) {
        dGroup = {
          dateKey,
          displayDate,
          dayTotal: 0,
          transactions: []
        };
        mGroup.days.push(dGroup);
      }

      dGroup.dayTotal += tx.amount;
      dGroup.transactions.push(tx);
    }

    return groups;
  }, [sortedTransactions]);

  return (
    <div className="space-y-3 pb-20 font-sans">
      {/* Compact Search & Quick Filter Bar (Apple HIG / Google Material 3) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-3 text-text-secondary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search expenses, notes, members..."
              className="w-full pl-9 pr-9 py-2 bg-surface rounded-full border border-border text-xs sm:text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-google-blue transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-text-secondary hover:text-text-primary cursor-pointer p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 1-Tap Quick "Today" Toggle (solves the most frequent daily need cleanly) */}
          <button
            type="button"
            onClick={() => setDatePreset(prev => prev === 'today' ? 'all' : 'today')}
            className={`h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none shrink-0 ${
              datePreset === 'today'
                ? 'bg-google-blue text-white shadow-xs'
                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
            }`}
            title={datePreset === 'today' ? "Showing today's expenses. Tap to view all time." : "Filter to today's expenses"}
          >
            <Calendar size={13} />
            <span>Today</span>
          </button>

          {/* Advanced Filter Dialog Trigger */}
          <button
            type="button"
            onClick={() => setShowFiltersModal(true)}
            className={`h-9 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 select-none ${
              activeFiltersCount > (datePreset === 'today' ? 1 : 0) || (datePreset !== 'all' && datePreset !== 'today')
                ? 'bg-google-blue text-white border-google-blue shadow-xs font-semibold'
                : 'bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary border-border'
            }`}
            title="Filter by amount, period, category, or status"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                activeFiltersCount > (datePreset === 'today' ? 1 : 0) || (datePreset !== 'all' && datePreset !== 'today')
                  ? 'bg-white text-google-blue'
                  : 'bg-google-blue text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Subtle, Dismissible Active Filter Chips (only rendered when filters are active) */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs animate-in fade-in duration-150">
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mr-0.5">
              Active:
            </span>

            {datePreset !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-xs font-medium">
                {datePreset === 'today' && 'Today'}
                {datePreset === 'this_month' && 'This Month'}
                {datePreset === 'this_quarter' && 'This Quarter'}
                {datePreset === 'this_year' && 'This Year'}
                {datePreset === 'custom' && `${customStartDate || 'Start'} to ${customEndDate || 'End'}`}
                <button
                  type="button"
                  onClick={() => setDatePreset('all')}
                  className="hover:text-blue-800 cursor-pointer"
                  title="Remove date filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {(minAmount || maxAmount) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-xs font-medium">
                {minAmount && maxAmount ? `₹${minAmount} – ₹${maxAmount}` : minAmount ? `Min ₹${minAmount}` : `Max ₹${maxAmount}`}
                <button
                  type="button"
                  onClick={() => { setMinAmount(''); setMaxAmount(''); }}
                  className="hover:text-blue-800 cursor-pointer"
                  title="Remove amount filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-xs font-medium">
                {categories[selectedCategory]?.name || selectedCategory}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-blue-800 cursor-pointer"
                  title="Remove category filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue text-xs font-medium capitalize">
                {selectedStatus === 'settled' ? 'Refunded only' : `${selectedStatus} only`}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('all')}
                  className="hover:text-blue-800 cursor-pointer"
                  title="Remove status filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {selectedCreators.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue dark:text-blue-400 text-xs font-medium">
                {selectedCreators.length === 1
                  ? (availableCreators.find(c => c.id === selectedCreators[0])?.name || '1 member')
                  : `${selectedCreators.length} members`}
                <button
                  type="button"
                  onClick={() => setSelectedCreators([])}
                  className="hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer"
                  title="Remove creator filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {sortBy !== 'added' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-google-blue/10 text-google-blue dark:text-blue-400 text-xs font-medium">
                {sortBy === 'amount_desc' ? 'Amount: High to Low' : 'Amount: Low to High'}
                <button
                  type="button"
                  onClick={() => setSortBy('added')}
                  className="hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer"
                  title="Reset sort order"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-text-secondary hover:text-google-blue transition-colors cursor-pointer ml-1 font-medium"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Subtle Expense List Header with Total subtly aligned on Top Right */}
      <div className="flex items-center justify-between px-1.5 pt-1 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-text-primary text-xs tracking-tight">
            {datePreset === 'today' ? "Today's Expenses" : hasActiveFilters ? "Filtered Expenses" : "All Expenses"}
          </span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary font-medium shrink-0">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* Subtle, Elegant Total & Export action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary text-[11px] uppercase tracking-wider font-semibold">Total</span>
            <span className="font-bold font-mono text-base text-text-primary tracking-tight">
              {formatINR(totalFiltered, { symbol: true })}
            </span>
          </div>

          {onOpenExportLedger && userRole !== 'viewer' && filteredTransactions.length > 0 && (
            <button
              type="button"
              onClick={onOpenExportLedger}
              className="h-7 px-2.5 rounded-full border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1 transition-all cursor-pointer select-none"
              title="Export ledger in Excel, CSV, or PDF format"
            >
              <Download size={11} className="text-google-blue" />
              <span>Export</span>
            </button>
          )}

          {canImport && onOpenImportLedger && userRole !== 'viewer' && (
            <button
              type="button"
              onClick={onOpenImportLedger}
              className="h-7 px-2.5 rounded-full border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1 transition-all cursor-pointer select-none"
              title="Import ledger from CSV or Excel"
            >
              <Upload size={11} className="text-google-blue" />
              <span>Import</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions List with Day & Month Groupings */}
      {filteredTransactions.length === 0 ? (
        <div className="py-14 px-4 text-center bg-surface rounded-3xl border border-border text-xs text-text-secondary space-y-3">
          <p className="font-medium text-sm text-text-primary">No transactions found</p>
          <p className="text-xs text-text-secondary max-w-xs mx-auto">
            {hasActiveFilters
              ? 'No expenses match the current filter criteria.'
              : 'No transactions recorded in this ledger yet.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-2 px-3.5 py-1.5 rounded-full bg-google-blue text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {userRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={onOpenAddExpense}
                  className="px-4 py-2 rounded-full bg-google-blue hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  Add First Expense
                </button>
              )}
              {canImport && onOpenImportLedger && userRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={onOpenImportLedger}
                  className="px-4 py-2 rounded-full border border-border bg-surface hover:bg-surface-hover text-text-primary text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-98"
                >
                  <Upload size={13} className="text-google-blue" />
                  <span>Import from CSV / Excel</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map((monthGroup) => {
            const showMonthHeader = monthGroups.length > 1;

            return (
              <div key={monthGroup.monthKey} className="space-y-2">
                {/* Subtle Month Header (shown when viewing multiple months) */}
                {showMonthHeader && (
                  <div className="flex items-center justify-between px-2 pt-2 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-text-secondary">
                      {monthGroup.monthKey}
                    </span>
                    <span className="text-text-secondary font-mono text-[11px]">
                      {formatINR(monthGroup.monthTotal, { symbol: true })}
                    </span>
                  </div>
                )}

                {/* Day Groups inside this month */}
                <div className="space-y-2.5">
                  {monthGroup.days.map((dayGroup) => (
                    <div
                      key={dayGroup.dateKey}
                      className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs"
                    >
                      {/* Subtle Day Header with Day Subtotal */}
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
                              {/* Left: Icon + Title + Meta */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div 
                                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: `${catData.hex}14`, color: catData.hex }}
                                >
                                  <IconComp size={16} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium text-text-primary truncate">
                                      {tx.isSettlement 
                                        ? `Settlement: ${formatSettlementDisplayTitle(tx, undefined, user?.uid, user?.email || undefined)}` 
                                        : tx.name}
                                    </span>
                                    {tx.settled && (
                                      <span className="text-[11px] font-semibold text-google-blue dark:text-blue-400 bg-google-blue/10 px-1.5 py-0.2 rounded whitespace-nowrap">
                                        Refunded
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-text-secondary truncate mt-0.5">
                                    <span>{catData.name}</span>
                                    {isScheduled && <span> · Scheduled</span>}
                                    {tx.createdByName && <span> · {tx.createdByName}</span>}
                                  </div>
                                  {customNote && (
                                    <div className="text-xs text-text-secondary truncate mt-0.5 italic">
                                      "{customNote}"
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right: Amount + Context Actions */}
                              <div 
                                className="flex items-center gap-2 sm:gap-3 shrink-0" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-right min-w-[60px] sm:min-w-[76px]">
                                  <div className="text-sm sm:text-base font-semibold text-text-primary tabular-nums">
                                    {formatINR(tx.amount, { symbol: true })}
                                  </div>
                                  {tx.settled && tx.originalAmount && (
                                    <div className="text-[11px] text-text-secondary line-through tabular-nums">
                                      {formatINR(tx.originalAmount, { symbol: true })}
                                    </div>
                                  )}
                                </div>

                                {canEdit && (
                                  <>
                                    {/* Desktop: Direct inline action buttons */}
                                    <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 shrink-0">
                                      {/* Refund / Undo Button */}
                                      <div className="w-[60px] sm:w-[68px] flex justify-end">
                                        {!tx.settled ? (
                                          <button
                                            type="button"
                                            onClick={() => onSettleExpense(tx)}
                                            className="h-8 px-2.5 rounded-lg bg-google-blue/10 hover:bg-google-blue/20 text-google-blue dark:text-blue-400 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap active:scale-95"
                                            title="Refund expense"
                                          >
                                            Refund
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => onUndoSettleExpense(tx)}
                                            title="Undo refund / restore original amount"
                                            className="h-8 px-2.5 rounded-lg bg-surface-hover hover:bg-surface-active text-text-secondary hover:text-google-blue text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                                          >
                                            <RotateCcw size={12} />
                                            <span>Undo</span>
                                          </button>
                                        )}
                                      </div>

                                      {/* Edit Button */}
                                      <button
                                        type="button"
                                        onClick={() => onEditExpense(tx)}
                                        className="w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                                        title="Edit expense"
                                        aria-label="Edit expense"
                                      >
                                        <Pencil size={14} />
                                      </button>

                                      {/* Delete Button */}
                                      <button
                                        type="button"
                                        onClick={() => setDesktopDeleteTx(tx)}
                                        className="w-8 h-8 rounded-lg text-text-secondary hover:text-google-red hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                                        title="Delete expense"
                                        aria-label="Delete expense"
                                      >
                                        <Trash2 size={14} />
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
              </div>
            );
          })}
        </div>
      )}

      {/* Advanced Filter Modal (Apple Bottom Sheet on mobile / Dialog on desktop) */}
      {showFiltersModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowFiltersModal(false)}
        >
          <div
            className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-border p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Bottom Sheet Grab Handle (mobile only) */}
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Filter Expenses</h3>
                <p className="text-xs text-text-secondary mt-0.5">Narrow down by period, amount, or category</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                title="Close filters"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. Date Period Filter */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                Period
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'this_quarter', label: 'This Quarter' },
                  { id: 'this_year', label: 'This Year' },
                  { id: 'custom', label: 'Custom' }
                ].map((preset) => {
                  const isSelected = datePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDatePreset(preset.id as DateRangePreset)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-center ${
                        isSelected
                          ? 'bg-google-blue text-white font-semibold shadow-xs'
                          : 'bg-surface-hover/70 hover:bg-surface-hover text-text-secondary border border-border'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range Pickers */}
              {datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase block mb-1">From</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface-hover/50 rounded-xl border border-border text-xs text-text-primary outline-none focus:border-google-blue"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase block mb-1">To</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-surface-hover/50 rounded-xl border border-border text-xs text-text-primary outline-none focus:border-google-blue"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Sort Order */}
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Sort Order
                </span>
                {sortBy !== 'added' && (
                  <button
                    type="button"
                    onClick={() => setSortBy('added')}
                    className="text-[11px] text-google-blue dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'added', label: 'When Added', sub: 'Default' },
                  { id: 'amount_desc', label: 'Amount: High', sub: 'Highest first' },
                  { id: 'amount_asc', label: 'Amount: Low', sub: 'Lowest first' }
                ].map((s) => {
                  const isSelected = sortBy === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id as 'added' | 'amount_desc' | 'amount_asc')}
                      className={`py-2 px-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-google-blue text-white font-semibold shadow-xs'
                          : 'bg-surface-hover/70 hover:bg-surface-hover text-text-secondary border border-border'
                      }`}
                    >
                      <span className="leading-tight">{s.label}</span>
                      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-text-secondary/70'}`}>
                        {s.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Amount Range Filter */}
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Amount Range (₹)
                </span>
                {(minAmount || maxAmount) && (
                  <button
                    type="button"
                    onClick={() => { setMinAmount(''); setMaxAmount(''); }}
                    className="text-[11px] text-google-blue hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-text-secondary font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min (e.g. 50)"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 bg-surface-hover/50 rounded-xl border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-text-secondary font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max (e.g. 100)"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 bg-surface-hover/50 rounded-xl border border-border text-xs sm:text-sm text-text-primary outline-none focus:border-google-blue"
                  />
                </div>
              </div>

              {/* Quick Amount Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  { label: '₹50 – ₹100', min: '50', max: '100' },
                  { label: 'Under ₹500', min: '', max: '500' },
                  { label: '₹500 – ₹2,000', min: '500', max: '2000' },
                  { label: '₹2,000+', min: '2000', max: '' }
                ].map((range) => {
                  const isMatch = minAmount === range.min && maxAmount === range.max;
                  return (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => {
                        if (isMatch) {
                          setMinAmount('');
                          setMaxAmount('');
                        } else {
                          setMinAmount(range.min);
                          setMaxAmount(range.max);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                        isMatch
                          ? 'bg-google-blue/15 border-google-blue text-google-blue font-semibold'
                          : 'bg-surface hover:bg-surface-hover text-text-secondary border-border'
                      }`}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Categories */}
            <div className="space-y-1.5 pt-1 border-t border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                Category
              </span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-google-blue text-white shadow-xs'
                      : 'bg-surface-hover/70 text-text-secondary border border-border'
                  }`}
                >
                  All
                </button>
                {Object.entries(categories).map(([k, c]) => {
                  const isSelected = selectedCategory === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedCategory(k)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-google-blue text-white shadow-xs'
                          : 'bg-surface-hover/70 text-text-secondary border border-border'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#FFFFFF' : c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Created By (Multi-select) */}
            {availableCreators.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Created By
                  </span>
                  {selectedCreators.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCreators([])}
                      className="text-[11px] text-google-blue dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Clear ({selectedCreators.length})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCreators([])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      selectedCreators.length === 0
                        ? 'bg-google-blue text-white shadow-xs'
                        : 'bg-surface-hover/70 text-text-secondary border border-border'
                    }`}
                  >
                    All Members
                  </button>

                  {availableCreators.map((creator) => {
                    const isSelected = selectedCreators.includes(creator.id);
                    return (
                      <button
                        key={creator.id}
                        type="button"
                        onClick={() => {
                          setSelectedCreators((prev) =>
                            prev.includes(creator.id)
                              ? prev.filter((id) => id !== creator.id)
                              : [...prev, creator.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-google-blue text-white shadow-xs'
                            : 'bg-surface-hover/70 text-text-secondary border border-border hover:bg-surface-hover'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={2.5} />}
                        <span>{creator.name}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-text-secondary/70'}`}>
                          · {creator.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Settlement Status */}
            <div className="space-y-1.5 pt-1 border-t border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary block">
                Status
              </span>
              <div className="inline-flex p-0.5 rounded-xl bg-surface-hover/60 border border-border text-xs w-full">
                {(['all', 'active', 'settled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={`flex-1 py-1 rounded-lg capitalize transition-colors cursor-pointer text-center font-medium ${
                      selectedStatus === st
                        ? 'bg-surface text-text-primary font-semibold shadow-xs'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {st === 'all' ? 'All' : st === 'active' ? 'Active' : 'Refunded'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-text-secondary hover:text-text-primary font-medium cursor-pointer"
              >
                Reset All
              </button>

              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="px-4 py-2 rounded-xl bg-google-blue hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                Show {filteredTransactions.length} {filteredTransactions.length === 1 ? 'item' : 'items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Transaction Action Menu (Anchored popup directly at 3-dots) */}
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

      {/* Desktop Delete Confirmation Modal (Native Apple/Google style) */}
      {desktopDeleteTx && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[100] w-screen h-screen min-h-[100dvh] bg-black/15 dark:bg-black/35 backdrop-blur-[5px] transition-all duration-200 animate-in fade-in cursor-pointer select-none touch-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDesktopDeleteTx(null);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDesktopDeleteTx(null);
            }}
            aria-hidden="true"
          />
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 select-none pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-delete-dialog-title"
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
                  onClick={() => setDesktopDeleteTx(null)}
                  className="w-7 h-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>

              <div className="space-y-1">
                <h4 id="desktop-delete-dialog-title" className="text-sm sm:text-base font-semibold text-text-primary">
                  Delete Expense?
                </h4>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-text-primary">"{desktopDeleteTx.name}"</span> ({formatINR(desktopDeleteTx.amount, { symbol: true })})? This cannot be undone.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDesktopDeleteTx(null)}
                  className="flex-1 h-9.5 rounded-xl border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteExpense(desktopDeleteTx.id);
                    setDesktopDeleteTx(null);
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
