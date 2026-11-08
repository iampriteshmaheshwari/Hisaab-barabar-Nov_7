import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  arrayUnion 
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import type { AppNotification, ExpenseGroup, Transaction, ShoppingItem } from '../types';

// Check if native system notifications are supported
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current permission status
export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Request system notification permission
export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Could not request notification permission:', err);
    return Notification.permission;
  }
}

// Send native system push notification to iPhone, Android, tablet, or desktop
export async function showDeviceNotification(
  title: string, 
  options: {
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: unknown;
  }
) {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || '/icon.svg',
    badge: options.badge || '/icon.svg',
    tag: options.tag || 'hisaab-notification',
    data: options.data,
    vibrate: [100, 50, 100]
  };

  try {
    // If service worker is registered and ready, use it (recommended for Android & background tabs)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }

    // Direct Notification fallback (desktop browsers & iOS standalone)
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.warn('Could not trigger device notification:', err);
    return false;
  }
}

// Subscribe to group notifications from Firestore
export function subscribeToGroupNotifications(
  groupId: string,
  onNotificationsUpdate: (notifications: AppNotification[]) => void,
  onError?: (error: unknown) => void
) {
  const notifRef = collection(db, 'groups', groupId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Omit<AppNotification, 'id'>), id: d.id });
      });
      onNotificationsUpdate(list);
    },
    (error) => {
      console.warn(`Error subscribing to notifications for ${groupId}:`, error);
      if (onError) onError(error);
    }
  );
}

// Add notification to group in Firestore
export async function addGroupNotification(
  groupId: string,
  notification: Omit<AppNotification, 'id'>
): Promise<AppNotification> {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullNotification: AppNotification = {
    ...notification,
    id: notifId
  };

  await setDoc(doc(db, 'groups', groupId, 'notifications', notifId), fullNotification);
  return fullNotification;
}

// Mark a single notification as read by the user
export async function markNotificationAsRead(
  groupId: string,
  notificationId: string,
  userId: string
): Promise<void> {
  if (groupId.startsWith('local_') || groupId === 'local_group') {
    return;
  }
  try {
    await updateDoc(doc(db, 'groups', groupId, 'notifications', notificationId), {
      readBy: arrayUnion(userId)
    });
  } catch (err) {
    console.warn('Could not mark notification as read:', err);
  }
}

// Mark multiple notifications as read
export async function markAllNotificationsAsRead(
  groupId: string,
  notifications: AppNotification[],
  userId: string
): Promise<void> {
  if (groupId.startsWith('local_') || groupId === 'local_group') {
    return;
  }
  const unread = notifications.filter(n => !n.readBy?.includes(userId));
  await Promise.all(
    unread.map(n => 
      updateDoc(doc(db, 'groups', groupId, 'notifications', n.id), {
        readBy: arrayUnion(userId)
      }).catch(err => console.warn('Could not mark read for doc', n.id, err))
    )
  );
}

// Delete notification
export async function deleteNotification(
  groupId: string,
  notificationId: string
): Promise<void> {
  if (groupId.startsWith('local_') || groupId === 'local_group') {
    return;
  }
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'notifications', notificationId));
  } catch (err) {
    console.warn('Could not delete notification:', err);
  }
}

// Helper: Format member names for display
export function getGroupMemberNames(group: ExpenseGroup): string[] {
  if (!group.members) return ['Admin'];
  const names: string[] = [];
  Object.values(group.members).forEach(m => {
    const roleName = m.role === 'owner' ? 'Admin' : m.role === 'editor' ? 'Can Edit' : 'View Only';
    const roleLabel = m.role ? ` (${roleName})` : '';
    const name = m.displayName || m.email.split('@')[0];
    const full = `${name}${roleLabel}`;
    if (!names.includes(full)) {
      names.push(full);
    }
  });
  return names.length > 0 ? names : [group.ownerEmail || 'Admin'];
}

// Daily Expense Digest Time Configuration
export const DEFAULT_DIGEST_TIME = '21:00'; // 9:00 PM by default

export const DIGEST_TIME_PRESETS = [
  { label: '7:00 PM', value: '19:00' },
  { label: '8:00 PM', value: '20:00' },
  { label: '9:00 PM (Default)', value: '21:00' },
  { label: '10:00 PM', value: '22:00' }
] as const;

