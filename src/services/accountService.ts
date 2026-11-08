import { 
  collection, 
  doc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc 
} from 'firebase/firestore';
import { 
  db, 
  auth, 
  googleProvider, 
  deleteUser, 
  reauthenticateWithPopup, 
  handleFirestoreError, 
  OperationType, 
  type User 
} from '../firebase';
import type { ExpenseGroup } from '../types';

export interface DeleteAccountResult {
  success: boolean;
  requiresRecentLogin?: boolean;
  error?: string;
}

/**
 * Clears all local application storage keys for Hisaab Barabar
 */
export function purgeAllLocalData(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('hisaab_') || key.startsWith('expenses_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error purging local storage:', e);
  }
}

/**
 * Reauthenticates the user with Google popup when Firebase requires recent login
 */
export async function reauthenticateGoogleUser(user: User): Promise<boolean> {
  try {
    await reauthenticateWithPopup(user, googleProvider);
    return true;
  } catch (err: any) {
    console.warn('Reauthentication error:', err?.message || err);
    return false;
  }
}

/**
 * Comprehensive Account Deletion adhering to Apple & Google Data Privacy & Account Deletion Standards:
 * 1. Purges private Firestore user profile (/users/{uid})
 * 2. Deletes user-owned ledgers and their subcollections (expenses, shopping, recurring, notifications)
 * 3. Removes user from shared member lists in ledgers they participated in
 * 4. Wipes local device cache & settings
 * 5. Permanently deletes Firebase Authentication account
 */
export async function deleteUserAccount(user: User): Promise<DeleteAccountResult> {
  const userUid = user.uid;
  const userEmail = (user.email || '').toLowerCase().trim();

  try {
    // 1. Delete private user profile document
    try {
      await deleteDoc(doc(db, 'users', userUid));
    } catch (e) {
      console.warn('Notice deleting user doc:', e);
    }

    // 2. Query and delete all groups owned / created by this user
    try {
      const groupsRef = collection(db, 'groups');
      const ownedGroupsQuery = query(groupsRef, where('createdBy', '==', userUid));
      const ownedSnap = await getDocs(ownedGroupsQuery);

      for (const groupDoc of ownedSnap.docs) {
        const groupId = groupDoc.id;

        // Clean up expenses
        try {
          const expSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'));
          for (const d of expSnap.docs) {
            try { await deleteDoc(d.ref); } catch {}
          }
        } catch {}

        // Clean up shopping list
        try {
          const shopSnap = await getDocs(collection(db, 'groups', groupId, 'shopping'));
          for (const d of shopSnap.docs) {
            try { await deleteDoc(d.ref); } catch {}
          }
        } catch {}

        // Clean up recurring expenses
        try {
          const recSnap = await getDocs(collection(db, 'groups', groupId, 'recurring'));
          for (const d of recSnap.docs) {
            try { await deleteDoc(d.ref); } catch {}
          }
        } catch {}

        // Clean up notifications
        try {
          const notifSnap = await getDocs(collection(db, 'groups', groupId, 'notifications'));
          for (const d of notifSnap.docs) {
            try { await deleteDoc(d.ref); } catch {}
          }
        } catch {}

        // Delete group doc itself
        try {
          await deleteDoc(doc(db, 'groups', groupId));
        } catch {}
      }
    } catch (e) {
      console.warn('Notice cleaning up owned groups:', e);
    }

    // 3. Query groups where user is a participant (not owner) and remove membership
    try {
      const groupsRef = collection(db, 'groups');
      const memberQuery = query(groupsRef, where('memberUids', 'array-contains', userUid));
      const memberSnap = await getDocs(memberQuery);

      for (const groupDoc of memberSnap.docs) {
        const groupData = groupDoc.data() as ExpenseGroup;
        // Skip if user was owner (already handled in step 2)
        if (groupData.createdBy === userUid) continue;

        const updatedUids = (groupData.memberUids || []).filter(id => id !== userUid);
        const updatedEmails = (groupData.memberEmails || []).filter(e => e.toLowerCase() !== userEmail);
        const updatedMembers = { ...(groupData.members || {}) };
        delete updatedMembers[userUid];
        if (userEmail) {
          delete updatedMembers[userEmail];
        }

        try {
          await updateDoc(doc(db, 'groups', groupDoc.id), {
            memberUids: updatedUids,
            memberEmails: updatedEmails,
            members: updatedMembers,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Notice removing member from group:', e);
        }
      }
    } catch (e) {
      console.warn('Notice cleaning up participant groups:', e);
    }

    // 4. Wipe device local storage
    purgeAllLocalData();

    // 5. Delete Firebase Auth user
    try {
      await deleteUser(user);
      return { success: true };
    } catch (authErr: any) {
      const code = authErr?.code || '';
      if (code === 'auth/requires-recent-login') {
        return { 
          success: false, 
          requiresRecentLogin: true, 
          error: 'For your security, Google requires you to confirm your identity before permanently deleting your account.' 
        };
      }
      throw authErr;
    }
  } catch (error: any) {
    console.error('Account deletion error:', error);
    return {
      success: false,
      error: error?.message || 'An unexpected error occurred while deleting your account. Please try again.'
    };
  }
}
