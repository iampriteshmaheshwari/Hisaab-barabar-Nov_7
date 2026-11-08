import React from 'react';
import { X, Smartphone, Share, PlusSquare, Download, Check, Globe } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstallNative?: () => void;
}

export function InstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallNative
}: InstallAppModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent || '');

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-surface text-text-primary w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom duration-250 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 sm:pt-5 pb-3 flex items-center justify-between border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
              <Download size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Install Hisaab Barabar</h3>
              <p className="text-xs text-text-secondary">Add to Home Screen as a native app</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-hover flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Native 1-Click Install Button if supported by browser */}
          {deferredPrompt && onInstallNative && (
            <div className="p-4 rounded-2xl bg-google-blue/10 border border-google-blue/20 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-google-blue dark:text-blue-400">
                <Check size={14} />
                <span>Instant Installation Available</span>
              </div>
              <p className="text-xs text-text-secondary">
                Your browser supports direct 1-tap installation to your home screen or desktop.
              </p>
              <button
                type="button"
                onClick={() => {
                  onInstallNative();
                  onClose();
                }}
                className="w-full h-11 bg-google-blue hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Download size={15} />
                <span>Install App Now</span>
              </button>
            </div>
          )}

          {/* iOS Instructions */}
          {isIOS && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-tight">
                iPhone & iPad (Safari)
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-hover/70 border border-border/70">
                  <div className="w-7 h-7 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <Share size={14} />
                  </div>
                  <div className="text-xs text-text-primary leading-relaxed">
                    <strong className="font-semibold">Step 1:</strong> Tap the <strong className="font-semibold text-google-blue">Share</strong> button in Safari's bottom toolbar (the square icon with an up arrow).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-hover/70 border border-border/70">
                  <div className="w-7 h-7 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <PlusSquare size={14} />
                  </div>
                  <div className="text-xs text-text-primary leading-relaxed">
                    <strong className="font-semibold">Step 2:</strong> Scroll down and select <strong className="font-semibold text-google-blue">"Add to Home Screen"</strong>, then tap <strong className="font-semibold">Add</strong> in the top-right corner.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android / Chrome Instructions if native prompt not triggered */}
          {!isIOS && !deferredPrompt && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-tight">
                {isAndroid ? 'Android (Chrome / Samsung / Brave)' : 'Desktop Browser (Chrome / Edge)'}
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-hover/70 border border-border/70">
                  <div className="w-7 h-7 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <Globe size={14} />
                  </div>
                  <div className="text-xs text-text-primary leading-relaxed">
                    <strong className="font-semibold">Step 1:</strong> Tap the <strong className="font-semibold">browser menu (⋮)</strong> in the top or bottom corner of your browser.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-hover/70 border border-border/70">
                  <div className="w-7 h-7 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <Smartphone size={14} />
                  </div>
                  <div className="text-xs text-text-primary leading-relaxed">
                    <strong className="font-semibold">Step 2:</strong> Select <strong className="font-semibold text-google-blue">"Install app"</strong> or <strong className="font-semibold text-google-blue">"Add to Home screen"</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Advantages */}
          <div className="pt-2 border-t border-border/60">
            <div className="text-xs font-medium text-text-secondary mb-2">Native App Advantages:</div>
            <ul className="text-xs text-text-secondary space-y-1.5 list-disc pl-4">
              <li>Opens instantly without web address bars or navigation clutter.</li>
              <li>Fully functional offline with IndexedDB local caching.</li>
              <li>Supports real-time push notifications for shared ledgers.</li>
              <li>Instant 1-tap launch directly from your home screen or dock.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 border border-border hover:bg-surface-hover text-text-primary rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
