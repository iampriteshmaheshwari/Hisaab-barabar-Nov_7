import React, { useState, useEffect, useMemo } from 'react';
import { 
  User as UserIcon, 
  Smartphone, 
  Check, 
  ArrowRight,
  AlertCircle,
  X,
  QrCode
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { 
  formatUpiId, 
  isValidUpiId, 
  getSavedPersonalUpi,
  buildUpiPaymentUri,
  generateUpiQrDataUrl
} from '../../utils/upiUtils';

interface ProfileSetupModalProps {
  isOpen: boolean;
  user: User | null;
  onClose?: () => void;
  onComplete: (displayName: string, upiId: string) => Promise<void> | void;
}

const COMMON_HANDLES = ['@oksbi', '@okhdfcbank', '@okicici', '@paytm', '@ybl', '@okaxis'];

export function ProfileSetupModal({
  isOpen,
  user,
  onClose,
  onComplete
}: ProfileSetupModalProps) {
  const [fullName, setFullName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');

  // Check if user has already completed profile previously or is editing
  const isAlreadyCompleted = useMemo(() => {
    if (!user) return false;
    try {
      return localStorage.getItem(`hisaab_profile_completed_${user.uid}`) === 'true';
    } catch {
      return false;
    }
  }, [user]);

  const isEditing = isAlreadyCompleted || Boolean(onClose);

  // Real-time validation for UPI ID: null if empty, true if valid, false if invalid
  const isUpiFieldValid = useMemo(() => {
    const trimmed = upiId.trim();
    if (!trimmed) return null;
    return isValidUpiId(formatUpiId(trimmed));
  }, [upiId]);

  useEffect(() => {
    if (isOpen && user) {
      const initialName = user.displayName || (user.email ? user.email.split('@')[0] : '');
      setFullName(initialName);
      setUpiId(getSavedPersonalUpi() || '');
      setErrorMsg('');
      setShowQrPreview(false);
    }
  }, [isOpen, user]);

  // Generate live QR code for verification
  useEffect(() => {
    let active = true;
    const clean = formatUpiId(upiId);
    if (clean && isValidUpiId(clean)) {
      const uri = buildUpiPaymentUri({ pa: clean });
      generateUpiQrDataUrl(uri)
        .then(url => {
          if (active) setQrPreviewUrl(url);
        })
        .catch(console.warn);
    } else {
      setQrPreviewUrl('');
      setShowQrPreview(false);
    }
    return () => { active = false; };
  }, [upiId]);

  if (!isOpen || !user) return null;

  const handleApplyHandle = (handle: string) => {
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const trimmed = upiId.trim();
    if (!trimmed) {
      const username = (fullName || user.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      setUpiId(`${username}${cleanHandle}`);
      return;
    }

    if (trimmed.includes('@')) {
      const prefix = trimmed.split('@')[0];
      setUpiId(`${prefix}${cleanHandle}`);
    } else {
      setUpiId(`${trimmed}${cleanHandle}`);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    const trimmedUpi = upiId.trim();
    let formattedUpi = '';
    if (trimmedUpi) {
      formattedUpi = formatUpiId(trimmedUpi);
      if (!isValidUpiId(formattedUpi)) {
        setErrorMsg('Please enter a valid UPI ID (e.g. yourname@oksbi).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onComplete(trimmedName, formattedUpi);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipUpi = async () => {
    setErrorMsg('');
    const trimmedName = fullName.trim() || user.displayName || user.email?.split('@')[0] || 'User';
    setIsSubmitting(true);
    try {
      await onComplete(trimmedName, '');
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not complete profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain font-sans animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-setup-title"
      onClick={() => {
        if (onClose) onClose();
      }}
    >
      <div 
        className="relative bg-surface text-text-primary w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Mobile Grab Handle */}
        <div className="pt-2.5 pb-0.5 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors z-10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header */}
        <div className="px-6 pt-3.5 pb-1.5 text-center space-y-1.5 shrink-0">
          <div className="relative mx-auto w-12 h-12 rounded-full bg-google-blue/10 border-2 border-surface shadow-xs flex items-center justify-center overflow-hidden">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={fullName || 'User'} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon size={22} className="text-google-blue" />
            )}
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-surface flex items-center justify-center text-white">
              <Check size={8} strokeWidth={3} />
            </div>
          </div>

          <div className="space-y-0.5">
            <h2 
              id="profile-setup-title"
              className="text-lg font-bold tracking-tight text-text-primary"
            >
              {isEditing ? 'Edit Profile' : 'Complete your profile'}
            </h2>
            <p className="text-xs text-text-secondary">
              {isEditing 
                ? 'Update your name and receiving UPI ID.' 
                : 'Set your name and UPI for group settlements.'}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-2 space-y-3 overflow-y-auto no-scrollbar">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full Name Field */}
          <div className="space-y-1.5">
            <label 
              htmlFor="profile-fullname"
              className="block text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary/70">
                <UserIcon size={17} />
              </div>
              <input
                id="profile-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus={!isEditing}
                className="w-full h-12 pl-10 pr-3.5 rounded-xl bg-surface-hover/70 border border-border text-sm text-text-primary outline-none focus:border-google-blue focus:ring-1 focus:ring-google-blue/30 transition-all font-medium placeholder:text-text-secondary/50"
              />
            </div>
          </div>

          {/* UPI ID Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="profile-upi"
                className="block text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Receiving UPI ID
              </label>
              {isUpiFieldValid === true && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check size={13} strokeWidth={2.5} />
                  <span>Valid</span>
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary/70">
                <Smartphone size={17} />
              </div>
              <input
                id="profile-upi"
                type="text"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="username@bank"
                className={`w-full h-12 pl-10 pr-9 rounded-xl bg-surface-hover/70 border text-sm text-text-primary outline-none transition-all font-mono font-medium placeholder:text-text-secondary/50 ${
                  isUpiFieldValid === false && upiId.trim().length > 3
                    ? 'border-amber-500/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                    : isUpiFieldValid === true
                    ? 'border-emerald-500/40 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                    : 'border-border focus:border-google-blue focus:ring-1 focus:ring-google-blue/30'
                }`}
              />
              {isUpiFieldValid === true && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-500 animate-in fade-in duration-150">
                  <Check size={16} strokeWidth={2.5} />
                </div>
              )}
            </div>

            {/* Quick Handle Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_HANDLES.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  onClick={() => handleApplyHandle(handle)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-google-blue/40 text-xs font-medium text-text-secondary hover:text-google-blue transition-colors cursor-pointer select-none active:scale-95"
                >
                  {handle}
                </button>
              ))}
            </div>

            {/* Live QR Verification Toggle */}
            {isUpiFieldValid === true && qrPreviewUrl && (
              <div className="pt-1.5 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowQrPreview(!showQrPreview)}
                  className="text-xs text-google-blue hover:underline font-medium flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <QrCode size={13} />
                  <span>{showQrPreview ? 'Hide QR Code' : 'Verify QR Code'}</span>
                </button>
                {showQrPreview && (
                  <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center mx-auto mt-1 animate-in fade-in zoom-in-95 duration-150">
                    <img src={qrPreviewUrl} alt="UPI QR Preview" className="w-36 h-36 object-contain" />
                    <span className="text-[11px] text-neutral-500 mt-1 font-medium text-center">
                      Scan to verify receiving account
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 pb-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || !fullName.trim()}
              className="w-full h-11 sm:h-12 bg-google-blue hover:bg-google-blue-hover active:scale-[0.98] disabled:opacity-50 text-white rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-google-blue/25 select-none"
            >
              <span>
                {isSubmitting 
                  ? 'Saving...' 
                  : isEditing 
                  ? 'Save Changes' 
                  : 'Continue'}
              </span>
              {!isSubmitting && (
                isEditing ? <Check size={16} strokeWidth={2.4} /> : <ArrowRight size={15} strokeWidth={2.4} />
              )}
            </button>

            {isEditing ? (
              onClose && (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors py-1 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              !upiId.trim() && (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSkipUpi}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors py-1 cursor-pointer"
                  >
                    Add UPI ID later
                  </button>
                </div>
              )
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
