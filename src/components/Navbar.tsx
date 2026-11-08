import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  Users, 
  ChevronDown, 
  LogOut, 
  Share2,
  Wallet,
  Sun,
  Moon,
  Laptop,
  Plus,
  Bell,
  LogIn,
  Download,
  CloudUpload,
  UserCog,
  User,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ExpenseGroup, UserRole, ThemeMode, AppNotification } from '../types';
import { NotificationCenter } from './notifications/NotificationCenter';
import { GeminiIcon } from './icons/GeminiIcon';
import { shareGroupInviteLink } from '../utils/shareUtils';

interface NavbarProps {
  groups: ExpenseGroup[];
  activeGroup: ExpenseGroup | null;
  userRole: UserRole;
  onOpenGroupModal: (initialTab?: 'members' | 'groups' | 'create') => void;
  onOpenJoinModal: () => void;
  onOpenInviteModal?: () => void;
  onSelectGroup: (groupId: string) => void;
  isOnline: boolean;
  isSyncing?: boolean;
  pendingSyncCount?: number;
  themeMode?: ThemeMode;
  onCycleThemeMode?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  notifications?: AppNotification[];
  onMarkReadNotification?: (notificationId: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onClearAllNotifications?: () => void;
  onDeleteNotification?: (notificationId: string) => void;
  onSelectNotification?: (notification: AppNotification) => void;
  onTriggerTestDailyDigest?: () => void;
  onTriggerTestSplitNotification?: () => void;
  pushPermission?: NotificationPermission | 'unsupported';
  onRequestPushPermission?: () => Promise<void>;
  digestTime?: string;
  isStandalone?: boolean;
  onOpenInstallModal?: () => void;
  onOpenProfileSetup?: () => void;
  onShowToast?: (msg: string | { message: string; subMessage?: string; type?: 'info' | 'success' | 'warning' | 'error' }) => void;
}

interface GroupPopoverCoords {
  top: number;
  left: number;
  width: number;
  arrowLeft: number;
}

function getRoleForGroup(grp: ExpenseGroup, currentUid?: string, currentEmail?: string): UserRole {
  if (!currentUid) return 'owner'; // Local sandbox guest has full access
  const cleanEmail = (currentEmail || '').toLowerCase().trim();
  const isOwner = grp.createdBy === currentUid || (grp.ownerEmail && grp.ownerEmail.toLowerCase() === cleanEmail);
  if (isOwner) return 'owner';
  const memberData = grp.members && (grp.members[currentUid] || (cleanEmail ? grp.members[cleanEmail] : undefined));
  if (memberData?.role) return memberData.role;
  return 'viewer';
}

export function Navbar({
  groups,
  activeGroup,
  userRole,
  onOpenGroupModal,
  onOpenJoinModal,
  onOpenInviteModal,
  onSelectGroup,
  isOnline,
  isSyncing = false,
  pendingSyncCount = 0,
  themeMode,
  onCycleThemeMode,
  darkMode,
  onToggleDarkMode,
  notifications = [],
  onMarkReadNotification,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onDeleteNotification,
  onSelectNotification,
  onTriggerTestDailyDigest,
  onTriggerTestSplitNotification,
  pushPermission = 'default',
  onRequestPushPermission,
  digestTime = '21:00',
  isStandalone = false,
  onOpenInstallModal,
  onOpenProfileSetup,
  onShowToast
}: NavbarProps) {
  const { user, signInWithGoogle, logOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showPendingSignOutConfirm, setShowPendingSignOutConfirm] = useState(false);
  const [groupCoords, setGroupCoords] = useState<GroupPopoverCoords | null>(null);

  const groupMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const activeGroupItemRef = useRef<HTMLButtonElement>(null);

  const currentUid = user?.uid || 'local_user';
  const unreadCount = notifications.filter(
    n => !n.readBy || !n.readBy.includes(currentUid)
  ).length;

  // Auto-scroll to ensure active ledger is cleanly visible whenever group menu is opened
  useEffect(() => {
    if (showGroupMenu) {
      const timer = setTimeout(() => {
        if (activeGroupItemRef.current) {
          activeGroupItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showGroupMenu]);

  // Viewport & Safe-Margin Geometry Engine for Group Ledger Menu
  // On desktop and tablet (sm: 640px+), CSS absolute positioning handles anchoring cleanly and instantly without scripts.
  // On mobile, bounds card inside [12px, window.innerWidth - 12px] with proper anchor clearance.
  const computeGroupPosition = () => {
    if (!groupMenuRef.current) return;
    const rect = groupMenuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;

    if (vw >= 640) {
      setGroupCoords(null);
      return;
    }

    const margin = 12; // 12px safe boundary from viewport edges
    const idealWidth = 320;
    const cardWidth = Math.min(idealWidth, vw - margin * 2);

    let cardLeft = rect.left;

    // Prevent card from overflowing past right screen edge
    if (cardLeft + cardWidth > vw - margin) {
      cardLeft = vw - margin - cardWidth;
    }
    // Prevent card from overflowing past left screen edge
    if (cardLeft < margin) {
      cardLeft = margin;
    }

    setGroupCoords({
      top: rect.bottom + 6,
      left: cardLeft,
      width: cardWidth,
      arrowLeft: 0
    });
  };

  const handleToggleGroupMenu = () => {
    if (!showGroupMenu) {
      computeGroupPosition();
      setShowUserMenu(false);
      setShowNotificationMenu(false);
      setShowGroupMenu(true);
    } else {
      setShowGroupMenu(false);
    }
  };

  useLayoutEffect(() => {
    if (showGroupMenu) {
      computeGroupPosition();
    }
  }, [showGroupMenu]);

  useEffect(() => {
    if (!showGroupMenu) return;
    const handleUpdate = () => {
      computeGroupPosition();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('orientationchange', handleUpdate);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, [showGroupMenu]);

  const isAnyMenuOpen = showGroupMenu || showUserMenu || showNotificationMenu;

  const closeAllMenus = () => {
    setShowGroupMenu(false);
    setShowUserMenu(false);
    setShowNotificationMenu(false);
  };

  // Auto-close menus when clicking anywhere outside on the page or pressing Escape
  useEffect(() => {
    if (!isAnyMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showGroupMenu && groupMenuRef.current && !groupMenuRef.current.contains(target)) {
        setShowGroupMenu(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (showNotificationMenu && notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setShowNotificationMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnyMenuOpen, showGroupMenu, showUserMenu, showNotificationMenu]);

  return (
    <>
      {/* Universal Scrim & Blur Backdrop for open navbar menus (Apple HIG & Material 3 Popovers) */}
      {isAnyMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 dark:bg-black/55 backdrop-blur-sm transition-all duration-200 animate-in fade-in cursor-pointer select-none"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAllMenus();
          }}
          aria-hidden="true"
        />
      )}

      <header 
        className={`sticky top-0 z-50 pt-[env(safe-area-inset-top,0px)] transition-all duration-200 ${
          isAnyMenuOpen 
            ? 'bg-transparent border-transparent' 
            : 'backdrop-blur-md bg-surface/85 border-b border-border'
        }`}
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-6 md:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Identity + Group Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`flex items-center shrink-0 transition-opacity duration-200 ${isAnyMenuOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-google-blue text-white flex items-center justify-center shadow-xs shrink-0" title="Hisaab Barabar">
                <Wallet size={16} strokeWidth={2.2} />
              </div>
            </div>

            <div className={`h-4 w-[1px] bg-border mx-0.5 hidden min-[440px]:block shrink-0 transition-opacity duration-200 ${isAnyMenuOpen ? 'opacity-30' : 'opacity-100'}`} />

            {/* Group Switcher Button */}
            <div ref={groupMenuRef} className="relative min-w-0 max-w-full shrink">
              <button
                type="button"
                onClick={handleToggleGroupMenu}
                className={`inline-flex items-center gap-1.5 sm:gap-2 h-8 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all cursor-pointer select-none max-w-[180px] min-[360px]:max-w-[210px] min-[400px]:max-w-[250px] sm:max-w-[320px] md:max-w-[360px] min-w-0 ${
                  showGroupMenu 
                    ? 'relative z-50 bg-surface text-google-blue border-google-blue/40 shadow-sm ring-2 ring-google-blue/20' 
                    : showUserMenu || showNotificationMenu
                    ? 'opacity-30 pointer-events-none border-transparent'
                    : 'bg-surface-hover/80 hover:bg-surface-hover border border-border text-text-primary hover:border-border/90 active:scale-98'
                }`}
                title={activeGroup ? activeGroup.name : 'Personal'}
              >
                <span 
                  className={`w-1.5 h-1.5 rounded-full shrink-0 shadow-xs ${
                    !isOnline 
                      ? 'bg-amber-500 shadow-amber-500/50' 
                      : isSyncing 
                      ? 'bg-google-blue animate-pulse shadow-google-blue/50' 
                      : 'bg-google-blue shadow-google-blue/50'
                  }`} 
                  title={!isOnline ? 'Offline mode' : isSyncing ? 'Syncing...' : 'Live sync'} 
                />
                <span className="truncate min-w-0">
                  {activeGroup ? activeGroup.name : 'Personal'}
                </span>
                <ChevronDown 
                  size={12} 
                  className={`text-text-secondary shrink-0 transition-transform duration-200 ${showGroupMenu ? 'rotate-180 text-google-blue' : ''}`} 
                />
              </button>

              {/* Group Dropdown Menu (Apple HIG & Material 3 Popover) */}
              {showGroupMenu && (
                <div 
                  style={groupCoords ? {
                    position: 'fixed',
                    top: `${groupCoords.top}px`,
                    left: `${groupCoords.left}px`,
                    width: `${groupCoords.width}px`
                  } : undefined}
                  className={`fixed sm:absolute sm:top-full sm:mt-1.5 sm:left-0 sm:right-auto sm:w-80 z-50 bg-surface rounded-2xl shadow-xl border border-border text-text-primary p-2 overflow-hidden font-sans ring-1 ring-black/5 dark:ring-white/10 max-h-[min(540px,calc(100dvh-5rem))] flex flex-col ${
                    !groupCoords ? 'top-[calc(3.5rem+env(safe-area-inset-top,0px))] left-3 w-[min(320px,calc(100vw-24px))] sm:left-0 sm:right-auto sm:w-80' : ''
                  }`}
                >
                  <div className="relative z-10 flex flex-col min-h-0">
                    <div className="px-3 py-2 flex items-center justify-between text-xs font-semibold text-text-secondary border-b border-border/80 mb-1 shrink-0">
                      <span>Groups & Ledgers</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowGroupMenu(false);
                          onOpenGroupModal('create');
                        }}
                        className="text-google-blue hover:text-google-blue-hover cursor-pointer font-medium flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md hover:bg-google-blue/10 transition-colors"
                      >
                        <Plus size={13} strokeWidth={2.2} />
                        <span>New</span>
                      </button>
                    </div>

                    <div className="max-h-[min(340px,46vh)] overflow-y-auto overscroll-contain py-1 space-y-0.5 pr-1 pb-1 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-text-secondary/30 scrollbar-track-transparent">
                      {groups.map((grp) => {
                        const isActive = activeGroup?.id === grp.id;
                        const role = isActive ? userRole : getRoleForGroup(grp, user?.uid, user?.email);
                        const roleLabel = role === 'owner' ? 'Admin' : role === 'viewer' ? 'View Only' : 'Can Edit';
                        const roleClass = role === 'owner'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-300/80 dark:border-purple-800'
                          : role === 'viewer'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 border border-blue-300/80 dark:border-blue-800';

                        return (
                          <button
                            key={grp.id}
                            ref={isActive ? activeGroupItemRef : undefined}
                            type="button"
                            onClick={() => {
                              onSelectGroup(grp.id);
                              setShowGroupMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer select-none ${
                              isActive 
                                ? 'bg-google-blue/10 dark:bg-google-blue/15 text-google-blue font-semibold ring-1 ring-google-blue/20 shadow-xs' 
                                : 'text-text-primary hover:bg-surface-hover active:bg-surface-active'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {grp.type === 'split' ? (
                                <Users
                                  size={15}
                                  className={`shrink-0 transition-colors ${
                                    isActive ? 'text-google-blue' : 'text-text-secondary/80'
                                  }`}
                                  fill={isActive ? 'currentColor' : 'none'}
                                  strokeWidth={isActive ? 2.2 : 1.75}
                                />
                              ) : (
                                <Wallet
                                  size={15}
                                  className={`shrink-0 transition-colors ${
                                    isActive ? 'text-google-blue' : 'text-text-secondary/80'
                                  }`}
                                  fill={isActive ? 'currentColor' : 'none'}
                                  strokeWidth={isActive ? 2.2 : 1.75}
                                />
                              )}
                              <span className={`truncate text-xs ${isActive ? 'font-semibold text-google-blue' : 'font-medium text-text-primary'}`}>
                                {grp.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {grp.type === 'split' && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-google-blue bg-google-blue/10 border border-google-blue/20 shrink-0 leading-none">
                                  Split
                                </span>
                              )}
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 tracking-tight min-w-[58px] text-center leading-none ${roleClass}`}>
                                {roleLabel}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-border/80 mt-1 pt-1.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowGroupMenu(false);
                          onOpenGroupModal('create');
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-google-blue hover:bg-google-blue/10 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <Plus size={14} className="shrink-0" />
                        <span>Create New Ledger</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowGroupMenu(false);
                          onOpenGroupModal('members');
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <UserCog size={14} className="text-text-secondary shrink-0" />
                        <span>Manage Group & Members</span>
                      </button>
                      {activeGroup && (
                        <button
                          type="button"
                          onClick={async () => {
                            setShowGroupMenu(false);
                            if (!user) {
                              if (onOpenInviteModal) {
                                onOpenInviteModal();
                              }
                              return;
                            }
                            const notifyFn = (msg: string) => {
                              if (onShowToast) {
                                onShowToast({ message: msg, type: 'info' });
                              }
                            };
                            await shareGroupInviteLink(activeGroup, notifyFn);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                          title={`Share ${activeGroup.name} invite link`}
                        >
                          <Share2 size={14} className="text-text-secondary shrink-0" />
                          <span className="truncate">Share "{activeGroup.name}"</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowGroupMenu(false);
                          onOpenJoinModal();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <LogIn size={14} className="text-google-blue shrink-0" />
                        <span>Join Ledger with Code</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Offline / Sync Status Pill (Apple HIG & Material 3 styling) */}
            {!isOnline ? (
              <div 
                className={`inline-flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none animate-in fade-in duration-150 ${
                  isAnyMenuOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'
                }`}
                title={pendingSyncCount && pendingSyncCount > 0 ? `${pendingSyncCount} offline change(s) waiting to sync` : 'Offline · Changes saved locally'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="hidden min-[480px]:inline">Offline</span>
                {pendingSyncCount && pendingSyncCount > 0 ? (
                  <span className="text-[10px] px-1 py-0.2 rounded-full bg-amber-500/20 font-bold shrink-0">{pendingSyncCount}</span>
                ) : null}
              </div>
            ) : isSyncing ? (
              <div 
                className={`inline-flex items-center gap-1.5 h-7 px-2 sm:px-2.5 rounded-full text-[11px] font-medium bg-google-blue/10 text-google-blue border border-google-blue/20 shrink-0 select-none animate-in fade-in duration-150 ${
                  isAnyMenuOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'
                }`}
                title="Syncing offline changes to cloud..."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-google-blue animate-ping shrink-0" />
                <span className="hidden min-[480px]:inline">Syncing...</span>
                {pendingSyncCount && pendingSyncCount > 0 ? (
                  <span className="text-[10px] px-1 py-0.2 rounded-full bg-google-blue/20 font-bold shrink-0">{pendingSyncCount}</span>
                ) : null}
              </div>
            ) : null}
          </div>

        {/* Right: Notifications + Theme Toggle + Authentic Google Account Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Notification Bell with Badge & Popover */}
          <div ref={notificationMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowGroupMenu(false);
                setShowUserMenu(false);
                const nextOpen = !showNotificationMenu;
                setShowNotificationMenu(nextOpen);
                if (nextOpen && unreadCount > 0 && onMarkAllNotificationsRead) {
                  onMarkAllNotificationsRead();
                }
              }}
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition-all cursor-pointer border ${
                showNotificationMenu
                  ? 'relative z-50 bg-surface border-google-blue ring-2 ring-google-blue/40 shadow-lg text-google-blue'
                  : isAnyMenuOpen
                  ? 'opacity-30 pointer-events-none border-transparent text-text-secondary'
                  : 'border-border/40 hover:border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover active:scale-95'
              }`}
              title={unreadCount > 0 ? `${unreadCount} new notification(s)` : 'Notifications'}
              aria-label="Notifications menu"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-google-red text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotificationMenu && (
              <NotificationCenter
                anchorRef={notificationMenuRef}
                notifications={notifications}
                currentUserId={currentUid}
                digestTime={digestTime}
                groupType={activeGroup?.type || 'budget'}
                onClose={() => setShowNotificationMenu(false)}
                onMarkRead={(id) => onMarkReadNotification && onMarkReadNotification(id)}
                onMarkAllRead={() => onMarkAllNotificationsRead && onMarkAllNotificationsRead()}
                onClearAll={onClearAllNotifications}
                onDeleteNotification={(id) => onDeleteNotification && onDeleteNotification(id)}
                onSelectNotification={(notif) => {
                  setShowNotificationMenu(false);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
                onTriggerTestDailyDigest={() => onTriggerTestDailyDigest && onTriggerTestDailyDigest()}
                onTriggerTestSplitNotification={onTriggerTestSplitNotification}
                pushPermission={pushPermission}
                onRequestPushPermission={async () => {
                  if (onRequestPushPermission) await onRequestPushPermission();
                }}
              />
            )}
          </div>

          {!isStandalone && onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className={`w-8 h-8 rounded-full shrink-0 hidden min-[440px]:flex items-center justify-center text-text-secondary hover:text-google-blue hover:bg-google-blue/10 active:scale-95 transition-all cursor-pointer border border-border/40 hover:border-google-blue/30 ${
                isAnyMenuOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'
              }`}
              title="Install Hisaab Barabar as an App"
              aria-label="Install App"
            >
              <Download size={15} />
            </button>
          )}

          {(onCycleThemeMode || onToggleDarkMode) && (
            <button
              type="button"
              onClick={onCycleThemeMode || onToggleDarkMode}
              className={`w-8 h-8 rounded-full shrink-0 hidden min-[520px]:flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover active:scale-95 transition-all cursor-pointer border border-border/40 hover:border-border ${
                isAnyMenuOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'
              }`}
              title={
                themeMode === 'system'
                  ? 'Theme: System (Auto) - Click for Light'
                  : themeMode === 'light'
                  ? 'Theme: Light - Click for Dark'
                  : themeMode === 'dark'
                  ? 'Theme: Dark - Click for System'
                  : darkMode
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
              aria-label="Toggle theme appearance"
            >
              {themeMode === 'system' ? (
                <Laptop size={15} />
              ) : themeMode === 'dark' || (darkMode && !themeMode) ? (
                <Moon size={15} />
              ) : (
                <Sun size={15} />
              )}
            </button>
          )}

          {user ? (
            <div ref={userMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowGroupMenu(false);
                  setShowNotificationMenu(false);
                  setShowUserMenu(!showUserMenu);
                }}
                className={`w-8 h-8 rounded-full shrink-0 p-0.5 border shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center select-none focus:outline-hidden ${
                  showUserMenu
                    ? 'relative z-50 bg-surface border-google-blue ring-2 ring-google-blue/40 shadow-lg'
                    : showGroupMenu
                    ? 'opacity-30 pointer-events-none border-transparent'
                    : 'border-border/80 hover:border-google-blue/40 hover:shadow-xs bg-surface'
                }`}
                title={user.displayName ? `${user.displayName} (${user.email})` : user.email || 'Google Account'}
                aria-label="Google Account menu"
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-surface-active flex items-center justify-center">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-xs font-bold text-google-blue font-sans">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute top-full mt-2 right-0 w-[270px] max-w-[calc(100vw-20px)] bg-surface rounded-2xl shadow-2xl border border-border z-50 p-2 font-sans">
                  {/* Popover Arrow Indicator pointing up to the user avatar in navbar */}
                  <div className="absolute -top-1.5 right-3.5 w-3 h-3 rotate-45 bg-surface border-t border-l border-border pointer-events-none" />

                  <div className="relative z-10">
                    <div className="px-3 py-2.5 border-b border-border mb-1 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-border bg-surface-active flex items-center justify-center">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.displayName || 'User'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xs font-bold text-google-blue">
                            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                            {user.displayName || 'Google Account'}
                          </span>
                          {onOpenProfileSetup && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                onOpenProfileSetup();
                              }}
                              className="text-[11px] font-medium text-google-blue hover:underline cursor-pointer shrink-0"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-text-secondary truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    {onOpenProfileSetup && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenProfileSetup();
                        }}
                        className="w-full text-left px-3 py-2 text-xs sm:text-sm text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center justify-between cursor-pointer font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-google-blue shrink-0" />
                          <span>Profile &amp; Receiving UPI</span>
                        </div>
                        <ChevronRight size={13} className="text-text-secondary shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenGroupModal('members');
                      }}
                      className="w-full text-left px-3 py-2 text-xs sm:text-sm text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Users size={14} className="text-text-secondary shrink-0" />
                      <span>Group Members & Roles</span>
                    </button>



                    {(onCycleThemeMode || onToggleDarkMode) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onCycleThemeMode) onCycleThemeMode();
                          else if (onToggleDarkMode) onToggleDarkMode();
                        }}
                        className="w-full text-left px-3 py-2 text-xs sm:text-sm text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center justify-between cursor-pointer font-medium"
                      >
                        <div className="flex items-center gap-2">
                          {themeMode === 'system' ? (
                            <Laptop size={14} className="text-text-secondary shrink-0" />
                          ) : themeMode === 'dark' || (darkMode && !themeMode) ? (
                            <Moon size={14} className="text-text-secondary shrink-0" />
                          ) : (
                            <Sun size={14} className="text-text-secondary shrink-0" />
                          )}
                          <span>Appearance</span>
                        </div>
                        <span className="text-xs text-text-secondary capitalize font-normal">
                          {themeMode || (darkMode ? 'Dark' : 'Light')}
                        </span>
                      </button>
                    )}

                    {!isStandalone && onOpenInstallModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenInstallModal();
                        }}
                        className="w-full text-left px-3 py-2 text-xs sm:text-sm text-text-primary hover:bg-surface-hover rounded-xl transition-colors flex items-center justify-between cursor-pointer font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <Download size={14} className="text-google-blue shrink-0" />
                          <span>Install App</span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-google-blue px-1.5 py-0.5 rounded-md bg-google-blue/10">
                          PWA
                        </span>
                      </button>
                    )}

                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          setShowUserMenu(false);
                          if (pendingSyncCount && pendingSyncCount > 0) {
                            setShowPendingSignOutConfirm(true);
                            return;
                          }
                          await logOut();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-google-red hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <LogOut size={14} className="shrink-0" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch {
                  // Handled cleanly in AuthContext
                }
              }}
              className="h-8 px-2.5 sm:px-3 rounded-full text-xs font-medium text-text-primary bg-surface hover:bg-surface-hover border border-border shadow-2xs hover:border-text-secondary/30 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 select-none"
              title="Sign in with Google to sync and share across devices"
            >
              {/* Official Google 'G' Icon */}
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
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
                You have {pendingSyncCount} {pendingSyncCount === 1 ? 'change' : 'changes'} saved on this device waiting to sync. They will remain securely on this device and auto-upload when you sign back in to this Google Account online.
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
                onClick={async () => {
                  setShowPendingSignOutConfirm(false);
                  await logOut();
                }}
                className="flex-1 h-11 bg-google-red hover:bg-red-700 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
