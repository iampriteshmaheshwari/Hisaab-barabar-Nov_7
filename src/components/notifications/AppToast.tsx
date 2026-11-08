import React, { useEffect, useState, useRef } from 'react';
import { 
  CheckCircle2, 
  Receipt, 
  ShoppingBag, 
  CloudCheck, 
  Info, 
  AlertCircle, 
  X,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import type { CategoryData } from '../../types';

export interface ToastData {
  id?: string;
  message: string;
  subMessage?: string;
  type?: 'success' | 'info' | 'warning' | 'error' | 'expense' | 'shopping' | 'sync' | 'ledger';
  amount?: number;
  category?: string;
  categoryColor?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface AppToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
  categories?: Record<string, CategoryData>;
  hasFab?: boolean;
}

export function AppToast({ toast, onDismiss, categories, hasFab = false }: AppToastProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable key identifying the current active toast
  const activeToastKey = toast 
    ? (toast.id || `${toast.type || 'info'}_${toast.message}_${toast.subMessage || ''}`)
    : null;

  // Reset exit state whenever a new toast arrives, cancelling any lingering exit timeouts
  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setIsExiting(false);
  }, [activeToastKey]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  // Smooth dismissal handler with micro-exit animation
  const handleTriggerDismiss = () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      onDismissRef.current();
      setIsExiting(false);
      exitTimerRef.current = null;
    }, 180);
  };

  // Robust timer keyed ONLY to toast identity and pause state,
  // preventing parent re-renders (e.g. ledger switch listeners) from constantly resetting it.
  useEffect(() => {
    if (!toast || isPaused) return;

    const timeoutMs = toast.duration ?? (
      toast.action 
        ? 5000 
        : toast.type === 'ledger'
        ? 2600
        : toast.subMessage 
        ? 3200 
        : 2600
    );

    const timer = setTimeout(() => {
      handleTriggerDismiss();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [activeToastKey, isPaused, toast?.duration, toast?.action, toast?.type, toast?.subMessage]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'ledger':
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-xs">
            <BookOpen size={16} strokeWidth={2.2} />
          </div>
        );
      case 'expense':
        return (
          <div 
            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ 
              backgroundColor: toast.categoryColor ? `${toast.categoryColor}25` : 'rgba(26, 115, 232, 0.2)',
              color: toast.categoryColor || '#60a5fa'
            }}
          >
            <Receipt size={16} strokeWidth={2.2} />
          </div>
        );
      case 'shopping':
        return (
          <div 
            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ 
              backgroundColor: toast.categoryColor ? `${toast.categoryColor}25` : 'rgba(171, 71, 188, 0.2)',
              color: toast.categoryColor || '#c084fc'
            }}
          >
            <ShoppingBag size={16} strokeWidth={2.2} />
          </div>
        );
      case 'sync':
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-xs">
            <CloudCheck size={16} strokeWidth={2.2} />
          </div>
        );
      case 'warning':
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-xs">
            <AlertCircle size={16} strokeWidth={2.2} />
          </div>
        );
      case 'error':
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-xs">
            <AlertCircle size={16} strokeWidth={2.2} />
          </div>
        );
      case 'info':
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-xs">
            <Info size={16} strokeWidth={2.2} />
          </div>
        );
      case 'success':
      default:
        return (
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs">
            <CheckCircle2 size={16} strokeWidth={2.2} />
          </div>
        );
    }
  };

  return (
    <div 
      className={`fixed ${
        hasFab 
          ? 'bottom-[calc(8.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-24' 
          : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-20'
      } left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[94%] sm:w-auto max-w-md transition-all duration-200 ease-out ${
        isExiting 
          ? 'opacity-0 translate-y-2 scale-95 pointer-events-none' 
          : 'animate-in fade-in slide-in-from-bottom-2'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full bg-slate-900/95 dark:bg-[#161822]/95 text-white rounded-2xl p-2.5 sm:py-2.5 sm:px-3.5 shadow-2xl shadow-black/30 dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl border border-white/12 dark:border-white/15 ring-1 ring-black/30 flex items-center gap-2.5 sm:gap-3">
        {/* Semantic Icon */}
        {getIcon()}

        {/* Text Container */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-xs sm:text-sm font-semibold text-white tracking-tight leading-snug truncate">
            {toast.message}
          </div>
          {toast.subMessage && (
            <div className="text-[11px] sm:text-xs text-slate-300 dark:text-slate-300 line-clamp-1 font-normal mt-0.5 tracking-normal">
              {toast.subMessage}
            </div>
          )}
        </div>

        {/* Optional Action Button */}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleTriggerDismiss();
            }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
          >
            <span>{toast.action.label}</span>
            <ArrowRight size={12} />
          </button>
        )}

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleTriggerDismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all cursor-pointer shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
