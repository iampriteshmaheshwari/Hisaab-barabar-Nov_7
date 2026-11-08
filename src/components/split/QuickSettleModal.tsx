import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  AlertCircle, 
  ExternalLink, 
  QrCode, 
  CheckCircle2,
  Copy,
  Check,
  MessageCircle
} from 'lucide-react';
import type { ExpenseGroup, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { recordSettlementPayment, canMarkAsReceived } from '../../services/splitService';
import { 
  formatUpiId, 
  isValidUpiId, 
  buildUpiPaymentUri, 
  buildUpiAppLinks,
  generateUpiQrDataUrl,
  getSavedPersonalUpi
} from '../../utils/upiUtils';
import { formatINR } from '../../utils/formatUtils';

interface QuickSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup;
  userRole: UserRole;
  debtor: { key: string; name: string };
  creditor: { key: string; name: string };
  suggestedAmount: number;
  onPaymentRecorded: () => void;
}

export function QuickSettleModal({
  isOpen,
  onClose,
  group,
  userRole,
  debtor,
  creditor,
  suggestedAmount,
  onPaymentRecorded
}: QuickSettleModalProps) {
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [showConfirmSettle, setShowConfirmSettle] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQrOnMobile, setShowQrOnMobile] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Check if current user is debtor (payer) or creditor (receiver)
  const isDebtorMe = debtor.key === user?.uid || (!user && (debtor.key === 'guest' || debtor.name === 'You'));
  const isCreditorMe = creditor.key === user?.uid || (!user && (creditor.key === 'guest' || creditor.name === 'You'));

  // Initialize data on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorNotice(null);
      setAmount(suggestedAmount > 0 ? suggestedAmount.toString() : '');
      setShowQrOnMobile(false);
      setShowConfirmSettle(false);
    }
  }, [isOpen, suggestedAmount]);

  const numAmount = parseFloat(amount) || 0;

  // Payee UPI ID from user-level profile (Single Source of Truth)
  const payeeUpi = useMemo(() => {
    if (isCreditorMe) {
      return getSavedPersonalUpi() || group.members?.[creditor.key]?.upiId || '';
    }
    return group.members?.[creditor.key]?.upiId || '';
  }, [isCreditorMe, creditor.key, group.members]);

  const effectiveUpiId = useMemo(() => {
    return formatUpiId(payeeUpi);
  }, [payeeUpi]);

  const isUpiValid = useMemo(() => {
    return isValidUpiId(effectiveUpiId);
  }, [effectiveUpiId]);

  // Build standard NPCI UPI Payment URI
  const upiUri = useMemo(() => {
    if (!effectiveUpiId || !isUpiValid) return '';
    return buildUpiPaymentUri({
      pa: effectiveUpiId,
      am: numAmount > 0 ? numAmount : undefined,
      tn: group.name ? `${group.name} Settlement` : undefined
    });
  }, [effectiveUpiId, isUpiValid, numAmount, group.name]);

  // Direct UPI App deep links
  const upiAppLinks = useMemo(() => {
    if (!effectiveUpiId || !isUpiValid) return null;
    return buildUpiAppLinks({
      pa: effectiveUpiId,
      am: numAmount > 0 ? numAmount : undefined,
      tn: group.name ? `${group.name} Settlement` : undefined
    });
  }, [effectiveUpiId, isUpiValid, numAmount, group.name]);

  // Generate QR code Data URL
  useEffect(() => {
    let isMounted = true;
    if (upiUri) {
      generateUpiQrDataUrl(upiUri)
        .then((url) => {
          if (isMounted) setQrDataUrl(url);
        })
        .catch(console.warn);
    } else {
      setQrDataUrl('');
    }
    return () => {
      isMounted = false;
    };
  }, [upiUri]);

  const handleCopyUpi = () => {
    if (!effectiveUpiId) return;
    navigator.clipboard?.writeText(effectiveUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // WhatsApp reminder deep link for payee without UPI
  const whatsappReminderUrl = useMemo(() => {
    const text = `Hi ${creditor.name}, please link your receiving UPI ID on Hisaab Barabar so I can settle ${formatINR(numAmount, { symbol: true })} for "${group.name}".`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [creditor.name, numAmount, group.name]);

  // Execute recording settlement
  const handleConfirmAndRecord = async () => {
    if (userRole === 'viewer') return;
    if (numAmount <= 0) {
      setErrorNotice('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      await recordSettlementPayment(
        group.id,
        debtor,
        creditor,
        numAmount,
        today,
        effectiveUpiId ? 'Settled via UPI' : 'Settled (Direct)',
        user,
        group,
        userRole
      );
      setShowConfirmSettle(false);
      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to record settlement.');
      setShowConfirmSettle(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchApp = (e: React.MouseEvent, appScheme: string) => {
    e.preventDefault();
    if (!upiUri) return;

    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      setShowQrOnMobile(true);
      return;
    }

    // Direct app launch with fallback to universal intent
    const start = Date.now();
    window.location.href = appScheme;

    setTimeout(() => {
      if (typeof document !== 'undefined' && document.hasFocus() && Date.now() - start < 2000) {
        window.location.href = upiUri;
      }
    }, 850);
  };

  if (!isOpen) return null;

  const markPerm = canMarkAsReceived(debtor.key, creditor.key, user, userRole, group);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200 font-sans"
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

        {/* Minimal Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <span className="text-base font-bold text-text-primary block leading-tight truncate">
              {isCreditorMe ? 'Receive Settlement' : 'Settle with UPI'}
            </span>
            <span className="text-xs text-text-secondary">
              {isCreditorMe ? `${debtor.name} owes you` : `Transfer to ${creditor.name}`}
            </span>
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

        {errorNotice && (
          <div className="mx-4 mt-3 py-2 px-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-google-red text-xs font-medium flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
            <AlertCircle size={14} className="shrink-0" />
            <span className="leading-snug">{errorNotice}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* Subtle Hero Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-surface-hover/50 border border-border text-center space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block">
              {isCreditorMe ? `${debtor.name} pays You` : `Paying ${creditor.name}`}
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight tabular-nums">
              {formatINR(numAmount, { symbol: true })}
            </div>

            {/* Payee UPI Status Badge */}
            <div className="pt-1 flex items-center justify-center">
              {isUpiValid ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border shadow-2xs">
                  <span className="text-xs font-semibold text-text-primary truncate max-w-[200px] tracking-tight">
                    {effectiveUpiId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? (
                      <>
                        <Check size={12} className="text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-text-secondary">
                  No UPI ID linked
                </span>
              )}
            </div>
          </div>

          {/* Settle Actions */}
          {isUpiValid ? (
            <div className="space-y-4 pt-0.5">
              {/* Primary Launch (Debtor only) */}
              {isDebtorMe && (
                <a
                  href={upiUri}
                  className="w-full h-12 rounded-2xl bg-google-blue hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <ExternalLink size={16} />
                  <span>Pay {formatINR(numAmount, { symbol: true })} via UPI</span>
                </a>
              )}

              {/* Direct UPI Apps */}
              {isDebtorMe && upiAppLinks && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-text-secondary block text-center">
                    Or pay directly with
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <a
                      href={upiAppLinks.gpay}
                      onClick={(e) => handleLaunchApp(e, upiAppLinks.gpay)}
                      className="h-11 sm:h-12 px-1 rounded-xl bg-surface-hover hover:bg-surface-active border border-border hover:border-google-blue/30 flex items-center justify-center text-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
                      title="Google Pay"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-text-primary group-hover:text-google-blue transition-colors text-center leading-tight">
                        Google Pay
                      </span>
                    </a>

                    <a
                      href={upiAppLinks.phonepe}
                      onClick={(e) => handleLaunchApp(e, upiAppLinks.phonepe)}
                      className="h-11 sm:h-12 px-1 rounded-xl bg-surface-hover hover:bg-surface-active border border-border hover:border-google-blue/30 flex items-center justify-center text-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
                      title="PhonePe"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-text-primary group-hover:text-google-blue transition-colors text-center leading-tight">
                        PhonePe
                      </span>
                    </a>

                    <a
                      href={upiAppLinks.paytm}
                      onClick={(e) => handleLaunchApp(e, upiAppLinks.paytm)}
                      className="h-11 sm:h-12 px-1 rounded-xl bg-surface-hover hover:bg-surface-active border border-border hover:border-google-blue/30 flex items-center justify-center text-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
                      title="Paytm"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-text-primary group-hover:text-google-blue transition-colors text-center leading-tight">
                        Paytm
                      </span>
                    </a>

                    <a
                      href={upiAppLinks.bhim}
                      onClick={(e) => handleLaunchApp(e, upiAppLinks.bhim)}
                      className="h-11 sm:h-12 px-1 rounded-xl bg-surface-hover hover:bg-surface-active border border-border hover:border-google-blue/30 flex items-center justify-center text-center transition-all cursor-pointer active:scale-95 shadow-2xs group"
                      title="BHIM"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-text-primary group-hover:text-google-blue transition-colors text-center leading-tight">
                        BHIM
                      </span>
                    </a>
                  </div>
                </div>
              )}

              {/* Receiver Action (Creditor only) */}
              {isCreditorMe && (
                <button
                  type="button"
                  onClick={() => setShowConfirmSettle(true)}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <CheckCircle2 size={16} />
                  <span>Mark {formatINR(numAmount, { symbol: true })} as Received</span>
                </button>
              )}

              {/* Minimal QR Code Toggle */}
              <div className="w-full flex flex-col items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowQrOnMobile(!showQrOnMobile)}
                  className="outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-google-blue/30 text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-full hover:bg-surface-hover transition-colors"
                >
                  <QrCode size={15} />
                  <span>{showQrOnMobile ? 'Hide QR Code' : (isCreditorMe ? 'Show My QR Code' : 'Show QR Code to Scan')}</span>
                </button>

                {showQrOnMobile && qrDataUrl && (
                  <div className="w-full flex flex-col items-center justify-center mt-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 bg-white rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center mx-auto">
                      <img 
                        src={qrDataUrl} 
                        alt="UPI QR Code" 
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                      />
                      <p className="text-[11px] text-neutral-500 mt-2 font-medium tracking-wide text-center">
                        Scan with any UPI app
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Payee Has No UPI Linked */
            <div className="space-y-3 pt-1">
              <div className="p-4 rounded-2xl bg-surface-hover/60 border border-border text-center space-y-1.5">
                <p className="text-xs text-text-secondary">
                  {isCreditorMe 
                    ? 'Link your UPI ID in Settings to receive payments via QR & UPI apps.' 
                    : `${creditor.name} hasn't linked a UPI ID yet.`}
                </p>
              </div>

              {isDebtorMe && (
                <div className="space-y-2">
                  <a
                    href={whatsappReminderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <MessageCircle size={16} />
                    <span>Remind {creditor.name} on WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (!markPerm.allowed) {
                        setErrorNotice(markPerm.reason || 'Only the receiver or group owner can mark as settled.');
                        return;
                      }
                      setShowConfirmSettle(true);
                    }}
                    className="w-full h-11 rounded-2xl bg-surface-hover hover:bg-surface-active border border-border text-text-primary text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <CheckCircle2 size={15} />
                    <span>Mark as Settled (Cash / Bank)</span>
                  </button>
                </div>
              )}

              {isCreditorMe && (
                <button
                  type="button"
                  onClick={() => setShowConfirmSettle(true)}
                  className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <CheckCircle2 size={16} />
                  <span>Mark {formatINR(numAmount, { symbol: true })} as Received</span>
                </button>
              )}
            </div>
          )}

          {/* Subtle Secondary Helper (Debtor only with UPI) */}
          {isDebtorMe && isUpiValid && (
            <div className="pt-3 pb-1 border-t border-border/50 text-center">
              <p className="text-xs text-text-secondary">
                Already completed payment?{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (!markPerm.allowed) {
                      setErrorNotice(markPerm.reason || 'Only the receiver or group owner can mark as received.');
                      return;
                    }
                    setShowConfirmSettle(true);
                  }}
                  className={markPerm.allowed 
                    ? "text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer ml-0.5 inline-flex items-center gap-1"
                    : "text-text-muted opacity-60 font-semibold cursor-not-allowed ml-0.5 inline-flex items-center gap-1"}
                  title={!markPerm.allowed ? (markPerm.reason || 'Only the receiver or group owner can mark as received.') : undefined}
                >
                  <CheckCircle2 size={13} className="inline shrink-0" />
                  <span>Mark as settled</span>
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Subtle Confirmation Dialog */}
      {showConfirmSettle && (
        <div 
          className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isSubmitting && setShowConfirmSettle(false)}
        >
          <div 
            className="bg-surface w-full max-w-xs rounded-3xl p-5 border border-border shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={20} strokeWidth={2.4} />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-base sm:text-lg text-text-primary tracking-tight">
                {isCreditorMe
                  ? `Mark ${formatINR(numAmount, { symbol: true })} as received?`
                  : `Settle ${formatINR(numAmount, { symbol: true })}?`}
              </h4>
              <p className="text-xs text-text-secondary font-medium">
                {isDebtorMe ? 'You' : debtor.name} → {isCreditorMe ? 'You' : creditor.name}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmSettle(false)}
                className="flex-1 py-2.5 rounded-2xl bg-surface-hover hover:bg-surface-active text-text-primary text-xs sm:text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAndRecord}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-xs active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : (isCreditorMe ? 'Confirm' : 'Mark Paid')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
