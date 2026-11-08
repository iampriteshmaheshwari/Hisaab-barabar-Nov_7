import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Users, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  ArrowRight, 
  ShoppingBag, 
  Wallet,
  ClipboardPaste,
  ArrowLeftRight,
  QrCode,
  IndianRupee,
  Copy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { joinGroupByCode } from '../../services/expenseService';
import { GoogleIcon } from '../GoogleIcon';
import type { ExpenseGroup } from '../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (groupId: string, groupName?: string) => void;
  initialCode?: string;
  initialType?: string;
  initialName?: string;
  groups?: ExpenseGroup[];
}

export function parseCodeInput(raw: string): string {
  let val = raw.trim();
  if (!val) return '';

  try {
    if (val.includes('joinCode=') || val.includes('code=')) {
      const url = new URL(val.startsWith('http') ? val : `https://${val}`);
      const paramCode = url.searchParams.get('joinCode') || url.searchParams.get('code');
      if (paramCode) return paramCode.trim().toUpperCase();
    }
  } catch {
    // Fallback if URL parsing fails
  }

  const queryMatch = val.match(/(?:joinCode|code)=([A-Za-z0-9_-]+)/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1].toUpperCase();
  }

  const codeMatch = val.match(/\b([A-Za-z0-9]{6,12})\b/);
  if (val.length > 12 && codeMatch && codeMatch[1]) {
    return codeMatch[1].toUpperCase();
  }

  return val.toUpperCase();
}

