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
        className="bg-surface dark:bg-[#12151c] w-full max-w-[420px] sm:max-w-md rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2 pb-0.5 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Brand Top Header: Aligns with Landing Page header */}
        <div className="px-4 min-[380px]:px-5 py-2.5 sm:py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 select-none">
            <div className="w-6 h-6 min-[380px]:w-7 min-[380px]:h-7 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={14} strokeWidth={2.2} />
            </div>
            <span className="text-[13px] min-[380px]:text-[14px] font-bold tracking-tight text-text-primary">
              Hisaab Barabar
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body: Completely compact with zero scrolling */}
        <div className="p-4 min-[380px]:p-5 space-y-3">
          {/* Main Visual Badge & Editorial Headline */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
              {isSplit ? (
                <Users size={11} className="text-google-blue dark:text-blue-400" />
              ) : (
                <Wallet size={11} className="text-google-blue dark:text-blue-400" />
              )}
              <span>{isSplit ? 'Split Ledger' : 'Expense Tracker'} · {isEffectiveAdmin ? 'Admin' : 'Member'}</span>
            </div>

            <h2 className="text-xl min-[380px]:text-2xl font-serif text-text-primary tracking-tight leading-snug pt-0.5">
              Switched to <span className="italic text-google-blue dark:text-blue-400 font-serif font-normal">"{group.name}"</span>
            </h2>

            <p className="text-[11px] min-[380px]:text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-normal">
              {isEffectiveAdmin 
                ? 'You have administrative access to this ledger. Your active workspace is live.'
                : 'You are a member of this ledger. Your active workspace is live.'}
            </p>
          </div>

          {/* Quick Ledger Context Highlights */}
          <div className="p-3 min-[380px]:p-3.5 rounded-2xl bg-neutral-50/60 dark:bg-neutral-900/50 border border-neutral-200/90 dark:border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <Users size={14} className="text-google-blue dark:text-blue-400" />
                <span>Collaborators</span>
              </span>
              <span className="font-semibold text-text-primary">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <IndianRupee size={14} className="text-google-blue dark:text-blue-400" />
                <span>Currency</span>
              </span>
              <span className="font-medium text-text-primary">
                Indian Rupee (₹)
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-2">
                <RefreshCw size={14} className="text-google-blue dark:text-blue-400" />
                <span>Sync Status</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check size={12} strokeWidth={2.5} />
                <span>Live Synced</span>
              </span>
            </div>

            {inviteCode && (
              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/80 dark:border-neutral-800 text-[11px]">
                <span className="text-neutral-500 dark:text-neutral-400">Invite Code</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 font-mono font-bold text-text-primary hover:text-google-blue cursor-pointer transition-colors"
                  title="Copy invite code"
                >
                  <span>{inviteCode}</span>
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                </button>
              </div>
            )}
          </div>

          {/* Actions: Matching Landing Page buttons */}
          <div className="space-y-1.5 pt-0.5">
            <button
              type="button"
              onClick={onContinue}
              className="w-full h-11 min-[380px]:h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-xs min-[380px]:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer select-none"
            >
              <span>Continue in {group.name}</span>
              <ArrowRight size={15} />
            </button>

            {previousGroupName && previousGroupName !== group.name && onSwitchBack && (
              <button
                type="button"
                onClick={onSwitchBack}
                className="w-full h-9 min-[380px]:h-10 rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 active:scale-[0.99] text-text-primary text-[11px] min-[380px]:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
              >
                <RotateCcw size={12} />
                <span>Switch back to "{previousGroupName}"</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
