import React, { useState } from 'react';
import { 
  Crown, 
  Users, 
  Check, 
  Copy, 
  ArrowRight, 
  ShieldCheck, 
  BookOpen, 
  ShoppingBag, 
  X,
  RotateCcw
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
  const memberCount = group.memberEmails?.length || group.memberUids?.length || 1;
  const inviteCode = group.inviteCode || '';

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Top Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Ledger Link Opened
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar space-y-4">
          {/* Main Visual Badge */}
          <div className="text-center space-y-3">
            <div className="relative inline-flex items-center justify-center mx-auto">
              <div 
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${
                  isEffectiveAdmin 
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/25 ring-4 ring-blue-500/10' 
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/25 ring-4 ring-emerald-500/10'
                }`}
              >
                {isEffectiveAdmin ? <ShieldCheck size={30} strokeWidth={2.2} /> : <Users size={30} strokeWidth={2.2} />}
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 shadow-xs border"
                style={{
                  backgroundColor: isEffectiveAdmin ? 'rgba(26, 115, 232, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  borderColor: isEffectiveAdmin ? 'rgba(26, 115, 232, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                  color: isEffectiveAdmin ? '#1a73e8' : '#059669'
                }}
              >
                {isEffectiveAdmin ? <ShieldCheck size={12} className="shrink-0" /> : <Users size={12} className="shrink-0" />}
                <span>{isEffectiveAdmin ? 'Ledger Admin' : 'Ledger Member'}</span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {group.name}
              </h2>

              <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
                {isEffectiveAdmin 
                  ? 'You are an admin of this ledger. Your active workspace has been switched here with full administrative access.'
                  : 'You are a member of this ledger. Your active workspace has been switched here.'}
              </p>
            </div>
          </div>

          {/* Quick Ledger Context Highlights */}
          <div className="bg-surface-hover/70 border border-border rounded-2xl p-3.5 space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-text-secondary" />
                <span>Collaborators</span>
              </span>
              <span className="font-semibold text-text-primary">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-google-blue" />
                <span>Shared Ledger & Balances</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check size={12} strokeWidth={2.5} />
                <span>Synced</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-purple-500" />
                <span>Buying List</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check size={12} strokeWidth={2.5} />
                <span>Active</span>
              </span>
            </div>

            {inviteCode && (
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                <span className="text-text-secondary">Invite Code</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 font-mono font-bold text-google-blue hover:underline cursor-pointer bg-google-blue/10 px-2 py-0.5 rounded-md"
                  title="Copy invite code"
                >
                  <span>{inviteCode}</span>
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onContinue}
              className="w-full h-12 bg-google-blue hover:bg-google-blue-hover active:bg-blue-700 text-white rounded-2xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-google-blue/20 active:scale-95"
            >
              <span>Continue in {group.name}</span>
              <ArrowRight size={16} />
            </button>

            {previousGroupName && previousGroupName !== group.name && onSwitchBack && (
              <button
                type="button"
                onClick={onSwitchBack}
                className="w-full h-10 bg-transparent hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