export function JoinGroupModal({
  isOpen,
  onClose,
  onJoined,
  initialCode = '',
  initialType = '',
  initialName = '',
  groups = []
}: JoinGroupModalProps) {
  const { user, signInWithGoogle } = useAuth();
  const [code, setCode] = useState(parseCodeInput(initialCode));
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [forceManualInput, setForceManualInput] = useState(false);
  const [previewGroup, setPreviewGroup] = useState<{ name?: string; type?: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setForceManualInput(false);
    setErrorMsg('');
  }, [isOpen, initialCode]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (initialCode) {
      setCode(parseCodeInput(initialCode));
    }
  }, [initialCode]);

  const hasInviteLinkCode = Boolean(initialCode && initialCode.trim().length > 0 && !forceManualInput);
  const cleanCode = useMemo(() => parseCodeInput(code || initialCode || ''), [code, initialCode]);

  const alreadyInGroup = useMemo(() => {
    if (!cleanCode || !groups || groups.length === 0) return null;
    return groups.find(g => 
      g.inviteCode?.toUpperCase() === cleanCode || 
      g.previousInviteCodes?.some(c => c.toUpperCase() === cleanCode) ||
      g.id === cleanCode
    ) || null;
  }, [groups, cleanCode]);

  const isOwnerOfGroup = useMemo(() => {
    if (!alreadyInGroup || !user) return false;
    const userEmail = (user.email || '').toLowerCase().trim();
    return alreadyInGroup.createdBy === user.uid || (alreadyInGroup.ownerEmail && alreadyInGroup.ownerEmail.toLowerCase() === userEmail);
  }, [alreadyInGroup, user]);

  const urlMetadata = useMemo(() => {
    try {
      if (typeof window === 'undefined') return { type: '', name: '' };
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type') || sessionStorage.getItem('hisaab_pending_invite_type') || '';
      const name = params.get('name') || sessionStorage.getItem('hisaab_pending_invite_name') || '';
      return { type, name: name ? decodeURIComponent(name) : '' };
    } catch {
      return { type: '', name: '' };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!cleanCode) {
      setPreviewGroup(null);
      return;
    }

    if (alreadyInGroup) {
      setPreviewGroup({ name: alreadyInGroup.name, type: alreadyInGroup.type });
      return;
    }

    if (user && db) {
      (async () => {
        try {
          const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            const data = snap.docs[0].data();
            setPreviewGroup({
              name: data.name,
              type: data.type
            });
          }
        } catch {
          // Gracefully rely on urlMetadata
        }
      })();
    }

    return () => {
      isMounted = false;
    };
  }, [cleanCode, alreadyInGroup, user]);

  const effectiveType = alreadyInGroup?.type || previewGroup?.type || initialType || urlMetadata.type || 'budget';
  const isSplit = effectiveType === 'split';
  const effectiveName = alreadyInGroup?.name || previewGroup?.name || initialName || urlMetadata.name || '';

  const handleCopyInviteCode = async () => {
    const target = initialCode || code;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const executeJoin = async (codeToJoin: string, activeUser = user) => {
    if (lockoutSeconds > 0) {
      setErrorMsg(`Please wait ${lockoutSeconds}s.`);
      return;
    }

    if (!activeUser) {
      setErrorMsg('Please sign in with Google first.');
      return;
    }

    const targetCleanCode = parseCodeInput(codeToJoin);
    if (!targetCleanCode) {
      setErrorMsg('Please enter a valid invite code.');
      return;
    }

    if (alreadyInGroup) {
      onJoined(alreadyInGroup.id, alreadyInGroup.name);
      onClose();
      return;
    }

    setIsJoining(true);
    setErrorMsg('');

    try {
      const group = await joinGroupByCode(targetCleanCode, activeUser);
      if (!group) {
        throw new Error('Ledger not found or inactive.');
      }
      try {
        sessionStorage.removeItem('hisaab_pending_invite_code');
        sessionStorage.removeItem('hisaab_pending_invite_type');
        sessionStorage.removeItem('hisaab_pending_invite_name');
        sessionStorage.removeItem('hisaab_auto_join');
      } catch {}
      setFailedAttempts(0);
      setLockoutSeconds(0);
      onJoined(group.id, group.name);
      onClose();
    } catch (err: any) {
      console.error('Error joining group:', err);
      let message = 'Unable to join ledger. Please check the code.';
      if (err?.message) {
        if (err.message.includes('expired') || err.message.includes('regenerated')) {
          message = 'This invite link has expired. Please ask an admin for the updated link.';
        } else if (err.message.includes('not found') || err.message.includes('inactive')) {
          message = 'Ledger not found or inactive. Please verify the code.';
        } else if (!activeUser && (err.message.includes('permission-denied') || err.message.includes('Missing or insufficient permissions'))) {
          message = 'Please sign in with Google to join this shared ledger.';
        } else {
          message = err.message;
        }
      }
      setErrorMsg(message);

      setFailedAttempts(prev => {
        const next = prev + 1;
        if (next >= 5) {
          setLockoutSeconds(30);
          setErrorMsg('Too many invalid attempts. Please wait 30 seconds.');
          return 0;
        }
        return next;
      });
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (user && hasInviteLinkCode && sessionStorage.getItem('hisaab_auto_join') === 'true') {
      sessionStorage.removeItem('hisaab_auto_join');
      executeJoin(code || initialCode, user);
    }
  }, [user, hasInviteLinkCode]);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      try {
        const loggedUser = await signInWithGoogle();
        if (loggedUser) {
          await executeJoin(code, loggedUser);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Sign in was cancelled or failed.');
      }
      return;
    }

    await executeJoin(code, user);
  };

  const handleSignInAndAcceptInvite = async () => {
    setErrorMsg('');
    setIsJoining(true);
    try {
      sessionStorage.setItem('hisaab_auto_join', 'true');
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        await executeJoin(code || initialCode, loggedUser);
      } else {
        setIsJoining(false);
      }
    } catch (err: any) {
      sessionStorage.removeItem('hisaab_auto_join');
      console.warn('Sign-in status in JoinGroupModal:', err?.message || err);
      setErrorMsg(err?.message || 'Google sign in was not completed.');
      setIsJoining(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overscroll-none font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface dark:bg-[#12151c] w-full max-w-[420px] sm:max-w-md rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Top Header */}
        <div className="px-5 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={15} strokeWidth={2.2} />
            </div>
            <span className="text-sm font-bold tracking-tight text-text-primary">
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

        {/* Content Body: Designed for pristine legibility with zero cropping */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* SCENARIO 1: ARRIVED VIA INVITE LINK */}
          {hasInviteLinkCode ? (
            <div className="space-y-4">
              {/* Editorial Header Section */}
              <div className="text-center space-y-1.5">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    <IndianRupee size={12} className="text-google-blue dark:text-blue-400" />
                    <span>{isSplit ? 'Split Ledger' : 'Expense Tracker'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-text-secondary hover:text-google-blue cursor-pointer transition-colors"
                    title="Copy invite code"
                  >
                    <span>Code: {initialCode || code}</span>
                    {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif text-text-primary tracking-tight leading-[1.2] pt-1">
                  Join <span className="italic text-google-blue dark:text-blue-400 font-serif font-normal">"{effectiveName || (isSplit ? 'Split Group' : 'Shared Ledger')}"</span>
                </h2>

                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-xs sm:max-w-sm mx-auto leading-normal">
                  {isSplit
                    ? 'Who owes whom? · 1-tap UPI & debt simplification'
                    : 'Where did the money go? · Shared tracking & budgets'}
                </p>
              </div>

              {/* Perfectly Legible Feature Highlights Card: No truncation, full sentences wrap cleanly */}
              <div className="rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-200/90 dark:border-neutral-800 p-4 space-y-3.5 text-left">
                {isSplit ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Users size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          Fair Bill Splits
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Split dining, trips, and flat rent equally or by exact shares without awkward reminders.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowLeftRight size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          Simplified Net Balances
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Automatic debt simplification so everyone settles with the fewest transactions.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <QrCode size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          1-Tap UPI Settlements
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Settle dues directly in Google Pay, PhonePe, Paytm, or scan UPI QR codes.
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Wallet size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          Shared Expense Tracking
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Log household spending together with real-time category totals.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <IndianRupee size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          Monthly Category Budgets
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Set spending caps on groceries, bills, and domestic expenses.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ShoppingBag size={16} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-text-primary leading-snug">
                          Collaborative Buying List
                        </div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Live checklist to add home essentials and tick off purchases.
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Error Notice */}
              {errorMsg ? (
                <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-text-primary text-center space-y-1">
                    <h4 className="text-xs font-semibold text-text-primary">
                      {errorMsg.includes('expired') || errorMsg.includes('regenerated')
                        ? 'Invite Link Inactive'
                        : 'Notice'}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                      {errorMsg}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setForceManualInput(true);
                        setCode('');
                      }}
                      className="flex-1 h-10 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Enter Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="h-10 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : isJoining ? (
                <div className="p-4 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-center gap-2.5 text-center">
                  <div className="w-5 h-5 rounded-full border-2 border-google-blue border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-text-primary">
                    Connecting to {isSplit ? 'Split ' : ''}Ledger...
                  </span>
                </div>
              ) : !user ? (
                /* Primary Google Sign-in CTA: Matching Landing Page */
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSignInAndAcceptInvite}
                    className="w-full h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-md shadow-google-blue/15 cursor-pointer select-none"
                  >
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                      <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <span>Join {isSplit ? 'Split Group ' : 'Ledger '}with Google</span>
                  </button>

                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 text-center font-normal">
                    Synced across every device · No app install needed
                  </p>

                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-xs text-neutral-500 hover:text-text-primary transition-colors cursor-pointer"
                    >
                      Decline &amp; continue to app
                    </button>
                  </div>
                </div>
              ) : (
                /* Signed-in user view */
                <div className="space-y-2 pt-1">
                  <div className="px-3.5 py-2 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-google-blue/10 text-google-blue font-bold flex items-center justify-center text-xs shrink-0">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary truncate leading-tight">
                          {user.displayName || 'Google User'}
                        </div>
                        <div className="text-[11px] text-text-secondary truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      Signed In
                    </span>
                  </div>

                  {alreadyInGroup ? (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>Already {isOwnerOfGroup ? 'an admin' : 'a member'} of <strong>"{alreadyInGroup.name}"</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onJoined(alreadyInGroup.id, alreadyInGroup.name);
                          onClose();
                        }}
                        className="w-full h-11 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                      >
                        <span>Open "{alreadyInGroup.name}" Ledger</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => executeJoin(initialCode || code, user)}
                      className="w-full h-12 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-google-blue/15 active:scale-[0.99]"
                    >
                      <Check size={15} strokeWidth={2.5} />
                      <span>Accept &amp; Join {isSplit ? 'Split Group' : 'Ledger'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* SCENARIO 2: MANUAL JOIN VIA INVITE CODE */
            <div className="space-y-3.5">
              {!user ? (
                <div className="text-center space-y-3 py-1">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-serif text-text-primary tracking-tight">
                      Sign in with Google to Join
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal max-w-xs mx-auto">
                      Sign in with your Google account to enter an invite code and join any split or expense ledger.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="w-full h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-md shadow-google-blue/15 cursor-pointer select-none"
                  >
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                      <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <span>Continue with Google</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Invite Code
                      </label>
                      {typeof navigator !== 'undefined' && navigator.clipboard && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const clipText = await navigator.clipboard.readText();
                              if (clipText) {
                                const cleaned = parseCodeInput(clipText);
                                setCode(cleaned);
                                setErrorMsg('');
                              }
                            } catch {}
                          }}
                          className="text-xs text-google-blue hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ClipboardPaste size={12} />
                          <span>Paste Code</span>
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={32}
                        value={code}
                        onChange={(e) => setCode(parseCodeInput(e.target.value))}
                        placeholder="e.g. AXCD5CQS"
                        className="w-full px-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center font-mono text-base tracking-widest text-text-primary outline-none focus:border-google-blue uppercase font-bold transition-all"
                      />
                      {code && (
                        <button
                          type="button"
                          onClick={() => setCode('')}
                          className="absolute right-3 top-2.5 text-text-secondary hover:text-text-primary p-1 rounded-full cursor-pointer"
                          title="Clear code"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 text-center">
                      Paste the 8-character code or shared link from your ledger admin.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-google-red flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {alreadyInGroup ? (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>Already {isOwnerOfGroup ? 'an admin' : 'a member'} of <strong>"{alreadyInGroup.name}"</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onJoined(alreadyInGroup.id, alreadyInGroup.name);
                          onClose();
                        }}
                        className="w-full h-11 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                      >
                        <span>Open "{alreadyInGroup.name}" Ledger</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isJoining || !code.trim() || lockoutSeconds > 0}
                      className="w-full h-11 bg-google-blue hover:bg-google-blue-hover disabled:opacity-40 text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                    >
                      <Check size={15} strokeWidth={2.5} />
                      <span>{lockoutSeconds > 0 ? `Wait ${lockoutSeconds}s` : isJoining ? 'Joining Ledger...' : 'Join Ledger'}</span>
                    </button>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
