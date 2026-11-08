import React, { useState } from 'react';
import { 
  Users, 
  Check, 
  Copy, 
  ArrowRight, 
  Wallet,
  X,
  RotateCcw,
  IndianRupee,
  RefreshCw
} from 'lucide-react';
import type { ExpenseGroup } from '../../types';

interface LedgerContextModalProps {
  isOpen: boolean;
  group: ExpenseGroup | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  previousGroupName?: string;
  onContinue: () => void;
  onSwitchBack?: () => void;
  onClose: () => void;
}

export function LedgerContextModal({
  isOpen,
  group,
  isOwner,
  isAdmin,
  previousGroupName,
  onContinue,
  onSwitchBack,
  onClose
}: LedgerContextModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !group) return null;

  const isEffectiveAdmin = Boolean(isAdmin ?? isOwner);
  const isSplit = group.type === 'split';
  const memberCount = group.memberEmails?.length || group.memberUids?.length || 1;
  const inviteCode = group.inviteCode || '';

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface dark:bg-[#12151c] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Brand Top Header: Aligns with Landing Page header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={15} strokeWidth={2.2} />
            </div>
            <span className="text-[14px] sm:text-[15px] font-bold tracking-tight text-text-primary">
              Hisaab Barabar
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar space-y-4">
          {/* Main Visual Badge & Editorial Headline */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
              {isSplit ? (
                <Users size={12} className="text-google-blue dark:text-blue-400" />
              ) : (
                <Wallet size={12} className="text-google-blue dark:text-blue-400" />
              )}
              <span>{isSplit ? 'Split Ledger' : 'Expense Tracker'} · {isEffectiveAdmin ? 'Admin' : 'Member'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif text-text-primary tracking-tight leading-[1.18] pt-0.5">
              Switched to <span className="italic text-google-blue dark:text-blue-400 font-serif font-normal">"{group.name}"</span>
            </h2>

            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              {isEffectiveAdmin 
                ? 'You have administrative access to this ledger. Your active workspace has been switched.'
                : 'You are a member of this ledger. Your active workspace has been switched.'}
            </p>
          </div>

          {/* Quick Ledger Context Highlights */}
          <div className="p-4 rounded-3xl bg-neutral-50/60 dark:bg-neutral-900/50 border border-neutral-200/90 dark:border-neutral-800 space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <Users size={15} className="text-google-blue dark:text-blue-400" />
                <span>Collaborators</span>
              </span>
              <span className="font-semibold text-text-primary">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <IndianRupee size={15} className="text-google-blue dark:text-blue-400" />
                <span>Currency</span>
              </span>
              <span className="font-medium text-text-primary">
                Indian Rupee (₹)
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <RefreshCw size={15} className="text-google-blue dark:text-blue-400" />
                <span>Sync Status</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check size={13} strokeWidth={2.5} />
                <span>Live Synced</span>
              </span>
            </div>

            {inviteCode && (
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200/80 dark:border-neutral-800 text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Invite Code</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 font-mono font-bold text-text-primary hover:text-google-blue cursor-pointer transition-colors"
                  title="Copy invite code"
                >
                  <span>{inviteCode}</span>
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            )}
          </div>

          {/* Actions: Matching Landing Page buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onContinue}
              className="w-full h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer select-none"
            >
              <span>Continue in {group.name}</span>
              <ArrowRight size={16} />
            </button>

            {previousGroupName && previousGroupName !== group.name && onSwitchBack && (
              <button
                type="button"
                onClick={onSwitchBack}
                className="w-full h-11 rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 active:scale-[0.99] text-text-primary text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
              >
                <RotateCcw size={13} />
                <span>Switch back to "{previousGroupName}"</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
