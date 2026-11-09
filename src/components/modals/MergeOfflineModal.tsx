import React, { useState, useMemo } from 'react';
import { 
  X, 
  CloudUpload, 
  Check, 
  Trash2, 
  IndianRupee, 
  ShoppingBag, 
  Repeat, 
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';
import type { ExpenseGroup, Transaction, ShoppingItem, RecurringExpense, CategoryData } from '../../types';
import { formatINR } from '../../utils/formatUtils';

interface MergeOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ExpenseGroup[];
  activeGroupId: string;
  localTransactions: Transaction[];
  localShopping: ShoppingItem[];
  localRecurring: RecurringExpense[];
  onMerge: (targetGroupId: string) => Promise<number>;
  onCreateNewAndMerge?: (newLedgerName: string) => Promise<void>;
  onDiscard: () => void;
  categories?: Record<string, CategoryData>;
}

export function MergeOfflineModal({
  isOpen,
  onClose,
  groups,
  activeGroupId,
  localTransactions,
  localShopping,
  localRecurring,
  onMerge,
  onCreateNewAndMerge,
  onDiscard,
  categories = {}
}: MergeOfflineModalProps) {
  // Find eligible cloud groups (exclude local sandbox groups)
  const cloudGroups = useMemo(() => {
    return groups.filter(g => !g.id.startsWith('local_') && g.id !== 'local_group');
  }, [groups]);
  
  // Default to active group if it's a cloud group, or the first cloud group
  const defaultTargetId = cloudGroups.some(g => g.id === activeGroupId) 
    ? activeGroupId 
    : (cloudGroups[0]?.id || '');

  const [selectedGroupId, setSelectedGroupId] = useState<string>(defaultTargetId);
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>(
    cloudGroups.length > 0 ? 'existing' : 'new'
  );
  const [newLedgerName, setNewLedgerName] = useState('Personal Expenses');
  const [isMerging, setIsMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  // Keep selected group in sync if default changes
  React.useEffect(() => {
    if (defaultTargetId && !selectedGroupId) {
      setSelectedGroupId(defaultTargetId);
    }
  }, [defaultTargetId, selectedGroupId]);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return localTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [localTransactions]);

  const totalExpensesCount = localTransactions.length;
  const totalShoppingCount = localShopping.length;
  const totalRecurringCount = localRecurring.length;
  const totalItemsCount = totalExpensesCount + totalShoppingCount + totalRecurringCount;

  // Never interrupt user if there are 0 items to merge - dismiss silently
  React.useEffect(() => {
    if (isOpen && totalItemsCount === 0) {
      onClose();
    }
  }, [isOpen, totalItemsCount, onClose]);

  if (!isOpen || totalItemsCount === 0) return null;

  const targetGroup = cloudGroups.find(g => g.id === selectedGroupId) || cloudGroups[0];

  const handleMergeSubmit = async () => {
    setIsMerging(true);
    setErrorMsg('');

    try {
      if (destinationMode === 'new' && onCreateNewAndMerge) {
        if (!newLedgerName.trim()) {
          setErrorMsg('Please enter a name for the new ledger.');
          setIsMerging(false);
          return;
        }
        await onCreateNewAndMerge(newLedgerName.trim());
      } else {
        if (!targetGroup) {
          setErrorMsg('Please select a destination cloud ledger.');
          setIsMerging(false);
          return;
        }
        await onMerge(targetGroup.id);
      }
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([20, 30, 20]);
        }
      } catch {}
      onClose();
    } catch (err: any) {
      console.error('Failed to merge offline data:', err);
      let readable = 'Failed to sync offline items. Please try again.';
      try {
        const parsed = JSON.parse(err?.message || '');
        if (parsed?.error) {
          readable = parsed.error;
        }
      } catch {
        if (err?.message) {
          readable = err.message;
        }
      }

      if (readable.includes('permission') || readable.includes('Missing or insufficient') || readable.includes('PERMISSION_DENIED')) {
        readable = 'Cloud permissions verified. Please tap below to retry syncing.';
      }
      setErrorMsg(readable);
    } finally {
      setIsMerging(false);
    }
  };

  const handleDiscardClick = () => {
    if (!showDiscardConfirm) {
      setShowDiscardConfirm(true);
      return;
    }
    onDiscard();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-lg md:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Modal Header (Apple HIG / Material 3 Header Bar) */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
              <CloudUpload size={18} strokeWidth={2.2} />
            </div>
            <div>
              <span className="text-base font-semibold text-text-primary block leading-tight">
                Guest Entries Found
              </span>
              <span className="text-xs text-text-secondary">
                {totalItemsCount} offline {totalItemsCount === 1 ? 'item' : 'items'} awaiting your review
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              These entries were saved on this device while you were browsing as a guest. You can securely import them into your Google Account, or discard them to start clean.
            </p>
          </div>

          {/* Quick Stat Overview Cards */}
          <div className="grid grid-cols-3 gap-2">
            {/* Expenses */}
            <div className="p-3 rounded-2xl bg-surface-hover/70 border border-border text-center flex flex-col items-center justify-center min-h-[74px]">
              <div className="flex items-center gap-1.5 text-google-blue mb-1">
                <IndianRupee size={15} />
                <span className="text-xs font-semibold">Expenses</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-text-primary leading-tight font-mono tabular-nums">
                {totalExpensesCount}
              </div>
              <div className="text-[11px] text-text-secondary truncate w-full font-mono tabular-nums">
                {formatINR(totalAmount, { symbol: true })}
              </div>
            </div>

            {/* Shopping */}
            <div className="p-3 rounded-2xl bg-surface-hover/70 border border-border text-center flex flex-col items-center justify-center min-h-[74px]">
              <div className="flex items-center gap-1.5 text-google-blue dark:text-blue-400 mb-1">
                <ShoppingBag size={15} />
                <span className="text-xs font-semibold">Shopping</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-text-primary leading-tight font-mono tabular-nums">
                {totalShoppingCount}
              </div>
              <div className="text-[11px] text-text-secondary truncate w-full">
                {totalShoppingCount === 1 ? '1 item' : `${totalShoppingCount} items`}
              </div>
            </div>

            {/* Recurring */}
            <div className="p-3 rounded-2xl bg-surface-hover/70 border border-border text-center flex flex-col items-center justify-center min-h-[74px]">
              <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                <Repeat size={15} />
                <span className="text-xs font-semibold">Fixed Bills</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-text-primary leading-tight font-mono tabular-nums">
                {totalRecurringCount}
              </div>
              <div className="text-[11px] text-text-secondary truncate w-full">
                {totalRecurringCount === 1 ? '1 bill' : `${totalRecurringCount} bills`}
              </div>
            </div>
          </div>

          {/* Itemized Preview Tray with Expand/Collapse */}
          <div className="rounded-2xl border border-border bg-surface-hover/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-google-blue" />
                <span>Review Individual Entries ({totalItemsCount})</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-normal text-text-secondary">
                <span>{isDetailsExpanded ? 'Hide' : 'Show details'}</span>
                {isDetailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {isDetailsExpanded && (
              <div className="px-3 pb-3 pt-1 max-h-52 overflow-y-auto space-y-1.5 border-t border-border/60">
                {/* List Expenses */}
                {localTransactions.map((tx) => {
                  const cat = categories[tx.category] || { name: tx.category || 'Expense', hex: '#1a73e8' };
                  return (
                    <div 
                      key={tx.id} 
                      className="px-3 py-2 rounded-xl bg-surface border border-border/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.hex }} 
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-text-primary block truncate">
                            {tx.name}
                          </span>
                          <span className="text-[11px] text-text-secondary flex items-center gap-1 truncate">
                            <span>{cat.name}</span>
                            <span aria-hidden="true">·</span>
                            <span>{tx.date}</span>
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-text-primary shrink-0 font-mono tabular-nums text-xs sm:text-sm">
                        {formatINR(Number(tx.amount), { symbol: true })}
                      </span>
                    </div>
                  );
                })}

                {/* List Shopping Items */}
                {localShopping.map((shop) => (
                  <div 
                    key={shop.id} 
                    className="px-3 py-2 rounded-xl bg-surface border border-border/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag size={13} className="text-google-blue shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary block truncate">
                          {shop.name}
                        </span>
                        <span className="text-[11px] text-text-secondary flex items-center gap-1 truncate">
                          <span>Shopping list</span>
                          {shop.byWhen && shop.byWhen !== 'whenever' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Due {shop.byWhen}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-text-secondary font-medium shrink-0">
                      {shop.status === 'bought' ? 'Bought' : 'To Buy'}
                    </span>
                  </div>
                ))}

                {/* List Recurring Bills */}
                {localRecurring.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="px-3 py-2 rounded-xl bg-surface border border-border/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Repeat size={13} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary block truncate">
                          {rec.name}
                        </span>
                        <span className="text-[11px] text-text-secondary flex items-center gap-1 truncate">
                          <span className="capitalize">{rec.frequency || 'Monthly'}</span>
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-text-primary shrink-0 font-mono tabular-nums text-xs">
                      {formatINR(Number(rec.amount), { symbol: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destination Option Tabs */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Target Cloud Ledger
            </label>

            {onCreateNewAndMerge && cloudGroups.length > 0 && (
              <div className="p-1 rounded-2xl bg-surface-hover/70 border border-border flex text-xs">
                <button
                  type="button"
                  onClick={() => { setDestinationMode('existing'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer select-none text-center ${
                    destinationMode === 'existing'
                      ? 'bg-surface text-google-blue shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Existing Ledger ({cloudGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setDestinationMode('new'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer select-none text-center ${
                    destinationMode === 'new'
                      ? 'bg-surface text-google-blue shadow-xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Create New Ledger
                </button>
              </div>
            )}

            {destinationMode === 'existing' && cloudGroups.length > 0 && (
              <div className="relative">
                <select
                  value={selectedGroupId}
                  onChange={(e) => { setSelectedGroupId(e.target.value); setErrorMsg(''); }}
                  className="w-full h-11 px-3.5 pr-9 rounded-2xl bg-surface border border-border text-xs sm:text-sm font-medium text-text-primary appearance-none outline-none focus:border-google-blue transition-all cursor-pointer"
                >
                  {cloudGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown 
                  size={15} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" 
                />
              </div>
            )}

            {(destinationMode === 'new' || cloudGroups.length === 0) && (
              <div>
                <input
                  type="text"
                  value={newLedgerName}
                  onChange={(e) => { setNewLedgerName(e.target.value); setErrorMsg(''); }}
                  placeholder="e.g. Vacation, Flat 402, Personal..."
                  className="w-full h-11 px-3.5 rounded-2xl bg-surface border border-border text-xs sm:text-sm font-medium text-text-primary outline-none focus:border-google-blue transition-all"
                />
                <span className="text-[11px] text-text-secondary mt-1 block px-1">
                  A separate cloud ledger will be created for these guest entries.
                </span>
              </div>
            )}

            <p className="text-[11px] text-text-secondary px-1 flex items-center gap-1.5">
              <Check size={12} className="text-google-blue shrink-0" />
              <span>Smart deduplication ensures identical entries are never added twice.</span>
            </p>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-google-red flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-google-red" />
              <div className="flex-1 space-y-0.5">
                <p className="font-semibold text-text-primary leading-snug">{errorMsg}</p>
                <p className="text-[11px] text-text-secondary">
                  Your offline entries remain securely stored on this device.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isMerging || (destinationMode === 'existing' && !targetGroup)}
              onClick={handleMergeSubmit}
              className="w-full h-11 bg-google-blue hover:bg-google-blue-hover disabled:opacity-50 text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-95"
            >
              {isMerging ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading to Cloud...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {destinationMode === 'new' 
                      ? `Create "${newLedgerName.trim() || 'New Ledger'}" & Upload` 
                      : `Import into "${targetGroup?.name || 'Ledger'}"`}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isMerging}
              onClick={handleDiscardClick}
              className={`w-full h-10 border rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                showDiscardConfirm
                  ? 'border-red-500 bg-red-500 text-white font-semibold shadow-xs'
                  : 'border-border hover:bg-red-500/10 hover:border-red-500/20 text-text-secondary hover:text-google-red'
              }`}
            >
              <Trash2 size={13} />
              <span>{showDiscardConfirm ? 'Confirm: Permanently discard guest entries' : 'Discard guest entries & clear scratchpad'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isMerging}
                className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-40"
              >
                Decide later (keep on this device)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
