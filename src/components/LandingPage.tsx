import React, { useState } from 'react';
import { 
  Wallet, 
  Users, 
  Sun,
  Moon
} from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import type { ThemeMode } from '../types';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  onExploreGuest: () => void;
  onOpenJoin: () => void;
  themeMode?: ThemeMode;
  darkMode?: boolean;
  onCycleThemeMode?: () => void;
  onToggleDarkMode?: () => void;
}

export function LandingPage({
  onSignIn,
  onExploreGuest,
  onOpenJoin,
  themeMode,
  darkMode,
  onCycleThemeMode,
  onToggleDarkMode
}: LandingPageProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch (err) {
      console.warn('Sign in note:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const isDark = Boolean(darkMode || themeMode === 'dark');

  // Shared Action Controls (Google Sign In, Solo Guest, Invite Code)
  const renderActionControls = (isDesktopCard: boolean) => (
    <div className="w-full space-y-1.5 min-[380px]:space-y-2">
      {/* Primary: Sign in with Google */}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="w-full h-11 min-[380px]:h-12 sm:h-13 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white text-[13px] min-[380px]:text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 sm:gap-3 transition-all shadow-sm cursor-pointer select-none disabled:opacity-70"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
          <GoogleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        </div>
        <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
      </button>

      {/* Subtext under Google Sign In */}
      <p className="text-[11px] min-[380px]:text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 text-center font-normal">
        Share with family &amp; friends · synced on every device
      </p>

      {/* Subtle Divider */}
      <div className="relative py-1.5 min-[380px]:py-2 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
        </div>
        <span className={`relative px-3 text-[11px] min-[380px]:text-xs text-neutral-400 dark:text-neutral-500 ${isDesktopCard ? 'bg-surface dark:bg-[#12151c]' : 'bg-bg-main'}`}>
          or
        </span>
      </div>

      {/* Secondary: Try solo without signing in */}
      <button
        type="button"
        onClick={onExploreGuest}
        className="w-full h-11 min-[380px]:h-12 sm:h-13 rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 active:scale-[0.99] text-text-primary text-[13px] min-[380px]:text-sm sm:text-base font-semibold flex items-center justify-center transition-all cursor-pointer select-none"
      >
        Try solo without signing in
      </button>

      {/* Subtext under Try Solo */}
      <p className="text-[11px] min-[380px]:text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 text-center font-normal">
        Personal tracker only · saved on this device
      </p>

      {/* Joining a group invite code link */}
      <p className="text-[11px] min-[380px]:text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-400 text-center pt-1 min-[380px]:pt-1.5 font-normal">
        Joining a group?{' '}
        <button
          type="button"
          onClick={onOpenJoin}
          className="text-google-blue dark:text-blue-400 font-semibold underline underline-offset-2 hover:opacity-85 cursor-pointer"
        >
          Enter invite code
        </button>
      </p>
    </div>
  );

  return (
    <div className="min-h-[100dvh] w-full bg-bg-main text-text-primary flex flex-col justify-between font-sans selection:bg-google-blue/20 selection:text-google-blue overflow-x-hidden overflow-y-auto">
      {/* 1. Header / Navbar */}
      <header className="shrink-0 pt-[max(0.5rem,env(safe-area-inset-top,8px))] px-4 min-[380px]:px-5 sm:px-8 max-w-6xl xl:max-w-7xl mx-auto w-full">
        <div className="h-12 sm:h-14 lg:h-16 flex items-center justify-between">
          {/* Logo & App Name */}
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet size={16} strokeWidth={2.2} />
            </div>
            <span className="text-[15px] sm:text-base font-bold tracking-tight text-text-primary">
              Hisaab Barabar
            </span>
          </div>

          {/* Theme Appearance Toggle */}
          <div className="flex items-center gap-2">
            {(onCycleThemeMode || onToggleDarkMode) && (
              <button
                type="button"
                onClick={onCycleThemeMode || onToggleDarkMode}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme appearance"
              >
                {isDark ? (
                  <Sun size={15} strokeWidth={2} />
                ) : (
                  <Moon size={15} strokeWidth={2} />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col justify-center px-4 min-[380px]:px-5 sm:px-8 py-2 min-[380px]:py-3 sm:py-6 max-w-6xl xl:max-w-7xl mx-auto w-full">
        
        {/* DESKTOP & LAPTOP LAYOUT (>= 1024px) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-10 xl:gap-14 items-center w-full py-4">
          {/* Left Column: Headline + Feature Cards */}
          <div className="lg:col-span-7 space-y-7 xl:space-y-8">
            {/* Editorial Headline */}
            <div>
              <h1 className="text-5xl xl:text-6xl font-serif text-text-primary tracking-tight leading-[1.12]">
                Every rupee,<br />
                <span className="italic text-google-blue dark:text-blue-400 font-serif">accounted for.</span>
              </h1>
              <p className="text-base xl:text-lg text-neutral-600 dark:text-neutral-400 mt-3 font-normal">
                Track spends and split bills, in one place.
              </p>
            </div>

            {/* 2 Feature Cards Side-by-Side */}
            <div className="grid grid-cols-2 gap-4 xl:gap-5">
              {/* Expense Tracker Card */}
              <div className="p-5 xl:p-6 rounded-3xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center mb-3.5">
                    <Wallet size={19} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">
                    Expense Tracker
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 mb-3.5">
                    Where did the money go?
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Household
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Personal
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    College groups
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Committees
                  </span>
                </div>
              </div>

              {/* Split Ledger Card */}
              <div className="p-5 xl:p-6 rounded-3xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center mb-3.5">
                    <Users size={19} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">
                    Split Ledger
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 mb-3.5">
                    Who owes whom? · 1-tap UPI &amp; debt simplification
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Trips
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Roommates
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    Colleagues
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    1-tap UPI
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: "Get started" Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md p-7 xl:p-8 rounded-3xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-xs">
              <h2 className="text-2xl sm:text-3xl font-serif text-text-primary font-normal mb-6">
                Get started
              </h2>
              {renderActionControls(true)}
            </div>
          </div>
        </div>

        {/* TABLET LAYOUT (768px - 1023px): Perfectly compact so footer is visible without scrolling */}
        <div className="hidden md:block lg:hidden max-w-xl mx-auto w-full py-1">
          {/* Headline Centered */}
          <div className="text-center mb-3.5 md:mb-4">
            <h1 className="text-3xl md:text-[36px] font-serif text-text-primary tracking-tight leading-[1.12]">
              Every rupee,<br />
              <span className="italic text-google-blue dark:text-blue-400 font-serif">accounted for.</span>
            </h1>
            <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 mt-1 font-normal">
              Track spends and split bills, in one place.
            </p>
          </div>

          {/* 2 Feature Cards Side-by-Side */}
          <div className="grid grid-cols-2 gap-3.5 mb-3.5 md:mb-4">
            {/* Expense Tracker Card */}
            <div className="p-3.5 md:p-4 rounded-2xl md:rounded-3xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center mb-2">
                  <Wallet size={17} strokeWidth={2.2} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-text-primary leading-tight">
                  Expense Tracker
                </h3>
                <p className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 mb-2.5">
                  Where did the money go?
                </p>
              </div>
              <div className="flex flex-wrap gap-1 md:gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Household
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Personal
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  College groups
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Committees
                </span>
              </div>
            </div>

            {/* Split Ledger Card */}
            <div className="p-3.5 md:p-4 rounded-2xl md:rounded-3xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center mb-2">
                  <Users size={17} strokeWidth={2.2} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-text-primary leading-tight">
                  Split Ledger
                </h3>
                <p className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 mb-2.5">
                  Who owes whom? · 1-tap UPI &amp; debt simplification
                </p>
              </div>
              <div className="flex flex-wrap gap-1 md:gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Trips
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Roommates
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Colleagues
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  1-tap UPI
                </span>
              </div>
            </div>
          </div>

          {/* Centered Actions */}
          <div className="max-w-sm md:max-w-md mx-auto w-full">
            {renderActionControls(false)}
          </div>
        </div>

        {/* MOBILE COMPACT VIEW (< 768px): Tailored to fit 100% above the fold */}
        <div className="block md:hidden max-w-sm mx-auto w-full space-y-3 min-[380px]:space-y-4">
          {/* Editorial Headline */}
          <div className="space-y-0.5">
            <h1 className="text-[28px] min-[380px]:text-[32px] sm:text-4xl font-serif text-text-primary tracking-tight leading-[1.12]">
              Every rupee,<br />
              <span className="italic text-google-blue dark:text-blue-400 font-serif">accounted for.</span>
            </h1>
            <p className="text-xs min-[380px]:text-sm text-neutral-600 dark:text-neutral-400 font-normal pt-0.5">
              Track spends and split bills, in one place.
            </p>
          </div>

          {/* 2 Feature Cards: Horizontal layout matching screenshot exactly */}
          <div className="space-y-2 min-[380px]:space-y-2.5">
            {/* Expense Tracker Card */}
            <div className="p-3 min-[380px]:p-3.5 rounded-2xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 min-[380px]:w-9 min-[380px]:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Wallet size={16} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm min-[380px]:text-[15px] font-bold text-text-primary leading-tight">
                    Expense Tracker
                  </h3>
                  <p className="text-[11px] min-[380px]:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    Where did the money go?
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 min-[380px]:gap-1.5 mt-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Household
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Personal
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  College groups
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Committees
                </span>
              </div>
            </div>

            {/* Split Ledger Card */}
            <div className="p-3 min-[380px]:p-3.5 rounded-2xl bg-surface dark:bg-[#12151c] border border-neutral-200/90 dark:border-neutral-800 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 min-[380px]:w-9 min-[380px]:h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-google-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users size={16} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm min-[380px]:text-[15px] font-bold text-text-primary leading-tight">
                    Split Ledger
                  </h3>
                  <p className="text-[11px] min-[380px]:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    Who owes whom? · 1-tap UPI &amp; debt simplification
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 min-[380px]:gap-1.5 mt-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Trips
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Roommates
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  Colleagues
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] min-[380px]:text-[11px] font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                  1-tap UPI
                </span>
              </div>
            </div>
          </div>

          {/* Action Area: Fits above the fold cleanly */}
          <div className="pt-0.5">
            {renderActionControls(false)}
          </div>
        </div>

      </main>

      {/* 3. Footer */}
      <footer className="shrink-0 py-3 sm:py-5 px-4 text-center text-[11px] sm:text-xs font-medium tracking-wide text-neutral-400/80 dark:text-neutral-500/80 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] select-none">
        Crafted with ❤️ in Bharat
      </footer>
    </div>
  );
}
