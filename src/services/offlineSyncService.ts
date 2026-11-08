import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import type { Transaction, ShoppingItem, RecurringExpense } from '../types';

export type MutationType = 
  | 'ADD_EXPENSE' 
  | 'UPDATE_EXPENSE' 
  | 'DELETE_EXPENSE' 
  | 'SETTLE_EXPENSE' 
  | 'UNDO_SETTLE_EXPENSE'
  | 'ADD_SHOPPING' 
  | 'UPDATE_SHOPPING' 
  | 'TOGGLE_SHOPPING' 
  | 'DELETE_SHOPPING' 
  | 'ADD_RECURRING' 
  | 'UPDATE_RECURRING'
  | 'TOGGLE_RECURRING' 
  | 'DELETE_RECURRING';

export interface QueuedMutation {
  id: string;
  type: MutationType;
  groupId: string;
  targetId: string;
  payload: any;
  createdAt: string;
  retryCount: number;
}

// Storage key helpers
const getQueueKey = (userId?: string | null) => 
  userId ? `hisaab_sync_queue_${userId}` : 'hisaab_sync_queue_guest';

const getExpensesCacheKey = (groupId: string) => `hisaab_cache_expenses_${groupId}`;
const getShoppingCacheKey = (groupId: string) => `hisaab_cache_shopping_${groupId}`;
const getRecurringCacheKey = (groupId: string) => `hisaab_cache_recurring_${groupId}`;

// Listeners for sync state changes (isSyncing, pendingCount)
type SyncListener = (isSyncing: boolean, pendingCount: number) => void;
const syncListeners = new Set<SyncListener>();

function notifySyncListeners(isSyncing: boolean, pendingCount: number) {
  syncListeners.forEach(listener => {
    try {
      listener(isSyncing, pendingCount);
    } catch (e) {
      console.warn('Sync listener error:', e);
    }
  });
}

