import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle
} from 'lucide-react';
import type { ExpenseGroup, Transaction, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';
import { 
  getGroupMembersList, 
  matchMemberKeys, 
  getMemberDisplayName,
  getExpenseLockInfo,
  canModifyExpenseMonetaryFields
} from '../../services/splitService';

interface SplitExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  userRole: UserRole;
  initialTx?: Transaction | null;
  transactions?: Transaction[];
  onOpenInviteModal?: () => void;
  onAddDirectMember?: (nameOrEmail: string) => Promise<boolean | void>;
  onSave: (data: {
    name: string;
    amount: number;
    date: string;
    paidBy: string;
    paidByName: string;
    splitMode: 'equal' | 'exact';
    splitMembers: string[];
    splits: Record<string, number>;
    note?: string;
  }) => Promise<void>;
}

export function SplitExpenseModal({
  isOpen,
  onClose,
  group,
  userRole,
  initialTx,
  transactions,
  onSave
}: SplitExpenseModalProps) {
  const { user } = useAuth();

  const lockInfo = useMemo(() => {
    if (!initialTx || !transactions) return { isLocked: false, lockingSettlements: [] };
    return getExpenseLockInfo(initialTx, transactions, group, user?.uid, user?.email || undefined);
  }, [initialTx, transactions, group, user]);

  const isLocked = lockInfo.isLocked;

  const members = useMemo(() => {
    return getGroupMembersList(group, user?.uid, user?.email || undefined);
  }, [group, user]);

  const defaultPayerKey = useMemo(() => {
    const me = members.find(m => m.isCurrentUser);
    return me ? me.key : members[0]?.key || user?.uid || '';
  }, [members, user]);

  // Form states
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState(defaultPayerKey);

  // Split equally toggle
  const [splitEqually, setSplitEqually] = useState(true);

  // List of individuals to split with
  const [selectedMemberKeys, setSelectedMemberKeys] = useState<string[]>([]);
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const amountInWords = useMemo(() => amountToIndianWords(amount), [amount]);
  const selectedCount = selectedMemberKeys.length;

  const equalCutPerPerson = useMemo(() => {
    if (numAmount <= 0 || selectedCount === 0) return 0;
    return Math.round((numAmount / selectedCount) * 100) / 100;
  }, [numAmount, selectedCount]);

  // Helper to compute equal splits map
  const computeEqualSplits = (total: number, keys: string[]): Record<string, string> => {
    if (total <= 0 || keys.length === 0) return {};
    const count = keys.length;
    const base = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - base * count) * 100) / 100;
    const result: Record<string, string> = {};
    keys.forEach((k, idx) => {
      const val = idx === 0 ? Math.round((base + remainder) * 100) / 100 : base;
      result[k] = val > 0 ? (Number.isInteger(val) ? val.toString() : val.toFixed(2)) : '0';
    });
    return result;
  };

  // Helper to get custom split cut for a member: falls back to equal share so it never shows zero
  const getMemberCustomCut = (key: string): string => {
    if (exactSplits[key] !== undefined && exactSplits[key] !== '') {
      return exactSplits[key];
    }
    if (numAmount > 0 && selectedCount > 0) {
      const base = Math.round((numAmount / selectedCount) * 100) / 100;
      return base > 0 ? (Number.isInteger(base) ? base.toString() : base.toFixed(2)) : '';
    }
    return '';
  };

  // Crucial User Requirement:
  // When toggling splitEqually to false, pre-populate exactSplits with the equal share
  // so the user can easily adjust individual amounts without starting from zero!
  const handleToggleSplitEqually = (checked: boolean) => {
    setSplitEqually(checked);
    if (!checked) {
      setExactSplits(computeEqualSplits(numAmount, selectedMemberKeys));
    }
  };

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      if (initialTx?.isSettlement) {
        onClose();
        return;
      }
      setErrorNotice(null);
      if (initialTx) {
        setName(initialTx.name || '');
        setAmount(initialTx.amount > 0 ? initialTx.amount.toString() : '');
        setDate(initialTx.date || new Date().toISOString().split('T')[0]);
        setPaidBy(initialTx.paidBy || defaultPayerKey);

        const currentMembers = initialTx.splitMembers || members.map(m => m.key);
        setSelectedMemberKeys(currentMembers);

        const isExact = initialTx.splitMode === 'exact';
        setSplitEqually(!isExact);

        if (initialTx.splits) {
          const strMap: Record<string, string> = {};
          Object.entries(initialTx.splits).forEach(([k, v]) => {
            strMap[k] = v.toString();
          });
          setExactSplits(strMap);
        } else {
          setExactSplits(computeEqualSplits(initialTx.amount, currentMembers));
        }
      } else {
        setName('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setPaidBy(defaultPayerKey);
        setSplitEqually(true);
        setSelectedMemberKeys(members.map(m => m.key));
        setExactSplits({});
      }
    }
  }, [isOpen, initialTx, members, defaultPayerKey]);

  // Select all / Deselect all toggle
  const isAllSelected = useMemo(() => {
    if (members.length === 0) return false;
    return members.every(m => selectedMemberKeys.includes(m.key));
  }, [members, selectedMemberKeys]);

  const handleToggleSelectAll = () => {
    if (isLocked) return;
    setErrorNotice(null);
    if (isAllSelected) {
      setSelectedMemberKeys([]);
      setExactSplits({});
    } else {
      const allKeys = members.map(m => m.key);
      setSelectedMemberKeys(allKeys);
      if (!splitEqually && numAmount > 0) {
        setExactSplits(computeEqualSplits(numAmount, allKeys));
      }
    }
  };

  // Toggle individual member
  const handleToggleMember = (key: string) => {
    if (isLocked) return;
    setErrorNotice(null);
    const isCurrentlySelected = selectedMemberKeys.includes(key);

    let nextKeys: string[];
    if (isCurrentlySelected) {
      nextKeys = selectedMemberKeys.filter(k => k !== key);
    } else {
      nextKeys = [...selectedMemberKeys, key];
    }
    setSelectedMemberKeys(nextKeys);

    if (!splitEqually && numAmount > 0 && nextKeys.length > 0) {
      setExactSplits(computeEqualSplits(numAmount, nextKeys));
    }
  };

  // Exact split totals when splitEqually is false
  const exactTotal = useMemo(() => {
    if (!splitEqually) {
      return selectedMemberKeys.reduce((sum, key) => {
        const valStr = getMemberCustomCut(key);
        return sum + (parseFloat(valStr) || 0);
      }, 0);
    }
    return numAmount;
  }, [exactSplits, selectedMemberKeys, splitEqually, numAmount, selectedCount]);

  const exactDiff = Math.round((numAmount - exactTotal) * 100) / 100;

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'viewer') return;

    if (!name.trim()) {
      setErrorNotice('Please provide a description for this expense.');
      return;
    }

    if (numAmount <= 0) {
      setErrorNotice('Please enter a valid amount greater than zero.');
      return;
    }

    if (selectedMemberKeys.length === 0) {
      setErrorNotice('Select at least one person to split this expense with.');
      return;
    }

    if (!splitEqually && Math.abs(exactDiff) > 0.05) {
      setErrorNotice(`Sum of individual cuts (₹${exactTotal}) does not match expense total (₹${numAmount}). Difference: ₹${exactDiff}`);
      return;
    }

    if (initialTx && transactions) {
      const isMonetaryChanged = 
        Math.abs((initialTx.amount || 0) - numAmount) > 0.001 ||
        (initialTx.paidBy || '') !== paidBy ||
        JSON.stringify(initialTx.splitMembers || []) !== JSON.stringify(selectedMemberKeys);

      if (isMonetaryChanged) {
        const monCheck = canModifyExpenseMonetaryFields(initialTx, selectedMemberKeys, transactions, group, user);
        if (!monCheck.allowed) {
          setErrorNotice(monCheck.reason || 'Amount and split are locked because a payment was made after this expense. Undo the payment to change them.');
          return;
        }
      }
    }

    const payerMember = members.find(m => matchMemberKeys(m.key, paidBy, group, user?.uid, user?.email || undefined));
    let paidByName = 'Member';
    if (payerMember) {
      if (payerMember.isCurrentUser) {
        paidByName = user?.displayName || user?.email?.split('@')[0] || 'You';
      } else {
        paidByName = payerMember.name;
      }
    } else {
      paidByName = getMemberDisplayName(paidBy, group, user?.uid, user?.email || undefined);
    }

    const splitsPayload: Record<string, number> = {};
    if (!splitEqually) {
      selectedMemberKeys.forEach(k => {
        splitsPayload[k] = parseFloat(getMemberCustomCut(k)) || 0;
      });
    } else {
      selectedMemberKeys.forEach(k => {
        splitsPayload[k] = equalCutPerPerson;
      });
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      await onSave({
        name: name.trim(),
        amount: numAmount,
        date,
        paidBy,
        paidByName,
        splitMode: splitEqually ? 'equal' : 'exact',
        splitMembers: selectedMemberKeys,
        splits: splitsPayload,
        note: initialTx?.note || undefined
      });
      onClose();
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || initialTx?.isSettlement) return null;

  const isViewer = userRole === 'viewer';
  const isEditing = Boolean(initialTx?.id);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Modal Header: 100% Uniform with ExpenseModal */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-base font-semibold text-text-primary">
            {isEditing ? 'Edit Expense' : 'New Expense'}
          </span>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notice */}
        {errorNotice && (
          <div className="mx-4 mt-3 py-2 px-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-google-red text-xs font-medium flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
            <AlertCircle size={14} className="shrink-0" />
            <span className="leading-snug">{errorNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* Locked Note (subtle, 1-2 short sentences) */}
          {isLocked && (
            <div className="p-3 rounded-2xl bg-surface-hover border border-border/80 text-xs text-text-secondary leading-relaxed">
              Amount and split are locked because a payment was made after this expense. Undo the payment to change them.
            </div>
          )}

          {/* 1. Big Amount Input: 100% Uniform with ExpenseModal */}
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
                autoFocus={!isLocked}
                value={amount}
                disabled={isViewer || isLocked}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                  const newAmt = parseFloat(val) || 0;
                  if (!splitEqually && newAmt > 0 && selectedMemberKeys.length > 0) {
                    setExactSplits(computeEqualSplits(newAmt, selectedMemberKeys));
                  }
                }}
                placeholder="0"
                className={`w-48 text-center text-4xl font-semibold tracking-tight bg-transparent outline-none text-text-primary placeholder:text-text-secondary/40 ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
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

          {/* 2. Description: 100% Uniform with ExpenseModal */}
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

          {/* 3. Paid by & Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
                Paid by
              </label>
              <select
                value={paidBy}
                disabled={isViewer || isLocked}
                onChange={(e) => setPaidBy(e.target.value)}
                className={`w-full px-3 py-2 rounded-2xl bg-surface-hover/70 border border-border text-base sm:text-sm text-text-primary outline-none focus:border-google-blue cursor-pointer truncate ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {members.map(m => {
                  const payerLabel = m.isCurrentUser
                    ? (m.name === 'You' ? 'You' : `${m.name} (You)`)
                    : m.name;
                  return (
                    <option key={m.key} value={m.key}>
                      {payerLabel}
                    </option>
                  );
                })}
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

          {/* 4. Split Equally Switch */}
          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-xs sm:text-sm text-text-primary block leading-tight">
                Split equally
              </span>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                {splitEqually 
                  ? `Equal division (₹${equalCutPerPerson.toLocaleString('en-IN')} each for ${selectedCount} selected)`
                  : 'Custom amounts per person (unequal split)'}
              </p>
            </div>

            {/* Apple / Material 3 Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={splitEqually}
                disabled={isViewer || isLocked}
                onChange={(e) => handleToggleSplitEqually(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-active peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-google-blue" />
            </label>
          </div>

          {/* 5. Split Between Section with Checklist */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-0.5">
              <div className="text-xs font-semibold text-text-secondary">
                <span>Split between: </span>
                <span className="text-text-primary font-bold">
                  {selectedCount} {selectedCount === 1 ? 'person' : 'people'}
                </span>
              </div>

              {/* Select all toggle button */}
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-google-blue hover:underline cursor-pointer transition-colors"
              >
                {isAllSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* List of individuals to select or deselect */}
            <div className="space-y-1.5">
              {members.map((m) => {
                const isSelected = selectedMemberKeys.includes(m.key);
                const memberLabel = m.isCurrentUser
                  ? (m.name === 'You' ? 'You' : `${m.name} (You)`)
                  : m.name;

                const customCutVal = getMemberCustomCut(m.key);

                return (
                  <div
                    key={m.key}
                    onClick={() => handleToggleMember(m.key)}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                      isSelected 
                        ? 'bg-surface border-border hover:border-google-blue/40 shadow-2xs' 
                        : 'bg-surface-hover/30 border-border/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected 
                          ? 'bg-google-blue border-google-blue text-white' 
                          : 'border-border bg-surface text-transparent'
                      }`}>
                        <Check size={13} strokeWidth={3} />
                      </div>

                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-surface-hover border border-border flex items-center justify-center font-bold text-xs text-text-primary shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>

                      <span className="font-semibold text-xs sm:text-sm text-text-primary truncate">
                        {memberLabel}
                      </span>
                    </div>

                    {/* Member cut display or custom input */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!splitEqually ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-text-secondary">₹</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            disabled={!isSelected}
                            value={isSelected ? customCutVal : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExactSplits(prev => ({ ...prev, [m.key]: val }));
                            }}
                            placeholder={equalCutPerPerson > 0 ? equalCutPerPerson.toString() : '0'}
                            className="w-20 px-2.5 py-1 rounded-xl bg-surface-hover border border-border text-xs sm:text-sm font-semibold text-text-primary text-right outline-none focus:border-google-blue disabled:opacity-40"
                          />
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm font-semibold text-text-primary tabular-nums">
                          {isSelected ? `₹${equalCutPerPerson.toLocaleString('en-IN')}` : '₹0'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unequal Difference Validation Pill */}
            {!splitEqually && numAmount > 0 && (
              <div className={`text-xs text-center py-1.5 px-3 rounded-xl font-medium border ${
                Math.abs(exactDiff) < 0.05 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-[#15803d] dark:text-[#25D366]' 
                  : 'bg-red-500/10 border-red-500/20 text-google-red'
              }`}>
                {Math.abs(exactDiff) < 0.05 
                  ? 'All cuts match expense total exactly!' 
                  : exactDiff > 0 
                    ? `₹${exactDiff} remaining to allocate` 
                    : `₹${Math.abs(exactDiff)} over allocated`}
              </div>
            )}
          </div>

          {/* Action Button: 100% Uniform with ExpenseModal */}
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
