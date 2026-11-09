/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart2, 
  BookOpen, 
  ShoppingBag, 
  Repeat, 
  Settings, 
  Plus, 
  Lock,
  Cloud,
  CheckCircle,
  LogIn,
  AlertCircle,
  Wallet,
  X,
  ReceiptText,
  UserCheck,
  Users,
  UserPlus
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { GroupModal } from './components/modals/GroupModal';
import { JoinGroupModal } from './components/modals/JoinGroupModal';
import { SettleModal } from './components/modals/SettleModal';
import { ExpenseModal } from './components/modals/ExpenseModal';
import { RecurringModal } from './components/modals/RecurringModal';
import { CategoryModal } from './components/modals/CategoryModal';
import { MergeOfflineModal } from './components/modals/MergeOfflineModal';
import { ExportLedgerModal } from './components/modals/ExportLedgerModal';
import { ImportLedgerModal } from './components/modals/ImportLedgerModal';
import { SoloAuthPromptModal, type SoloAuthFeature } from './components/modals/SoloAuthPromptModal';
import type { ImportRowParsed } from './utils/exportLedgerUtils';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { ProfileSetupModal } from './components/modals/ProfileSetupModal';
import { LandingPage } from './components/LandingPage';
import { DeleteAccountModal } from './components/modals/DeleteAccountModal';
import { InstallAppModal } from './components/modals/InstallAppModal';
import { LedgerContextModal } from './components/modals/LedgerContextModal';
import { VoiceInputModal } from './components/modals/VoiceInputModal';
import { GeminiIcon } from './components/icons/GeminiIcon';
import { AppToast, type ToastData } from './components/notifications/AppToast';
import { purgeAllLocalData } from './services/accountService';
import { updateProfile } from 'firebase/auth';

import { OverviewTab } from './components/tabs/OverviewTab';
import { TransactionsTab } from './components/tabs/TransactionsTab';
import { ShoppingTab } from './components/tabs/ShoppingTab';
import { FixedTab } from './components/tabs/FixedTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { SplitGroupView } from './components/split/SplitGroupView';
import { SplitIndividualView } from './components/split/SplitIndividualView';
import { SplitExpenseModal } from './components/split/SplitExpenseModal';
import { QuickSettleModal } from './components/split/QuickSettleModal';
import { InviteMemberModal } from './components/modals/InviteMemberModal';
import { 
  getGroupMembersList, 
  recordSettlementPayment, 
  matchMemberKeys,
  getCanonicalMemberName,
  formatSettlementDisplayTitle,
  validateSettlementRestore,
  canAddExpense,
  canEditExpense,
  canModifyExpenseMonetaryFields,
  canDeleteExpense,
  canRestoreExpense,
  canMarkAsReceived,
  canUndoSettlement,
  canRestoreSettlement,
  getExpenseLockInfo
} from './services/splitService';

import type { 
  Transaction, 
  ShoppingItem, 
  RecurringExpense, 
  CategoryData, 
  ExpenseGroup, 
  UserRole,
  ThemeMode,
  AppNotification
} from './types';

import { 
  subscribeToGroupNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  dispatchDailyExpenseSummary,
  dispatchBuyingItemNotification,
  dispatchSplitExpenseNotification,
  dispatchSettlementNotification,
  dispatchSettlementReminderNotification,
  getPushPermissionState,
  requestPushPermission,
  showDeviceNotification,
  getUserDigestTime,
  setUserDigestTime,
  formatDigestTime,
  DEFAULT_DIGEST_TIME
} from './services/notificationService';

import { 
  subscribeToUserGroups, 
  subscribeToGroupExpenses, 
  subscribeToGroupShopping, 
  subscribeToGroupRecurring,
  createGroup,
  deleteExpenseGroup,
  migrateLocalGroupsToCloud,
  addExpenseToGroup,
  updateExpenseInGroup,
  deleteExpenseFromGroup,
  settleExpenseInGroup,
  undoSettleExpenseInGroup,
  addShoppingItemToGroup,
  toggleShoppingItemStatus,
  updateShoppingItemInGroup,
  deleteShoppingItemFromGroup,
  addRecurringExpenseToGroup,
  updateRecurringExpenseInGroup,
  toggleRecurringExpenseStatus,
  deleteRecurringExpenseFromGroup,
  syncLocalDataToGroup,
  reassignCategoryInCloudGroup,
  updateGroupCustomCategories,
  subscribeToUserPreferences,
  saveUserLedgerGeminiPreference,
  getLocalTodayIso,
  getDueOccurrences,
  getNextOccurrenceDate,
  addDirectMemberToGroup,
  updateGroupMemberUpi,
  updateGroupName,
  softDeleteExpenseInGroup,
  restoreExpenseInGroup,
  permanentDeleteExpenseFromGroup
} from './services/expenseService';

import { getSavedPersonalUpi, savePersonalUpi, removePersonalUpi } from './utils/upiUtils';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

import { 
  getCachedExpenses, 
  setCachedExpenses, 
  getCachedShopping, 
  setCachedShopping, 
  getCachedRecurring, 
  setCachedRecurring,
  enqueueMutation,
  getPendingMutationsCount,
  syncPendingMutations,
  subscribeToSyncState,
  mergeServerExpensesWithPending,
  mergeServerShoppingWithPending,
  mergeServerRecurringWithPending
} from './services/offlineSyncService';

const DEFAULT_CATEGORIES: Record<string, CategoryData> = {
  groceries: { name: 'Groceries', hex: '#059669', color: '#059669', bg: '#05966914', iconName: 'ShoppingCart' },
  food: { name: 'Food & Dining', hex: '#EA580C', color: '#EA580C', bg: '#EA580C14', iconName: 'Utensils' },
  utilities: { name: 'Bills & Recharge', hex: '#D97706', color: '#D97706', bg: '#D9770614', iconName: 'Zap' },
  rent: { name: 'Home & Rent', hex: '#0D9488', color: '#0D9488', bg: '#0D948814', iconName: 'Home' },
  travel: { name: 'Travel & Petrol', hex: '#0284C7', color: '#0284C7', bg: '#0284C714', iconName: 'Car' },
  medical: { name: 'Health & Medicine', hex: '#DC2626', color: '#DC2626', bg: '#DC262614', iconName: 'HeartPulse' },
  shopping: { name: 'Shopping', hex: '#7C3AED', color: '#7C3AED', bg: '#7C3AED14', iconName: 'ShoppingBag' },
  education: { name: 'Education', hex: '#4F46E5', color: '#4F46E5', bg: '#4F46E514', iconName: 'BookOpen' },
  investments: { name: 'Investments & Loans', hex: '#2563EB', color: '#2563EB', bg: '#2563EB14', iconName: 'TrendingUp' },
  other: { name: 'Other', hex: '#64748B', color: '#64748B', bg: '#64748B14', iconName: 'Tag' }
};

function getSavedActiveGroupId(userUid?: string | null): string {
  try {
    if (userUid) {
      const userSaved = localStorage.getItem(`hisaab_active_group_id_${userUid}`);
      if (userSaved) return userSaved;
    }
    return localStorage.getItem('hisaab_active_group_id') || '';
  } catch {
    return '';
  }
}

