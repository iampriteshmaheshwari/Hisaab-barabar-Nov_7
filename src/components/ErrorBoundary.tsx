import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    // If URL has broken or malformed query parameters, reload to origin
    try {
      const url = new URL(window.location.href);
      if (url.search) {
        window.location.href = url.origin + url.pathname;
        return;
      }
    } catch {}
    window.location.reload();
  };

  handleResetAndRecover = () => {
    try {
      sessionStorage.clear();
      // Keep user's core data in localStorage, only remove pending invite flags
      sessionStorage.removeItem('hisaab_pending_invite_code');
      sessionStorage.removeItem('hisaab_auto_join');
    } catch {}
    window.location.href = window.location.origin;
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#f8f9fa] dark:bg-[#0c0d10] text-[#1f1f1f] dark:text-[#f3f4f6] flex items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md bg-white dark:bg-[#15171c] rounded-3xl p-6 sm:p-8 border border-black/10 dark:border-white/10 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={32} strokeWidth={2.2} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                Something didn't load properly
              </h1>
              <p className="text-xs sm:text-sm text-[#5e6368] dark:text-[#9ca3af] leading-relaxed">
                We encountered a temporary issue while loading your ledger. Don't worry, your expense records are secure.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl text-left text-xs font-mono text-[#5e6368] dark:text-[#9ca3af] overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full h-12 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95"
              >
                <RefreshCw size={16} />
                <span>Reload Ledger</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAndRecover}
                className="w-full h-11 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10 text-[#5e6368] dark:text-[#9ca3af] rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Home size={15} />
                <span>Go to Home Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
