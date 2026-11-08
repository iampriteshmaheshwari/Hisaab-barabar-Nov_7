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

// Automatically extract clean code if user pasted a full URL or text with code
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

  // Reset manual override and errors on code change or modal re-open
  useEffect(() => {
    setForceManualInput(false);
    setErrorMsg('');
  }, [isOpen, initialCode]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Update local code state if initialCode changes
  useEffect(() => {
    if (initialCode) {
      setCode(parseCodeInput(initialCode));
    }
  }, [initialCode]);

  const hasInviteLinkCode = Boolean(initialCode && initialCode.trim().length > 0 && !forceManualInput);
  const cleanCode = useMemo(() => parseCodeInput(code || initialCode || ''), [code, initialCode]);

  // Check if current user is already an owner or member of this group
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

  // Read URL query params / session storage
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

  // Fetch Firestore preview if signed in and code is present
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
      setErrorMsg(`Too many attempts. Please wait ${lockoutSeconds}s before trying again.`);
      return;
    }

    if (!activeUser) {
      setErrorMsg('Please sign in with your Google account first.');
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
        throw new Error('Ledger not found or inactive. The invite code may have expired or been regenerated by an admin.');
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
          message = 'This invite link is no longer active. The ledger admin may have reset the code.';
        } else if (err.message.includes('not found') || err.message.includes('inactive')) {
          message = 'Ledger not found or inactive. Please verify the code with your admin.';
        } else if (!activeUser && (err.message.includes('permission-denied') || err.message.includes('Missing or insufficient permissions'))) {
          message = 'Please sign in with Google to join this shared ledger.';
        } else if (err.message.includes('permission-denied') || err.message.includes('Missing or insufficient permissions')) {
          message = 'This ledger is private or the invite link has expired.';
        } else {
          message = err.message;
        }
      }
      setErrorMsg(message);

      setFailedAttempts(prev => {
        const next = prev + 1;
        if (next >= 5) {
          setLockoutSeconds(30);
          setErrorMsg('Too many invalid attempts. Please wait 30 seconds before trying again.');
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
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface dark:bg-[#12151c] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar space-y-4">
          {/* SCENARIO 1: ARRIVED VIA INVITE LINK */}
          {hasInviteLinkCode ? (
            <div className="space-y-4">
              {/* Editorial Header Section */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  <IndianRupee size={12} className="text-google-blue dark:text-blue-400" />
                  <span>{isSplit ? 'Split Ledger · Indian Rupee (₹)' : 'Expense Tracker · Indian Rupee (₹)'}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif text-text-primary tracking-tight leading-[1.18] pt-0.5">
                  Join <span className="italic text-google-blue dark:text-blue-400 font-serif font-normal">"{effectiveName || (isSplit ? 'Split Group' : 'Shared Ledger')}"</span>
                </h2>

                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  {isSplit
                    ? 'Who owes whom? · 1-tap UPI & debt simplification'
                    : 'Where did the money go? · Shared tracking & budgets'}
                </p>
              </div>

              {/* Showcase Card: Exact Real Features Built In App */}
              <div className="p-4 sm:p-5 rounded-3xl bg-neutral-50/60 dark:bg-neutral-900/50 border border-neutral-200/90 dark:border-neutral-800 space-y-3.5">
                {isSplit ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Users size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          Split Bills Effortlessly
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Split dining, trips, and rent equally or by exact shares without awkward follow-ups.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowLeftRight size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          Smart Debt Simplification
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Calculates net balances to minimize transfers so everyone settles with the fewest transactions.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <QrCode size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          1-Tap UPI Settlements
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Pay directly via GPay, PhonePe, Paytm, or BHIM using verified UPI IDs and QR codes.
                        </p>
                      </div>
                    </div>

                    {/* Tag Pills matching landing page */}
                    <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Trips
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Roommates
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Colleagues
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        1-tap UPI
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Wallet size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          Shared Expense Tracking
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Log daily household and group expenses in ₹ with instant category breakdown and search.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <IndianRupee size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          Monthly Category Budgets
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Keep groceries, utilities, and domestic outlays within planned monthly spending targets.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                        <ShoppingBag size={17} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary">
                          Collaborative Buying List
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                          Shared shopping checklist updated live across members to avoid duplicate purchases.
                        </p>
                      </div>
                    </div>

                    {/* Tag Pills matching landing page */}
                    <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Household
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Personal
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Family
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-surface dark:bg-[#12151c] text-neutral-600 dark:text-neutral-400">
                        Shared budgets
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Invite Code Tag */}
              <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-surface-hover/60 border border-neutral-200/90 dark:border-neutral-800 text-xs">
                <span className="text-neutral-500 dark:text-neutral-400 font-normal">
                  Invite Code
                </span>
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  className="font-mono font-bold tracking-wider text-text-primary flex items-center gap-1.5 hover:text-google-blue transition-colors cursor-pointer"
                  title="Copy invite code"
                >
                  <span>{initialCode || code}</span>
                  {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>

              {/* Error Notice */}
              {errorMsg ? (
                <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-text-primary space-y-2 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <AlertTriangle size={20} strokeWidth={2.2} />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-text-primary">
                        {errorMsg.includes('expired') || errorMsg.includes('regenerated')
                          ? 'Invite Link Inactive'
                          : 'Ledger Notice'}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xs mx-auto">
                        {errorMsg}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setForceManualInput(true);
                        setCode('');
                      }}
                      className="w-full h-11 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-95"
                    >
                      <span>Enter a Different Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full h-10 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
                    >
                      Back to My Ledgers
                    </button>
                  </div>
                </div>
              ) : isJoining ? (
                <div className="p-6 rounded-3xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200/90 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-200">
                  <div className="w-8 h-8 rounded-full border-2 border-google-blue border-t-transparent animate-spin" />
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-text-primary">
                      Connecting to {isSplit ? 'Split ' : ''}Ledger...
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Syncing balances with your Google account
                    </div>
                  </div>
                </div>
              ) : !user ? (
                /* Landing-page styled Google sign in button */
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSignInAndAcceptInvite}
                    className="w-full h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-[13px] min-[380px]:text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 sm:gap-3 transition-all shadow-sm cursor-pointer select-none"
                  >
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                      <GoogleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    </div>
                    <span>Join {isSplit ? 'Split Group ' : 'Ledger '}with Google</span>
                  </button>

                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 text-center font-normal">
                    Synced across every device · No credit card or app install needed
                  </p>

                  <div className="text-center pt-1">
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
                <div className="space-y-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-google-blue/10 text-google-blue font-bold flex items-center justify-center text-xs shrink-0">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary truncate">
                          {user.displayName || 'Google User'}
                        </div>
                        <div className="text-xs text-text-secondary truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      Signed In
                    </span>
                  </div>

                  {alreadyInGroup ? (
                    <div className="space-y-2 pt-1">
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <div>
                          <span>You are already {isOwnerOfGroup ? 'an admin' : 'a member'} of <strong>"{alreadyInGroup.name}"</strong>.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onJoined(alreadyInGroup.id, alreadyInGroup.name);
                          onClose();
                        }}
                        className="w-full h-12 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                      >
                        <span>Open "{alreadyInGroup.name}" Ledger</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => executeJoin(initialCode || code, user)}
                      className="w-full h-12 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>Accept &amp; Join {isSplit ? 'Split Group' : 'Ledger'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* SCENARIO 2: MANUAL JOIN VIA INVITE CODE */
            <div className="space-y-4">
              {!user ? (
                <div className="text-center space-y-4 py-2">
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif text-text-primary tracking-tight">
                      Sign in with Google to Join
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
                      Sign in with your Google account to enter an invite code and join any shared split or expense ledger.
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
                    className="w-full h-12 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-[13px] sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-sm cursor-pointer select-none"
                  >
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                      <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                    </div>
                    <span>Continue with Google</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
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
                            } catch {
                              // Clipboard read blocked
                            }
                          }}
                          className="text-xs text-google-blue hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ClipboardPaste size={12} />
                          <span>Paste from Clipboard</span>
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
                        className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center font-mono text-lg tracking-widest text-text-primary outline-none focus:border-google-blue uppercase font-bold transition-all"
                      />
                      {code && (
                        <button
                          type="button"
                          onClick={() => setCode('')}
                          className="absolute right-3 top-3 text-text-secondary hover:text-text-primary p-1 rounded-full cursor-pointer"
                          title="Clear code"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 text-center">
                      Paste the 8-character invite code or shared link from your ledger admin.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-google-red flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {alreadyInGroup ? (
                    <div className="space-y-2 pt-1">
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <div>
                          <span>You are already {isOwnerOfGroup ? 'an admin' : 'a member'} of <strong>"{alreadyInGroup.name}"</strong>.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onJoined(alreadyInGroup.id, alreadyInGroup.name);
                          onClose();
                        }}
                        className="w-full h-12 bg-google-blue hover:bg-google-blue-hover text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                      >
                        <span>Open "{alreadyInGroup.name}" Ledger</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isJoining || !code.trim() || lockoutSeconds > 0}
                      className="w-full h-12 bg-google-blue hover:bg-google-blue-hover disabled:opacity-40 text-white rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>{lockoutSeconds > 0 ? `Please wait ${lockoutSeconds}s` : isJoining ? 'Joining Ledger...' : 'Join Ledger'}</span>
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