function saveActiveGroupId(groupId: string, userUid?: string | null): void {
  try {
    if (groupId) {
      localStorage.setItem('hisaab_active_group_id', groupId);
      if (userUid) {
        localStorage.setItem(`hisaab_active_group_id_${userUid}`, groupId);
      }
    }
  } catch (e) {
    console.warn('Could not save active group id:', e);
  }
}

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, authError, clearAuthError } = useAuth();

  // Navigation tab state (remembers last active tab across app closes)
  const [activeTab, setActiveTab] = useState<'Overview' | 'Transactions' | 'Lists' | 'Fixed' | 'Settings' | 'Group' | 'Individual'>(() => {
    try {
      const saved = localStorage.getItem('hisaab_active_tab');
      if (saved === 'Overview' || saved === 'Transactions' || saved === 'Lists' || saved === 'Fixed' || saved === 'Settings' || saved === 'Group' || saved === 'Individual') {
        return saved;
      }
    } catch {}
    return 'Overview';
  });

  const mainContentRef = useRef<HTMLElement>(null);

  const handleTabSwitch = useCallback((tab: typeof activeTab) => {
    if (activeTab === tab) {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    } else {
      setActiveTab(tab);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('hisaab_active_tab', activeTab);
    } catch {}

    // Instantly reset scroll to top so user begins at the top of the new tab
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      mainContentRef.current.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [activeTab]);

  // Appearance (Light | Dark | System)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('hisaab_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    const legacyDark = localStorage.getItem('hisaab_dark_mode');
    if (legacyDark === 'true') return 'dark';
    if (legacyDark === 'false') return 'light';
    return 'system';
  });

  const [resolvedDarkMode, setResolvedDarkMode] = useState<boolean>(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('hisaab_theme_mode', themeMode);

    const applyTheme = () => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);
      setResolvedDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Dynamic theme-color and iOS status bar styling sync
      const themeColor = isDark ? '#0c0d10' : '#f8f9fa';
      const statusBarStyle = isDark ? 'black-translucent' : 'default';

      try {
        const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
        themeColorMetas.forEach(meta => {
          meta.setAttribute('content', themeColor);
        });

        const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (statusBarMeta) {
          statusBarMeta.setAttribute('content', statusBarStyle);
        }
      } catch {}
    };

    applyTheme();

    if (themeMode === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const handleCycleTheme = () => {
    setThemeMode((current) => {
      if (current === 'system') return 'light';
      if (current === 'light') return 'dark';
      return 'system';
    });
  };

  // Group Management State
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    return getSavedActiveGroupId();
  });

  // Group data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);

  // Modals state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalTab, setGroupModalTab] = useState<'members' | 'groups' | 'create'>('members');
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode') || params.get('code') || sessionStorage.getItem('hisaab_pending_invite_code');
      const type = params.get('type') || sessionStorage.getItem('hisaab_pending_invite_type');
      const name = params.get('name') || sessionStorage.getItem('hisaab_pending_invite_name');
      if (code) {
        const clean = code.trim().toUpperCase();
        sessionStorage.setItem('hisaab_pending_invite_code', clean);
        if (type) sessionStorage.setItem('hisaab_pending_invite_type', type);
        if (name) sessionStorage.setItem('hisaab_pending_invite_name', name);
        return clean;
      }
    } catch {}
    return '';
  });
  const [initialJoinType, setInitialJoinType] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('type') || sessionStorage.getItem('hisaab_pending_invite_type') || '';
    } catch {}
    return '';
  });
  const [initialJoinName, setInitialJoinName] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('name') || sessionStorage.getItem('hisaab_pending_invite_name') || '';
    } catch {}
    return '';
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSplitExpenseModal, setShowSplitExpenseModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleDebtor, setSettleDebtor] = useState<{ key: string; name: string } | null>(null);
  const [settleCreditor, setSettleCreditor] = useState<{ key: string; name: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [splitTab, setSplitTab] = useState<'group' | 'individual' | 'settings'>('group');
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Helper to read per-ledger Gemini setting
  const readLedgerGeminiSetting = useCallback((groupId: string): boolean => {
    try {
      const saved = localStorage.getItem(`hisaab_gemini_enabled_${groupId}`);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      // Check legacy global preference for backward compatibility
      const legacy = localStorage.getItem('hisaab_gemini_enabled');
      return legacy !== null ? JSON.parse(legacy) : false;
    } catch {
      return false;
    }
  }, []);

  // Per-ledger Gemini preference map
  const [ledgerGeminiMap, setLedgerGeminiMap] = useState<Record<string, boolean>>(() => {
    const initialGid = getSavedActiveGroupId() || 'local_group';
    return {
      [initialGid]: (() => {
        try {
          const saved = localStorage.getItem(`hisaab_gemini_enabled_${initialGid}`);
          if (saved !== null) return JSON.parse(saved);
          const legacy = localStorage.getItem('hisaab_gemini_enabled');
          return legacy !== null ? JSON.parse(legacy) : false;
        } catch {
          return false;
        }
      })()
    };
  });
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [convertingShoppingItemIds, setConvertingShoppingItemIds] = useState<string[] | null>(null);
  const [settleTx, setSettleTx] = useState<Transaction | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalTab, setCategoryModalTab] = useState<'manage' | 'add'>('manage');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showExportLedgerModal, setShowExportLedgerModal] = useState(false);
  const [showImportLedgerModal, setShowImportLedgerModal] = useState(false);
  const [showSoloAuthModal, setShowSoloAuthModal] = useState(false);
  const [soloAuthFeature, setSoloAuthFeature] = useState<SoloAuthFeature>('create_ledger');
  const [hasCheckedMergeForUser, setHasCheckedMergeForUser] = useState<string | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(() => {
    try {
      const viewed = localStorage.getItem('hisaab_barabar_onboarding_viewed');
      // If user navigated using an invite link, let them join their group directly without popup
      const params = new URLSearchParams(window.location.search);
      if (params.get('joinCode') || params.get('code')) {
        return false;
      }
      return viewed !== 'true';
    } catch {
      return false;
    }
  });

  // Track if visitor explicitly opted to explore local guest mode
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('joinCode') || params.get('code') || params.get('guest') === 'true' || params.get('demo') === 'true' || localStorage.getItem('hisaab_guest_mode') === 'true') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });
  const [toast, setToast] = useState<ToastData | null>(null);
  const [ledgerContextGroup, setLedgerContextGroup] = useState<{
    group: ExpenseGroup;
    isOwner: boolean;
    previousGroupName?: string;
  } | null>(null);

  const showToast = useCallback((data: string | ToastData) => {
    const toastObj: ToastData = typeof data === 'string'
      ? { 
          id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
          message: data, 
          type: 'info' 
        }
      : { 
          id: data.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
          ...data 
        };
    setToast(toastObj);
  }, []);

  const handleDismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const setToastMessage = useCallback((msg: string | null) => {
    if (!msg) {
      setToast(null);
    } else {
      showToast(msg);
    }
  }, [showToast]);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showResetDataModal, setShowResetDataModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Post-Sign In Profile Setup (Full Name & UPI Verification)
  const [showProfileSetupModal, setShowProfileSetupModal] = useState<boolean>(false);
  const [currentUserUpi, setCurrentUserUpi] = useState<string>(() => getSavedPersonalUpi());

  useEffect(() => {
    if (user) {
      setCurrentUserUpi(getSavedPersonalUpi());
    } else {
      setCurrentUserUpi('');
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user && !authLoading) {
      try {
        const completed = localStorage.getItem(`hisaab_profile_completed_${user.uid}`);
        if (completed !== 'true') {
          setShowProfileSetupModal(true);
        }
      } catch {
        setShowProfileSetupModal(true);
      }
    } else {
      setShowProfileSetupModal(false);
    }
  }, [user?.uid, authLoading]);

  const handleCompleteProfileSetup = async (displayName: string, upiId: string) => {
    if (!user) return;
    try {
      // 1. Update Firebase Auth displayName
      try {
        await updateProfile(user, { displayName });
      } catch (e) {
        console.warn('Auth displayName update notice:', e);
      }

      // 2. Persist in Firestore user document
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
            displayName,
            upiId: upiId || '',
            profileCompleted: true,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore user doc update notice:', e);
      }

      // 3. Save local UPI ID if entered
      if (upiId) {
        savePersonalUpi(upiId);
        setCurrentUserUpi(upiId);
      } else {
        removePersonalUpi();
        setCurrentUserUpi('');
      }

      // 4. Update member details in active group if cloud group
      if (activeGroup && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
        try {
          if (upiId) {
            await updateGroupMemberUpi(activeGroup, user.uid, upiId);
          }
        } catch (e) {
          console.warn('Group member UPI update notice:', e);
        }
      }

      // 5. Save completion flag in localStorage
      localStorage.setItem(`hisaab_profile_completed_${user.uid}`, 'true');
      setShowProfileSetupModal(false);

      showToast({
        message: 'Profile completed!',
        subMessage: upiId ? `UPI ID ${upiId} linked for settlements` : 'Welcome to Hisaab Barabar',
        type: 'info'
      });
    } catch (err: any) {
      console.warn('Error completing profile setup:', err);
      showToast({
        message: 'Could not complete profile',
        subMessage: err?.message || 'Please check your connection',
        type: 'error'
      });
    }
  };

  // Standalone PWA detection (iOS Safari, Android standalone, Desktop Chrome/Edge)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    return typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setToastMessage('Hisaab Barabar added to your device');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallNative = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setToastMessage('Hisaab Barabar installed successfully');
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Network connectivity status & Offline Sync Engine
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => {
    return getPendingMutationsCount(user?.uid);
  });

  // Track sync engine state in real time
  useEffect(() => {
    const unsub = subscribeToSyncState((syncing, count) => {
      setIsSyncing(syncing);
      setPendingSyncCount(count);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setPendingSyncCount(getPendingMutationsCount(user?.uid));
  }, [user?.uid]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (user) {
        const countBefore = getPendingMutationsCount(user.uid);
        if (countBefore > 0) {
          showToast({
            message: 'Back online',
            subMessage: `Uploading ${countBefore} offline change${countBefore > 1 ? 's' : ''}...`,
            type: 'sync'
          });
          try {
            const { synced } = await syncPendingMutations(user);
            if (synced > 0) {
              showToast({
                message: 'Cloud ledger synced',
                subMessage: `All ${synced} offline change${synced > 1 ? 's' : ''} saved`,
                type: 'sync'
              });
            } else {
              showToast({
                message: 'Back online',
                subMessage: 'Cloud ledger synced',
                type: 'sync'
              });
            }
          } catch {
            showToast({
              message: 'Back online',
              subMessage: 'Cloud ledger synced',
              type: 'sync'
            });
          }
        } else {
          showToast({
            message: 'Back online',
            subMessage: 'Cloud ledger synced',
            type: 'sync'
          });
        }
      } else {
        showToast({
          message: 'Back online',
          subMessage: 'Connected to network',
          type: 'sync'
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      const pending = getPendingMutationsCount(user?.uid);
      if (pending > 0) {
        showToast({
          message: 'Offline mode',
          subMessage: `${pending} offline change${pending > 1 ? 's' : ''} saved locally`,
          type: 'info'
        });
      } else {
        showToast({
          message: 'Offline mode',
          subMessage: 'Entries will autosync when reconnected',
          type: 'info'
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If online on mount and there are pending offline mutations, sync immediately
    if (typeof navigator !== 'undefined' && navigator.onLine && user) {
      if (getPendingMutationsCount(user.uid) > 0) {
        syncPendingMutations(user).catch(() => {});
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const handleAccountDeleted = () => {
    setActiveGroupId('');
    setGroups([]);
    setTransactions([]);
    setShoppingItems([]);
    setRecurringExpenses([]);
    setActiveTab('Overview');
    setShowDeleteAccountModal(false);
    setToastMessage('Account and all associated records permanently deleted');
  };

  const handleResetLocalData = () => {
    purgeAllLocalData();
    setActiveGroupId('');
    setGroups([]);
    setTransactions([]);
    setShoppingItems([]);
    setRecurringExpenses([]);
    setActiveTab('Overview');
    setShowResetDataModal(false);
    showToast({
      message: 'Offline ledger data reset',
      type: 'info'
    });
  };

  const handleOpenGroupModal = (tab: 'members' | 'groups' | 'create' = 'members') => {
    if (!user) {
      if (tab === 'create') {
        setSoloAuthFeature('create_ledger');
        setShowSoloAuthModal(true);
        return;
      }
      if (tab === 'members') {
        setSoloAuthFeature('manage_members');
        setShowSoloAuthModal(true);
        return;
      }
      if (tab === 'groups') {
        setSoloAuthFeature('multi_ledger');
        setShowSoloAuthModal(true);
        return;
      }
    }
    setGroupModalTab(tab);
    setShowGroupModal(true);
  };

  const handleOpenInviteModal = () => {
    if (!user) {
      setSoloAuthFeature('share_ledger');
      setShowSoloAuthModal(true);
      return;
    }
    setShowInviteModal(true);
  };

  // Period filter for Overview
  const [selectedPeriod, setSelectedPeriod] = useState<'current_month' | 'last_month' | 'ytd'>('current_month');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Local fallback storage for guests
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('expenses_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [localShopping, setLocalShopping] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('expenses_shopping_list');
    return saved ? JSON.parse(saved) : [];
  });
  const [localRecurring, setLocalRecurring] = useState<RecurringExpense[]>(() => {
    const saved = localStorage.getItem('expenses_recurring');
    return saved ? JSON.parse(saved) : [];
  });

  // Helper to distinguish genuine guest scratchpad records from cloud records
  const isGuestGroupId = useCallback((gid?: string | null): boolean => {
    if (!gid) return true;
    return gid === 'local_group' || gid.startsWith('local_') || gid.startsWith('local');
  }, []);

  // Filter only genuine guest items created in local sandbox
  const genuineGuestTransactions = useMemo(() => {
    return localTransactions.filter(t => isGuestGroupId(t.groupId));
  }, [localTransactions, isGuestGroupId]);

  const genuineGuestShopping = useMemo(() => {
    return localShopping.filter(s => isGuestGroupId(s.groupId));
  }, [localShopping, isGuestGroupId]);

  const genuineGuestRecurring = useMemo(() => {
    return localRecurring.filter(r => isGuestGroupId(r.groupId));
  }, [localRecurring, isGuestGroupId]);

  // Check URL parameters & session storage for invitation links (e.g. ?joinCode=ABCDEF)
  // Smartly detects if user is already the owner or an active member of this ledger!
  useEffect(() => {
    // If auth state is still resolving, wait before deciding to pop up modals
    if (authLoading) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('joinCode') || params.get('code') || sessionStorage.getItem('hisaab_pending_invite_code') || initialJoinCode;
    if (!code) return;

    const cleanCode = code.trim().toUpperCase();

    // 1. If signed in, check if user is already the owner or member of this group
    if (user) {
      const existingGroup = groups.find(g => 
        g.inviteCode?.toUpperCase() === cleanCode || 
        g.previousInviteCodes?.some(c => c.toUpperCase() === cleanCode) ||
        g.id === cleanCode
      );

      if (existingGroup) {
        // User already belongs to this group! Do NOT prompt them to join!
        const userEmail = (user.email || '').toLowerCase().trim();
        const isOwner = existingGroup.createdBy === user.uid || (existingGroup.ownerEmail && existingGroup.ownerEmail.toLowerCase() === userEmail);

        // Clean the URL query params without reloading the page
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('joinCode') || url.searchParams.has('code')) {
            url.searchParams.delete('joinCode');
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
          }
          sessionStorage.removeItem('hisaab_pending_invite_code');
          sessionStorage.removeItem('hisaab_auto_join');
        } catch (e) {
          console.error(e);
        }

        setInitialJoinCode('');
        setShowJoinModal(false);

        // Determine previous group name if switching
        const prevGroupName = activeGroupId && activeGroupId !== existingGroup.id
          ? groups.find(g => g.id === activeGroupId)?.name
          : undefined;

        // Switch to this group
        setActiveGroupId(existingGroup.id);
        saveActiveGroupId(existingGroup.id, user.uid);
        setActiveTab('Overview');

        // Present the dedicated Ledger Context Modal (clear, interactive, never unnoticed)
        setLedgerContextGroup({
          group: existingGroup,
          isOwner,
          previousGroupName: prevGroupName
        });
        return;
      }
    }

    // 2. If user is guest/not signed in, or group is not in existing groups:
    setInitialJoinCode(cleanCode);
    setShowJoinModal(true);
  }, [authLoading, user, groups]);

  // Handle Home Screen Shortcuts & Tab Deep Links (?action=add-expense, ?tab=transactions, etc.)
  useEffect(() => {
    const handleUrlActions = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        
        // 1. Home screen shortcut action: Quick Add Expense
        const action = params.get('action');
        if (action === 'add-expense') {
          setEditingTx(null);
          const targetGroup = groups.find(g => g.id === activeGroupId) || groups[0];
          if (targetGroup?.type === 'split') {
            setShowSplitExpenseModal(true);
          } else {
            setShowExpenseModal(true);
          }
          const url = new URL(window.location.href);
          url.searchParams.delete('action');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
        }

        // 2. Tab navigation shortcut: ?tab=transactions / ?tab=shopping / ?tab=fixed / ?tab=settings / ?tab=overview / ?tab=group / ?tab=individual
        const tabParam = params.get('tab')?.toLowerCase();
        if (tabParam) {
          if (tabParam === 'transactions' || tabParam === 'ledger') {
            setActiveTab('Transactions');
          } else if (tabParam === 'shopping' || tabParam === 'lists') {
            setActiveTab('Lists');
          } else if (tabParam === 'fixed' || tabParam === 'bills') {
            setActiveTab('Fixed');
          } else if (tabParam === 'settings') {
            setActiveTab('Settings');
          } else if (tabParam === 'overview') {
            setActiveTab('Overview');
          } else if (tabParam === 'group') {
            setActiveTab('Group');
          } else if (tabParam === 'individual') {
            setActiveTab('Individual');
          }
          const url = new URL(window.location.href);
          url.searchParams.delete('tab');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
        }
      } catch (e) {
        console.warn('URL shortcut check note:', e);
      }
    };

    handleUrlActions();
    window.addEventListener('popstate', handleUrlActions);
    return () => window.removeEventListener('popstate', handleUrlActions);
  }, [groups, activeGroupId]);

  // Android & Mobile Browser Hardware/Gesture Back Button handling for modals
  const isAnyModalOpen = Boolean(
    showExpenseModal || 
    showSplitExpenseModal ||
    showInviteModal ||
    showSettleModal ||
    showVoiceModal ||
    settleTx || 
    showGroupModal || 
    showJoinModal || 
    showRecurringModal || 
    showCategoryModal || 
    showMergeModal || 
    showOnboardingModal || 
    showDeleteAccountModal || 
    showResetDataModal || 
    showInstallModal || 
    ledgerContextGroup
  );

  const modalPushedRef = useRef(false);

  useEffect(() => {
    if (isAnyModalOpen && !modalPushedRef.current) {
      modalPushedRef.current = true;
      window.history.pushState({ modalOpen: true }, '');

      const handlePopState = () => {
        modalPushedRef.current = false;
        setShowExpenseModal(false);
        setShowSplitExpenseModal(false);
        setShowInviteModal(false);
        setShowSettleModal(false);
        setSettleDebtor(null);
        setSettleCreditor(null);
        setShowVoiceModal(false);
        setEditingTx(null);
        setSettleTx(null);
        setShowGroupModal(false);
        setShowJoinModal(false);
        setShowRecurringModal(false);
        setEditingRecurring(null);
        setShowCategoryModal(false);
        setShowMergeModal(false);
        setShowOnboardingModal(false);
        setShowDeleteAccountModal(false);
        setShowResetDataModal(false);
        setShowInstallModal(false);
        setLedgerContextGroup(null);
      };

      window.addEventListener('popstate', handlePopState, { once: true });
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    } else if (!isAnyModalOpen && modalPushedRef.current) {
      modalPushedRef.current = false;
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
    }
  }, [isAnyModalOpen]);

  // 1. Subscribe to User's Expense Groups from Firestore or Local Storage
  useEffect(() => {
    // Prevent premature guest fallback or overwriting saved active group while auth state is resolving
    if (authLoading) return;

    if (!user) {
      setHasCheckedMergeForUser(null);
      // Reload local sandbox records when in guest mode
      try {
        const savedTx = localStorage.getItem('expenses_transactions');
        setLocalTransactions(savedTx ? JSON.parse(savedTx) : []);
        const savedShop = localStorage.getItem('expenses_shopping_list');
        setLocalShopping(savedShop ? JSON.parse(savedShop) : []);
        const savedRec = localStorage.getItem('expenses_recurring');
        setLocalRecurring(savedRec ? JSON.parse(savedRec) : []);
      } catch (e) {
        console.error('Error reloading local storage:', e);
      }

      // Guest mode: solo user is restricted to their single default personal ledger
      const saved = localStorage.getItem('expenses_local_groups');
      let localList: ExpenseGroup[] = saved ? JSON.parse(saved) : [];
      if (localList.length === 0) {
        localList = [{
          id: 'local_group',
          name: 'Personal Expenses',
          type: 'budget',
          createdBy: 'guest',
          ownerEmail: 'guest@device',
          memberUids: ['guest'],
          memberEmails: ['guest@device'],
          inviteCode: 'LOCAL1',
          members: {
            guest: { email: 'guest@device', displayName: 'Guest', role: 'owner', addedAt: new Date().toISOString() }
          },
          createdAt: new Date().toISOString()
        }];
        localStorage.setItem('expenses_local_groups', JSON.stringify(localList));
      } else if (localList.length > 1) {
        localList = [localList[0]];
        localStorage.setItem('expenses_local_groups', JSON.stringify(localList));
      }
      setGroups(localList);
      setActiveGroupId(prev => {
        const savedId = getSavedActiveGroupId(null);
        const targetId = prev || savedId;
        const exists = localList.some(g => g.id === targetId);
        const chosen = exists && targetId ? targetId : localList[0].id;
        saveActiveGroupId(chosen, null);
        return chosen;
      });
      return;
    }

    // Signed-in user: instantly seed groups from local user cache to preserve active ledger offline
    const cachedUserGroupsKey = `hisaab_cloud_groups_${user.uid}`;
    try {
      const cached = localStorage.getItem(cachedUserGroupsKey);
      if (cached) {
        const parsed: ExpenseGroup[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGroups(parsed);
          const savedActiveId = getSavedActiveGroupId(user.uid);
          if (savedActiveId && !savedActiveId.startsWith('local_') && savedActiveId !== 'local_group' && parsed.some(g => g.id === savedActiveId)) {
            setActiveGroupId(savedActiveId);
          } else if (parsed[0]) {
            setActiveGroupId(parsed[0].id);
            saveActiveGroupId(parsed[0].id, user.uid);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read cached cloud groups:', e);
    }

    const unsubscribe = subscribeToUserGroups(
      user,
      async (fetchedGroups) => {
        if (fetchedGroups.length === 0) {
          // If the user arrived with an invitation to join a shared ledger, do NOT create a default personal ledger.
          const pendingInviteCode = initialJoinCode || sessionStorage.getItem('hisaab_pending_invite_code');
          if (pendingInviteCode) {
            return;
          }

          // Guard against offline or pending cache states:
          // NEVER auto-create a default ledger if device is offline or if user has existing cached ledgers!
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          let hasExistingCache = false;
          try {
            const cached = localStorage.getItem(cachedUserGroupsKey);
            if (cached && JSON.parse(cached).length > 0) {
              hasExistingCache = true;
            }
          } catch {}

          if (isOffline || hasExistingCache || groups.some(g => !g.id.startsWith('local_') && g.id !== 'local_group')) {
            // Keep using the existing cloud ledger from cache without creating any default ledger
            return;
          }

          // Check if the user had REAL local items or custom groups created offline before logging in
          const savedLocal = localStorage.getItem('expenses_local_groups');
          let localList: ExpenseGroup[] = [];
          try {
            if (savedLocal) localList = JSON.parse(savedLocal);
          } catch {}

          const hasLocalItems = genuineGuestTransactions.length > 0 || genuineGuestShopping.length > 0 || genuineGuestRecurring.length > 0;
          const hasCustomLocalGroups = localList.some(g => g.id !== 'local_group' && g.name !== 'My Personal Expenses');

          // Only migrate if user actually created offline expenses or customized groups
          if (hasLocalItems || hasCustomLocalGroups) {
            try {
              // Migrate local ledgers & items to user's Google account
              const promoted = await migrateLocalGroupsToCloud(
                user,
                localList,
                genuineGuestTransactions,
                genuineGuestShopping,
                genuineGuestRecurring
              );
              // Clean local storage completely so nothing remains orphaned
              localStorage.removeItem('expenses_local_groups');
              localStorage.removeItem('expenses_transactions');
              localStorage.removeItem('expenses_shopping_list');
              localStorage.removeItem('expenses_recurring');
              setLocalTransactions([]);
              setLocalShopping([]);
              setLocalRecurring([]);
              setGroups(promoted);
              localStorage.setItem(cachedUserGroupsKey, JSON.stringify(promoted));
              if (promoted[0]) {
                setActiveGroupId(promoted[0].id);
                saveActiveGroupId(promoted[0].id, user.uid);
              }
              setToastMessage(`Synced ${promoted.length} offline ledger${promoted.length === 1 ? '' : 's'} to your Google account`);
              return;
            } catch (e) {
              console.error('Failed to migrate local groups to cloud', e);
            }
          }

          // Only create initial personal ledger if confirmed online and user is truly new (zero groups)
          try {
            const initial = await createGroup('Personal Expenses', user);
            localStorage.removeItem('expenses_local_groups');
            const newGroups = [initial];
            setGroups(newGroups);
            localStorage.setItem(cachedUserGroupsKey, JSON.stringify(newGroups));
            setActiveGroupId(initial.id);
            saveActiveGroupId(initial.id, user.uid);
          } catch (e) {
            console.error('Failed to create initial user group', e);
          }
        } else {
          // Cloud ledgers exist: load existing ledgers across all devices without creating any new ones
          localStorage.removeItem('expenses_local_groups');
          setGroups(fetchedGroups);
          localStorage.setItem(cachedUserGroupsKey, JSON.stringify(fetchedGroups));
          
          // Retain active group: always prioritize user's explicitly remembered active ledger (e.g. Ledger B)
          setActiveGroupId(prev => {
            const savedId = getSavedActiveGroupId(user.uid);
            let targetId = '';
            if (savedId && !savedId.startsWith('local_') && savedId !== 'local_group' && fetchedGroups.some(g => g.id === savedId)) {
              targetId = savedId;
            } else if (prev && !prev.startsWith('local_') && prev !== 'local_group' && fetchedGroups.some(g => g.id === prev)) {
              targetId = prev;
            } else {
              targetId = fetchedGroups[0].id;
            }
            saveActiveGroupId(targetId, user.uid);
            return targetId;
          });
        }
      },
      (error) => {
        console.warn('Could not subscribe to groups:', error);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // Persist active group whenever activeGroupId or user changes
  useEffect(() => {
    if (activeGroupId) {
      saveActiveGroupId(activeGroupId, user?.uid);
    }
  }, [activeGroupId, user?.uid]);

  // Check for offline data merge whenever user signs in (strictly requires > 0 genuine guest items)
  useEffect(() => {
    if (!user || groups.length === 0) return;

    // Filter out sandbox groups to check valid cloud groups
    const hasCloudGroup = groups.some(g => !g.id.startsWith('local_') && g.id !== 'local_group');
    if (!hasCloudGroup) return;

    // Sanitize local storage: purge any cloud ledger items that erroneously leaked into guest storage
    const hasLeakedTx = localTransactions.some(t => t.groupId && !isGuestGroupId(t.groupId));
    const hasLeakedShop = localShopping.some(s => s.groupId && !isGuestGroupId(s.groupId));
    const hasLeakedRec = localRecurring.some(r => r.groupId && !isGuestGroupId(r.groupId));

    if (hasLeakedTx || hasLeakedShop || hasLeakedRec) {
      const cleanTx = localTransactions.filter(t => isGuestGroupId(t.groupId));
      const cleanShop = localShopping.filter(s => isGuestGroupId(s.groupId));
      const cleanRec = localRecurring.filter(r => isGuestGroupId(r.groupId));
      setLocalTransactions(cleanTx);
      setLocalShopping(cleanShop);
      setLocalRecurring(cleanRec);
      try {
        localStorage.setItem('expenses_transactions', JSON.stringify(cleanTx));
        localStorage.setItem('expenses_shopping_list', JSON.stringify(cleanShop));
        localStorage.setItem('expenses_recurring', JSON.stringify(cleanRec));
      } catch {}
    }

    const totalOfflineCount = genuineGuestTransactions.length + genuineGuestShopping.length + genuineGuestRecurring.length;
    if (totalOfflineCount === 0) {
      if (hasCheckedMergeForUser !== user.uid) {
        setHasCheckedMergeForUser(user.uid);
      }
      return;
    }

    if (totalOfflineCount > 0 && hasCheckedMergeForUser !== user.uid) {
      setHasCheckedMergeForUser(user.uid);
      setShowMergeModal(true);
    }
  }, [user, groups, localTransactions, localShopping, localRecurring, genuineGuestTransactions.length, genuineGuestShopping.length, genuineGuestRecurring.length, hasCheckedMergeForUser, isGuestGroupId]);

  // Create new group handler (works for both logged-in and guest users)
  const handleCreateNewGroup = async (
    name: string, 
    type: 'budget' | 'split' = 'budget'
  ): Promise<ExpenseGroup | null> => {
    const cleanName = name.trim();
    if (!cleanName) return null;

    if (user) {
      const created = await createGroup(cleanName, user, type);
      setGroups(prev => [created, ...prev.filter(g => g.id !== created.id)]);
      setActiveGroupId(created.id);
      saveActiveGroupId(created.id, user.uid);
      return created;
    } else {
      // Solo guest is restricted to single default personal ledger
      setSoloAuthFeature('create_ledger');
      setShowSoloAuthModal(true);
      return null;
    }
  };

  // Delete group/ledger handler (supports both cloud and local guest groups)
  const handleDeleteGroup = async (groupId: string): Promise<void> => {
    const targetGroup = groups.find(g => g.id === groupId);
    const targetName = targetGroup?.name || 'Ledger';

    try {
      await deleteExpenseGroup(groupId, user);

      const remaining = groups.filter(g => g.id !== groupId);
      setGroups(remaining);

      // If the deleted group was the active group
      if (activeGroupId === groupId) {
        if (remaining.length > 0) {
          const nextGroup = remaining[0];
          setActiveGroupId(nextGroup.id);
          saveActiveGroupId(nextGroup.id, user?.uid);
        } else {
          // If all ledgers are deleted, recreate a fresh default ledger
          if (user) {
            const fresh = await createGroup('Personal Expenses', user);
            setGroups([fresh]);
            setActiveGroupId(fresh.id);
            saveActiveGroupId(fresh.id, user.uid);
          } else {
            const freshId = `local_grp_${Date.now()}`;
            const freshLocal: ExpenseGroup = {
              id: freshId,
              name: 'Personal Expenses',
              createdBy: 'guest',
              ownerEmail: 'guest@device',
              memberUids: ['guest'],
              memberEmails: ['guest@device'],
              inviteCode: `LOC${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
              members: {
                guest: { email: 'guest@device', displayName: 'Guest', role: 'owner', addedAt: new Date().toISOString() }
              },
              createdAt: new Date().toISOString()
            };
            setGroups([freshLocal]);
            localStorage.setItem('expenses_local_groups', JSON.stringify([freshLocal]));
            setActiveGroupId(freshId);
            saveActiveGroupId(freshId, null);
          }
        }
      }

      setToastMessage(`Deleted "${targetName}"`);
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      setToastMessage(err?.message || 'Failed to delete ledger');
      throw err;
    }
  };

  // Update group/ledger name handler (supports both cloud and local guest groups)
  const handleUpdateGroupName = async (groupId: string, newName: string): Promise<void> => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    try {
      await updateGroupName(groupId, cleanName);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: cleanName } : g));
      showToast({ message: 'Ledger name updated', type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Could not update ledger name', type: 'error' });
      throw err;
    }
  };

  // Find active group object
  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === activeGroupId) || groups[0] || null;
  }, [groups, activeGroupId]);

  // Determine current user's role in the active group
  const userRole: UserRole = useMemo(() => {
    if (!user) return 'owner'; // Local guest has full rights over their local sandbox
    if (!activeGroup) return 'viewer';

    if (activeGroup.createdBy === user.uid) return 'owner';

    const byUid = activeGroup.members?.[user.uid];
    if (byUid) return byUid.role;

    const userEmail = (user.email || '').toLowerCase().trim();
    const byEmail = activeGroup.members?.[userEmail];
    if (byEmail) return byEmail.role;

    // If user is registered in memberUids or memberEmails, default to 'editor'
    if (
      activeGroup.memberUids?.includes(user.uid) ||
      (userEmail && activeGroup.memberEmails?.some(e => e.toLowerCase() === userEmail))
    ) {
      return 'editor';
    }

    return 'viewer';
  }, [user, activeGroup]);

  const isSplitLedger = activeGroup?.type === 'split';
  const splitMembersList = useMemo(() => {
    if (!activeGroup || activeGroup.type !== 'split') return [];
    return getGroupMembersList(activeGroup, user?.uid, user?.email || undefined);
  }, [activeGroup, user]);
  const splitMemberCount = splitMembersList.length;

  // Whenever activeGroupId changes, sync the per-ledger Gemini preference
  useEffect(() => {
    const gid = activeGroupId || 'local_group';
    setLedgerGeminiMap(prev => {
      if (gid in prev) return prev;
      return { ...prev, [gid]: readLedgerGeminiSetting(gid) };
    });
  }, [activeGroupId, readLedgerGeminiSetting]);

  // Cross-device sync: Listen to user profile preferences from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToUserPreferences(user.uid, (cloudPrefs) => {
      setLedgerGeminiMap(prev => {
        const next = { ...prev };
        let hasChanged = false;
        Object.entries(cloudPrefs).forEach(([gid, isEnabled]) => {
          try {
            localStorage.setItem(`hisaab_gemini_enabled_${gid}`, JSON.stringify(isEnabled));
          } catch {}
          if (next[gid] !== isEnabled) {
            next[gid] = isEnabled;
            hasChanged = true;
          }
        });
        return hasChanged ? next : prev;
      });
    });
  }, [user?.uid]);

  // Effective Gemini state for the active ledger:
  // Split ledgers do not use Gemini AI (not required).
  // When a ledger is view-only, Gemini is strictly disabled & uneditable.
  const effectiveGeminiEnabled = useMemo(() => {
    if (activeGroup?.type === 'split') return false;
    if (userRole === 'viewer') return false;
    const gid = activeGroupId || 'local_group';
    return ledgerGeminiMap[gid] ?? readLedgerGeminiSetting(gid);
  }, [activeGroup?.type, userRole, activeGroupId, ledgerGeminiMap, readLedgerGeminiSetting]);

  const handleToggleGemini = useCallback((enabled: boolean) => {
    if (userRole === 'viewer') return;
    const gid = activeGroupId || 'local_group';
    setLedgerGeminiMap(prev => ({ ...prev, [gid]: enabled }));
    try {
      localStorage.setItem(`hisaab_gemini_enabled_${gid}`, JSON.stringify(enabled));
    } catch {}

    // Cloud sync across devices for authenticated user
    if (user?.uid) {
      saveUserLedgerGeminiPreference(user.uid, gid, enabled);
    }

    showToast({
      message: enabled 
        ? `Gemini AI enabled for ${activeGroup?.name || 'this ledger'}` 
        : `Restored classic Ledger navigation for ${activeGroup?.name || 'this ledger'}`,
      type: 'info'
    });
  }, [userRole, activeGroupId, activeGroup?.name, user?.uid, showToast]);

  // Categories - Ledger Scoped (Material 3 & Apple HIG Multi-tenancy)
  const categories: Record<string, CategoryData> = useMemo(() => {
    return {
      ...DEFAULT_CATEGORIES,
      ...(activeGroup?.customCategories || {})
    };
  }, [activeGroup?.customCategories]);

  // Handler: Save / Update Category for the active ledger
  const handleSaveCategory = async (key: string, data: CategoryData) => {
    if (!activeGroup) return;

    const updatedCustom = {
      ...(activeGroup.customCategories || {}),
      [key]: data
    };

    // 1. Optimistically update local activeGroup & groups state
    const updatedGroups = groups.map(g => g.id === activeGroup.id ? { ...g, customCategories: updatedCustom } : g);
    setGroups(updatedGroups);

    // Keep user's offline startup cache in sync for instant PWA / standalone load
    if (user) {
      try {
        localStorage.setItem(`hisaab_cloud_groups_${user.uid}`, JSON.stringify(updatedGroups));
      } catch {}
    }

    // 2. Persist to cloud group in Firestore if cloud ledger
    if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
      try {
        await updateGroupCustomCategories(activeGroup.id, updatedCustom);
      } catch (err) {
        console.error('Failed to sync custom categories to cloud group:', err);
      }
    } else {
      // 3. Persist to local groups in localStorage
      try {
        const savedLocal = localStorage.getItem('expenses_local_groups');
        if (savedLocal) {
          const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
          const next = parsed.map(g => g.id === activeGroup.id ? { ...g, customCategories: updatedCustom } : g);
          localStorage.setItem('expenses_local_groups', JSON.stringify(next));
        }
      } catch (e) {
        console.warn('Could not save local group categories:', e);
      }
    }

    setToastMessage(`Saved category "${data.name}" in ${activeGroup.name}`);
  };

  // Auto-migrate legacy device-stored custom categories into active ledger once if ledger has no custom categories
  useEffect(() => {
    if (!activeGroup) return;
    try {
      const legacySaved = localStorage.getItem('hisaab_categories');
      if (legacySaved) {
        const parsed: Record<string, CategoryData> = JSON.parse(legacySaved);
        const legacyCustom: Record<string, CategoryData> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (!DEFAULT_CATEGORIES[k]) {
            legacyCustom[k] = v;
          }
        });
        if (Object.keys(legacyCustom).length > 0 && (!activeGroup.customCategories || Object.keys(activeGroup.customCategories).length === 0)) {
          const merged = { ...(activeGroup.customCategories || {}), ...legacyCustom };
          setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, customCategories: merged } : g));
          if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
            updateGroupCustomCategories(activeGroup.id, merged).catch(console.warn);
          } else {
            const savedLocal = localStorage.getItem('expenses_local_groups');
            if (savedLocal) {
              const parsedLocal: ExpenseGroup[] = JSON.parse(savedLocal);
              const next = parsedLocal.map(g => g.id === activeGroup.id ? { ...g, customCategories: merged } : g);
              localStorage.setItem('expenses_local_groups', JSON.stringify(next));
            }
          }
        }
        // Permanently erase legacy device key so categories are never duplicated or randomly re-applied
        localStorage.removeItem('hisaab_categories');
      }
    } catch {}
  }, [activeGroup?.id, user]);

  // Desktop & Tablet Keyboard Navigation (Material & Apple productivity patterns)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      
      if (e.key === 'Escape') {
        setShowExpenseModal(false);
        setEditingTx(null);
        setSettleTx(null);
        setShowGroupModal(false);
        setShowJoinModal(false);
        setShowRecurringModal(false);
        setShowCategoryModal(false);
        setShowMergeModal(false);
        setShowOnboardingModal(false);
        setShowProfileSetupModal(false);
        setShowDeleteAccountModal(false);
        setShowResetDataModal(false);
        setShowInstallModal(false);
        setLedgerContextGroup(null);
        return;
      }

      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      if ((e.key === 'e' || e.key === 'n' || e.key === '+') && userRole !== 'viewer') {
        e.preventDefault();
        setEditingTx(null);
        if (isSplitLedger) {
          setShowSplitExpenseModal(true);
        } else {
          setShowExpenseModal(true);
        }
      } else if (e.key === '1') {
        setActiveTab('Overview');
      } else if (e.key === '2') {
        setActiveTab('Transactions');
      } else if (e.key === '3') {
        setActiveTab('Lists');
      } else if (e.key === '4') {
        setActiveTab('Fixed');
      } else if (e.key === '5') {
        setActiveTab('Settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userRole]);

  // 2. Real-time Subscription to Group Expenses with Instant Cache & Smart Offline Merge
  useEffect(() => {
    if (!activeGroup) {
      setTransactions([]);
      return;
    }

    const isLocalLedger = activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group';

    if (!user || isLocalLedger) {
      // Filter local transactions specifically for active ledger in guest mode or local sandbox
      const defaultGid = groups[0]?.id || 'local_group';
      const filtered = localTransactions.filter(t => {
        const itemGid = t.groupId || defaultGid;
        return itemGid === activeGroup.id;
      });
      setTransactions(filtered);
      return;
    }

    // Immediately seed with cached expenses so offline viewing has 0ms latency
    const cached = getCachedExpenses(activeGroup.id);
    if (cached.length > 0) {
      setTransactions(mergeServerExpensesWithPending(cached, activeGroup.id, user.uid));
    } else {
      setTransactions([]);
    }

    const unsubscribe = subscribeToGroupExpenses(
      activeGroup.id,
      (liveExpenses) => {
        const merged = mergeServerExpensesWithPending(liveExpenses, activeGroup.id, user.uid);
        setTransactions(merged);
        setCachedExpenses(activeGroup.id, merged);
      },
      (err) => {
        console.warn('Could not load group expenses:', err);
      }
    );

    return () => unsubscribe();
  }, [activeGroup?.id, user, localTransactions, groups]);

  // 3. Real-time Subscription to Group Shopping List with Instant Cache & Smart Offline Merge
  useEffect(() => {
    if (!activeGroup) {
      setShoppingItems([]);
      return;
    }

    const isLocalLedger = activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group';

    if (!user || isLocalLedger) {
      // Filter local shopping items specifically for active ledger in guest mode or local sandbox
      const defaultGid = groups[0]?.id || 'local_group';
      const filtered = localShopping.filter(i => {
        const itemGid = i.groupId || defaultGid;
        return itemGid === activeGroup.id;
      });
      setShoppingItems(filtered);
      return;
    }

    // Immediately seed with cached shopping items so offline viewing has 0ms latency
    const cached = getCachedShopping(activeGroup.id);
    if (cached.length > 0) {
      setShoppingItems(mergeServerShoppingWithPending(cached, activeGroup.id, user.uid));
    } else {
      setShoppingItems([]);
    }

    const unsubscribe = subscribeToGroupShopping(
      activeGroup.id,
      (liveShopping) => {
        const merged = mergeServerShoppingWithPending(liveShopping, activeGroup.id, user.uid);
        setShoppingItems(merged);
        setCachedShopping(activeGroup.id, merged);
      },
      (err) => {
        console.warn('Could not load group shopping items:', err);
      }
    );

    return () => unsubscribe();
  }, [activeGroup?.id, user, localShopping, groups]);

  // 4. Real-time Subscription to Group Recurring Expenses with Instant Cache & Smart Offline Merge
  useEffect(() => {
    if (!activeGroup) {
      setRecurringExpenses([]);
      return;
    }

    const isLocalLedger = activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group';

    if (!user || isLocalLedger) {
      // Filter local recurring items specifically for active ledger in guest mode or local sandbox
      const defaultGid = groups[0]?.id || 'local_group';
      const filtered = localRecurring.filter(r => {
        const itemGid = r.groupId || defaultGid;
        return itemGid === activeGroup.id;
      });
      setRecurringExpenses(filtered);
      return;
    }

    // Immediately seed with cached recurring expenses
    const cached = getCachedRecurring(activeGroup.id);
    if (cached.length > 0) {
      setRecurringExpenses(mergeServerRecurringWithPending(cached, activeGroup.id, user.uid));
    } else {
      setRecurringExpenses([]);
    }

    const unsubscribe = subscribeToGroupRecurring(
      activeGroup.id,
      (liveRecurring) => {
        const merged = mergeServerRecurringWithPending(liveRecurring, activeGroup.id, user.uid);
        setRecurringExpenses(merged);
        setCachedRecurring(activeGroup.id, merged);
      },
      (err) => {
        console.warn('Could not load group recurring expenses:', err);
      }
    );

    return () => unsubscribe();
  }, [activeGroup?.id, user, localRecurring, groups]);

  // 5. Real-time Subscription to Group Notifications & Device Alert Engine (Push-Only)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(getPushPermissionState());
  const previousNotifIdsRef = useRef<Set<string>>(new Set());

  // Individual user preference for daily digest time (Default: 21:00 / 9:00 PM)
  const [digestTime, setDigestTime] = useState<string>(() => getUserDigestTime(user?.uid));

  useEffect(() => {
    setDigestTime(getUserDigestTime(user?.uid));
  }, [user?.uid]);

  const handleUpdateDigestTime = (newTime: string) => {
    setDigestTime(newTime);
    setUserDigestTime(newTime, user?.uid);
    setToastMessage(`Daily digest scheduled for ${formatDigestTime(newTime)}`);
  };

  // Push permission update handler
  const handleRequestPushPermission = async () => {
    const perm = await requestPushPermission();
    setPushPermission(perm);
  };

  useEffect(() => {
    if (!activeGroup) {
      setNotifications([]);
      return;
    }

    const currentGid = activeGroup.id;
    if (!user || currentGid.startsWith('local_') || currentGid === 'local_group') {
      try {
        const saved = localStorage.getItem(`hisaab_local_notifs_${currentGid}`);
        if (saved) {
          setNotifications(JSON.parse(saved));
        } else {
          setNotifications([]);
        }
      } catch (e) {
        setNotifications([]);
      }
      return;
    }

    setNotifications([]);
    const unsubscribe = subscribeToGroupNotifications(
      activeGroup.id,
      (liveNotifications) => {
        // Detect newly arrived notifications to trigger native push notification
        liveNotifications.forEach((n) => {
          if (!previousNotifIdsRef.current.has(n.id)) {
            // Check if notification was created recently (within last 10 minutes) and not by current user
            const ageMs = Date.now() - new Date(n.createdAt).getTime();
            if (ageMs < 10 * 60 * 1000 && n.createdBy !== user.uid) {
              // Trigger native device push notification (no disruptive in-app banner)
              showDeviceNotification(n.title, {
                body: n.message,
                tag: n.id
              });
            }
          }
        });

        // Update known IDs
        previousNotifIdsRef.current = new Set(liveNotifications.map(n => n.id));
        setNotifications(liveNotifications);
      },
      (err) => {
        console.warn('Could not load group notifications:', err);
      }
    );

    return () => unsubscribe();
  }, [activeGroup?.id, user]);

  // 6. Daily Expense Digest Automation (Configurable Delivery Time, Default 9 PM / 21:00)
  // User directive: "Let that 9 pm be decided by that individual. By default : Lets keep it 9 pm. But if user wants to change it to some other, allow user to change it."
  const handleTriggerDailyDigest = async (force: boolean = false) => {
    if (!activeGroup) return;
    const notif = await dispatchDailyExpenseSummary(
      activeGroup,
      transactions,
      user,
      force
    );
    if (notif) {
      if (!user || activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group') {
        setNotifications(prev => {
          const updated = [notif, ...prev];
          localStorage.setItem(`hisaab_local_notifs_${activeGroup.id}`, JSON.stringify(updated));
          return updated;
        });
      }
    }
  };

  useEffect(() => {
    if (!activeGroup || transactions.length === 0) return;

    const checkScheduledDigest = () => {
      const now = new Date();
      const [targetHour, targetMinute = 0] = (digestTime || '21:00').split(':').map(Number);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Trigger once current time is at or past the scheduled time today
      const isDue = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
      if (isDue) {
        const todayIso = now.toISOString().split('T')[0];
        const storageKey = `hisaab_daily_notif_${activeGroup.id}_${todayIso}`;
        if (!localStorage.getItem(storageKey)) {
          // Check if there was any expense entry today
          const todayExpenses = transactions.filter(t => t.date === todayIso);
          if (todayExpenses.length > 0) {
            handleTriggerDailyDigest(false);
          }
        }
      }
    };

    // Check right away and then every 30 seconds
    checkScheduledDigest();
    const interval = setInterval(checkScheduledDigest, 30 * 1000);
    return () => clearInterval(interval);
  }, [activeGroup, transactions, digestTime]);

  // 7. Automated Scheduled Fixed Expense Posting Engine
  // Checks active recurring bills against transaction history and automatically logs due expenses
  const autoProcessingScheduledRef = useRef(false);

  useEffect(() => {
    if (!activeGroup) return;
    if (userRole === 'viewer') return; // Viewer permissions cannot write expenses

    const processScheduledBills = async () => {
      if (autoProcessingScheduledRef.current) return;
      autoProcessingScheduledRef.current = true;

      try {
        const todayStr = getLocalTodayIso();
        const activeBills = recurringExpenses.filter(r => (r.status || 'active') === 'active');
        if (activeBills.length === 0) return;

        const isCloud = Boolean(user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group');
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const newTransactions: Transaction[] = [];

        for (const rec of activeBills) {
          const dueOccurrences = getDueOccurrences(rec, todayStr);
          for (const occDate of dueOccurrences) {
            const deterministicId = `tx_rec_${rec.id}_${occDate.replace(/-/g, '')}`;

            // Check if this occurrence is already logged in transactions
            const alreadyLogged = transactions.some(
              tx => tx.id === deterministicId ||
                    (tx.recurringExpenseId === rec.id && (tx.date === occDate || tx.recurringInstanceDate === occDate))
            ) || newTransactions.some(
              tx => tx.id === deterministicId ||
                    (tx.recurringExpenseId === rec.id && tx.date === occDate)
            );

            if (!alreadyLogged) {
              const freqLabel = rec.frequency 
                ? rec.frequency.charAt(0).toUpperCase() + rec.frequency.slice(1).toLowerCase() 
                : 'Monthly';
              const newTx: Transaction = {
                id: deterministicId,
                name: rec.name,
                category: rec.category || 'other',
                amount: rec.amount,
                date: occDate,
                settled: false,
                groupId: activeGroup.id,
                createdBy: user?.uid || 'guest',
                createdByName: user?.displayName || user?.email?.split('@')[0] || 'Scheduled Bill',
                recurringExpenseId: rec.id,
                recurringInstanceDate: occDate,
                createdAt: new Date().toISOString()
              };
              newTransactions.push(newTx);
            }
          }
        }

        if (newTransactions.length > 0) {
          // Optimistically update transactions in state and cache
          setTransactions(prev => [...newTransactions, ...prev]);
          const currentCached = getCachedExpenses(activeGroup.id);
          setCachedExpenses(activeGroup.id, [...newTransactions, ...currentCached]);

          if (isCloud && user) {
            for (const tx of newTransactions) {
              enqueueMutation({
                type: 'ADD_EXPENSE',
                groupId: activeGroup.id,
                targetId: tx.id,
                payload: tx
              }, user.uid);
            }
            if (!isOffline) {
              syncPendingMutations(user).catch(err => console.warn('Background sync note (recurring):', err));
            }
          } else {
            // Local / Guest persistence
            setLocalTransactions(prev => {
              const updated = [...newTransactions, ...prev];
              try {
                localStorage.setItem('expenses_transactions', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }

          showToast({
            message: newTransactions.length === 1 
              ? `Logged scheduled bill: "${newTransactions[0].name}" (₹${newTransactions[0].amount.toLocaleString('en-IN')})`
              : `Logged ${newTransactions.length} scheduled bills in Ledger`,
            subMessage: 'Recorded on scheduled occurrence date',
            type: 'info'
          });
        }
      } catch (err) {
        console.warn('Auto-processing scheduled expenses error:', err);
      } finally {
        autoProcessingScheduledRef.current = false;
      }
    };

    processScheduledBills();
    const interval = setInterval(processScheduledBills, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeGroup, recurringExpenses, transactions, userRole, user]);

  // Notification action handlers with instant optimistic UI update
  const handleMarkReadNotification = async (notificationId: string) => {
    if (!activeGroup) return;
    const currentUid = user?.uid || 'local_user';
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId
          ? { ...n, readBy: Array.from(new Set([...(n.readBy || []), currentUid])) }
          : n
      );
      if (!user || activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group') {
        localStorage.setItem(`hisaab_local_notifs_${activeGroup.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
      await markNotificationAsRead(activeGroup.id, notificationId, user.uid);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!activeGroup) return;
    const currentUid = user?.uid || 'local_user';
    setNotifications(prev => {
      const updated = prev.map(n => ({
        ...n,
        readBy: Array.from(new Set([...(n.readBy || []), currentUid]))
      }));
      if (!user || activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group') {
        localStorage.setItem(`hisaab_local_notifs_${activeGroup.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
      await markAllNotificationsAsRead(activeGroup.id, notifications, user.uid);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!activeGroup) return;
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      localStorage.setItem(`hisaab_local_notifs_${activeGroup.id}`, JSON.stringify(updated));
      return updated;
    });

    if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
      await deleteNotification(activeGroup.id, notificationId);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!activeGroup) return;
    const toClear = [...notifications];
    setNotifications([]);
    localStorage.removeItem(`hisaab_local_notifs_${activeGroup.id}`);

    if (user && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group') {
      try {
        await Promise.all(toClear.map(n => deleteNotification(activeGroup.id, n.id)));
      } catch (err) {
        console.warn('Could not clear all notifications from cloud:', err);
      }
    }
  };

  const handleSelectNotification = (notif: AppNotification) => {
    if (notif.type === 'BUYING_ITEM_ADDED') {
      setActiveTab('Lists');
    } else if (notif.type === 'DAILY_EXPENSE_SUMMARY') {
      setActiveTab('Overview');
    }
    if (activeGroup) {
      handleMarkReadNotification(notif.id);
    }
  };

  // Handler: Select active group
  const handleSelectGroup = (groupId: string, showToastFeedback = true) => {
    const isDifferent = groupId !== activeGroupId;
    setActiveGroupId(groupId);
    saveActiveGroupId(groupId, user?.uid);
    if (isDifferent) {
      const g = groups.find(item => item.id === groupId);
      if (g?.type === 'split') {
        if (activeTab === 'Lists' || activeTab === 'Fixed' || activeTab === 'Overview') {
          setActiveTab('Group');
        } else if (activeTab === 'Transactions') {
          setActiveTab('Individual');
        }
      } else {
        if (activeTab === 'Group') {
          setActiveTab('Overview');
        } else if (activeTab === 'Individual') {
          setActiveTab('Transactions');
        }
      }
      if (showToastFeedback && g) {
        const userEmail = (user?.email || '').toLowerCase().trim();
        const isOwner = g.createdBy === user?.uid || (g.ownerEmail && g.ownerEmail.toLowerCase() === userEmail);
        showToast({
          message: `Switched to "${g.name}"`,
          subMessage: isOwner ? 'Ledger Admin' : 'Ledger Member',
          type: 'ledger',
          duration: 2500
        });
      }
    }
  };

  const handleOpenSettleModal = (
    debtor: { key: string; name: string } | string,
    creditor: { key: string; name: string } | string,
    amount?: number
  ) => {
    let debtorObj: { key: string; name: string };
    let creditorObj: { key: string; name: string };

    if (typeof debtor === 'string') {
      const isMe = debtor === user?.uid || debtor === 'guest' || debtor === 'you';
      const mem = activeGroup?.members?.[debtor];
      debtorObj = {
        key: debtor,
        name: isMe ? 'You' : (mem?.displayName || mem?.email?.split('@')[0] || 'Member')
      };
    } else {
      debtorObj = debtor;
    }

    if (typeof creditor === 'string') {
      const isMe = creditor === user?.uid || creditor === 'guest' || creditor === 'you';
      const mem = activeGroup?.members?.[creditor];
      creditorObj = {
        key: creditor,
        name: isMe ? 'You' : (mem?.displayName || mem?.email?.split('@')[0] || 'Member')
      };
    } else {
      creditorObj = creditor;
    }

    setSettleDebtor(debtorObj);
    setSettleCreditor(creditorObj);
    setSettleAmount(amount || 0);
    setShowSettleModal(true);
  };

  // Handler: Add or Edit Expense with Instant Optimistic UI & Offline Sync
  const handleSaveExpense = async (data: {
    name: string;
    amount: number;
    category: string;
    date: string;
    groupId: string;
  }) => {
    const isEditOperation = Boolean(editingTx && editingTx.id && editingTx.id.trim().length > 0);
    const shoppingIdsToClean = convertingShoppingItemIds ? [...convertingShoppingItemIds] : [];
    const targetGroupId = data.groupId || activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const nowIso = new Date().toISOString();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isEditOperation && editingTx) {
      // 1. Edit existing transaction
      const editorName = user?.displayName || user?.email?.split('@')[0] || 'Member';
      const prevHistory = editingTx.editHistory || [];
      const updatedHistory = [{
        editedAt: nowIso,
        editedBy: user?.uid,
        editedByName: editorName,
        previousAmount: editingTx.amount,
        previousName: editingTx.name
      }, ...prevHistory].slice(0, 20);

      const updatedTx: Transaction = {
        ...editingTx,
        name: data.name.trim(),
        amount: data.amount,
        category: data.category,
        date: data.date,
        groupId: targetGroupId,
        lastEditedBy: user?.uid,
        lastEditedByName: editorName,
        lastEditedAt: nowIso,
        editCount: (editingTx.editCount || 0) + 1,
        editHistory: updatedHistory
      };

      // Instantly update state & persistent cache
      setTransactions(prev => prev.map(t => t.id === editingTx.id ? updatedTx : t));
      const currentCached = getCachedExpenses(targetGroupId);
      setCachedExpenses(targetGroupId, currentCached.map(t => t.id === editingTx.id ? updatedTx : t));

      // ONLY write to guest scratchpad if operating in guest/local mode
      if (isLocal) {
        setLocalTransactions(prev => {
          const updated = prev.map(t => t.id === editingTx.id ? updatedTx : t);
          try {
            localStorage.setItem('expenses_transactions', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      if (isCloud && user) {
        enqueueMutation({
          type: 'UPDATE_EXPENSE',
          groupId: targetGroupId,
          targetId: editingTx.id,
          payload: {
            name: data.name.trim(),
            amount: data.amount,
            category: data.category,
            date: data.date,
            lastEditedBy: user.uid,
            lastEditedByName: editorName,
            lastEditedAt: nowIso,
            editCount: updatedTx.editCount,
            editHistory: updatedHistory
          }
        }, user.uid);

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }

      const catData = categories[data.category] || { name: data.category || 'Expense', hex: '#1a73e8' };
      const formattedAmount = `₹${Number(data.amount).toLocaleString('en-IN')}`;

      showToast({
        message: isOffline ? `${formattedAmount} updated offline` : `${formattedAmount} updated`,
        subMessage: `${data.name.trim()} · ${catData.name}`,
        type: 'expense',
        amount: data.amount,
        category: data.category,
        categoryColor: catData.hex
      });
    } else {
      // 2. Add brand-new transaction
      const newTxId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newTx: Transaction = {
        id: newTxId,
        name: data.name.trim(),
        amount: data.amount,
        category: data.category,
        date: data.date,
        groupId: targetGroupId,
        settled: false,
        createdBy: user?.uid || 'guest',
        createdByName: user?.displayName || user?.email?.split('@')[0] || 'Member',
        createdAt: nowIso
      };

      // Instantly update state & persistent cache
      setTransactions(prev => [newTx, ...prev.filter(t => t.id !== newTxId)]);
      const currentCached = getCachedExpenses(targetGroupId);
      setCachedExpenses(targetGroupId, [newTx, ...currentCached.filter(t => t.id !== newTxId)]);

      // ONLY write to guest scratchpad if operating in guest/local mode
      if (isLocal) {
        setLocalTransactions(prev => {
          const updated = [newTx, ...prev.filter(t => t.id !== newTxId)];
          try {
            localStorage.setItem('expenses_transactions', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      // Clean up converted shopping items immediately in state & cache
      if (shoppingIdsToClean.length > 0) {
        setShoppingItems(prev => prev.filter(i => !shoppingIdsToClean.includes(i.id)));
        const cachedShop = getCachedShopping(targetGroupId);
        setCachedShopping(targetGroupId, cachedShop.filter(i => !shoppingIdsToClean.includes(i.id)));
        if (isLocal) {
          setLocalShopping(prev => prev.filter(i => !shoppingIdsToClean.includes(i.id)));
          try {
            localStorage.setItem('expenses_shopping_list', JSON.stringify(localShopping.filter(i => !shoppingIdsToClean.includes(i.id))));
          } catch {}
        }
      }

      if (isCloud && user) {
        enqueueMutation({
          type: 'ADD_EXPENSE',
          groupId: targetGroupId,
          targetId: newTx.id,
          payload: newTx
        }, user.uid);

        // Also enqueue deletion for converted shopping items
        for (const sId of shoppingIdsToClean) {
          enqueueMutation({
            type: 'DELETE_SHOPPING',
            groupId: targetGroupId,
            targetId: sId,
            payload: {}
          }, user.uid);
        }

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }

      const catData = categories[data.category] || { name: data.category || 'Expense', hex: '#1a73e8' };
      const formattedAmount = `₹${Number(data.amount).toLocaleString('en-IN')}`;
      const groupName = (groups.find(g => g.id === targetGroupId) || activeGroup)?.name || '';

      if (shoppingIdsToClean.length > 0) {
        showToast({
          message: isOffline ? `${formattedAmount} logged offline` : `${formattedAmount} logged from shopping list`,
          subMessage: `${data.name.trim()} · ${catData.name}`,
          type: 'expense',
          amount: data.amount,
          category: data.category,
          categoryColor: catData.hex
        });
      } else {
        showToast({
          message: isOffline ? `${formattedAmount} saved offline` : `${formattedAmount} added to ${catData.name}`,
          subMessage: groupName ? `${data.name.trim()} · ${groupName}` : data.name.trim(),
          type: 'expense',
          amount: data.amount,
          category: data.category,
          categoryColor: catData.hex
        });
      }
    }

    setConvertingShoppingItemIds(null);
    setEditingTx(null);
  };

  // Handler: Batch Import Expenses into Fresh Ledger
  const handleBatchImportExpenses = async (
    importedRows: ImportRowParsed[],
    newCategoriesToCreate?: Record<string, CategoryData>
  ) => {
    if (!importedRows || importedRows.length === 0) return;
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const groupName = (groups.find(g => g.id === targetGroupId) || activeGroup)?.name || 'Ledger';

    // If any new categories were created during import, merge them into the ledger's customCategories
    if (newCategoriesToCreate && Object.keys(newCategoriesToCreate).length > 0 && activeGroup) {
      const mergedCustom = {
        ...(activeGroup.customCategories || {}),
        ...newCategoriesToCreate
      };
      const updatedGroups = groups.map(g => g.id === activeGroup.id ? { ...g, customCategories: mergedCustom } : g);
      setGroups(updatedGroups);

      if (isLocal) {
        try {
          const savedLocal = localStorage.getItem('expenses_local_groups');
          if (savedLocal) {
            const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
            const next = parsed.map(g => g.id === activeGroup.id ? { ...g, customCategories: mergedCustom } : g);
            localStorage.setItem('expenses_local_groups', JSON.stringify(next));
          }
        } catch {}
      } else if (isCloud && user) {
        try {
          await updateGroupCustomCategories(activeGroup.id, mergedCustom);
        } catch (err) {
          console.warn('Could not update custom categories in cloud on import:', err);
        }
      }
    }

    const newTransactions: Transaction[] = [];
    const nowIso = new Date().toISOString();

    importedRows.forEach((row, idx) => {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`;
      const creatorUid = row.matchedMember?.uid || user?.uid || 'guest';
      const creatorName = row.matchedMember?.displayName || row.paidByName || user?.displayName || 'Member';

      const newTx: Transaction = {
        id: txId,
        name: row.name,
        category: row.category || 'other',
        amount: row.amount,
        date: row.date,
        settled: row.settled,
        groupId: targetGroupId,
        createdBy: creatorUid,
        createdByName: creatorName,
        paidBy: row.matchedMember?.uid || row.paidByEmail,
        paidByName: creatorName,
        note: row.note,
        createdAt: nowIso
      };

      newTransactions.push(newTx);
    });

    // 1. Instantly update local state & persistent cache
    setTransactions(prev => [...newTransactions, ...prev]);
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, [...newTransactions, ...currentCached]);

    // 2. Local guest storage update if offline/guest
    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = [...newTransactions, ...prev];
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    // 3. Queue cloud sync mutations if connected to Firestore
    if (isCloud && user) {
      for (const tx of newTransactions) {
        enqueueMutation({
          type: 'ADD_EXPENSE',
          groupId: targetGroupId,
          targetId: tx.id,
          payload: tx
        }, user.uid);
      }

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Batch import cloud sync note:', err));
      }
    }

    const totalAmount = newTransactions.reduce((acc, t) => acc + t.amount, 0);

    showToast({
      message: `${newTransactions.length} expenses imported`,
      subMessage: `₹${totalAmount.toLocaleString('en-IN')} added to ${groupName}`,
      type: 'expense'
    });
  };

  // Handler: Save Split Expense (Equal or Exact splits)
  const handleSaveSplitExpense = async (data: {
    name: string;
    amount: number;
    date: string;
    paidBy: string;
    paidByName: string;
    splitMode: 'equal' | 'exact';
    splitMembers: string[];
    splits: Record<string, number>;
    note?: string;
  }) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isEdit = Boolean(editingTx && editingTx.id && editingTx.id.trim().length > 0);
    const targetId = isEdit ? editingTx!.id : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const editorName = user?.displayName || user?.email?.split('@')[0] || 'Member';

    // Central Security & Lock Checks:
    if (isEdit && editingTx) {
      const editCheck = canEditExpense(editingTx, user, userRole, activeGroup, transactions);
      if (!editCheck.allowed) {
        showToast({
          message: editCheck.reason || 'You do not have permission to edit this expense.',
          type: 'error'
        });
        return;
      }

      const isMonetaryChanged = 
        Math.abs((editingTx.amount || 0) - data.amount) > 0.001 ||
        (editingTx.paidBy || '') !== data.paidBy ||
        (editingTx.splitMode || 'equal') !== data.splitMode ||
        JSON.stringify(editingTx.splitMembers || []) !== JSON.stringify(data.splitMembers || []);

      if (isMonetaryChanged) {
        const monCheck = canModifyExpenseMonetaryFields(editingTx, data.splitMembers, transactions, activeGroup, user);
        if (!monCheck.allowed) {
          showToast({
            message: monCheck.reason || 'Amount and split are locked because a payment was made after this expense. Undo the payment to change them.',
            type: 'error'
          });
          return;
        }
      }
    } else {
      const addCheck = canAddExpense(user, userRole, activeGroup);
      if (!addCheck.allowed) {
        showToast({
          message: addCheck.reason || 'Viewers cannot add expenses.',
          type: 'error'
        });
        return;
      }
    }

    const existingHistory = isEdit ? (editingTx?.editHistory || []) : [];
    const newEditRecord = isEdit ? [{
      editedAt: nowIso,
      editedBy: user?.uid,
      editedByName: editorName,
      previousAmount: editingTx?.amount,
      previousName: editingTx?.name
    }, ...existingHistory].slice(0, 20) : undefined;

    const splitTx: Transaction = {
      ...(isEdit ? editingTx : {}),
      id: targetId,
      name: data.name,
      amount: data.amount,
      category: 'split',
      date: data.date,
      settled: isEdit ? (editingTx?.settled ?? false) : false,
      groupId: targetGroupId,
      createdBy: isEdit ? (editingTx?.createdBy || user?.uid || 'guest') : (user?.uid || 'guest'),
      createdByName: isEdit ? (editingTx?.createdByName || editorName) : editorName,
      paidBy: data.paidBy,
      paidByName: data.paidByName,
      splitMode: data.splitMode,
      splitMembers: data.splitMembers,
      splits: data.splits,
      note: data.note,
      createdAt: isEdit ? (editingTx?.createdAt || nowIso) : nowIso,
      ...(isEdit ? {
        lastEditedBy: user?.uid,
        lastEditedByName: editorName,
        lastEditedAt: nowIso,
        editCount: (editingTx?.editCount || 0) + 1,
        editHistory: newEditRecord
      } : {})
    };

    // Optimistic update
    if (isEdit) {
      setTransactions(prev => prev.map(t => t.id === targetId ? splitTx : t));
    } else {
      setTransactions(prev => [splitTx, ...prev.filter(t => t.id !== targetId)]);
    }

    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(
      targetGroupId,
      isEdit 
        ? currentCached.map(t => t.id === targetId ? splitTx : t)
        : [splitTx, ...currentCached.filter(t => t.id !== targetId)]
    );

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = isEdit ? prev.map(t => t.id === targetId ? splitTx : t) : [splitTx, ...prev.filter(t => t.id !== targetId)];
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: isEdit ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE',
        groupId: targetGroupId,
        targetId: targetId,
        payload: splitTx
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }

      if (activeGroup) {
        dispatchSplitExpenseNotification(activeGroup, splitTx, user).catch(err => console.warn('Notification note:', err));
      }
    }

    showToast({
      message: isEdit ? 'Split bill updated' : `₹${data.amount.toLocaleString('en-IN')} split bill added`,
      subMessage: `${data.name} · Paid by ${data.paidByName}`,
      type: 'success'
    });
    setEditingTx(null);
  };

  // Handler: Update an existing split expense (for per-member settlement tracking)
  const handleUpdateSplitTx = async (updatedTx: Transaction) => {
    const targetGroupId = activeGroup?.id || activeGroupId || updatedTx.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.map(t => t.id === updatedTx.id ? updatedTx : t));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.map(t => t.id === updatedTx.id ? updatedTx : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'UPDATE_EXPENSE',
        groupId: targetGroupId,
        targetId: updatedTx.id,
        payload: updatedTx
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }
  };

  const handleTriggerTestSplitNotification = async () => {
    if (!activeGroup) return;
    try {
      await dispatchSettlementReminderNotification(
        activeGroup,
        'Group Members',
        1450,
        user
      );
      showToast({
        message: 'Test settlement reminder dispatched',
        subMessage: 'Checked real-time notifications',
        type: 'info'
      });
    } catch {}
  };

  const handleOpenQuickSettle = (
    debtor: { key: string; name: string },
    creditor: { key: string; name: string },
    amount: number
  ) => {
    setSettleDebtor(debtor);
    setSettleCreditor(creditor);
    setSettleAmount(amount);
    setShowSettleModal(true);
  };

  const handleDirectRecordSettlement = async (
    debtor: { key: string; name: string },
    creditor: { key: string; name: string },
    amount: number
  ) => {
    if (!activeGroup) return;
    try {
      const date = new Date().toISOString().split('T')[0];
      const settlementTx = await recordSettlementPayment(
        activeGroup.id,
        debtor,
        creditor,
        amount,
        date,
        'Direct peer settlement',
        user,
        activeGroup
      );

      if (settlementTx) {
        setTransactions(prev => [settlementTx, ...prev.filter(t => t.id !== settlementTx.id)]);
        const currentCached = getCachedExpenses(activeGroup.id);
        setCachedExpenses(activeGroup.id, [settlementTx, ...currentCached.filter(t => t.id !== settlementTx.id)]);
      }

      showToast({
        message: `₹${amount.toLocaleString('en-IN')} marked as settled`,
        subMessage: `${debtor.name} → ${creditor.name} · Open dues reconciled`,
        type: 'success',
        action: {
          label: 'Undo',
          onClick: () => {
            if (settlementTx?.id) {
              handleDeleteExpense(settlementTx.id, settlementTx);
            }
          }
        }
      });
    } catch (err: any) {
      showToast({
        message: 'Failed to record settlement',
        subMessage: err?.message || 'Please try again',
        type: 'error'
      });
    }
  };

  // Handler: Delete Expense / Move to Trash (Split group: soft delete with 30-day retention)
  const handleDeleteExpense = async (txId: string, explicitTargetTx?: Transaction) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const targetTx = explicitTargetTx || transactionsRef.current.find(t => t.id === txId) || transactions.find(t => t.id === txId);
    if (!targetTx) return;

    const isSplitGroup = activeGroup?.type === 'split' || targetTx.category === 'split' || Boolean(targetTx.splitMembers?.length) || Boolean(targetTx.isSettlement);
    const nowIso = new Date().toISOString();
    const deleterName = user?.displayName || user?.email?.split('@')[0] || 'Member';

    if (isSplitGroup) {
      // Central Security & Lock Checks:
      if (targetTx.isSettlement) {
        const undoCheck = canUndoSettlement(targetTx, user, userRole, activeGroup);
        if (!undoCheck.allowed) {
          showToast({
            message: undoCheck.reason || 'You do not have permission to undo this settlement.',
            type: 'error'
          });
          return;
        }
      } else {
        const delCheck = canDeleteExpense(targetTx, user, userRole, activeGroup, transactions);
        if (!delCheck.allowed) {
          showToast({
            message: delCheck.reason || "Can't delete this expense.",
            type: 'error'
          });
          return;
        }
      }

      // Split Group: Soft delete into Trash (kept for 30 days with full restore ability)
      const softDeletedTx: Transaction = {
        ...targetTx,
        isDeleted: true,
        deletedAt: nowIso,
        deletedBy: user?.uid || 'guest',
        deletedByName: deleterName,
        deletedReason: 'Deleted by member'
      };

      // 1. Prepare base transaction list with the soft-deleted transaction (pure append/soft-delete, never mutating other expenses)
      const currentTxs = transactionsRef.current;
      const updatedTransactionsList = currentTxs.some(t => t.id === txId)
        ? currentTxs.map(t => t.id === txId ? softDeletedTx : t)
        : [softDeletedTx, ...currentTxs.filter(t => t.id !== txId)];

      setTransactions(updatedTransactionsList);
      const currentCached = getCachedExpenses(targetGroupId);
      setCachedExpenses(targetGroupId, updatedTransactionsList);

      if (isLocal) {
        setLocalTransactions(updatedTransactionsList);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updatedTransactionsList));
        } catch {}
      }

      if (isCloud && user) {
        enqueueMutation({
          type: 'UPDATE_EXPENSE',
          groupId: targetGroupId,
          targetId: txId,
          payload: {
            isDeleted: true,
            deletedAt: nowIso,
            deletedBy: user.uid,
            deletedByName: deleterName,
            deletedReason: 'Deleted by member'
          }
        }, user.uid);

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }


      showToast({
        message: targetTx.isSettlement 
          ? 'Settlement undone · Debts reopened' 
          : 'Moved to Trash · Kept for 30 days',
        subMessage: `${targetTx.name} (₹${targetTx.amount.toLocaleString('en-IN')})`,
        type: 'info'
      });
      return;
    }

    // Standard Non-Split Expense: permanent deletion
    setTransactions(prev => prev.filter(t => t.id !== txId));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.filter(t => t.id !== txId));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.filter(t => t.id !== txId);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'DELETE_EXPENSE',
        groupId: targetGroupId,
        targetId: txId,
        payload: {}
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    showToast({
      message: isOffline ? 'Deleted offline · Saved on device' : 'Expense deleted',
      subMessage: `${targetTx.name} (₹${targetTx.amount.toLocaleString('en-IN')})`,
      type: 'info'
    });
  };

  // Handler: Restore a soft-deleted split transaction from Trash
  const handleRestoreExpense = async (txId: string) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx) return;

    // Central Security & Lock Checks:
    if (targetTx.isSettlement) {
      const restCheck = canRestoreSettlement(targetTx, user, userRole, activeGroup, transactions);
      if (!restCheck.allowed) {
        showToast({
          message: restCheck.reason || 'Cannot restore this settlement.',
          type: 'error'
        });
        return;
      }
    } else {
      const restCheck = canRestoreExpense(targetTx, user, userRole, activeGroup, transactions);
      if (!restCheck.allowed) {
        showToast({
          message: restCheck.reason || 'Cannot restore this expense.',
          type: 'error'
        });
        return;
      }
    }

    const restoredTx: Transaction = {
      ...targetTx,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedByName: undefined,
      deletedReason: undefined
    };

    setTransactions(prev => prev.map(t => t.id === txId ? restoredTx : t));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.map(t => t.id === txId ? restoredTx : t));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.map(t => t.id === txId ? restoredTx : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'UPDATE_EXPENSE',
        groupId: targetGroupId,
        targetId: txId,
        payload: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          deletedByName: null,
          deletedReason: null
        }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }


    showToast({
      message: 'Restored from Trash',
      subMessage: `${targetTx.name} (₹${targetTx.amount.toLocaleString('en-IN')})`,
      type: 'success'
    });
  };

  // Handler: Permanently delete transaction from Trash
  const handlePermanentDeleteExpense = async (txId: string) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const targetTx = transactions.find(t => t.id === txId);

    setTransactions(prev => prev.filter(t => t.id !== txId));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.filter(t => t.id !== txId));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.filter(t => t.id !== txId);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'DELETE_EXPENSE',
        groupId: targetGroupId,
        targetId: txId,
        payload: {}
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    showToast({
      message: 'Permanently deleted',
      subMessage: targetTx ? `${targetTx.name} (₹${targetTx.amount.toLocaleString('en-IN')})` : undefined,
      type: 'info'
    });
  };

  // Handler: Settle Expense (Mark as Refunded / Returned)
  const handleSaveSettlement = async (refundAmount: number, note: string) => {
    if (!settleTx) return;
    const targetGroupId = activeGroup?.id || activeGroupId || settleTx.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const netAmount = Math.max(0, settleTx.amount - refundAmount);
    const isFullRefund = refundAmount >= settleTx.amount;

    const updatedTx: Transaction = {
      ...settleTx,
      settled: true,
      originalAmount: settleTx.originalAmount || settleTx.amount,
      amount: netAmount,
      note: note || 'Refunded / Returned'
    };

    setTransactions(prev => prev.map(t => t.id === settleTx.id ? updatedTx : t));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.map(t => t.id === settleTx.id ? updatedTx : t));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.map(t => t.id === settleTx.id ? updatedTx : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'SETTLE_EXPENSE',
        groupId: targetGroupId,
        targetId: settleTx.id,
        payload: {
          settled: true,
          originalAmount: updatedTx.originalAmount,
          amount: netAmount,
          note: updatedTx.note
        }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    showToast({
      message: isOffline ? 'Saved offline · Saved on device' : (isFullRefund ? 'Expense marked as fully refunded' : 'Partial refund recorded'),
      subMessage: isFullRefund ? '₹0 balance remaining in ledger' : `₹${netAmount.toLocaleString('en-IN')} remaining in ledger`,
      type: 'success'
    });
  };

  // Handler: Undo Settle / Undo Refund Expense or Undo Settlement Payment
  const handleUndoSettle = async (tx: Transaction) => {
    if (tx.isSettlement) {
      await handleDeleteExpense(tx.id);
      return;
    }

    const targetGroupId = activeGroup?.id || activeGroupId || tx.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const restoredTx: Transaction = {
      ...tx,
      settled: false,
      settledMembers: [],
      amount: tx.originalAmount || tx.amount,
      note: (tx.note?.toLowerCase().trim() === 'settled' || tx.note?.toLowerCase().trim() === 'refunded / returned' || tx.note?.toLowerCase().trim() === 'full refund' || tx.note?.toLowerCase().trim() === '50% refund') ? '' : (tx.note || '')
    };

    setTransactions(prev => prev.map(t => t.id === tx.id ? restoredTx : t));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.map(t => t.id === tx.id ? restoredTx : t));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.map(t => t.id === tx.id ? restoredTx : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'UNDO_SETTLE_EXPENSE',
        groupId: targetGroupId,
        targetId: tx.id,
        payload: {
          settled: false,
          settledMembers: [],
          amount: restoredTx.amount,
          note: restoredTx.note
        }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    showToast({
      message: 'Refund undone · Expense restored',
      subMessage: `₹${restoredTx.amount.toLocaleString('en-IN')} active in ledger`,
      type: 'info'
    });
  };

  // Handler: Quick Settle Expense (1-tap toggle to settled)
  const handleQuickSettle = async (tx: Transaction) => {
    const targetGroupId = activeGroup?.id || activeGroupId || tx.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const allMembers = tx.splitMembers && tx.splitMembers.length > 0 ? tx.splitMembers : [];
    const updatedTx: Transaction = {
      ...tx,
      settled: true,
      settledMembers: allMembers,
      originalAmount: tx.originalAmount || tx.amount,
      note: tx.note || ''
    };

    setTransactions(prev => prev.map(t => t.id === tx.id ? updatedTx : t));
    const currentCached = getCachedExpenses(targetGroupId);
    setCachedExpenses(targetGroupId, currentCached.map(t => t.id === tx.id ? updatedTx : t));

    if (isLocal) {
      setLocalTransactions(prev => {
        const updated = prev.map(t => t.id === tx.id ? updatedTx : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'SETTLE_EXPENSE',
        groupId: targetGroupId,
        targetId: tx.id,
        payload: {
          settled: true,
          originalAmount: updatedTx.originalAmount,
          amount: updatedTx.amount,
          note: updatedTx.note
        }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    showToast({
      message: 'Expense marked as settled',
      subMessage: 'Status changed to settled',
      type: 'success'
    });
  };

  // Handler: Shopping items with Instant Optimistic UI & Infinite Offline Capability
  const handleAddShoppingItem = async (
    name: string,
    options?: { category?: string; byWhen?: string }
  ) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const finalCategory = options?.category || 'other';
    const finalByWhen = options?.byWhen || 'whenever';
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const nowIso = new Date().toISOString();
    const nowDate = nowIso.split('T')[0];
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const newItemId = `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: ShoppingItem = {
      id: newItemId,
      name: cleanName,
      status: 'pending',
      date: nowDate,
      groupId: targetGroupId,
      category: finalCategory,
      byWhen: finalByWhen,
      createdBy: user?.uid || 'guest',
      createdAt: nowIso
    };

    // 1. Immediately update React state optimistically
    setShoppingItems(prev => [newItem, ...prev.filter(i => i.id !== newItemId)]);

    // 2. Immediately write to persistent cache for this ledger
    const currentCached = getCachedShopping(targetGroupId);
    setCachedShopping(targetGroupId, [newItem, ...currentCached.filter(i => i.id !== newItemId)]);

    // Only persist for guest sandbox if isLocal
    if (isLocal) {
      setLocalShopping(prev => [newItem, ...prev.filter(i => i.id !== newItemId)]);
      try {
        localStorage.setItem('expenses_shopping_list', JSON.stringify([newItem, ...localShopping.filter(i => i.id !== newItemId)]));
      } catch {}
    }

    // 3. If signed-in to cloud ledger, enqueue mutation and trigger non-blocking background sync
    if (isCloud && user) {
      enqueueMutation({
        type: 'ADD_SHOPPING',
        groupId: targetGroupId,
        targetId: newItemId,
        payload: newItem
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    // 4. Notifications & user feedback
    const catData = categories[finalCategory] || { name: 'Other', hex: '#AB47BC' };
    if (isOffline) {
      showToast({
        message: `"${cleanName}" added`,
        subMessage: 'Saved offline on device',
        type: 'shopping',
        category: finalCategory,
        categoryColor: catData.hex
      });
    } else {
      showToast({
        message: `"${cleanName}" added`,
        subMessage: activeGroup?.name ? `Shopping · ${activeGroup.name}` : 'Shopping list',
        type: 'shopping',
        category: finalCategory,
        categoryColor: catData.hex
      });
      if (activeGroup) {
        dispatchBuyingItemNotification(activeGroup, newItem, user).catch(() => {});
      }
    }
  };

  const handleToggleShoppingItem = async (item: ShoppingItem) => {
    const targetGroupId = activeGroup?.id || activeGroupId || item.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const nextStatus = item.status === 'pending' ? 'bought' : 'pending';

    // Instantly update state & persistent cache
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));
    const currentCached = getCachedShopping(targetGroupId);
    setCachedShopping(targetGroupId, currentCached.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));

    if (isLocal) {
      setLocalShopping(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));
      try {
        localStorage.setItem('expenses_shopping_list', JSON.stringify(localShopping.map(i => i.id === item.id ? { ...i, status: nextStatus } : i)));
      } catch {}
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'TOGGLE_SHOPPING',
        groupId: targetGroupId,
        targetId: item.id,
        payload: { status: nextStatus }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }
  };

  const handleUpdateShoppingItem = async (
    itemId: string,
    updates: { name: string; category?: string; byWhen?: string }
  ) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const cleanUpdates = {
      name: updates.name.trim(),
      category: updates.category || 'other',
      byWhen: updates.byWhen || 'whenever'
    };

    // Instantly update state & persistent cache
    setShoppingItems(prev => prev.map(i => i.id === itemId ? { ...i, ...cleanUpdates } : i));
    const currentCached = getCachedShopping(targetGroupId);
    setCachedShopping(targetGroupId, currentCached.map(i => i.id === itemId ? { ...i, ...cleanUpdates } : i));

    if (isLocal) {
      setLocalShopping(prev => prev.map(i => i.id === itemId ? { ...i, ...cleanUpdates } : i));
      try {
        localStorage.setItem('expenses_shopping_list', JSON.stringify(localShopping.map(i => i.id === itemId ? { ...i, ...cleanUpdates } : i)));
      } catch {}
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'UPDATE_SHOPPING',
        groupId: targetGroupId,
        targetId: itemId,
        payload: cleanUpdates
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    setToastMessage(isOffline ? 'Updated offline · Saved on device' : 'Item updated');
  };

  const handleDeleteShoppingItem = async (itemId: string) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // Instantly remove from state & cache
    setShoppingItems(prev => prev.filter(i => i.id !== itemId));
    const currentCached = getCachedShopping(targetGroupId);
    setCachedShopping(targetGroupId, currentCached.filter(i => i.id !== itemId));

    if (isLocal) {
      setLocalShopping(prev => prev.filter(i => i.id !== itemId));
      try {
        localStorage.setItem('expenses_shopping_list', JSON.stringify(localShopping.filter(i => i.id !== itemId)));
      } catch {}
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'DELETE_SHOPPING',
        groupId: targetGroupId,
        targetId: itemId,
        payload: {}
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    setToastMessage(isOffline ? 'Deleted offline · Saved on device' : 'Item deleted');
  };

  const handleConvertBoughtToExpense = (itemsToConvert: ShoppingItem[]) => {
    if (!itemsToConvert || itemsToConvert.length === 0) return;
    const summary = itemsToConvert.map(i => i.name).join(', ');
    // Category uniformity check: if all items share the exact same category, use it; otherwise default to 'other'
    const firstCategory = itemsToConvert[0]?.category;
    const isUniform = Boolean(
      firstCategory &&
      itemsToConvert.every(i => Boolean(i.category) && i.category === firstCategory)
    );
    const detectedCategory = isUniform && firstCategory && (firstCategory in categories || categories[firstCategory])
      ? firstCategory
      : 'other';
    setConvertingShoppingItemIds(itemsToConvert.map(i => i.id));
    setEditingTx({
      id: '',
      name: summary,
      amount: 0,
      category: detectedCategory,
      date: new Date().toISOString().split('T')[0],
      groupId: activeGroup?.id || '',
      settled: false
    });
    setShowExpenseModal(true);
  };

  // Handler: Recurring Expenses with Instant Optimistic UI & Offline Sync
  const handleSaveRecurring = async (data: {
    id?: string;
    name: string;
    amount: number;
    category: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    groupId: string;
  }) => {
    const targetGroupId = data.groupId || activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (data.id) {
      // Edit existing recurring expense
      const recId = data.id;
      const existing = recurringExpenses.find(r => r.id === recId);
      const updates: Partial<RecurringExpense> = {
        name: data.name.trim(),
        amount: data.amount,
        category: data.category,
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate
      };
      if (existing && existing.startDate !== data.startDate) {
        updates.resumedAt = undefined;
      }

      setRecurringExpenses(prev => prev.map(r => r.id === recId ? { ...r, ...updates } : r));
      const currentCached = getCachedRecurring(targetGroupId);
      setCachedRecurring(targetGroupId, currentCached.map(r => r.id === recId ? { ...r, ...updates } : r));

      if (isLocal) {
        setLocalRecurring(prev => prev.map(r => r.id === recId ? { ...r, ...updates } : r));
        try {
          localStorage.setItem('expenses_recurring', JSON.stringify(localRecurring.map(r => r.id === recId ? { ...r, ...updates } : r)));
        } catch {}
      }

      if (isCloud && user) {
        enqueueMutation({
          type: 'UPDATE_RECURRING',
          groupId: targetGroupId,
          targetId: recId,
          payload: updates
        }, user.uid);

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }

      setToastMessage(isOffline ? 'Scheduled bill updated offline · Saved on device' : 'Scheduled bill updated');
    } else {
      // Add new recurring expense
      const newRecId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newRec: RecurringExpense = {
        id: newRecId,
        name: data.name.trim(),
        amount: data.amount,
        category: data.category,
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'active',
        groupId: targetGroupId,
        createdBy: user?.uid || 'guest',
        createdAt: new Date().toISOString()
      };

      setRecurringExpenses(prev => [newRec, ...prev.filter(r => r.id !== newRecId)]);
      const currentCached = getCachedRecurring(targetGroupId);
      setCachedRecurring(targetGroupId, [newRec, ...currentCached.filter(r => r.id !== newRecId)]);

      if (isLocal) {
        setLocalRecurring(prev => [newRec, ...prev.filter(r => r.id !== newRecId)]);
        try {
          localStorage.setItem('expenses_recurring', JSON.stringify([newRec, ...localRecurring.filter(r => r.id !== newRecId)]));
        } catch {}
      }

      if (isCloud && user) {
        enqueueMutation({
          type: 'ADD_RECURRING',
          groupId: targetGroupId,
          targetId: newRecId,
          payload: newRec
        }, user.uid);

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }

      setToastMessage(isOffline ? 'Scheduled bill added offline · Saved on device' : 'Scheduled bill added');
    }
  };

  const handleToggleRecurringStatus = async (rec: RecurringExpense) => {
    const targetGroupId = activeGroup?.id || activeGroupId || rec.groupId || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const todayStr = getLocalTodayIso();
    const isActivating = (rec.status || 'active') === 'cancelled';
    const nextStatus = (isActivating ? 'active' : 'cancelled') as 'active' | 'cancelled';

    const updatedRec: RecurringExpense = {
      ...rec,
      status: nextStatus,
      pausedAt: !isActivating ? todayStr : rec.pausedAt,
      resumedAt: isActivating ? todayStr : rec.resumedAt
    };

    setRecurringExpenses(prev => prev.map(r => r.id === rec.id ? updatedRec : r));
    const currentCached = getCachedRecurring(targetGroupId);
    setCachedRecurring(targetGroupId, currentCached.map(r => r.id === rec.id ? updatedRec : r));

    if (isLocal) {
      setLocalRecurring(prev => prev.map(r => r.id === rec.id ? updatedRec : r));
      try {
        localStorage.setItem('expenses_recurring', JSON.stringify(localRecurring.map(r => r.id === rec.id ? updatedRec : r)));
      } catch {}
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'TOGGLE_RECURRING',
        groupId: targetGroupId,
        targetId: rec.id,
        payload: {
          status: nextStatus,
          pausedAt: updatedRec.pausedAt || null,
          resumedAt: updatedRec.resumedAt || null
        }
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    if (isActivating) {
      const nextDate = getNextOccurrenceDate(updatedRec, todayStr);
      if (nextDate === todayStr) {
        setToastMessage('Bill reactivated · Due today');
      } else if (nextDate) {
        const [y, m, d] = nextDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const formatted = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        setToastMessage(`Bill reactivated · Next on ${formatted}`);
      } else {
        setToastMessage('Bill reactivated');
      }
    } else {
      setToastMessage('Bill paused');
    }
  };

  const handleDeleteRecurring = async (recId: string) => {
    const targetGroupId = activeGroup?.id || activeGroupId || (groups[0]?.id) || 'local_group';
    const isCloud = Boolean(user && !targetGroupId.startsWith('local_') && targetGroupId !== 'local_group');
    const isLocal = !isCloud;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    setRecurringExpenses(prev => prev.filter(r => r.id !== recId));
    const currentCached = getCachedRecurring(targetGroupId);
    setCachedRecurring(targetGroupId, currentCached.filter(r => r.id !== recId));

    if (isLocal) {
      setLocalRecurring(prev => prev.filter(r => r.id !== recId));
      try {
        localStorage.setItem('expenses_recurring', JSON.stringify(localRecurring.filter(r => r.id !== recId)));
      } catch {}
    }

    if (isCloud && user) {
      enqueueMutation({
        type: 'DELETE_RECURRING',
        groupId: targetGroupId,
        targetId: recId,
        payload: {}
      }, user.uid);

      if (!isOffline) {
        syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
      }
    }

    setToastMessage('Recurring bill removed');
  };

  // Handler: 1-click Local Data Sync to Active Cloud Group
  const handleSyncLocalData = async (): Promise<number> => {
    if (!user || !activeGroup) throw new Error('Not authenticated');

    // Collect custom categories from offline groups without duplication
    let offlineCategories: Record<string, CategoryData> = {};
    try {
      const savedLocal = localStorage.getItem('expenses_local_groups');
      if (savedLocal) {
        const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
        parsed.forEach(g => {
          if (g.customCategories) {
            offlineCategories = { ...offlineCategories, ...g.customCategories };
          }
        });
      }
    } catch {}

    const count = await syncLocalDataToGroup(
      activeGroup.id,
      user,
      genuineGuestTransactions,
      genuineGuestShopping,
      genuineGuestRecurring
    );

    // Merge custom categories into destination cloud group
    if (Object.keys(offlineCategories).length > 0) {
      const mergedCustom = { ...(activeGroup.customCategories || {}), ...offlineCategories };
      await updateGroupCustomCategories(activeGroup.id, mergedCustom).catch(console.warn);
      const updatedGroups = groups.map(g => g.id === activeGroup.id ? { ...g, customCategories: mergedCustom } : g);
      setGroups(updatedGroups);
      try {
        localStorage.setItem(`hisaab_cloud_groups_${user.uid}`, JSON.stringify(updatedGroups));
      } catch {}
    }

    // Clear local scratchpad and legacy device categories completely
    localStorage.removeItem('expenses_transactions');
    localStorage.removeItem('expenses_shopping_list');
    localStorage.removeItem('expenses_recurring');
    localStorage.removeItem('expenses_local_groups');
    localStorage.removeItem('hisaab_categories');
    setLocalTransactions([]);
    setLocalShopping([]);
    setLocalRecurring([]);
    setToastMessage(`Synced ${count} offline ${count === 1 ? 'record' : 'records'} to ${activeGroup.name}`);
    return count;
  };

  // Handler: Merge offline entries to chosen destination cloud group
  const handleMergeOfflineData = async (targetGroupId: string): Promise<number> => {
    if (!user) throw new Error('Not authenticated');
    const targetGroup = groups.find(g => g.id === targetGroupId);

    // Collect custom categories from offline groups
    let offlineCategories: Record<string, CategoryData> = {};
    try {
      const savedLocal = localStorage.getItem('expenses_local_groups');
      if (savedLocal) {
        const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
        parsed.forEach(g => {
          if (g.customCategories) {
            offlineCategories = { ...offlineCategories, ...g.customCategories };
          }
        });
      }
    } catch {}

    const count = await syncLocalDataToGroup(
      targetGroupId,
      user,
      genuineGuestTransactions,
      genuineGuestShopping,
      genuineGuestRecurring
    );

    // Merge offline custom categories into chosen destination ledger
    if (Object.keys(offlineCategories).length > 0 && targetGroup) {
      const mergedCustom = { ...(targetGroup.customCategories || {}), ...offlineCategories };
      await updateGroupCustomCategories(targetGroupId, mergedCustom).catch(console.warn);
      const updatedGroups = groups.map(g => g.id === targetGroupId ? { ...g, customCategories: mergedCustom } : g);
      setGroups(updatedGroups);
      try {
        localStorage.setItem(`hisaab_cloud_groups_${user.uid}`, JSON.stringify(updatedGroups));
      } catch {}
    }

    // Clean local storage scratchpad and local groups completely
    localStorage.removeItem('expenses_transactions');
    localStorage.removeItem('expenses_shopping_list');
    localStorage.removeItem('expenses_recurring');
    localStorage.removeItem('expenses_local_groups');
    localStorage.removeItem('hisaab_categories');
    setLocalTransactions([]);
    setLocalShopping([]);
    setLocalRecurring([]);
    setActiveGroupId(targetGroupId);
    localStorage.setItem('hisaab_active_group_id', targetGroupId);
    setToastMessage(`Merged ${count} offline ${count === 1 ? 'entry' : 'entries'} into ${targetGroup?.name || 'ledger'}`);
    return count;
  };

  // Handler: Create new cloud group and merge offline entries into it
  const handleCreateNewAndMergeOfflineData = async (newLedgerName: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    // Collect custom categories from offline groups
    let offlineCategories: Record<string, CategoryData> = {};
    try {
      const savedLocal = localStorage.getItem('expenses_local_groups');
      if (savedLocal) {
        const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
        parsed.forEach(g => {
          if (g.customCategories) {
            offlineCategories = { ...offlineCategories, ...g.customCategories };
          }
        });
      }
    } catch {}

    const created = await createGroup(newLedgerName, user);

    if (Object.keys(offlineCategories).length > 0) {
      await updateGroupCustomCategories(created.id, offlineCategories).catch(console.warn);
      created.customCategories = offlineCategories;
    }

    const updatedGroups = [created, ...groups.filter(g => g.id !== created.id)];
    setGroups(updatedGroups);
    try {
      localStorage.setItem(`hisaab_cloud_groups_${user.uid}`, JSON.stringify(updatedGroups));
    } catch {}

    const count = await syncLocalDataToGroup(
      created.id,
      user,
      genuineGuestTransactions,
      genuineGuestShopping,
      genuineGuestRecurring
    );

    // Clean local storage completely
    localStorage.removeItem('expenses_transactions');
    localStorage.removeItem('expenses_shopping_list');
    localStorage.removeItem('expenses_recurring');
    localStorage.removeItem('expenses_local_groups');
    localStorage.removeItem('hisaab_categories');
    setLocalTransactions([]);
    setLocalShopping([]);
    setLocalRecurring([]);
    setActiveGroupId(created.id);
    saveActiveGroupId(created.id, user.uid);
    setToastMessage(`Created "${created.name}" with ${count} offline entries`);
  };

  // Handler: Discard offline entries and clean scratchpad
  const handleDiscardOfflineData = () => {
    localStorage.removeItem('expenses_transactions');
    localStorage.removeItem('expenses_shopping_list');
    localStorage.removeItem('expenses_recurring');
    localStorage.removeItem('expenses_local_groups');
    localStorage.removeItem('hisaab_categories');
    setLocalTransactions([]);
    setLocalShopping([]);
    setLocalRecurring([]);
    setToastMessage('Offline entries cleared');
  };

  // Handler: Delete Category and safely reassign all tagged expenses, shopping items, and recurring bills to 'other' in the active ledger
  const handleDeleteCategory = async (catKey: string) => {
    if (catKey === 'other' || !activeGroup) return;
    const catData = categories[catKey];

    // 1. Remove category from active group's customCategories
    const updatedCustom = { ...(activeGroup.customCategories || {}) };
    delete updatedCustom[catKey];

    // Optimistically update React groups state & offline cache
    const updatedGroups = groups.map(g => g.id === activeGroup.id ? { ...g, customCategories: updatedCustom } : g);
    setGroups(updatedGroups);
    if (user) {
      try {
        localStorage.setItem(`hisaab_cloud_groups_${user.uid}`, JSON.stringify(updatedGroups));
      } catch {}
    }

    // 2. Count affected records in this active ledger
    const affectedTx = transactions.filter(t => (t.category || 'other') === catKey);
    const affectedShop = shoppingItems.filter(s => (s.category || 'other') === catKey);
    const affectedRec = recurringExpenses.filter(r => (r.category || 'other') === catKey);
    const totalAffected = affectedTx.length + affectedShop.length + affectedRec.length;

    // 3. Update React active state immediately with optimistic reassignment
    setTransactions(prev => prev.map(t => (t.category || 'other') === catKey ? { ...t, category: 'other' } : t));
    setShoppingItems(prev => prev.map(s => (s.category || 'other') === catKey ? { ...s, category: 'other' } : s));
    setRecurringExpenses(prev => prev.map(r => (r.category || 'other') === catKey ? { ...r, category: 'other' } : r));

    // 4. Update local storage records for this active group
    if (activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group') {
      setLocalTransactions(prev => {
        const updated = prev.map(t => ((t.groupId || 'local_group') === activeGroup.id && (t.category || 'other') === catKey) ? { ...t, category: 'other' } : t);
        try {
          localStorage.setItem('expenses_transactions', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setLocalShopping(prev => {
        const updated = prev.map(s => ((s.groupId || 'local_group') === activeGroup.id && (s.category || 'other') === catKey) ? { ...s, category: 'other' } : s);
        try {
          localStorage.setItem('expenses_shopping_list', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setLocalRecurring(prev => {
        const updated = prev.map(r => ((r.groupId || 'local_group') === activeGroup.id && (r.category || 'other') === catKey) ? { ...r, category: 'other' } : r);
        try {
          localStorage.setItem('expenses_recurring', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      try {
        const savedLocal = localStorage.getItem('expenses_local_groups');
        if (savedLocal) {
          const parsed: ExpenseGroup[] = JSON.parse(savedLocal);
          const next = parsed.map(g => g.id === activeGroup.id ? { ...g, customCategories: updatedCustom } : g);
          localStorage.setItem('expenses_local_groups', JSON.stringify(next));
        }
      } catch (e) {
        console.warn('Could not save local group categories on delete:', e);
      }
    } else {
      // 5. Cloud group: update customCategories in Firestore and reassign cloud items for this group
      try {
        await updateGroupCustomCategories(activeGroup.id, updatedCustom);
      } catch (err) {
        console.warn('Could not update group customCategories in Firestore:', err);
      }

      // Reassign category in Firestore cloud group
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (!isOffline && user) {
        reassignCategoryInCloudGroup(activeGroup.id, catKey, 'other').catch(err => {
          console.warn(`Category reassign in cloud group ${activeGroup.id} notice:`, err);
        });
      }

      // Enqueue mutations for offline resilience
      if (user) {
        affectedTx.forEach(tx => {
          enqueueMutation({
            type: 'UPDATE_EXPENSE',
            groupId: activeGroup.id,
            targetId: tx.id,
            payload: { category: 'other' }
          }, user.uid);
        });

        affectedShop.forEach(s => {
          enqueueMutation({
            type: 'UPDATE_SHOPPING',
            groupId: activeGroup.id,
            targetId: s.id,
            payload: { category: 'other' }
          }, user.uid);
        });

        affectedRec.forEach(r => {
          enqueueMutation({
            type: 'UPDATE_RECURRING',
            groupId: activeGroup.id,
            targetId: r.id,
            payload: { category: 'other' }
          }, user.uid);
        });

        if (!isOffline) {
          syncPendingMutations(user).catch(err => console.warn('Background sync note:', err));
        }
      }

      // Update cached items for this group
      const cachedTx = getCachedExpenses(activeGroup.id);
      if (cachedTx.some(t => (t.category || 'other') === catKey)) {
        setCachedExpenses(activeGroup.id, cachedTx.map(t => (t.category || 'other') === catKey ? { ...t, category: 'other' } : t));
      }
      const cachedShop = getCachedShopping(activeGroup.id);
      if (cachedShop.some(s => (s.category || 'other') === catKey)) {
        setCachedShopping(activeGroup.id, cachedShop.map(s => (s.category || 'other') === catKey ? { ...s, category: 'other' } : s));
      }
      const cachedRec = getCachedRecurring(activeGroup.id);
      if (cachedRec.some(r => (r.category || 'other') === catKey)) {
        setCachedRecurring(activeGroup.id, cachedRec.map(r => (r.category || 'other') === catKey ? { ...r, category: 'other' } : r));
      }
    }

    // 6. Visual toast feedback
    showToast({
      message: `"${catData?.name || 'Category'}" deleted`,
      subMessage: totalAffected > 0 
        ? `${totalAffected} ${totalAffected === 1 ? 'item' : 'items'} changed to Other`
        : `Removed from ${activeGroup.name}`,
      type: 'info'
    });
  };

  const hasLocalData = genuineGuestTransactions.length > 0 || genuineGuestShopping.length > 0 || genuineGuestRecurring.length > 0;

  // Premium Apple & Google splash screen during initial authentication resolution
  if (authLoading && groups.length === 0) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] w-full bg-bg-main text-text-primary flex flex-col items-center justify-center font-sans p-4 select-none">
        <div className="flex flex-col items-center gap-3.5 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-google-blue text-white flex items-center justify-center shadow-lg shadow-google-blue/20">
            <Wallet size={26} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-base font-semibold tracking-tight text-text-primary">
              Hisaab Barabar
            </span>
            <span className="text-xs text-text-secondary">
              Syncing your ledgers...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show Landing Page for unauthenticated visitors
  if (!user && !guestMode) {
    return (
      <>
        <LandingPage
          onSignIn={async () => {
            try {
              await signInWithGoogle();
            } catch (err) {
              console.warn(err);
            }
          }}
          onExploreGuest={() => {
            try {
              localStorage.setItem('hisaab_barabar_onboarding_viewed', 'true');
              localStorage.setItem('hisaab_guest_mode', 'true');
            } catch {}
            setShowOnboardingModal(false);
            setGuestMode(true);
          }}
          onOpenJoin={() => setShowJoinModal(true)}
          themeMode={themeMode}
          darkMode={resolvedDarkMode}
          onCycleThemeMode={handleCycleTheme}
          onToggleDarkMode={handleCycleTheme}
        />

        <JoinGroupModal
          isOpen={showJoinModal}
          groups={groups}
          onClose={() => {
            setShowJoinModal(false);
            setInitialJoinCode('');
            setInitialJoinType('');
            setInitialJoinName('');
          }}
          onJoined={(groupId, groupName) => {
            setGuestMode(true);
            handleSelectGroup(groupId);
            setShowJoinModal(false);
            setInitialJoinCode('');
            setInitialJoinType('');
            setInitialJoinName('');
            showToast({
              message: groupName ? `Joined "${groupName}"` : 'Joined shared ledger',
              subMessage: 'Joined with View Only access • Admin can grant Can Edit permissions',
              type: 'ledger',
              duration: 3500
            });
          }}
          initialCode={initialJoinCode}
          initialType={initialJoinType}
          initialName={initialJoinName}
        />
      </>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-bg-main text-text-primary flex flex-col font-sans selection:bg-google-blue/20 selection:text-google-blue overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        groups={groups}
        activeGroup={activeGroup}
        userRole={userRole}
        onOpenGroupModal={handleOpenGroupModal}
        onOpenJoinModal={() => setShowJoinModal(true)}
        onOpenInviteModal={handleOpenInviteModal}
        onSelectGroup={handleSelectGroup}
        onShowToast={showToast}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingSyncCount={pendingSyncCount}
        themeMode={themeMode}
        onCycleThemeMode={handleCycleTheme}
        darkMode={resolvedDarkMode}
        onToggleDarkMode={handleCycleTheme}
        notifications={notifications}
        onMarkReadNotification={handleMarkReadNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onClearAllNotifications={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        onSelectNotification={handleSelectNotification}
        onTriggerTestDailyDigest={() => handleTriggerDailyDigest(true)}
        onTriggerTestSplitNotification={handleTriggerTestSplitNotification}
        pushPermission={pushPermission}
        onRequestPushPermission={handleRequestPushPermission}
        digestTime={digestTime}
        isStandalone={isStandalone}
        onOpenInstallModal={() => setShowInstallModal(true)}
        onOpenProfileSetup={() => setShowProfileSetupModal(true)}
      />

      {/* Main Tab Content */}
      <main ref={mainContentRef} className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 md:px-8 py-3.5 sm:py-5 overflow-y-auto overscroll-contain no-scrollbar">
        {activeGroup?.type === 'split' ? (
          /* Split / Contri Ledger Views */
          (activeTab === 'Individual' || activeTab === 'Transactions') ? (
            <SplitIndividualView
              group={activeGroup}
              transactions={transactions}
              userRole={userRole}
              onOpenSettleModal={handleOpenSettleModal}
              onRecordSettlement={handleDirectRecordSettlement}
              onOpenInviteModal={handleOpenInviteModal}
              onOpenAddExpense={() => {
                setEditingTx(null);
                setShowSplitExpenseModal(true);
              }}
              onShowToast={showToast}
            />
          ) : activeTab === 'Settings' ? (
            <SettingsTab
              themeMode={themeMode}
              onSelectThemeMode={setThemeMode}
              darkMode={resolvedDarkMode}
              onToggleDarkMode={handleCycleTheme}
              activeGroup={activeGroup}
              groups={groups}
              userRole={userRole}
              onOpenGroupModal={handleOpenGroupModal}
              onOpenCategoryModal={(tab = 'manage') => {
                setCategoryModalTab(tab);
                setShowCategoryModal(true);
              }}
              onDeleteCategory={handleDeleteCategory}
              categories={categories}
              transactions={transactions}
              shoppingItems={shoppingItems}
              recurringExpenses={recurringExpenses}
              onSyncLocalData={handleSyncLocalData}
              hasLocalData={hasLocalData}
              onOpenMergeModal={() => { if (hasLocalData) setShowMergeModal(true); }}
              pushPermission={pushPermission}
              onRequestPushPermission={handleRequestPushPermission}
              onTriggerTestDailyDigest={() => handleTriggerDailyDigest(true)}
              digestTime={digestTime}
              onChangeDigestTime={handleUpdateDigestTime}
              onOpenOnboarding={() => setShowOnboardingModal(true)}
              onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
              onResetLocalData={() => setShowResetDataModal(true)}
              isStandalone={isStandalone}
              onOpenInstallModal={() => setShowInstallModal(true)}
              onOpenJoinModal={() => setShowJoinModal(true)}
              onOpenProfileSetup={() => setShowProfileSetupModal(true)}
              currentUserUpi={currentUserUpi}
              pendingSyncCount={pendingSyncCount}
              geminiEnabled={false}
              onToggleGemini={handleToggleGemini}
              onOpenInviteModal={handleOpenInviteModal}
              onTriggerTestSplitNotification={handleTriggerTestSplitNotification}
              onUpdateGroupName={handleUpdateGroupName}
            />
          ) : (
            /* Default for split ledger: Group View */
            <SplitGroupView
              group={activeGroup}
              transactions={transactions}
              userRole={userRole}
              onOpenAddExpense={() => {
                setEditingTx(null);
                setShowSplitExpenseModal(true);
              }}
              onEditExpense={(tx) => {
                if (tx.isSettlement) return;
                setEditingTx(tx);
                setShowSplitExpenseModal(true);
              }}
              onDeleteExpense={handleDeleteExpense}
              onRestoreExpense={handleRestoreExpense}
              onPermanentDeleteExpense={handlePermanentDeleteExpense}
              onOpenInviteModal={handleOpenInviteModal}
              onShowToast={showToast}
              onUndoSettleExpense={handleUndoSettle}
              onUpdateExpense={handleUpdateSplitTx}
            />
          )
        ) : (
          /* Shared Budget Ledger Views (100% Unchanged) */
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                transactions={activeTransactions}
                categories={categories}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={setSelectedPeriod}
                showPeriodDropdown={showPeriodDropdown}
                setShowPeriodDropdown={setShowPeriodDropdown}
                userRole={userRole}
                onOpenAddExpense={() => { setEditingTx(null); setShowExpenseModal(true); }}
                onEditExpense={(tx) => { setEditingTx(tx); setShowExpenseModal(true); }}
                onDeleteExpense={handleDeleteExpense}
                onSettleExpense={(tx) => setSettleTx(tx)}
                onUndoSettleExpense={handleUndoSettle}
                groupName={activeGroup?.name || 'Group'}
                onNavigateToTransactions={() => setActiveTab('Transactions')}
                geminiEnabled={effectiveGeminiEnabled}
                onOpenExportLedger={userRole !== 'viewer' ? () => setShowExportLedgerModal(true) : undefined}
              />
            )}

            {activeTab === 'Transactions' && (
              <TransactionsTab
                transactions={activeTransactions}
                categories={categories}
                userRole={userRole}
                onOpenAddExpense={() => { setEditingTx(null); setShowExpenseModal(true); }}
                onEditExpense={(tx) => { setEditingTx(tx); setShowExpenseModal(true); }}
                onDeleteExpense={handleDeleteExpense}
                onSettleExpense={(tx) => setSettleTx(tx)}
                onUndoSettleExpense={handleUndoSettle}
                groupName={activeGroup?.name || 'Group'}
                onOpenExportLedger={userRole !== 'viewer' ? () => setShowExportLedgerModal(true) : undefined}
                onOpenImportLedger={() => setShowImportLedgerModal(true)}
                canImport={activeTransactions.length === 0}
              />
            )}

            {activeTab === 'Lists' && (
              <ShoppingTab
                items={shoppingItems}
                categories={categories}
                userRole={userRole}
                onAddItem={handleAddShoppingItem}
                onUpdateItem={handleUpdateShoppingItem}
                onToggleItem={handleToggleShoppingItem}
                onDeleteItem={handleDeleteShoppingItem}
                onConvertBoughtToExpense={handleConvertBoughtToExpense}
                groupName={activeGroup?.name || 'Group'}
              />
            )}

            {activeTab === 'Fixed' && (
              <FixedTab
                recurringExpenses={recurringExpenses}
                categories={categories}
                userRole={userRole}
                onOpenAddRecurring={() => {
                  setEditingRecurring(null);
                  setShowRecurringModal(true);
                }}
                onEditRecurring={(rec) => {
                  setEditingRecurring(rec);
                  setShowRecurringModal(true);
                }}
                onToggleStatus={handleToggleRecurringStatus}
                onDeleteRecurring={handleDeleteRecurring}
                groupName={activeGroup?.name || 'Group'}
              />
            )}

            {activeTab === 'Settings' && (
              <SettingsTab
                themeMode={themeMode}
                onSelectThemeMode={setThemeMode}
                darkMode={resolvedDarkMode}
                onToggleDarkMode={handleCycleTheme}
                activeGroup={activeGroup}
                groups={groups}
                userRole={userRole}
                onOpenGroupModal={handleOpenGroupModal}
                onOpenCategoryModal={(tab = 'manage') => {
                  setCategoryModalTab(tab);
                  setShowCategoryModal(true);
                }}
                onDeleteCategory={handleDeleteCategory}
                categories={categories}
                transactions={transactions}
                shoppingItems={shoppingItems}
                recurringExpenses={recurringExpenses}
                onSyncLocalData={handleSyncLocalData}
                hasLocalData={hasLocalData}
                onOpenMergeModal={() => { if (hasLocalData) setShowMergeModal(true); }}
                pushPermission={pushPermission}
                onRequestPushPermission={handleRequestPushPermission}
                onTriggerTestDailyDigest={() => handleTriggerDailyDigest(true)}
                digestTime={digestTime}
                onChangeDigestTime={handleUpdateDigestTime}
                onOpenOnboarding={() => setShowOnboardingModal(true)}
                onOpenDeleteAccount={() => setShowDeleteAccountModal(true)}
                onResetLocalData={() => setShowResetDataModal(true)}
                isStandalone={isStandalone}
                onOpenInstallModal={() => setShowInstallModal(true)}
                onOpenJoinModal={() => setShowJoinModal(true)}
                onOpenProfileSetup={() => setShowProfileSetupModal(true)}
                currentUserUpi={currentUserUpi}
                pendingSyncCount={pendingSyncCount}
                geminiEnabled={effectiveGeminiEnabled}
                onToggleGemini={handleToggleGemini}
                onOpenInviteModal={handleOpenInviteModal}
                onTriggerTestSplitNotification={handleTriggerTestSplitNotification}
                onUpdateGroupName={handleUpdateGroupName}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        activeGroup={activeGroup}
        groups={groups}
        onSelectGroup={handleSelectGroup}
        userRole={userRole}
        initialTab={groupModalTab}
        onCreateGroup={handleCreateNewGroup}
        onDeleteGroup={handleDeleteGroup}
        onOpenJoinModal={() => setShowJoinModal(true)}
        onOpenInviteModal={handleOpenInviteModal}
        onUpdateGroupName={handleUpdateGroupName}
      />

      <SoloAuthPromptModal
        isOpen={showSoloAuthModal}
        onClose={() => setShowSoloAuthModal(false)}
        feature={soloAuthFeature}
      />

      <JoinGroupModal
        isOpen={showJoinModal}
        groups={groups}
        onClose={() => {
          setShowJoinModal(false);
          setInitialJoinCode('');
          setInitialJoinType('');
          setInitialJoinName('');
          try {
            sessionStorage.removeItem('hisaab_pending_invite_code');
            sessionStorage.removeItem('hisaab_pending_invite_type');
            sessionStorage.removeItem('hisaab_pending_invite_name');
            sessionStorage.removeItem('hisaab_auto_join');
            const url = new URL(window.location.href);
            if (url.searchParams.has('joinCode') || url.searchParams.has('code')) {
              url.searchParams.delete('joinCode');
              url.searchParams.delete('code');
              url.searchParams.delete('type');
              url.searchParams.delete('name');
              window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
            }
          } catch (e) {
            console.error(e);
          }
        }}
        onJoined={(groupId, groupName) => {
          handleSelectGroup(groupId);
          setActiveTab('Overview');
          setShowJoinModal(false);
          setInitialJoinCode('');
          setInitialJoinType('');
          setInitialJoinName('');
          try {
            sessionStorage.removeItem('hisaab_pending_invite_code');
            sessionStorage.removeItem('hisaab_pending_invite_type');
            sessionStorage.removeItem('hisaab_pending_invite_name');
            sessionStorage.removeItem('hisaab_auto_join');
            const url = new URL(window.location.href);
            if (url.searchParams.has('joinCode') || url.searchParams.has('code')) {
              url.searchParams.delete('joinCode');
              url.searchParams.delete('code');
              url.searchParams.delete('type');
              url.searchParams.delete('name');
              window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
            }
          } catch (e) {
            console.error(e);
          }
          showToast({
            message: groupName ? `Joined "${groupName}"` : 'Joined shared ledger',
            subMessage: 'Joined with View Only access • Admin can grant Can Edit permissions',
            type: 'ledger',
            duration: 3500
          });
        }}
        initialCode={initialJoinCode}
        initialType={initialJoinType}
        initialName={initialJoinName}
      />

      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => { 
          setShowExpenseModal(false); 
          setEditingTx(null); 
          setConvertingShoppingItemIds(null);
        }}
        onSave={handleSaveExpense}
        onDelete={handleDeleteExpense}
        categories={categories}
        groups={groups}
        activeGroupId={activeGroup?.id || ''}
        userRole={userRole}
        initialTx={editingTx}
      />

      {activeGroup && (
        <SplitExpenseModal
          isOpen={showSplitExpenseModal}
          onClose={() => {
            setShowSplitExpenseModal(false);
            setEditingTx(null);
          }}
          group={activeGroup}
          userRole={userRole}
          initialTx={editingTx}
          transactions={transactions}
          onOpenInviteModal={handleOpenInviteModal}
          onAddDirectMember={async (nameOrEmail) => {
            const updated = await addDirectMemberToGroup(activeGroup, nameOrEmail, 'editor');
            setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
          }}
          onSave={handleSaveSplitExpense}
        />
      )}

      {activeGroup && (
        <InviteMemberModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          group={activeGroup}
          userRole={userRole}
          showToast={showToast}
          onAddDirectMember={async (nameOrEmail) => {
            const updated = await addDirectMemberToGroup(activeGroup, nameOrEmail, 'editor');
            setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
          }}
        />
      )}

      {activeGroup && showSettleModal && settleDebtor && settleCreditor && (
        <QuickSettleModal
          isOpen={showSettleModal}
          onClose={() => {
            setShowSettleModal(false);
            setSettleDebtor(null);
            setSettleCreditor(null);
          }}
          group={activeGroup}
          userRole={userRole}
          debtor={settleDebtor}
          creditor={settleCreditor}
          suggestedAmount={settleAmount}
          onPaymentRecorded={() => {
            const debtorKey = (settleDebtor?.key || '').toLowerCase().trim();
            const creditorKey = (settleCreditor?.key || '').toLowerCase().trim();

            // Automatically club and settle the debtor's due on any open expenses where creditor was payer
            if (debtorKey && creditorKey) {
              setTransactions(prev => {
                return prev.map(t => {
                  if (t.isSettlement) return t;
                  const payer = (t.paidBy || t.createdBy || '').toLowerCase().trim();
                  const participants = (t.splitMembers || []).map(p => p.toLowerCase().trim());

                  if (payer === creditorKey && participants.includes(debtorKey)) {
                    const currentSettled = t.settledMembers || [];
                    const alreadySettled = currentSettled.some(k => k.toLowerCase().trim() === debtorKey);
                    const newSettled = alreadySettled ? currentSettled : [...currentSettled, settleDebtor!.key];
                    const nonPayers = participants.filter(p => p !== payer);
                    const allDone = nonPayers.length > 0 && nonPayers.every(p => 
                      newSettled.some(k => k.toLowerCase().trim() === p)
                    );

                    const updatedTx: Transaction = {
                      ...t,
                      settledMembers: newSettled,
                      settled: allDone ? true : t.settled
                    };
                    handleUpdateSplitTx(updatedTx);
                    return updatedTx;
                  }
                  return t;
                });
              });
            }

            const isLocal = !user || activeGroup.id.startsWith('local_') || activeGroup.id === 'local_group';
            if (isLocal) {
              try {
                const saved = localStorage.getItem('expenses_transactions');
                if (saved) {
                  const list = JSON.parse(saved);
                  setLocalTransactions(list);
                }
              } catch {}
            }
            if (activeGroup && settleDebtor && settleCreditor && user) {
              const canonicalDebtorName = getCanonicalMemberName(settleDebtor.key, activeGroup, user?.uid, user?.email || undefined, user);
              const canonicalCreditorName = getCanonicalMemberName(settleCreditor.key, activeGroup, user?.uid, user?.email || undefined, user);

              dispatchSettlementNotification(activeGroup, {
                amount: settleAmount,
                paidByName: canonicalDebtorName,
                settledToName: canonicalCreditorName
              }, user).catch(err => console.warn('Settlement notification note:', err));
            }
            showToast({
              message: 'Settlement recorded & expense completed',
              subMessage: 'Dues automatically resolved against expense',
              type: 'success'
            });
          }}
        />
      )}

      <VoiceInputModal
        isOpen={showVoiceModal && userRole !== 'viewer'}
        onClose={() => setShowVoiceModal(false)}
        activeGroup={activeGroup}
        userRole={userRole}
        categories={categories}
        onSaveExpense={handleSaveExpense}
        onAddShoppingItem={handleAddShoppingItem}
        isOnline={isOnline}
      />

      <SettleModal
        isOpen={!!settleTx}
        tx={settleTx}
        activeGroup={activeGroup}
        onClose={() => setSettleTx(null)}
        onSave={handleSaveSettlement}
      />

      <RecurringModal
        isOpen={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          setEditingRecurring(null);
        }}
        onSave={handleSaveRecurring}
        categories={categories}
        groups={groups}
        activeGroupId={activeGroup?.id || ''}
        userRole={userRole}
        initialRecurring={editingRecurring}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        existingCategories={categories}
        transactions={transactions}
        shoppingItems={shoppingItems}
        recurringExpenses={recurringExpenses}
        initialTab={categoryModalTab}
        groupName={activeGroup?.name || 'Personal Expenses'}
        userRole={userRole}
      />

      <MergeOfflineModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        groups={groups}
        activeGroupId={activeGroupId}
        localTransactions={genuineGuestTransactions}
        localShopping={genuineGuestShopping}
        localRecurring={genuineGuestRecurring}
        onMerge={handleMergeOfflineData}
        onCreateNewAndMerge={handleCreateNewAndMergeOfflineData}
        onDiscard={handleDiscardOfflineData}
        categories={categories}
      />

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        activeTab={activeTab}
        onGetStarted={() => {
          setActiveTab('Overview');
          setShowOnboardingModal(false);
        }}
        onOpenJoinModal={() => {
          setShowOnboardingModal(false);
          setShowJoinModal(true);
        }}
      />

      {/* Post-Sign In Profile Completion & Edit (Full Name & UPI ID) */}
      <ProfileSetupModal
        isOpen={showProfileSetupModal && Boolean(user)}
        user={user}
        onClose={() => setShowProfileSetupModal(false)}
        onComplete={handleCompleteProfileSetup}
      />

      {/* Delete Account Modal (Apple HIG & Google M3 Irreversible Action Sheet) */}
      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        onAccountDeleted={handleAccountDeleted}
      />

      {/* PWA Home Screen Installation Guide & Native Trigger */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallNative={handleInstallNative}
      />

      {/* Export Accounting Ledger Modal (Excel, CSV, PDF) */}
      <ExportLedgerModal
        isOpen={showExportLedgerModal && userRole !== 'viewer'}
        onClose={() => setShowExportLedgerModal(false)}
        transactions={activeTransactions}
        categories={categories}
        group={activeGroup}
        currentUserName={user?.displayName || 'You'}
        currentUserEmail={user?.email || undefined}
        userRole={userRole}
      />

      {/* Re-import Accounting Ledger Modal (CSV / Excel with Member Email Verification) */}
      <ImportLedgerModal
        isOpen={showImportLedgerModal}
        onClose={() => setShowImportLedgerModal(false)}
        group={activeGroup}
        categories={categories}
        currentUserName={user?.displayName || 'You'}
        currentUserEmail={user?.email || undefined}
        onBatchImport={handleBatchImportExpenses}
      />

      {/* Reset Local Guest Data Confirmation Dialog */}
      {showResetDataModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle size={22} strokeWidth={2.2} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-semibold text-text-primary">
                Reset Offline Data?
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                This will erase all guest transactions, local checklists, and settings stored on this device.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetDataModal(false)}
                className="flex-1 h-11 border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetLocalData}
                className="flex-1 h-11 bg-google-red hover:bg-red-700 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Toast Notification (Google Material 3 + Apple iOS style) */}
      <AppToast
        toast={toast}
        onDismiss={handleDismissToast}
        categories={categories}
        hasFab={userRole !== 'viewer' && (
          isSplitLedger
            ? (activeTab === 'Group' || activeTab === 'Individual' || activeTab === 'Overview' || activeTab === 'Transactions')
            : (activeTab === 'Overview' || activeTab === 'Transactions')
        )}
      />

      {/* Ledger Deep Link Context Switch Modal */}
      <LedgerContextModal
        isOpen={Boolean(ledgerContextGroup)}
        group={ledgerContextGroup?.group || null}
        isOwner={ledgerContextGroup?.isOwner || false}
        previousGroupName={ledgerContextGroup?.previousGroupName}
        onContinue={() => setLedgerContextGroup(null)}
        onSwitchBack={() => {
          if (ledgerContextGroup?.previousGroupName) {
            const prevGroup = groups.find(g => g.name === ledgerContextGroup.previousGroupName);
            if (prevGroup) {
              setActiveGroupId(prevGroup.id);
              saveActiveGroupId(prevGroup.id, user?.uid);
            }
          }
          setLedgerContextGroup(null);
        }}
        onClose={() => setLedgerContextGroup(null)}
      />

      {/* Auth Notice Banner (e.g. pop-up blocked) */}
      {authError && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] px-4 py-2.5 rounded-2xl bg-surface/95 dark:bg-surface/90 backdrop-blur-md border border-amber-500/30 shadow-lg flex items-center justify-between gap-3 text-xs font-medium text-text-primary animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
            <span className="leading-snug text-text-secondary">{authError}</span>
          </div>
          <button
            type="button"
            onClick={clearAuthError}
            className="text-text-secondary hover:text-text-primary shrink-0 p-1 rounded-full hover:bg-surface-hover cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Material 3 Floating Action Button (FAB) */}
      {userRole !== 'viewer' && (
        isSplitLedger
          ? (activeTab === 'Group' || activeTab === 'Individual' || activeTab === 'Overview' || activeTab === 'Transactions')
          : (activeTab === 'Overview' || activeTab === 'Transactions')
      ) && (
        <button
          type="button"
          onClick={() => { 
            if (isSplitLedger) {
              setEditingTx(null); 
              setShowSplitExpenseModal(true);
            } else {
              setEditingTx(null); 
              setShowExpenseModal(true);
            }
          }}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-20 right-4 sm:right-8 z-30 flex items-center gap-2 h-13 px-4 sm:px-5 rounded-2xl bg-google-blue hover:bg-google-blue-hover text-white shadow-lg shadow-google-blue/30 transition-all duration-200 cursor-pointer active:scale-95 select-none"
          title="Add Expense"
        >
          <Plus size={20} strokeWidth={2.2} />
          <span className="text-sm font-semibold tracking-tight">
            Add Expense
          </span>
        </button>
      )}

      {/* Bottom Navigation (Material 3 + Apple HIG) */}
      <footer className="bg-surface/85 backdrop-blur-md border-t border-border shrink-0 w-full z-20 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]">
        <div className="w-full max-w-3xl mx-auto flex justify-around items-center h-13 sm:h-14 px-2 min-[360px]:px-4 min-[390px]:px-6 sm:px-8 md:px-10">
          {isSplitLedger ? (
            /* Split Ledger Tabs: Group View | Individual View | Settings (Gemini not required for Split) */
            <>
              <NavItem 
                icon={<ReceiptText size={19} />} 
                label="Expenses" 
                active={activeTab === 'Group' || activeTab === 'Overview' || activeTab === 'Lists' || activeTab === 'Fixed'} 
                onClick={() => handleTabSwitch('Group')} 
              />

              <NavItem 
                icon={<UserCheck size={19} />} 
                label="Balances" 
                active={activeTab === 'Individual' || activeTab === 'Transactions'} 
                onClick={() => handleTabSwitch('Individual')} 
              />

              <NavItem 
                icon={<Settings size={19} />} 
                label="Settings" 
                active={activeTab === 'Settings'} 
                onClick={() => handleTabSwitch('Settings')} 
              />
            </>
          ) : (
            /* Budget Ledger Tabs: Overview | Ledger | Shopping | (Gemini) | Fixed | Settings */
            <>
              <NavItem 
                icon={<BarChart2 size={19} />} 
                label="Overview" 
                active={activeTab === 'Overview' || activeTab === 'Group'} 
                onClick={() => handleTabSwitch('Overview')} 
              />

              {!effectiveGeminiEnabled && (
                <NavItem 
                  icon={<BookOpen size={19} />} 
                  label="Ledger" 
                  active={activeTab === 'Transactions' || activeTab === 'Individual'} 
                  onClick={() => handleTabSwitch('Transactions')} 
                />
              )}

              <NavItem 
                icon={<ShoppingBag size={19} />} 
                label="Shopping" 
                active={activeTab === 'Lists'} 
                onClick={() => handleTabSwitch('Lists')} 
              />

              {effectiveGeminiEnabled && (
                /* Middle: 3rd from left & 3rd from right - Gemini AI Input */
                <button 
                  type="button"
                  disabled={!isOnline}
                  aria-label="Gemini AI"
                  className={`flex flex-col items-center justify-center select-none min-w-[44px] min-[390px]:min-w-[54px] py-0.5 group transition-colors ${
                    isOnline 
                      ? 'cursor-pointer active:scale-95' 
                      : 'cursor-not-allowed opacity-40'
                  }`}
                  onClick={() => {
                    if (isOnline) {
                      setShowVoiceModal(true);
                    }
                  }}
                  title={isOnline ? 'Add expenses or shopping items with Gemini (voice or text)' : 'Gemini requires active internet connection'}
                >
                  <div 
                    className={`w-11 sm:w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                      showVoiceModal
                        ? 'bg-google-blue/15 dark:bg-google-blue/20'
                        : 'group-hover:bg-surface-hover/80'
                    }`}
                  >
                    <GeminiIcon 
                      size={22} 
                      disabled={!isOnline} 
                      className="transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]" 
                    />
                  </div>
                  <span className={`text-[11px] sm:text-xs tracking-tight leading-tight mt-0.5 transition-colors whitespace-nowrap ${
                    showVoiceModal 
                      ? 'font-semibold text-google-blue' 
                      : 'font-medium text-text-secondary group-hover:text-text-primary'
                  }`}>
                    Gemini
                  </span>
                </button>
              )}

              <NavItem 
                icon={<Repeat size={19} />} 
                label="Fixed" 
                active={activeTab === 'Fixed'} 
                onClick={() => handleTabSwitch('Fixed')} 
              />
              <NavItem 
                icon={<Settings size={19} />} 
                label="Settings" 
                active={activeTab === 'Settings'} 
                onClick={() => handleTabSwitch('Settings')} 
              />
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function NavItem({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void; 
}) {
  return (
    <button 
      type="button"
      className="flex flex-col items-center justify-center cursor-pointer transition-colors group select-none min-w-[44px] min-[390px]:min-w-[54px] py-0.5"
      onClick={onClick}
    >
      <div 
        className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
          active 
            ? 'bg-google-blue/15 text-google-blue dark:bg-google-blue/20 dark:text-google-blue' 
            : 'text-text-secondary group-hover:text-text-primary'
        }`}
      >
        {icon}
      </div>
      <span className={`text-[11px] sm:text-xs tracking-tight leading-tight mt-0.5 transition-colors whitespace-nowrap ${
        active ? 'font-semibold text-google-blue' : 'font-medium text-text-secondary'
      }`}>
        {label}
      </span>
    </button>
  );
}
