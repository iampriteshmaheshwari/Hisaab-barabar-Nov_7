import React, { useState } from 'react';
import { 
  Users, 
  LogIn, 
  LogOut, 
  Moon, 
  Sun, 
  Laptop,
  Plus, 
  ChevronRight, 
  Share2,
  Database,
  Tag,
  Check,
  Bell,
  BarChart2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Play,
  Clock,
  RotateCcw,
  Trash2,
  UserX,
  Download,
  CloudUpload,
  AlertTriangle,
  Loader2,
  X,
  ReceiptText,
  QrCode,
  Copy,
  CheckCheck,
  Info,
  Pencil
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ExpenseGroup, CategoryData, UserRole, ThemeMode, Transaction, ShoppingItem, RecurringExpense } from '../../types';
import { GeminiIcon } from '../icons/GeminiIcon';
import { 
  getSavedPersonalUpi, 
  savePersonalUpi, 
  removePersonalUpi,
  formatUpiId, 
  isValidUpiId, 
  generateUpiQrDataUrl, 
  buildUpiPaymentUri 
} from '../../utils/upiUtils';
import { updateGroupMemberUpi } from '../../services/expenseService';
import { 
  DEFAULT_DIGEST_TIME, 
  DIGEST_TIME_PRESETS, 
  formatDigestTime 
} from '../../services/notificationService';

interface SettingsTabProps {
  geminiEnabled?: boolean;
  onToggleGemini?: (enabled: boolean) => void;
  themeMode?: ThemeMode;
  onSelectThemeMode?: (mode: ThemeMode) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  activeGroup: ExpenseGroup | null;
  groups: ExpenseGroup[];
  userRole: UserRole;
  onOpenGroupModal: (initialTab?: 'members' | 'groups' | 'create') => void;
  onOpenCategoryModal: (tab?: 'manage' | 'add') => void;
  onDeleteCategory?: (catKey: string) => Promise<void> | void;
  categories: Record<string, CategoryData>;
  transactions?: Transaction[];
  shoppingItems?: ShoppingItem[];
  recurringExpenses?: RecurringExpense[];
  onSyncLocalData: () => Promise<number>;
  hasLocalData: boolean;
  onOpenMergeModal?: () => void;
  pushPermission?: NotificationPermission | 'unsupported';
  onRequestPushPermission?: () => Promise<void>;
  onTriggerTestDailyDigest?: () => void;
  dailyNotifEnabled?: boolean;
  onToggleDailyNotif?: () => void;
  buyingNotifEnabled?: boolean;
  onToggleBuyingNotif?: () => void;
  digestTime?: string;
  onChangeDigestTime?: (newTime: string) => void;
  onOpenOnboarding?: () => void;
  onOpenDeleteAccount?: () => void;
  onResetLocalData?: () => void;
  isStandalone?: boolean;
  onOpenInstallModal?: () => void;
  onOpenJoinModal?: () => void;
  onOpenProfileSetup?: () => void;
  currentUserUpi?: string;
  pendingSyncCount?: number;
  onOpenInviteModal?: () => void;
  onTriggerTestSplitNotification?: () => void;
  onUpdateGroupName?: (groupId: string, newName: string) => Promise<void>;
}