export function subscribeToSyncState(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

// ==========================================
// 1. LOCAL DATA CACHE HELPERS
// ==========================================

export function getCachedExpenses(groupId: string): Transaction[] {
  if (!groupId) return [];
  try {
    const raw = localStorage.getItem(getExpensesCacheKey(groupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedExpenses(groupId: string, items: Transaction[]): void {
  if (!groupId) return;
  try {
    localStorage.setItem(getExpensesCacheKey(groupId), JSON.stringify(items));
  } catch (e) {
    console.warn('Could not cache expenses:', e);
  }
}

export function getCachedShopping(groupId: string): ShoppingItem[] {
  if (!groupId) return [];
  try {
    const raw = localStorage.getItem(getShoppingCacheKey(groupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedShopping(groupId: string, items: ShoppingItem[]): void {
  if (!groupId) return;
  try {
    localStorage.setItem(getShoppingCacheKey(groupId), JSON.stringify(items));
  } catch (e) {
    console.warn('Could not cache shopping items:', e);
  }
}

export function getCachedRecurring(groupId: string): RecurringExpense[] {
  if (!groupId) return [];
  try {
    const raw = localStorage.getItem(getRecurringCacheKey(groupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedRecurring(groupId: string, items: RecurringExpense[]): void {
  if (!groupId) return;
  try {
    localStorage.setItem(getRecurringCacheKey(groupId), JSON.stringify(items));
  } catch (e) {
    console.warn('Could not cache recurring items:', e);
  }
}

// ==========================================
// 2. OFFLINE MUTATION QUEUE MANAGEMENT
// ==========================================

export function getQueuedMutations(userId?: string | null): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(getQueueKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueuedMutations(mutations: QueuedMutation[], userId?: string | null): void {
  try {
    localStorage.setItem(getQueueKey(userId), JSON.stringify(mutations));
  } catch (e) {
    console.warn('Could not save mutation queue:', e);
  }
}

export function getPendingMutationsCount(userId?: string | null): number {
  return getQueuedMutations(userId).length;
}

export function enqueueMutation(
  mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retryCount'>,
  userId?: string | null
): QueuedMutation {
  const queue = getQueuedMutations(userId);
  const newMutation: QueuedMutation = {
    ...mutation,
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0
  };

  // Coalesce / deduplicate mutations on the same target where applicable:
  // e.g. If an item was created offline and updated offline before syncing,
  // update the payload in-place to minimize round-trips.
  let merged = false;
  const updatedQueue = queue.map(existing => {
    if (existing.groupId === newMutation.groupId && existing.targetId === newMutation.targetId) {
      if (existing.type === 'ADD_EXPENSE' && newMutation.type === 'UPDATE_EXPENSE') {
        merged = true;
        return {
          ...existing,
          payload: { ...existing.payload, ...newMutation.payload }
        };
      }
      if (existing.type === 'ADD_SHOPPING' && (newMutation.type === 'UPDATE_SHOPPING' || newMutation.type === 'TOGGLE_SHOPPING')) {
        merged = true;
        return {
          ...existing,
          payload: { ...existing.payload, ...newMutation.payload }
        };
      }
    }
    return existing;
  });

  if (!merged) {
    updatedQueue.push(newMutation);
  }

  saveQueuedMutations(updatedQueue, userId);
  notifySyncListeners(false, updatedQueue.length);
  return newMutation;
}

export function removeMutation(mutationId: string, userId?: string | null): void {
  const queue = getQueuedMutations(userId);
  const filtered = queue.filter(m => m.id !== mutationId);
  saveQueuedMutations(filtered, userId);
  notifySyncListeners(false, filtered.length);
}

export function clearQueue(userId?: string | null): void {
  try {
    localStorage.removeItem(getQueueKey(userId));
    notifySyncListeners(false, 0);
  } catch (e) {
    console.warn('Could not clear mutation queue:', e);
  }
}

// ==========================================
// 3. BACKGROUND SYNCHRONIZATION ENGINE
// ==========================================

let isSyncInProgress = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Network operation timed out')), timeoutMs)
    )
  ]);
}

/**
 * Synchronizes all pending offline changes to Firestore.
 * Automatically checks network connectivity, processes in FIFO order,
 * removes successfully committed mutations, and notifies listeners.
 */
export async function syncPendingMutations(
  user: User,
  onProgress?: (remaining: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  // If browser is offline, user is absent, or sync is already in flight, bail out
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  if (!user || isSyncInProgress) {
    return { synced: 0, failed: 0 };
  }

  const queue = getQueuedMutations(user.uid);
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  isSyncInProgress = true;
  notifySyncListeners(true, queue.length);

  let synced = 0;
  let failed = 0;
  const initialTotal = queue.length;

  try {
    for (const mutation of queue) {
      // Re-verify network during loop
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }

      const { groupId, targetId, type, payload } = mutation;
      if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
        // Skip local sandbox groups
        removeMutation(mutation.id, user.uid);
        continue;
      }

      try {
        switch (type) {
          case 'ADD_EXPENSE': {
            const expRef = doc(db, 'groups', groupId, 'expenses', targetId);
            await withTimeout(setDoc(expRef, payload, { merge: true }));
            break;
          }
          case 'UPDATE_EXPENSE': {
            const expRef = doc(db, 'groups', groupId, 'expenses', targetId);
            await withTimeout(updateDoc(expRef, payload));
            break;
          }
          case 'DELETE_EXPENSE': {
            const expRef = doc(db, 'groups', groupId, 'expenses', targetId);
            await withTimeout(deleteDoc(expRef));
            break;
          }
          case 'SETTLE_EXPENSE':
          case 'UNDO_SETTLE_EXPENSE': {
            const expRef = doc(db, 'groups', groupId, 'expenses', targetId);
            await withTimeout(updateDoc(expRef, payload));
            break;
          }
          case 'ADD_SHOPPING': {
            const shopRef = doc(db, 'groups', groupId, 'shopping', targetId);
            await withTimeout(setDoc(shopRef, payload, { merge: true }));
            break;
          }
          case 'UPDATE_SHOPPING': {
            const shopRef = doc(db, 'groups', groupId, 'shopping', targetId);
            await withTimeout(updateDoc(shopRef, payload));
            break;
          }
          case 'TOGGLE_SHOPPING': {
            const shopRef = doc(db, 'groups', groupId, 'shopping', targetId);
            await withTimeout(updateDoc(shopRef, { status: payload.status }));
            break;
          }
          case 'DELETE_SHOPPING': {
            const shopRef = doc(db, 'groups', groupId, 'shopping', targetId);
            await withTimeout(deleteDoc(shopRef));
            break;
          }
          case 'ADD_RECURRING': {
            const recRef = doc(db, 'groups', groupId, 'recurring', targetId);
            await withTimeout(setDoc(recRef, payload, { merge: true }));
            break;
          }
          case 'UPDATE_RECURRING': {
            const recRef = doc(db, 'groups', groupId, 'recurring', targetId);
            await withTimeout(updateDoc(recRef, payload));
            break;
          }
          case 'TOGGLE_RECURRING': {
            const recRef = doc(db, 'groups', groupId, 'recurring', targetId);
            await withTimeout(updateDoc(recRef, payload));
            break;
          }
          case 'DELETE_RECURRING': {
            const recRef = doc(db, 'groups', groupId, 'recurring', targetId);
            await withTimeout(deleteDoc(recRef));
            break;
          }
        }

        // Successfully synced to Firestore! Remove mutation from local queue
        removeMutation(mutation.id, user.uid);
        synced++;

        const currentRemaining = getPendingMutationsCount(user.uid);
        if (onProgress) {
          onProgress(currentRemaining, initialTotal);
        }
      } catch (err: any) {
        console.warn(`Sync failed for mutation ${mutation.id} (${mutation.type}):`, err);

        // If error is document not found (e.g. already deleted elsewhere), safely remove
        if (err?.code === 'not-found' || (err?.message && err.message.includes('No document to update'))) {
          removeMutation(mutation.id, user.uid);
          synced++;
          continue;
        }

        // Increment retry count or halt if network is offline
        mutation.retryCount = (mutation.retryCount || 0) + 1;
        failed++;

        // If client is offline or timed out, pause remaining sync until reconnect
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }
        if (err?.message && err.message.includes('timed out')) {
          break;
        }
      }
    }
  } finally {
    isSyncInProgress = false;
    const finalPending = getPendingMutationsCount(user.uid);
    notifySyncListeners(false, finalPending);
  }

  return { synced, failed };
}

// ==========================================
// 4. SMART MERGE UTILITIES
// Merges incoming server snapshots with any pending local mutations
// so local user actions are NEVER lost or flickered before sync.
// ==========================================

export function mergeServerExpensesWithPending(
  serverExpenses: Transaction[],
  groupId: string,
  userId?: string | null
): Transaction[] {
  const queue = getQueuedMutations(userId).filter(m => m.groupId === groupId);
  if (queue.length === 0) return serverExpenses;

  // Clone server list
  const map = new Map<string, Transaction>();
  serverExpenses.forEach(tx => map.set(tx.id, { ...tx }));

  // Apply pending mutations in creation order
  queue.forEach(m => {
    if (m.type === 'ADD_EXPENSE') {
      map.set(m.targetId, m.payload);
    } else if (m.type === 'UPDATE_EXPENSE' || m.type === 'SETTLE_EXPENSE' || m.type === 'UNDO_SETTLE_EXPENSE') {
      const existing = map.get(m.targetId);
      if (existing) {
        map.set(m.targetId, { ...existing, ...m.payload });
      }
    } else if (m.type === 'DELETE_EXPENSE') {
      map.delete(m.targetId);
    }
  });

  // Return sorted by date desc
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function mergeServerShoppingWithPending(
  serverShopping: ShoppingItem[],
  groupId: string,
  userId?: string | null
): ShoppingItem[] {
  const queue = getQueuedMutations(userId).filter(m => m.groupId === groupId);
  if (queue.length === 0) return serverShopping;

  const map = new Map<string, ShoppingItem>();
  serverShopping.forEach(item => map.set(item.id, { ...item }));

  queue.forEach(m => {
    if (m.type === 'ADD_SHOPPING') {
      map.set(m.targetId, m.payload);
    } else if (m.type === 'UPDATE_SHOPPING') {
      const existing = map.get(m.targetId);
      if (existing) {
        map.set(m.targetId, { ...existing, ...m.payload });
      }
    } else if (m.type === 'TOGGLE_SHOPPING') {
      const existing = map.get(m.targetId);
      if (existing) {
        map.set(m.targetId, { ...existing, status: m.payload.status });
      }
    } else if (m.type === 'DELETE_SHOPPING') {
      map.delete(m.targetId);
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));
}

export function mergeServerRecurringWithPending(
  serverRecurring: RecurringExpense[],
  groupId: string,
  userId?: string | null
): RecurringExpense[] {
  const queue = getQueuedMutations(userId).filter(m => m.groupId === groupId);
  if (queue.length === 0) return serverRecurring;

  const map = new Map<string, RecurringExpense>();
  serverRecurring.forEach(rec => map.set(rec.id, { ...rec }));

  queue.forEach(m => {
    if (m.type === 'ADD_RECURRING') {
      map.set(m.targetId, m.payload);
    } else if (m.type === 'TOGGLE_RECURRING') {
      const existing = map.get(m.targetId);
      if (existing) {
        map.set(m.targetId, { ...existing, status: m.payload.status });
      }
    } else if (m.type === 'DELETE_RECURRING') {
      map.delete(m.targetId);
    }
  });

  return Array.from(map.values());
}
