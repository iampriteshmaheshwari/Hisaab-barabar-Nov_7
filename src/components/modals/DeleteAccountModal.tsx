import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  UserX, 
  Database, 
  Smartphone, 
  ShieldAlert, 
  ArrowRight,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from '../GoogleIcon';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted?: () => void;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  onAccountDeleted
}: DeleteAccountModalProps) {
  const { user, deleteAccount, reauthenticate } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText('');
    setErrorMessage(null);
    setRequiresReauth(false);
    onClose();
  };

  const executeDeletion = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteAccount();
      if (res.success) {
        setConfirmText('');
        if (onAccountDeleted) {
          onAccountDeleted();
        }
        onClose();
      } else if (res.requiresRecentLogin) {
        setRequiresReauth(true);
        setErrorMessage(res.error || 'For security, please re-authenticate with Google before deleting your account.');
      } else {
        setErrorMessage(res.error || 'Could not delete account. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete account. Please check your internet connection.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReauthAndRetry = async () => {
    setIsReauthenticating(true);
    setErrorMessage(null);

    try {
      const ok = await reauthenticate();
      if (ok) {
        setRequiresReauth(false);
        // Retry deletion now that auth credentials are fresh
        await executeDeletion();
      } else {
        setErrorMessage('Verification was cancelled or interrupted. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not verify Google credentials.');
    } finally {
      setIsReauthenticating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
      >
        {/* Top iOS Pull Indicator */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Modal Header */}
        <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-google-red flex items-center justify-center shrink-0">
              <UserX size={17} strokeWidth={2.2} />
            </div>
            <div>
              <h3 id="delete-account-title" className="text-base font-semibold text-text-primary tracking-tight">
                Delete Account
              </h3>
              <p className="text-xs text-text-secondary">
                Irreversible account &amp; data removal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting || isReauthenticating}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-left">
          {/* User identity card */}
          {user && (
            <div className="p-3 rounded-2xl bg-surface-hover/60 border border-border flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-google-blue text-white flex items-center justify-center font-semibold text-sm shrink-0">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-text-primary truncate">
                  {user.displayName || 'Account'}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {user.email}
                </div>
              </div>
            </div>
          )}

          {/* Re-authentication required gate (Google / Apple security standard) */}
          {requiresReauth ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-semibold text-text-primary">
                    Identity Confirmation Required
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed">
                    Because account deletion is permanent, Google requires you to briefly re-verify your identity before we erase your data.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReauthAndRetry}
                disabled={isReauthenticating}
                className="w-full h-11 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                {isReauthenticating ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Verifying Google account...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4 bg-white rounded-full p-0.5" />
                    <span>Confirm with Google &amp; Delete</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Destruction Scope Checklist */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-tight text-text-secondary px-0.5">
                  What will be removed permanently:
                </div>

                <div className="bg-surface-hover/30 rounded-2xl border border-border divide-y divide-border/60 text-xs">
                  <div className="p-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-red-500/10 text-google-red flex items-center justify-center shrink-0 mt-0.5">
                      <UserX size={13} />
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary">Profile &amp; Cloud Credentials:</span>{' '}
                      <span className="text-text-secondary">
                        Your user identity, email link, and private profile will be completely purged from the system.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-red-500/10 text-google-red flex items-center justify-center shrink-0 mt-0.5">
                      <Database size={13} />
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary">Ledgers &amp; Expense History:</span>{' '}
                      <span className="text-text-secondary">
                        Groups you created will be deleted, and you will be removed from shared ledgers you joined.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-red-500/10 text-google-red flex items-center justify-center shrink-0 mt-0.5">
                      <Smartphone size={13} />
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary">Local Storage &amp; Cache:</span>{' '}
                      <span className="text-text-secondary">
                        All offline entries, shopping lists, and device preferences stored locally will be cleared.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Friction Confirmation Input */}
              <div className="space-y-1.5 pt-1">
                <label 
                  htmlFor="delete-confirmation-input"
                  className="block text-xs font-medium text-text-secondary px-0.5"
                >
                  Type <span className="font-bold text-google-red font-mono">DELETE</span> below to confirm:
                </label>
                <div className="relative">
                  <input
                    id="delete-confirmation-input"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    disabled={isDeleting}
                    autoComplete="off"
                    className="w-full h-11 px-3.5 rounded-2xl bg-surface border border-border text-sm text-text-primary outline-none focus:border-google-red focus:ring-2 focus:ring-google-red/20 transition-all font-mono"
                  />
                  {isConfirmed && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-google-red">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer Actions */}
        <div className="p-4 border-t border-border bg-surface shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting || isReauthenticating}
            className="flex-1 h-12 rounded-2xl border border-border hover:bg-surface-hover text-text-primary text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            Cancel
          </button>

          {!requiresReauth && (
            <button
              type="button"
              onClick={executeDeletion}
              disabled={!isConfirmed || isDeleting}
              className="flex-1 h-12 rounded-2xl bg-google-red hover:bg-red-700 disabled:opacity-35 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Delete Account</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