export function formatDigestTime(timeStr: string): string {
  if (!timeStr) return '9:00 PM';
  const parts = timeStr.split(':');
  if (parts.length < 2) return '9:00 PM';
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return '9:00 PM';
  
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  
  const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${formattedMinutes} ${period}`;
}

export function getUserDigestTime(userId?: string | null): string {
  try {
    if (userId) {
      const userSpecific = localStorage.getItem(`hisaab_digest_time_${userId}`);
      if (userSpecific && userSpecific.includes(':')) return userSpecific;
    }
    const globalPref = localStorage.getItem('hisaab_digest_time');
    if (globalPref && globalPref.includes(':')) return globalPref;
  } catch (e) {
    console.warn('Could not read digest time from localStorage', e);
  }
  return DEFAULT_DIGEST_TIME;
}

export function setUserDigestTime(time: string, userId?: string | null): void {
  try {
    localStorage.setItem('hisaab_digest_time', time);
    if (userId) {
      localStorage.setItem(`hisaab_digest_time_${userId}`, time);
    }
  } catch (e) {
    console.warn('Could not save digest time to localStorage', e);
  }
}

// Dispatch Daily Expense Summary Notification
export async function dispatchDailyExpenseSummary(
  group: ExpenseGroup,
  transactions: Transaction[],
  currentUser?: User | null,
  force: boolean = false
): Promise<AppNotification | null> {
  const todayIso = new Date().toISOString().split('T')[0];
  const storageKey = `hisaab_daily_notif_${group.id}_${todayIso}`;

  // If not forced and already generated today on this device, skip
  if (!force && localStorage.getItem(storageKey)) {
    return null;
  }

  // Filter transactions for today
  const todayTransactions = transactions.filter(t => t.date === todayIso);
  if (todayTransactions.length === 0 && !force) {
    return null; // Only trigger on days there was expense entry
  }

  const totalAmount = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const expenseCount = todayTransactions.length;
  const membersWithAccess = getGroupMemberNames(group);

  const title = `Daily Expense Digest • ${group.name}`;
  const message = expenseCount > 0
    ? `Today's total expense is ₹${totalAmount.toLocaleString('en-IN')} across ${expenseCount} transaction${expenseCount > 1 ? 's' : ''}. Accessible by ${membersWithAccess.length} member(s): ${membersWithAccess.join(', ')}`
    : `Daily check: No expenses were recorded today in ${group.name}. Accessible by: ${membersWithAccess.join(', ')}`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'DAILY_EXPENSE_SUMMARY',
    title,
    message,
    totalAmount,
    expenseCount,
    membersWithAccess,
    date: todayIso,
    createdBy: currentUser?.uid || 'system',
    createdByName: currentUser?.displayName || 'Hisaab Assistant',
    createdAt: new Date().toISOString(),
    readBy: currentUser ? [currentUser.uid] : []
  };

  localStorage.setItem(storageKey, 'true');

  // Push to system notification on iPhone, Android, tablets, desktops
  await showDeviceNotification(title, {
    body: message,
    tag: `daily-summary-${group.id}-${todayIso}`
  });

  // Save to Firestore if cloud group
  if (currentUser && !group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save daily notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Immediate Buying List Item Added Notification
export async function dispatchBuyingItemNotification(
  group: ExpenseGroup,
  item: ShoppingItem,
  addedByUser?: User | null
): Promise<AppNotification> {
  const userName = addedByUser?.displayName || addedByUser?.email?.split('@')[0] || 'A member';
  const categoryLabel = item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'General';
  
  let whenLabel = item.byWhen || 'whenever possible';
  if (whenLabel === 'today') whenLabel = 'Today';
  else if (whenLabel === 'tomorrow') whenLabel = 'Tomorrow';
  else if (whenLabel === 'whenever') whenLabel = 'Whenever possible';

  const title = `New Item on Buying List • ${group.name}`;
  const message = `${userName} added "${item.name}" (Category: ${categoryLabel}, Needed: ${whenLabel})`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'BUYING_ITEM_ADDED',
    title,
    message,
    itemName: item.name,
    itemCategory: categoryLabel,
    itemByWhen: whenLabel,
    createdBy: addedByUser?.uid || 'system',
    createdByName: userName,
    createdAt: new Date().toISOString(),
    readBy: addedByUser ? [addedByUser.uid] : []
  };

  // Push immediate system notification to iPhone, Android, tablets, desktops
  await showDeviceNotification(title, {
    body: message,
    tag: `buying-item-${item.id}`
  });

  // Save to Firestore if cloud group
  if (addedByUser && !group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save buying item notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Notification when a new member joins via invite code or link
export async function dispatchMemberJoinedNotification(
  group: ExpenseGroup,
  joinedUser: User,
  codeUsed: string
): Promise<AppNotification> {
  const userName = joinedUser.displayName || joinedUser.email?.split('@')[0] || 'A new member';
  const userEmail = joinedUser.email || '';
  
  const title = `New Member Joined • ${group.name}`;
  const message = `${userName} (${userEmail}) joined the ledger using invite code ${codeUsed}.`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'MEMBER_JOINED',
    title,
    message,
    createdBy: joinedUser.uid,
    createdByName: userName,
    createdAt: new Date().toISOString(),
    readBy: [joinedUser.uid]
  };

  // Push immediate system notification to iPhone, Android, tablets, desktops
  await showDeviceNotification(title, {
    body: message,
    tag: `member-joined-${group.id}-${joinedUser.uid}`
  });

  // Save to Firestore if cloud group
  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save member joined notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Notification when group owner regenerates the invite code
export async function dispatchInviteCodeRotatedNotification(
  group: ExpenseGroup,
  rotatedByUser: User,
  newCode: string
): Promise<AppNotification> {
  const userName = rotatedByUser.displayName || rotatedByUser.email?.split('@')[0] || 'The admin';
  
  const title = `Invite Code Reset • ${group.name}`;
  const message = `${userName} regenerated the ledger invite code (${newCode}). Previous invite links are now invalid.`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'INVITE_CODE_ROTATED',
    title,
    message,
    createdBy: rotatedByUser.uid,
    createdByName: userName,
    createdAt: new Date().toISOString(),
    readBy: [rotatedByUser.uid]
  };

  // Push immediate system notification
  await showDeviceNotification(title, {
    body: message,
    tag: `code-rotated-${group.id}-${Date.now()}`
  });

  // Save to Firestore if cloud group
  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save invite code rotated notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Notification when a split expense is added or updated
export async function dispatchSplitExpenseNotification(
  group: ExpenseGroup,
  expense: Transaction,
  addedByUser?: User | null
): Promise<AppNotification> {
  const userName = addedByUser?.displayName || addedByUser?.email?.split('@')[0] || expense.paidByName || 'A member';
  const memberCount = expense.splitMembers ? expense.splitMembers.length : (group.memberUids?.length || 2);
  const title = `New Split Bill • ${group.name}`;
  const message = `${userName} added "${expense.name}" (₹${expense.amount.toLocaleString('en-IN')}) split among ${memberCount} members.`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'SPLIT_EXPENSE_ADDED',
    title,
    message,
    itemName: expense.name,
    totalAmount: expense.amount,
    paidByName: expense.paidByName || userName,
    splitMembersCount: memberCount,
    createdBy: addedByUser?.uid || 'system',
    createdByName: userName,
    createdAt: new Date().toISOString(),
    readBy: addedByUser ? [addedByUser.uid] : []
  };

  // Push immediate system notification
  await showDeviceNotification(title, {
    body: message,
    tag: `split-expense-${expense.id}`
  });

  // Save to Firestore if cloud group
  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save split notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Notification when a debt settlement payment is recorded
export async function dispatchSettlementNotification(
  group: ExpenseGroup,
  settlement: {
    amount: number;
    paidByName: string;
    settledToName: string;
    note?: string;
  },
  user?: User | null
): Promise<AppNotification> {
  const payerClean = settlement.paidByName?.trim().toLowerCase() === 'you'
    ? (user?.displayName || user?.email?.split('@')[0] || 'A member')
    : (settlement.paidByName || 'A member');
  const receiverClean = settlement.settledToName?.trim().toLowerCase() === 'you'
    ? 'group member'
    : (settlement.settledToName || 'group member');

  const title = `Settlement Recorded • ${group.name}`;
  const message = `${payerClean} paid ₹${settlement.amount.toLocaleString('en-IN')} to ${receiverClean} to settle up.`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'SETTLEMENT_RECORDED',
    title,
    message,
    totalAmount: settlement.amount,
    paidByName: payerClean,
    settledToName: receiverClean,
    createdBy: user?.uid || 'system',
    createdByName: user?.displayName || payerClean,
    createdAt: new Date().toISOString(),
    readBy: user ? [user.uid] : []
  };

  // Push immediate system notification
  await showDeviceNotification(title, {
    body: message,
    tag: `settlement-${Date.now()}`
  });

  // Save to Firestore if cloud group
  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save settlement notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

// Dispatch Friendly Settlement Reminder Notification
export async function dispatchSettlementReminderNotification(
  group: ExpenseGroup,
  debtorName: string,
  amount: number,
  senderUser?: User | null
): Promise<AppNotification> {
  const senderName = senderUser?.displayName || senderUser?.email?.split('@')[0] || 'A group member';
  const title = `Settlement Reminder • ${group.name}`;
  const message = `Reminder: ₹${amount.toLocaleString('en-IN')} pending balance in ${group.name} with ${debtorName}.`;

  const notifData: Omit<AppNotification, 'id'> = {
    groupId: group.id,
    groupName: group.name,
    type: 'SETTLEMENT_REMINDER',
    title,
    message,
    totalAmount: amount,
    createdBy: senderUser?.uid || 'system',
    createdByName: senderName,
    createdAt: new Date().toISOString(),
    readBy: senderUser ? [senderUser.uid] : []
  };

  await showDeviceNotification(title, {
    body: message,
    tag: `reminder-${Date.now()}`
  });

  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      return await addGroupNotification(group.id, notifData);
    } catch (err) {
      console.warn('Could not save reminder notification to Firestore:', err);
    }
  }

  return {
    ...notifData,
    id: `local_notif_${Date.now()}`
  };
}

