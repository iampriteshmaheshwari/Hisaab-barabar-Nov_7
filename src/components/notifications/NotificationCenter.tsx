import React, { useState, useRef } from 'react';
import { 
  Bell, 
  ShoppingBag, 
  BarChart2, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Users, 
  Smartphone, 
  Sparkles, 
  Check, 
  X,
  Play,
  ShieldCheck,
  ReceiptText,
  IndianRupee,
  HandCoins
} from 'lucide-react';
import type { AppNotification } from '../../types';
import { formatDigestTime } from '../../services/notificationService';

interface NotificationCenterProps {
  notifications: AppNotification[];
  currentUserId?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  digestTime?: string;
  groupType?: 'budget' | 'split';
  onClose: () => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onClearAll?: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onSelectNotification?: (notification: AppNotification) => void;
  onTriggerTestDailyDigest: () => void;
  onTriggerTestSplitNotification?: () => void;
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPushPermission: () => Promise<void>;
}

export function NotificationCenter({
  notifications,
  currentUserId,
  anchorRef,
  digestTime = '21:00',
  groupType = 'budget',
  onClose,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onDeleteNotification,
  onSelectNotification,
  onTriggerTestDailyDigest,
  onTriggerTestSplitNotification,
  pushPermission,
  onRequestPushPermission
}: NotificationCenterProps) {
  const isSplit = groupType === 'split';
  const [activeFilter, setActiveFilter] = useState<'all' | 'buying' | 'daily' | 'split' | 'settle'>('all');
  const [isSimulating, setIsSimulating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const formattedDigestTime = formatDigestTime(digestTime);

  const effectiveUserId = currentUserId || 'local_user';

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'buying') return n.type === 'BUYING_ITEM_ADDED';
    if (activeFilter === 'daily') return n.type === 'DAILY_EXPENSE_SUMMARY';
    if (activeFilter === 'split') return n.type === 'SPLIT_EXPENSE_ADDED';
    if (activeFilter === 'settle') return n.type === 'SETTLEMENT_RECORDED' || n.type === 'SETTLEMENT_REMINDER';
    return true;
  });

  const unreadCount = notifications.filter(
    n => !n.readBy || !n.readBy.includes(effectiveUserId)
  ).length;

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await onTriggerTestDailyDigest();
    } finally {
      setTimeout(() => setIsSimulating(false), 600);
    }
  };

  return (
    <div 
      id="notification-center-menu"
      ref={cardRef}
      className="fixed top-[calc(3.5rem+env(safe-area-inset-top,0px))] right-3 left-3 max-w-sm ml-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:absolute sm:w-96 max-h-[min(600px,calc(100dvh-5rem))] z-50 bg-surface rounded-2xl shadow-2xl border border-border text-text-primary select-none flex flex-col ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
    >
      {/* Upward connector arrow matching Apple & Google popover style */}
      <div 
        className="absolute -top-1.5 right-11 sm:right-3.5 w-3.5 h-3.5 bg-surface border-t border-l border-border/90 rotate-45 z-20 pointer-events-none" 
        aria-hidden="true" 
      />

      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-border/60 bg-surface/50 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
            <Bell size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-semibold text-text-primary">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-google-blue text-white">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              {isSplit ? 'Split Bills, Balances & Settlements' : 'Daily Digest & Buying Alerts'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-2 py-1 rounded-lg text-xs font-medium text-google-blue hover:bg-google-blue/10 transition-colors flex items-center gap-1 cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck size={13} />
              <span>Read all</span>
            </button>
          )}
          {notifications.length > 0 && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-2 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1 cursor-pointer"
              title="Clear all notifications"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Close notifications"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Device Push Notification Status Banner */}
      <div className="px-3.5 py-2 border-b border-border/40 bg-surface-hover/40 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 text-text-secondary truncate">
          <Smartphone size={13} className="shrink-0 text-text-secondary" />
          <span className="truncate">
            {pushPermission === 'granted'
              ? 'Push notifications active'
              : pushPermission === 'denied'
              ? 'Push blocked in browser settings'
              : 'Push notifications disabled'}
          </span>
        </div>
        {pushPermission !== 'granted' && pushPermission !== 'unsupported' ? (
          <button
            type="button"
            onClick={onRequestPushPermission}
            className="px-2.5 py-1 rounded-lg bg-google-blue hover:bg-google-blue-hover text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Enable Push
          </button>
        ) : pushPermission === 'granted' ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-google-blue dark:text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-google-blue" />
            Active
          </span>
        ) : null}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center px-3 pt-2 pb-1 gap-1 border-b border-border/40 shrink-0 bg-surface">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-google-blue/10 text-google-blue font-semibold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          All ({notifications.length})
        </button>

        {isSplit ? (
          <>
            <button
              type="button"
              onClick={() => setActiveFilter('split')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'split'
                  ? 'bg-google-blue/10 text-google-blue dark:text-blue-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <ReceiptText size={11} />
              Split Bills
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('settle')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'settle'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <Check size={11} strokeWidth={2.5} />
              Settlements
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveFilter('buying')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'buying'
                  ? 'bg-google-blue/10 text-google-blue dark:text-blue-400 font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <ShoppingBag size={11} />
              Buying List
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('daily')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'daily'
                  ? 'bg-blue-500/10 text-google-blue font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <BarChart2 size={11} />
              Daily Digests
            </button>
          </>
        )}
      </div>

      {/* Notification List (Scrollable) */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-[160px] p-1.5 space-y-1">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-surface-hover mx-auto flex items-center justify-center text-text-secondary">
              <Check size={20} />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              All caught up!
            </p>
            <p className="text-xs text-text-secondary max-w-xs mx-auto leading-relaxed">
              {isSplit
                ? activeFilter === 'split'
                  ? 'No split expense notifications yet. New bills logged by members will appear here.'
                  : activeFilter === 'settle'
                  ? 'No settlement activity yet. Settle up records will appear here.'
                  : 'Notifications for shared bills, balance alerts, and settlements will appear here.'
                : activeFilter === 'buying'
                ? 'No items added to the buying list yet. Add items in the Lists tab to receive alerts.'
                : activeFilter === 'daily'
                ? `Daily digests summarize days when expenses are recorded (scheduled for ${formattedDigestTime}).`
                : `Notifications for daily expense summaries (${formattedDigestTime}) and buying list additions will appear here.`}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isRead = item.readBy ? item.readBy.includes(effectiveUserId) : false;
            const isDaily = item.type === 'DAILY_EXPENSE_SUMMARY';
            const isBuying = item.type === 'BUYING_ITEM_ADDED';
            const isMemberJoined = item.type === 'MEMBER_JOINED';
            const isCodeRotated = item.type === 'INVITE_CODE_ROTATED';
            const isSplitExpense = item.type === 'SPLIT_EXPENSE_ADDED';
            const isSettlement = item.type === 'SETTLEMENT_RECORDED';
            const isReminder = item.type === 'SETTLEMENT_REMINDER';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!isRead) onMarkRead(item.id);
                  if (onSelectNotification) onSelectNotification(item);
                }}
                className={`p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer group relative flex items-start gap-2.5 ${
                  isRead 
                    ? 'hover:bg-surface-hover/80 text-text-secondary' 
                    : 'bg-google-blue/5 hover:bg-google-blue/10 border border-google-blue/20 text-text-primary'
                }`}
              >
                {/* Type Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isDaily
                      ? 'bg-blue-500/15 text-google-blue'
                      : isBuying
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : isMemberJoined
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                      : isSplitExpense
                      ? 'bg-blue-500/15 text-google-blue'
                      : isSettlement
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : isReminder
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isDaily ? (
                    <BarChart2 size={16} />
                  ) : isBuying ? (
                    <ShoppingBag size={16} />
                  ) : isMemberJoined ? (
                    <Users size={16} />
                  ) : isSplitExpense ? (
                    <ReceiptText size={16} />
                  ) : isSettlement ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : isReminder ? (
                    <Clock size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {isDaily
                        ? 'Daily Digest'
                        : isBuying
                        ? 'Buying Item'
                        : isMemberJoined
                        ? 'Member Joined'
                        : isCodeRotated
                        ? 'Security Alert'
                        : isSplitExpense
                        ? 'Split Bill'
                        : isSettlement
                        ? 'Payment Settle'
                        : isReminder
                        ? 'Reminder'
                        : 'Notification'}
                    </span>
                    <span className="text-xs text-text-secondary truncate">
                      • {item.groupName}
                    </span>
                    {!isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-google-blue shrink-0" />
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-text-primary mt-0.5 leading-snug">
                    {item.title}
                  </p>

                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Split Expense Rupee and details tag */}
                  {(isSplitExpense || isSettlement || isReminder) && item.totalAmount && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-google-blue/10 text-google-blue dark:text-blue-300">
                        ₹{item.totalAmount.toLocaleString('en-IN')}
                      </span>
                      {item.paidByName && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-hover text-text-secondary">
                          {isSettlement ? `${item.paidByName} → ${item.settledToName}` : `Paid by ${item.paidByName}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Buying Item tags */}
                  {!isDaily && !isSplitExpense && !isSettlement && (item.itemCategory || item.itemByWhen) && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {item.itemCategory && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-google-blue/10 text-google-blue dark:text-blue-300">
                          {item.itemCategory}
                        </span>
                      )}
                      {item.itemByWhen && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-hover text-text-secondary flex items-center gap-1">
                          <Clock size={11} />
                          {item.itemByWhen}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Daily digest member tags */}
                  {isDaily && item.membersWithAccess && item.membersWithAccess.length > 0 && (
                    <div className="mt-1.5 text-xs text-text-secondary flex items-center gap-1">
                      <Users size={12} className="shrink-0" />
                      <span className="truncate">
                        Access: {item.membersWithAccess.slice(0, 3).join(', ')}
                        {item.membersWithAccess.length > 3 ? ` +${item.membersWithAccess.length - 3} more` : ''}
                      </span>
                    </div>
                  )}

                  <div className="mt-1 text-xs text-text-secondary/70">
                    {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' • '}
                    {new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                {/* Delete button (accessible on mobile touch and desktop hover) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotification(item.id);
                  }}
                  className="p-1.5 text-text-secondary hover:text-red-500 rounded-lg hover:bg-surface shrink-0 opacity-70 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove notification"
                  aria-label="Delete notification"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions: Test simulation */}
      <div className="p-2.5 sm:p-3 border-t border-border/60 bg-surface/50 backdrop-blur-xs flex items-center justify-between gap-2 shrink-0">
        <div className="text-xs text-text-secondary flex items-center gap-1.5 truncate">
          <Sparkles size={13} className={isSplit ? 'text-emerald-500 shrink-0' : 'text-amber-500 shrink-0'} />
          <span className="truncate">
            {isSplit ? 'Real-time Split Bill Sync' : `Daily at ${formattedDigestTime} Enabled`}
          </span>
        </div>

        {isSplit ? (
          onTriggerTestSplitNotification && (
            <button
              type="button"
              onClick={async () => {
                setIsSimulating(true);
                try {
                  await onTriggerTestSplitNotification();
                } finally {
                  setTimeout(() => setIsSimulating(false), 600);
                }
              }}
              disabled={isSimulating}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-hover hover:bg-surface-hover/80 text-text-primary border border-border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
              title="Send a sample settlement reminder notification"
            >
              <Play size={11} className={isSimulating ? 'animate-spin' : ''} />
              <span>{isSimulating ? 'Sending...' : 'Test Reminder Alert'}</span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={handleSimulate}
            disabled={isSimulating}
            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-hover hover:bg-surface-hover/80 text-text-primary border border-border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            title={`Simulate ${formattedDigestTime} daily summary check now`}
          >
            <Play size={11} className={isSimulating ? 'animate-spin' : ''} />
            <span>{isSimulating ? 'Simulating...' : `Test ${formattedDigestTime}`}</span>
          </button>
        )}
      </div>
    </div>
  );
}
