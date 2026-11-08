import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  Users, 
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from '../GoogleIcon';

export type AppTab = 'Overview' | 'Transactions' | 'Lists' | 'Fixed' | 'Settings' | 'Group' | 'Individual';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: AppTab;
  onGetStarted: () => void;
  onOpenJoinModal?: () => void;
}

export function OnboardingModal({ 
  isOpen, 
  onClose, 
  onGetStarted,
  onOpenJoinModal
}: OnboardingModalProps) {
  const { user, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(16); } catch {}
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('hisaab_barabar_onboarding_viewed', 'true');
      sessionStorage.setItem('hisaab_onboarding_dismissed', 'true');
    } catch {}
    triggerHaptic();
    onClose();
  };

  const handleStart = () => {
    try {
      localStorage.setItem('hisaab_barabar_onboarding_viewed', 'true');
      sessionStorage.setItem('hisaab_onboarding_dismissed', 'true');
    } catch {}
    triggerHaptic();
    onGetStarted();
  };

  const handleJoin = () => {
    try {
      localStorage.setItem('hisaab_barabar_onboarding_viewed', 'true');
      sessionStorage.setItem('hisaab_onboarding_dismissed', 'true');
    } catch {}
    triggerHaptic();
    onClose();
    if (onOpenJoinModal) {
      onOpenJoinModal();
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    triggerHaptic();
    try {
      const result = await signInWithGoogle();
      if (result) {
        try {
          localStorage.setItem('hisaab_barabar_onboarding_viewed', 'true');
          sessionStorage.setItem('hisaab_onboarding_dismissed', 'true');
        } catch {}
        onClose();
      }
    } catch (err) {
      console.warn('Google sign in note:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200 font-sans"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-sheet-title"
    >
      <div 
        className="bg-surface text-text-primary w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Top Header Bar */}
        <div className="px-5 pt-3 sm:pt-4 pb-2.5 flex items-center justify-between shrink-0 border-b border-border/60">
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={16} strokeWidth={2.2} />
            </div>
            <span className="text-[14px] sm:text-base font-semibold tracking-tight text-text-primary">
              Hisaab Barabar
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover active:bg-surface-active cursor-pointer transition-colors -mr-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4 space-y-4">
          <div className="text-center space-y-1.5">
            <h2 
              id="onboarding-sheet-title"
              className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-tight"
            >
              Track spends.<br />Split bills.
            </h2>
            <p className="text-sm text-text-secondary max-w-xs mx-auto leading-normal">
              Daily expenses, group splits & shopping lists, kept barabar.
            </p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-surface-hover/60 border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
                <Wallet size={19} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-primary">
                  Expense Tracker
                </div>
                <div className="text-xs text-text-secondary mt-0.5 leading-snug">
                  Daily spends, budgets & shopping lists
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface-hover/60 border border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
                <Users size={19} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-primary">
                  Split Ledger
                </div>
                <div className="text-xs text-text-secondary mt-0.5 leading-snug">
                  Group costs, balances & 1-tap UPI
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="px-5 sm:px-6 pt-2 pb-5 sm:pb-6 border-t border-border/80 bg-surface shrink-0 space-y-2.5">
          {!user ? (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full h-12 bg-google-blue hover:bg-google-blue-hover active:scale-[0.98] text-white rounded-full text-[15px] sm:text-base font-semibold tracking-normal transition-all cursor-pointer flex items-center justify-center gap-3 shadow-sm shadow-google-blue/25 select-none"
              >
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                  <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>

              <div className="flex items-center justify-between px-2 text-[13px] sm:text-sm">
                {onOpenJoinModal && (
                  <button
                    type="button"
                    onClick={handleJoin}
                    className="font-medium text-google-blue hover:underline cursor-pointer"
                  >
                    Have an invite code?
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStart}
                  className="font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer ml-auto"
                >
                  Explore as guest
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="w-full h-11 bg-google-blue hover:bg-google-blue-hover active:scale-[0.98] text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-google-blue/25 select-none"
            >
              <span>Continue to Dashboard</span>
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          )}

          <div className="text-center text-[10px] text-text-secondary/70 flex items-center justify-center gap-1.5 select-none">
            <span>Free forever</span>
            <span aria-hidden="true">·</span>
            <span>Instant UPI</span>
            <span aria-hidden="true">·</span>
            <span>Cloud synced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