export function SettingsTab({
  geminiEnabled = false,
  onToggleGemini,
  themeMode = 'system',
  onSelectThemeMode,
  darkMode,
  onToggleDarkMode,
  activeGroup,
  groups,
  userRole,
  onOpenGroupModal,
  onOpenCategoryModal,
  onDeleteCategory,
  categories,
  transactions = [],
  shoppingItems = [],
  recurringExpenses = [],
  onSyncLocalData,
  hasLocalData,
  onOpenMergeModal,
  pushPermission = 'default',
  onRequestPushPermission,
  onTriggerTestDailyDigest,
  dailyNotifEnabled = true,
  onToggleDailyNotif,
  buyingNotifEnabled = true,
  onToggleBuyingNotif,
  digestTime = DEFAULT_DIGEST_TIME,
  onChangeDigestTime,
  onOpenOnboarding,
  onOpenDeleteAccount,
  onResetLocalData,
  isStandalone = false,
  onOpenInstallModal,
  onOpenJoinModal,
  onOpenProfileSetup,
  currentUserUpi,
  pendingSyncCount = 0,
  onOpenInviteModal,
  onTriggerTestSplitNotification,
  onUpdateGroupName
}: SettingsTabProps) {
  const { user, signInWithGoogle, logOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isTestingDaily, setIsTestingDaily] = useState(false);
  const [savedTimeNotice, setSavedTimeNotice] = useState(false);
  const [showPendingSignOutConfirm, setShowPendingSignOutConfirm] = useState(false);
  const [deleteCategoryKey, setDeleteCategoryKey] = useState<string | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  // Group / Ledger Name Editing (Subtle, high quality)
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editedGroupName, setEditedGroupName] = useState('');
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [groupNameError, setGroupNameError] = useState<string | null>(null);

  const handleStartEditGroupName = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeGroup) return;
    setEditedGroupName(activeGroup.name);
    setGroupNameError(null);
    setIsEditingGroupName(true);
  };

  const handleSaveGroupName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = editedGroupName.trim();
    if (!activeGroup || !clean || !onUpdateGroupName) return;
    setIsSavingGroupName(true);
    setGroupNameError(null);
    try {
      await onUpdateGroupName(activeGroup.id, clean);
      setIsEditingGroupName(false);
    } catch (err: any) {
      setGroupNameError(err?.message || 'Could not update name');
    } finally {
      setIsSavingGroupName(false);
    }
  };

  const formattedDigestTime = formatDigestTime(digestTime);
  const isDefaultTime = digestTime === DEFAULT_DIGEST_TIME;

  const handleSelectDigestTime = (newTime: string) => {
    if (!newTime || !onChangeDigestTime) return;
    onChangeDigestTime(newTime);
    setSavedTimeNotice(true);
    setTimeout(() => setSavedTimeNotice(false), 2200);
  };

  const handleTestDaily = async () => {
    if (!onTriggerTestDailyDigest) return;
    setIsTestingDaily(true);
    try {
      await onTriggerTestDailyDigest();
    } finally {
      setTimeout(() => setIsTestingDaily(false), 600);
    }
  };

  const isSplit = activeGroup?.type === 'split';
  const [isTestingSplit, setIsTestingSplit] = useState(false);

  // Synchronized Personal UPI ID (Single Source of Truth)
  const effectiveUpi = currentUserUpi !== undefined ? currentUserUpi : (getSavedPersonalUpi() || '');
  const [showPersonalQr, setShowPersonalQr] = useState(false);
  const [personalQrUrl, setPersonalQrUrl] = useState('');
  const [copiedPersonalUpi, setCopiedPersonalUpi] = useState(false);

  // Generate QR code for saved receiving UPI ID
  React.useEffect(() => {
    let active = true;
    if (effectiveUpi && isValidUpiId(effectiveUpi) && showPersonalQr) {
      const personalUri = buildUpiPaymentUri({
        pa: effectiveUpi
      });
      generateUpiQrDataUrl(personalUri)
        .then(url => {
          if (active) setPersonalQrUrl(url);
        })
        .catch(console.warn);
    } else {
      setPersonalQrUrl('');
    }
    return () => { active = false; };
  }, [effectiveUpi, showPersonalQr]);

  const handleTestSplitAlert = async () => {
    if (!onTriggerTestSplitNotification) return;
    setIsTestingSplit(true);
    try {
      await onTriggerTestSplitNotification();
    } finally {
      setTimeout(() => setIsTestingSplit(false), 600);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await onSyncLocalData();
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    } catch (e: any) {
      setSyncError(e?.message || 'Could not sync local data. Please check your connection.');
      setTimeout(() => setSyncError(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 font-sans">
      {/* Profile & Receiving Payment Identity */}
      <div className="space-y-1.5">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          Profile &amp; Payment Identity
        </div>

        <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
          {user ? (
            <>
              {/* Profile Details Row */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-12 h-12 rounded-full object-cover border border-border shrink-0 shadow-2xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-google-blue text-white flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-text-primary leading-tight">
                      {user.displayName || 'Account'}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary mt-0.5 break-all">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pt-0.5 sm:pt-0">
                  {onOpenProfileSetup && (
                    <button
                      type="button"
                      onClick={onOpenProfileSetup}
                      className="h-9 px-4 rounded-xl border border-border hover:bg-surface-hover text-xs sm:text-sm font-semibold text-text-primary hover:text-google-blue transition-colors cursor-pointer"
                    >
                      Edit Profile
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingSyncCount && pendingSyncCount > 0) {
                        setShowPendingSignOutConfirm(true);
                        return;
                      }
                      logOut();
                    }}
                    className="h-9 px-4 rounded-xl border border-border hover:bg-surface-hover text-xs sm:text-sm font-semibold text-text-secondary hover:text-google-red transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* Receiving UPI ID & QR Code Row */}
              <div className="p-4 sm:p-5 bg-surface-hover/30 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
                      <Smartphone size={16} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Receiving UPI ID
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {effectiveUpi ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPersonalQr(!showPersonalQr)}
                          className="h-9 px-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary font-medium text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <QrCode size={14} />
                          <span>{showPersonalQr ? 'Hide QR' : 'Show QR'}</span>
                        </button>
                        {onOpenProfileSetup && (
                          <button
                            type="button"
                            onClick={onOpenProfileSetup}
                            className="h-9 px-3 rounded-xl text-text-secondary hover:text-google-blue hover:bg-surface text-xs sm:text-sm font-medium cursor-pointer transition-colors"
                          >
                            Change
                          </button>
                        )}
                      </>
                    ) : (
                      onOpenProfileSetup && (
                        <button
                          type="button"
                          onClick={onOpenProfileSetup}
                          className="h-9 px-4 rounded-xl bg-google-blue hover:bg-blue-700 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                          <span>+ Link UPI ID</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {effectiveUpi ? (
                  <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center justify-between gap-3">
                    <span className="text-sm sm:text-base font-mono font-semibold text-text-primary select-all break-all">
                      {effectiveUpi}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(effectiveUpi);
                          setCopiedPersonalUpi(true);
                          setTimeout(() => setCopiedPersonalUpi(false), 2000);
                        } catch {}
                      }}
                      className="h-8 px-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
                      title="Copy UPI ID"
                    >
                      {copiedPersonalUpi ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Check size={13} strokeWidth={2.5} />
                          Copied
                        </span>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-text-secondary">
                    No UPI ID linked yet. Link your UPI ID to receive direct settlements from group members.
                  </p>
                )}

                {/* Instant QR Code Display */}
                {showPersonalQr && personalQrUrl && effectiveUpi && (
                  <div className="pt-2 pb-1 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in duration-200">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
                      <img 
                        src={personalQrUrl} 
                        alt="Receiving UPI QR" 
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                      />
                      <p className="text-xs text-neutral-600 mt-2 font-medium tracking-wide">
                        Scan with any UPI app to pay {user.displayName || 'You'} directly
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Account Action (Apple HIG / Google Material 3 Guideline) */}
              {onOpenDeleteAccount && (
                <button
                  type="button"
                  onClick={onOpenDeleteAccount}
                  className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-red-500/5 transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-red-500/10 text-google-red flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Trash2 size={16} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-google-red">
                        Delete Account
                      </div>
                      <div className="text-xs text-text-secondary truncate">
                        Permanently erase profile, private data &amp; ledgers
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-google-red font-medium shrink-0">
                    <span>Manage</span>
                    <ChevronRight size={15} />
                  </div>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch {
                    // Handled cleanly in AuthContext
                  }
                }}
                className="w-full p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center">
                    <LogIn size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">Sign in with Google</div>
                    <div className="text-xs text-text-secondary">Sync groups across devices</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-secondary" />
              </button>

              {onResetLocalData && (
                <button
                  type="button"
                  onClick={onResetLocalData}
                  className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-surface-hover/60 transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-hover text-text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <RotateCcw size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-text-primary">
                        Reset Offline Ledger Data
                      </div>
                      <div className="text-xs text-text-secondary truncate">
                        Clear local guest transactions &amp; shopping cache
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-text-secondary shrink-0" />
                </button>
              )}
              {/* Guest Receiving UPI ID & QR Code Row */}
              <div className="p-4 sm:p-5 bg-surface-hover/30 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
                      <Smartphone size={16} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Receiving UPI ID
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {effectiveUpi ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPersonalQr(!showPersonalQr)}
                          className="h-9 px-3.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-primary font-medium text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <QrCode size={14} />
                          <span>{showPersonalQr ? 'Hide QR' : 'Show QR'}</span>
                        </button>
                        {onOpenProfileSetup && (
                          <button
                            type="button"
                            onClick={onOpenProfileSetup}
                            className="h-9 px-3 rounded-xl text-text-secondary hover:text-google-blue hover:bg-surface text-xs sm:text-sm font-medium cursor-pointer transition-colors"
                          >
                            Change
                          </button>
                        )}
                      </>
                    ) : (
                      onOpenProfileSetup && (
                        <button
                          type="button"
                          onClick={onOpenProfileSetup}
                          className="h-9 px-4 rounded-xl bg-google-blue hover:bg-blue-700 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                          <span>+ Link UPI ID</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {effectiveUpi ? (
                  <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center justify-between gap-3">
                    <span className="text-sm sm:text-base font-mono font-semibold text-text-primary select-all break-all">
                      {effectiveUpi}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(effectiveUpi);
                          setCopiedPersonalUpi(true);
                          setTimeout(() => setCopiedPersonalUpi(false), 2000);
                        } catch {}
                      }}
                      className="h-8 px-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
                      title="Copy UPI ID"
                    >
                      {copiedPersonalUpi ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Check size={13} strokeWidth={2.5} />
                          Copied
                        </span>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-text-secondary">
                    No UPI ID linked yet. Link your UPI ID to receive direct settlements from group members.
                  </p>
                )}

                {/* Instant QR Code Display */}
                {showPersonalQr && personalQrUrl && effectiveUpi && (
                  <div className="pt-2 pb-1 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in duration-200">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
                      <img 
                        src={personalQrUrl} 
                        alt="Receiving UPI QR" 
                        className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                      />
                      <p className="text-xs text-neutral-600 mt-2 font-medium tracking-wide">
                        Scan with any UPI app to pay directly
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Offline to Cloud Sync Row */}
          {hasLocalData && user && (
            <div className="p-3.5 flex items-center justify-between gap-3 bg-google-blue/5 border-t border-border">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-text-primary">
                  {syncDone ? 'Local records synced!' : 'Unsynced offline entries found'}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {syncDone ? 'Entries safely uploaded to cloud' : 'Entries created while signed out'}
                </div>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => {
                  if (onOpenMergeModal) {
                    onOpenMergeModal();
                  } else {
                    handleSync();
                  }
                }}
                className="px-3 py-1.5 rounded-full bg-google-blue text-white text-xs font-semibold hover:bg-google-blue-hover cursor-pointer transition-all disabled:opacity-40 shrink-0"
              >
                {isSyncing ? 'Syncing...' : syncDone ? 'Done' : 'Review & Merge'}
              </button>
            </div>
          )}

          {syncError && (
            <div className="p-3 bg-red-500/10 border-t border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium">
              {syncError}
            </div>
          )}
        </div>
      </div>

      {/* Group Sharing Settings */}
      {/* Group Sharing Settings */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Groups &amp; Sharing
          </span>
          <button
            type="button"
            onClick={() => onOpenGroupModal('groups')}
            className="text-xs text-text-secondary hover:text-google-blue font-semibold cursor-pointer transition-colors"
          >
            All Ledgers ({groups.length})
          </button>
        </div>

        <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
          {/* Active Ledger Info */}
          {isEditingGroupName ? (
            <div className="p-4 sm:p-4.5 space-y-2 bg-surface-hover/30" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Edit Ledger Name
                </span>
                <span className="text-2xs text-text-secondary">
                  Press Enter to save
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedGroupName}
                  onChange={(e) => setEditedGroupName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  placeholder="Enter ledger name"
                  className="h-9 px-3 rounded-xl border border-border bg-surface text-xs sm:text-sm text-text-primary focus:outline-none focus:border-google-blue min-w-0 flex-1 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveGroupName();
                    } else if (e.key === 'Escape') {
                      setIsEditingGroupName(false);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isSavingGroupName || !editedGroupName.trim()}
                  onClick={() => handleSaveGroupName()}
                  className="h-9 px-3.5 rounded-xl bg-google-blue text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSavingGroupName ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={isSavingGroupName}
                  onClick={() => setIsEditingGroupName(false)}
                  className="h-9 px-3 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-secondary text-xs font-medium transition-colors cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </div>
              {groupNameError && (
                <p className="text-xs text-rose-500 font-medium">{groupNameError}</p>
              )}
            </div>
          ) : (
            <div className="w-full p-4 sm:p-4.5 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-bold text-text-primary truncate">
                    {activeGroup ? activeGroup.name : 'Personal Ledger'}
                  </span>
                  {activeGroup && userRole !== 'viewer' && onUpdateGroupName && (
                    <button
                      type="button"
                      onClick={handleStartEditGroupName}
                      className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-active transition-colors cursor-pointer inline-flex items-center justify-center"
                      title="Edit ledger name"
                      aria-label="Edit ledger name"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-hover text-text-secondary border border-border">
                    {isSplit ? 'Split Ledger' : 'Expense Tracker'}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
                  <span>Invite code: <strong className="font-mono font-bold text-text-primary tracking-wider">{activeGroup?.inviteCode || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Role: <strong className="font-medium text-text-primary">{userRole === 'owner' ? 'Admin' : userRole === 'viewer' ? 'View Only' : 'Can Edit'}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenGroupModal('members')}
                className="flex items-center gap-1 text-xs sm:text-sm text-google-blue font-semibold shrink-0 hover:underline cursor-pointer"
              >
                <span>Manage</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Join Another Ledger Row */}
          {onOpenJoinModal && (
            <button
              type="button"
              onClick={onOpenJoinModal}
              className="w-full p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
                  <LogIn size={16} />
                </div>
                <div>
                  <div className="text-sm sm:text-base font-medium text-text-primary">
                    Join another Ledger
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Paste an 8-character invite code to join a group
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-text-secondary shrink-0" />
            </button>
          )}

          {/* Create New Ledger Row */}
          <button
            type="button"
            onClick={() => onOpenGroupModal('create')}
            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Plus size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-sm sm:text-base font-medium text-text-primary">
                  Create New Ledger
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  Start a new shared split ledger or expense budget
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-text-secondary shrink-0" />
          </button>
        </div>
      </div>

      {/* Categories: ONLY for Budget Ledgers (Hidden for Split Ledgers) */}
      {!isSplit && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Categories
              </span>
              {activeGroup && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-hover text-text-secondary border border-border truncate max-w-[150px]">
                  {activeGroup.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onOpenCategoryModal?.('manage')}
                className="text-xs text-text-secondary hover:text-text-primary font-medium cursor-pointer"
              >
                Manage
              </button>
              {userRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={() => onOpenCategoryModal?.('add')}
                  className="text-xs text-google-blue font-semibold cursor-pointer"
                >
                  + Add Category
                </button>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-3xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {Object.entries(categories).map(([k, cat]) => {
                const isOther = k === 'other';

                return (
                  <div
                    key={k}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-hover/60 border border-border/80 hover:bg-surface-hover transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-md shrink-0 shadow-2xs" style={{ backgroundColor: cat.hex }} />
                      <span className="text-xs sm:text-sm font-medium text-text-primary truncate">{cat.name}</span>
                    </div>
                    {!isOther && onDeleteCategory && userRole !== 'viewer' && (
                      <button
                        type="button"
                        onClick={() => setDeleteCategoryKey(k)}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors shrink-0"
                        title={`Delete ${cat.name} category`}
                      >
                        <X size={12} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Notifications & Device Alerts */}
      <div className="space-y-1.5">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          Notifications &amp; Alerts
        </div>

        <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
          {isSplit ? (
            /* Split Ledger Custom Notifications */
            <>
              {/* Split Expense Alerts */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <ReceiptText size={16} />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                      <span>Group Bill &amp; Expense Alerts</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-google-blue/10 text-google-blue dark:text-blue-400">
                        Real-time
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-text-secondary mt-0.5 leading-relaxed">
                      Instant alerts to all members when a shared bill or expense cut is recorded or updated in {activeGroup?.name || 'this ledger'}.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-google-blue dark:text-blue-400 flex items-center gap-1">
                    <Check size={13} strokeWidth={2.5} />
                    <span>Active</span>
                  </span>
                </div>
              </div>

              {/* Settlement Confirmations */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                      <span>Settlement &amp; Payment Confirmations</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Real-time
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-text-secondary mt-0.5 leading-relaxed">
                      Notifies immediately when a friend marks an amount as settled or paid to keep group balances accurate.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check size={13} strokeWidth={2.5} />
                    <span>Active</span>
                  </span>
                </div>
              </div>

              {/* Outstanding Balance Reminders */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                      <span>Outstanding Balance Reminders</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        Smart Alert
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-text-secondary mt-0.5 leading-relaxed">
                      Periodic gentle balance notifications so no one forgets who owes whom before trips end or months close.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleTestSplitAlert}
                    disabled={isTestingSplit}
                    className="px-3 py-1.5 rounded-xl border border-border bg-surface-hover hover:border-google-blue/40 text-xs font-medium text-text-primary flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Send a sample settlement reminder notification"
                  >
                    <Play size={11} className={isTestingSplit ? 'animate-spin' : ''} />
                    <span>{isTestingSplit ? 'Sending…' : 'Test Reminder Alert'}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Budget Ledger Custom Notifications */
            <>
              {/* Daily Expense Digest with Customizable Delivery Time */}
              <div className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                      <Clock size={16} />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2 flex-wrap">
                        <span>Daily Expense Digest</span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-google-blue/10 text-google-blue dark:text-blue-400">
                          {formattedDigestTime}
                        </span>
                        {isDefaultTime ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-surface-hover text-text-secondary border border-border/60">
                            Default
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-google-blue/10 text-google-blue border border-google-blue/20">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-text-secondary mt-0.5 leading-relaxed">
                        Sends a {formattedDigestTime} summary to all members with ledger access on days there was expense activity.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleTestDaily}
                      disabled={isTestingDaily}
                      className="px-3 py-1.5 rounded-xl border border-border bg-surface-hover hover:border-google-blue/40 text-xs font-medium text-text-primary flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title={`Trigger a preview notification of today's ${formattedDigestTime} expense summary`}
                    >
                      <Play size={11} className={isTestingDaily ? 'animate-spin' : ''} />
                      <span>{isTestingDaily ? 'Sending…' : `Test ${formattedDigestTime} Alert`}</span>
                    </button>
                  </div>
                </div>

                {/* Time Customization Tray */}
                <div className="bg-surface-hover/40 rounded-2xl p-3 sm:p-3.5 border border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                      <Clock size={13} className="text-google-blue" />
                      <span>Digest Scheduled Time</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {savedTimeNotice && (
                        <span className="text-xs font-semibold text-google-blue dark:text-blue-400 flex items-center gap-1 animate-in fade-in duration-200">
                          <Check size={12} strokeWidth={2.5} />
                          Saved
                        </span>
                      )}
                      {!isDefaultTime && (
                        <button
                          type="button"
                          onClick={() => handleSelectDigestTime(DEFAULT_DIGEST_TIME)}
                          className="text-xs font-medium text-google-blue hover:underline flex items-center gap-1 cursor-pointer"
                          title="Reset to 9:00 PM default"
                        >
                          <RotateCcw size={11} />
                          <span>Reset to 9:00 PM</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preset Buttons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DIGEST_TIME_PRESETS.map((preset) => {
                      const isSelected = digestTime === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handleSelectDigestTime(preset.value)}
                          className={`h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-google-blue text-white shadow-xs ring-2 ring-google-blue/20'
                              : 'bg-surface border border-border text-text-primary hover:bg-surface-hover hover:border-google-blue/30'
                          }`}
                        >
                          {isSelected && <Check size={14} strokeWidth={2.5} />}
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Time Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-border/40 text-xs">
                    <span className="text-text-secondary shrink-0">
                      Or set any custom time:
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="time"
                          value={digestTime}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSelectDigestTime(e.target.value);
                            }
                          }}
                          className="h-8 px-3 rounded-xl bg-surface border border-border text-xs font-semibold text-text-primary outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all cursor-pointer"
                          aria-label="Select custom digest time"
                        />
                      </div>
                      <span className="text-xs text-text-secondary">
                        Device local time
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Immediate Buying List Alert */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                    <ShoppingBag size={16} />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                      <span>Immediate Buying List Alerts</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-google-blue/10 text-google-blue dark:text-blue-400">
                        Real-time
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-text-secondary mt-0.5 leading-relaxed">
                      Notifies all devices instantly (or when reconnected) when items are added with category &amp; due date.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-google-blue dark:text-blue-400 flex items-center gap-1">
                    <Check size={13} strokeWidth={2.5} />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Device Push Notifications Status */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-hover text-text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                  <span>Device Push Notifications</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                    pushPermission === 'granted'
                      ? 'bg-google-blue/10 text-google-blue dark:text-blue-400'
                      : pushPermission === 'denied'
                      ? 'bg-google-red/10 text-google-red'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {pushPermission === 'granted' ? 'Enabled' : pushPermission === 'denied' ? 'Blocked' : 'Action Needed'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Delivers to iPhone (Add to Home Screen / iOS 16.4+), Android, tablets, and desktops.
                </div>
              </div>
            </div>

            {pushPermission !== 'granted' && onRequestPushPermission && (
              <button
                type="button"
                onClick={onRequestPushPermission}
                className="px-3 py-1.5 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-end sm:self-auto shrink-0"
              >
                <Bell size={12} />
                <span>Enable Push</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* App Installation & PWA Standalone (iOS, Android, Desktop) */}
      <div className="space-y-1.5">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          App Installation
        </div>

        <div className="bg-surface rounded-3xl border border-border p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                {isStandalone ? <Check size={16} /> : <Download size={16} />}
              </div>
              <div>
                <div className="text-sm sm:text-base font-medium text-text-primary flex items-center gap-2">
                  <span>{isStandalone ? 'Installed as App' : 'Add to Home Screen'}</span>
                  {isStandalone ? (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-google-blue/10 text-google-blue dark:text-blue-400">
                      Standalone PWA
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-surface-hover text-text-secondary">
                      Web Mode
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {isStandalone
                    ? 'Running natively on your home screen with offline caching & background sync.'
                    : 'Install on iPhone, Android, or desktop for 1-tap launch, full screen, and offline ledger access.'}
                </div>
              </div>
            </div>

            {!isStandalone && onOpenInstallModal && (
              <button
                type="button"
                onClick={onOpenInstallModal}
                className="px-3.5 py-1.5 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer self-end sm:self-auto shrink-0"
              >
                <Download size={13} />
                <span>Install App</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gemini AI Features Toggle: ONLY for Budget Ledgers (Hidden for Split Ledgers) */}
      {!isSplit && (
        <div className="space-y-1.5">
          <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
            AI Features
          </div>

          <div className="bg-surface rounded-3xl border border-border p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-google-blue/10 flex items-center justify-center shrink-0">
                  <GeminiIcon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    Enable Gemini
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    {userRole === 'viewer'
                      ? 'Disabled in View Only mode'
                      : `Voice & text input for ${activeGroup?.name || 'this ledger'}`}
                  </div>
                </div>
              </div>

              {/* Apple HIG / Material 3 Switch */}
              <button
                type="button"
                role="switch"
                disabled={userRole === 'viewer'}
                aria-checked={userRole !== 'viewer' && geminiEnabled}
                onClick={() => {
                  if (userRole !== 'viewer') {
                    onToggleGemini?.(!geminiEnabled);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  userRole === 'viewer'
                    ? 'opacity-40 cursor-not-allowed bg-surface-hover border-border'
                    : geminiEnabled
                    ? 'bg-google-blue cursor-pointer'
                    : 'bg-surface-hover border-border cursor-pointer'
                }`}
                title={
                  userRole === 'viewer'
                    ? 'Gemini is disabled and uneditable for View Only ledgers'
                    : geminiEnabled
                    ? 'Disable Gemini for this ledger'
                    : 'Enable Gemini for this ledger'
                }
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    geminiEnabled && userRole !== 'viewer' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <div className="space-y-1.5">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          Preferences
        </div>

        <div className="bg-surface rounded-3xl border border-border p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-text-primary shrink-0">
                {themeMode === 'system' ? (
                  <Laptop size={16} />
                ) : themeMode === 'dark' || (darkMode && !themeMode) ? (
                  <Moon size={16} />
                ) : (
                  <Sun size={16} />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-text-primary">Theme Appearance</div>
                <div className="text-xs text-text-secondary">Light, dark, or automatic system match</div>
              </div>
            </div>

            {/* 3-State Segmented Control */}
            <div className="inline-flex p-1 rounded-2xl bg-surface-hover border border-border self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onSelectThemeMode?.('light')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                  themeMode === 'light'
                    ? 'bg-surface text-text-primary shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Sun size={13} />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectThemeMode?.('dark')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                  themeMode === 'dark'
                    ? 'bg-surface text-text-primary shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Moon size={13} />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectThemeMode?.('system')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                  themeMode === 'system'
                    ? 'bg-surface text-google-blue shadow-xs font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Laptop size={13} />
                <span>System</span>
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Guide & About */}
      {onOpenOnboarding && (
        <div className="space-y-1.5">
          <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
            About & Guide
          </div>

          <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="w-full p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/60 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles size={17} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    Welcome Guide & Quick Start
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    Quick actions & core transformations
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-google-blue font-medium shrink-0">
                <span>View</span>
                <ChevronRight size={15} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal when Signing Out with Pending Offline Changes */}
      {showPendingSignOutConfirm && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CloudUpload size={22} strokeWidth={2.2} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-semibold text-text-primary">
                Unsynced Offline Changes
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                You have {pendingSyncCount} {pendingSyncCount === 1 ? 'change' : 'changes'} saved on this device waiting to sync. They will remain safely on this device and auto-upload when you sign back in to this Google Account online.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPendingSignOutConfirm(false)}
                className="flex-1 h-11 border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPendingSignOutConfirm(false);
                  logOut();
                }}
                className="flex-1 h-11 bg-google-red hover:bg-red-700 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Category Deletion (Apple HIG & Google M3) */}
      {deleteCategoryKey && categories[deleteCategoryKey] && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div 
            className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-text-primary leading-snug">
                  Delete "{categories[deleteCategoryKey].name}"?
                </h4>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {(() => {
                    const txCnt = transactions.filter(t => (t.category || 'other') === deleteCategoryKey).length;
                    const shopCnt = shoppingItems.filter(s => (s.category || 'other') === deleteCategoryKey).length;
                    const recCnt = recurringExpenses.filter(r => (r.category || 'other') === deleteCategoryKey).length;
                    const totalCnt = txCnt + shopCnt + recCnt;

                    if (totalCnt > 0) {
                      return (
                        <>
                          <span className="font-semibold text-text-primary">
                            {totalCnt} {totalCnt === 1 ? 'item' : 'items'}
                          </span>{' '}
                          ({txCnt > 0 ? `${txCnt} ${txCnt === 1 ? 'expense' : 'expenses'}` : ''}
                          {txCnt > 0 && (shopCnt > 0 || recCnt > 0) ? ', ' : ''}
                          {shopCnt > 0 ? `${shopCnt} shopping` : ''}
                          {shopCnt > 0 && recCnt > 0 ? ', ' : ''}
                          {recCnt > 0 ? `${recCnt} recurring` : ''}) currently using this category will automatically be changed to{' '}
                          <strong className="text-purple-600 dark:text-purple-400">Other</strong> so your records stay intact.
                        </>
                      );
                    }
                    return 'Are you sure you want to delete this category? No expenses or items are currently using it.';
                  })()}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeletingCat}
                onClick={() => setDeleteCategoryKey(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCat}
                onClick={async () => {
                  if (onDeleteCategory && deleteCategoryKey) {
                    setIsDeletingCat(true);
                    try {
                      await onDeleteCategory(deleteCategoryKey);
                      setDeleteCategoryKey(null);
                    } finally {
                      setIsDeletingCat(false);
                    }
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isDeletingCat ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Reassigning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete & Reassign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
