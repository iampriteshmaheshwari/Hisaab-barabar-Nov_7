import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { 
  ExpenseGroup, 
  Transaction, 
  ShoppingItem, 
  RecurringExpense, 
  UserRole,
  GroupMember,
  CategoryData
} from '../types';
import { 
  dispatchMemberJoinedNotification, 
  dispatchInviteCodeRotatedNotification 
} from './notificationService';

// Helper to generate high-entropy alphanumeric invite codes
// Uses 32-character set (excludes visually confusing 0, O, 1, I)
// 8 characters = 32^8 = ~1.099 trillion combinations
export function generateRandomInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Guaranteed unique invite code generator with Firestore verification
export async function generateUniqueInviteCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const candidate = generateRandomInviteCode(8);
    try {
      // 1. Verify candidate is not currently used by any active group
      const qActive = query(collection(db, 'groups'), where('inviteCode', '==', candidate));
      const activeSnap = await getDocs(qActive);
      if (activeSnap.empty) {
        // 2. Verify candidate was not previously used/rotated in any group
        const qPrev = query(collection(db, 'groups'), where('previousInviteCodes', 'array-contains', candidate));
        const prevSnap = await getDocs(qPrev);
        if (prevSnap.empty) {
          return candidate;
        }
      }
    } catch {
      // If offline or permission check occurs during initial check, fallback to candidate
      return candidate;
    }
    attempts++;
  }
  return generateRandomInviteCode(10);
}

// Export for backward compatibility
export function generateInviteCode(): string {
  return generateRandomInviteCode(8);
}

// Subscribe to groups the current user belongs to (as owner, editor, or viewer)
export function subscribeToUserGroups(
  user: User, 
  onGroupsUpdate: (groups: ExpenseGroup[]) => void,
  onError?: (error: unknown) => void
) {
  const userEmail = (user.email || '').toLowerCase().trim();
  const groupsRef = collection(db, 'groups');

  // Query groups where user UID is in memberUids
  const qUid = query(groupsRef, where('memberUids', 'array-contains', user.uid));

  const unsubscribe = onSnapshot(
    qUid,
    async (snapshot) => {
      const groupsList: ExpenseGroup[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Omit<ExpenseGroup, 'id'>;
        groupsList.push({ ...data, id: d.id });
      });

      // Also query if user is invited via email but hasn't had their UID populated yet
      if (userEmail) {
        try {
          const qEmail = query(groupsRef, where('memberEmails', 'array-contains', userEmail));
          const emailSnap = await getDocs(qEmail);
          
          for (const docSnap of emailSnap.docs) {
            const data = docSnap.data() as Omit<ExpenseGroup, 'id'>;
            const existing = groupsList.find(g => g.id === docSnap.id);
            if (!existing) {
              groupsList.push({ ...data, id: docSnap.id });
            }

            // Auto-link UID to this group if missing
            if (!data.memberUids?.includes(user.uid)) {
              try {
                const updatedUids = [...(data.memberUids || []), user.uid];
                const updatedMembers = { ...(data.members || {}) };
                const defaultRole: UserRole = data.type === 'split' ? 'editor' : 'viewer';
                const existingRole = updatedMembers[userEmail]?.role || defaultRole;
                updatedMembers[user.uid] = {
                  uid: user.uid,
                  email: userEmail,
                  displayName: user.displayName || userEmail,
                  role: existingRole,
                  addedAt: new Date().toISOString()
                };
                await updateDoc(doc(db, 'groups', docSnap.id), {
                  memberUids: updatedUids,
                  members: updatedMembers
                });
              } catch (e) {
                console.warn('Could not auto-link group membership UID', e);
              }
            }
          }
        } catch (err) {
          console.warn('Error querying invited groups by email:', err);
        }
      }

      onGroupsUpdate(groupsList);
    },
    (error) => {
      console.error('Groups subscription error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'groups');
    }
  );

  return unsubscribe;
}

// Create a new expense group
export async function createGroup(
  name: string, 
  user: User, 
  type: 'budget' | 'split' = 'budget'
): Promise<ExpenseGroup> {
  const userEmail = (user.email || '').toLowerCase().trim();
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inviteCode = await generateUniqueInviteCode();
  const now = new Date().toISOString();

  const cleanName = name.trim().slice(0, 35);
  const groupData: ExpenseGroup = {
    id: groupId,
    name: cleanName,
    createdBy: user.uid,
    ownerEmail: userEmail,
    memberUids: [user.uid],
    memberEmails: [userEmail],
    inviteCode,
    previousInviteCodes: [],
    type,
    members: {
      [user.uid]: {
        uid: user.uid,
        email: userEmail,
        displayName: user.displayName || userEmail.split('@')[0],
        role: 'owner',
        addedAt: now,
        joinedVia: 'creator'
      },
      [userEmail]: {
        uid: user.uid,
        email: userEmail,
        displayName: user.displayName || userEmail.split('@')[0],
        role: 'owner',
        addedAt: now,
        joinedVia: 'creator'
      }
    },
    createdAt: now,
    updatedAt: now
  };

  try {
    await setDoc(doc(db, 'groups', groupId), groupData);
    return groupData;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}`);
    throw error;
  }
}

// Invite user to group (Editor or Viewer)
export async function inviteMemberToGroup(
  group: ExpenseGroup,
  inviteeEmail: string,
  role: UserRole
): Promise<void> {
  const cleanEmail = inviteeEmail.toLowerCase().trim();
  if (!cleanEmail) throw new Error('Email is required');

  const updatedEmails = Array.from(new Set([...(group.memberEmails || []), cleanEmail]));
  const updatedMembers: Record<string, GroupMember> = {
    ...(group.members || {}),
    [cleanEmail]: {
      email: cleanEmail,
      role: role,
      addedAt: new Date().toISOString()
    }
  };

  try {
    await updateDoc(doc(db, 'groups', group.id), {
      memberEmails: updatedEmails,
      members: updatedMembers,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    throw error;
  }
}

// Add member directly by name or email (ideal for quick split ledgers)
export async function addDirectMemberToGroup(
  group: ExpenseGroup,
  nameOrEmail: string,
  role: UserRole = 'editor'
): Promise<ExpenseGroup> {
  const clean = nameOrEmail.trim();
  if (!clean) throw new Error('Member name or email cannot be empty');

  const isEmail = clean.includes('@');
  const memberKey = isEmail 
    ? clean.toLowerCase() 
    : `member_${clean.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).slice(-4)}`;

  const newMember: GroupMember = {
    displayName: isEmail ? clean.split('@')[0] : clean,
    email: isEmail ? clean.toLowerCase() : '',
    role,
    addedAt: new Date().toISOString(),
    joinedVia: isEmail ? 'email_invite' : 'creator'
  };

  const updatedMembers: Record<string, GroupMember> = {
    ...(group.members || {}),
    [memberKey]: newMember
  };

  const updatedEmails = isEmail 
    ? Array.from(new Set([...(group.memberEmails || []), clean.toLowerCase()]))
    : (group.memberEmails || []);

  const updatedGroup: ExpenseGroup = {
    ...group,
    members: updatedMembers,
    memberEmails: updatedEmails,
    updatedAt: new Date().toISOString()
  };

  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        memberEmails: updatedEmails,
        members: updatedMembers,
        updatedAt: updatedGroup.updatedAt
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
      throw error;
    }
  } else {
    try {
      const saved = localStorage.getItem('expenses_local_groups');
      const list: ExpenseGroup[] = saved ? JSON.parse(saved) : [];
      const updatedList = list.map(g => g.id === group.id ? updatedGroup : g);
      localStorage.setItem('expenses_local_groups', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not save updated local group members to localStorage:', e);
    }
  }

  return updatedGroup;
}

// Remove member from group
export async function removeMemberFromGroup(
  group: ExpenseGroup,
  memberKey: string
): Promise<void> {
  const updatedMembers = { ...(group.members || {}) };
  const memberToRemove = updatedMembers[memberKey];
  delete updatedMembers[memberKey];

  let updatedEmails = group.memberEmails || [];
  let updatedUids = group.memberUids || [];

  if (memberToRemove) {
    if (memberToRemove.email) {
      updatedEmails = updatedEmails.filter(e => e.toLowerCase() !== memberToRemove.email.toLowerCase());
      delete updatedMembers[memberToRemove.email.toLowerCase()];
    }
    if (memberToRemove.uid) {
      updatedUids = updatedUids.filter(u => u !== memberToRemove.uid);
      delete updatedMembers[memberToRemove.uid];
    }
  } else {
    // If key was an email or uid directly
    updatedEmails = updatedEmails.filter(e => e.toLowerCase() !== memberKey.toLowerCase());
    updatedUids = updatedUids.filter(u => u !== memberKey);
  }

  const updatedGroup: ExpenseGroup = {
    ...group,
    members: updatedMembers,
    memberEmails: updatedEmails,
    memberUids: updatedUids,
    updatedAt: new Date().toISOString()
  };

  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        memberEmails: updatedEmails,
        memberUids: updatedUids,
        members: updatedMembers,
        updatedAt: updatedGroup.updatedAt
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
      throw error;
    }
  } else {
    try {
      const saved = localStorage.getItem('expenses_local_groups');
      const list: ExpenseGroup[] = saved ? JSON.parse(saved) : [];
      const updatedList = list.map(g => g.id === group.id ? updatedGroup : g);
      localStorage.setItem('expenses_local_groups', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not save updated local group members to localStorage:', e);
    }
  }
}

// Delete an entire expense group and its associated subcollections
export async function deleteExpenseGroup(groupId: string, user: User | null): Promise<void> {
  // 1. If it's a local/offline group or guest user
  if (!user || groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedGroups = localStorage.getItem('expenses_local_groups');
      if (savedGroups) {
        const parsed: ExpenseGroup[] = JSON.parse(savedGroups);
        const filtered = parsed.filter(g => g.id !== groupId);
        localStorage.setItem('expenses_local_groups', JSON.stringify(filtered));
      }
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const parsed: Transaction[] = JSON.parse(savedTx);
        const filtered = parsed.filter(t => (t.groupId || 'local_group') !== groupId);
        localStorage.setItem('expenses_transactions', JSON.stringify(filtered));
      }
      const savedShop = localStorage.getItem('expenses_shopping_list');
      if (savedShop) {
        const parsed: ShoppingItem[] = JSON.parse(savedShop);
        const filtered = parsed.filter(s => (s.groupId || 'local_group') !== groupId);
        localStorage.setItem('expenses_shopping_list', JSON.stringify(filtered));
      }
      const savedRec = localStorage.getItem('expenses_recurring');
      if (savedRec) {
        const parsed: RecurringExpense[] = JSON.parse(savedRec);
        const filtered = parsed.filter(r => (r.groupId || 'local_group') !== groupId);
        localStorage.setItem('expenses_recurring', JSON.stringify(filtered));
      }
    } catch (e) {
      console.error('Error deleting local group data:', e);
    }
    return;
  }

  // 2. Cloud group in Firestore
  const path = `groups/${groupId}`;
  try {
    // Clean up expenses subcollection
    const expSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'));
    for (const d of expSnap.docs) {
      try { await deleteDoc(d.ref); } catch {}
    }

    // Clean up shopping subcollection
    const shopSnap = await getDocs(collection(db, 'groups', groupId, 'shopping'));
    for (const d of shopSnap.docs) {
      try { await deleteDoc(d.ref); } catch {}
    }

    // Clean up recurring subcollection
    const recSnap = await getDocs(collection(db, 'groups', groupId, 'recurring'));
    for (const d of recSnap.docs) {
      try { await deleteDoc(d.ref); } catch {}
    }

    // Delete group document itself
    await deleteDoc(doc(db, 'groups', groupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// Update an existing member's role (e.g. editor <-> viewer)
export async function updateMemberRole(
  group: ExpenseGroup,
  memberKey: string,
  newRole: UserRole
): Promise<void> {
  const updatedMembers: Record<string, GroupMember> = { ...(group.members || {}) };
  const target = updatedMembers[memberKey];

  if (target) {
    updatedMembers[memberKey] = {
      ...target,
      role: newRole
    };
    // Also update matching entries by UID or email if keyed separately
    if (target.email && updatedMembers[target.email.toLowerCase()]) {
      updatedMembers[target.email.toLowerCase()] = {
        ...updatedMembers[target.email.toLowerCase()],
        role: newRole
      };
    }
    if (target.uid && updatedMembers[target.uid]) {
      updatedMembers[target.uid] = {
        ...updatedMembers[target.uid],
        role: newRole
      };
    }
  } else {
    // If keyed by email directly
    const cleanKey = memberKey.toLowerCase();
    if (updatedMembers[cleanKey]) {
      updatedMembers[cleanKey] = {
        ...updatedMembers[cleanKey],
        role: newRole
      };
    }
  }

  try {
    await updateDoc(doc(db, 'groups', group.id), {
      members: updatedMembers,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    throw error;
  }
}

// Update a group member's UPI ID or phone number
export async function updateGroupMemberUpi(
  group: ExpenseGroup,
  memberKey: string,
  upiId: string,
  metadata?: {
    addedByName?: string;
    pendingConfirmation?: boolean;
  }
): Promise<ExpenseGroup> {
  const cleanUpi = upiId.trim().toLowerCase();
  const updatedMembers: Record<string, GroupMember> = { ...(group.members || {}) };
  const target = updatedMembers[memberKey];

  const upiFields: Partial<GroupMember> = {
    upiId: cleanUpi,
    ...(metadata?.addedByName !== undefined ? { upiAddedBy: metadata.addedByName } : {}),
    ...(metadata?.pendingConfirmation !== undefined ? { upiPendingConfirmation: metadata.pendingConfirmation } : {})
  };

  if (target) {
    updatedMembers[memberKey] = {
      ...target,
      ...upiFields
    };
    if (target.email && updatedMembers[target.email.toLowerCase()]) {
      updatedMembers[target.email.toLowerCase()] = {
        ...updatedMembers[target.email.toLowerCase()],
        ...upiFields
      };
    }
    if (target.uid && updatedMembers[target.uid]) {
      updatedMembers[target.uid] = {
        ...updatedMembers[target.uid],
        ...upiFields
      };
    }
  } else {
    const cleanKey = memberKey.toLowerCase();
    if (updatedMembers[cleanKey]) {
      updatedMembers[cleanKey] = {
        ...updatedMembers[cleanKey],
        ...upiFields
      };
    } else {
      updatedMembers[memberKey] = {
        email: memberKey.includes('@') ? memberKey.toLowerCase() : '',
        displayName: memberKey,
        role: 'editor',
        addedAt: new Date().toISOString(),
        ...upiFields
      };
    }
  }

  const updatedGroup: ExpenseGroup = {
    ...group,
    members: updatedMembers,
    updatedAt: new Date().toISOString()
  };

  if (!group.id.startsWith('local_') && group.id !== 'local_group') {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: updatedMembers,
        updatedAt: updatedGroup.updatedAt
      });
    } catch (error) {
      console.warn('Could not update member UPI in Firestore:', error);
    }
  } else {
    try {
      const saved = localStorage.getItem('expenses_local_groups');
      const list: ExpenseGroup[] = saved ? JSON.parse(saved) : [];
      const updatedList = list.map(g => g.id === group.id ? updatedGroup : g);
      localStorage.setItem('expenses_local_groups', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not save updated local group members to localStorage:', e);
    }
  }

  return updatedGroup;
}

// Group Owner can rotate / regenerate the invite code to invalidate compromised links
export async function regenerateGroupInviteCode(
  group: ExpenseGroup,
  user: User
): Promise<string> {
  const isOwner = group.createdBy === user.uid || group.members?.[user.uid]?.role === 'owner';
  if (!isOwner) {
    throw new Error('Only a ledger admin can regenerate the invite code.');
  }

  const oldCode = group.inviteCode;
  const newCode = await generateUniqueInviteCode();
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    inviteCode: newCode,
    inviteCodeRotatedAt: now,
    updatedAt: now
  };

  if (oldCode) {
    updatePayload.previousInviteCodes = arrayUnion(oldCode);
  }

  try {
    await updateDoc(doc(db, 'groups', group.id), updatePayload);

    // Notify all members that the invite code was refreshed and previous links were revoked
    try {
      await dispatchInviteCodeRotatedNotification(group, user, newCode);
    } catch (e) {
      console.warn('Could not dispatch rotation notification:', e);
    }

    return newCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    throw error;
  }
}

// Join group via Alphanumeric Invite Code or Group ID
export async function joinGroupByCode(code: string, user: User): Promise<ExpenseGroup | null> {
  const cleanCode = code.trim().toUpperCase();
  const userEmail = (user.email || '').toLowerCase().trim();

  try {
    let groupData: ExpenseGroup | null = null;

    // 1. Try querying by active inviteCode
    const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const groupDoc = snap.docs[0];
      groupData = { ...(groupDoc.data() as Omit<ExpenseGroup, 'id'>), id: groupDoc.id };
    } else {
      // 2. Check if this code was previously regenerated/invalidated
      try {
        const qPrev = query(collection(db, 'groups'), where('previousInviteCodes', 'array-contains', cleanCode));
        const prevSnap = await getDocs(qPrev);
        if (!prevSnap.empty) {
          throw new Error('This invite code has expired or was regenerated by the ledger admin. Please ask an admin for the updated invite link.');
        }
      } catch (err: any) {
        if (err.message && err.message.includes('expired or was regenerated')) {
          throw err;
        }
      }

      // 3. Fallback: only try direct document ID if code matches document ID pattern
      if (cleanCode.startsWith('GRP_') || cleanCode.startsWith('GROUP_') || cleanCode.length > 12) {
        try {
          const docRef = doc(db, 'groups', code.trim());
          const singleDoc = await getDoc(docRef);
          if (singleDoc.exists()) {
            groupData = { ...(singleDoc.data() as Omit<ExpenseGroup, 'id'>), id: singleDoc.id };
          }
        } catch {
          // Document does not exist or inaccessible
        }
      }
    }

    if (!groupData) {
      return null;
    }

    const isOwner = groupData.createdBy === user.uid || (groupData.ownerEmail && groupData.ownerEmail.toLowerCase() === userEmail);
    const wasAlreadyMember = isOwner || groupData.memberUids?.includes(user.uid) || groupData.memberEmails?.includes(userEmail);

    // If the user is already the owner or an active member, no need to overwrite or re-attach
    if (wasAlreadyMember) {
      return groupData;
    }

    await attachUserToGroup(groupData, user, cleanCode);
    return {
      ...groupData,
      memberUids: Array.from(new Set([...(groupData.memberUids || []), user.uid])),
      memberEmails: userEmail
        ? Array.from(new Set([...(groupData.memberEmails || []), userEmail]))
        : (groupData.memberEmails || [])
    };
  } catch (error: any) {
    console.error('Error joining group by code:', error);
    throw error;
  }
}

async function attachUserToGroup(group: ExpenseGroup, user: User, codeUsed?: string) {
  const userEmail = (user.email || '').toLowerCase().trim();
  const isOwner = group.createdBy === user.uid || (group.ownerEmail && group.ownerEmail.toLowerCase() === userEmail);
  const wasAlreadyMember = isOwner || group.memberUids?.includes(user.uid) || group.memberEmails?.includes(userEmail);
  const existingMember = group.members?.[user.uid] || group.members?.[userEmail];
  const defaultJoinRole: UserRole = group.type === 'split' ? 'editor' : 'viewer';
  const assignedRole = isOwner ? 'owner' : (existingMember?.role || defaultJoinRole);

  const updatedUids = Array.from(new Set([...(group.memberUids || []), user.uid]));
  const updatedEmails = Array.from(new Set([...(group.memberEmails || []), userEmail]));
  const now = new Date().toISOString();

  const updatedMembers = {
    ...(group.members || {}),
    [user.uid]: {
      uid: user.uid,
      email: userEmail,
      displayName: user.displayName || userEmail.split('@')[0],
      role: assignedRole,
      addedAt: existingMember?.addedAt || now,
      joinedVia: existingMember?.joinedVia || 'invite_code',
      inviteCodeUsed: codeUsed || existingMember?.inviteCodeUsed
    },
    [userEmail]: {
      uid: user.uid,
      email: userEmail,
      displayName: user.displayName || userEmail.split('@')[0],
      role: assignedRole,
      addedAt: existingMember?.addedAt || now,
      joinedVia: existingMember?.joinedVia || 'invite_code',
      inviteCodeUsed: codeUsed || existingMember?.inviteCodeUsed
    }
  };

  await updateDoc(doc(db, 'groups', group.id), {
    memberUids: updatedUids,
    memberEmails: updatedEmails,
    members: updatedMembers,
    updatedAt: now
  });

  // If this is a newly joined member, dispatch activity notification to the group
  if (!wasAlreadyMember && codeUsed) {
    try {
      await dispatchMemberJoinedNotification(group, user, codeUsed);
    } catch (err) {
      console.warn('Could not dispatch member joined notification:', err);
    }
  }
}

// Real-time listener for expenses inside an active group
export function subscribeToGroupExpenses(
  groupId: string,
  onExpensesUpdate: (expenses: Transaction[]) => void,
  onError?: (error: unknown) => void
) {
  if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
    onExpensesUpdate([]);
    return () => {};
  }

  const path = `groups/${groupId}/expenses`;
  const expensesRef = collection(db, 'groups', groupId, 'expenses');
  const q = query(expensesRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id });
      });
      onExpensesUpdate(list);
    },
    (error) => {
      console.error(`Error fetching expenses for ${groupId}:`, error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Single-fetch helper to retrieve expenses for reconciliation
export async function getGroupExpensesOnce(groupId: string): Promise<Transaction[]> {
  if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        return JSON.parse(savedTx);
      }
    } catch (e) {
      console.warn('Could not read local expenses:', e);
    }
    return [];
  }

  const path = `groups/${groupId}/expenses`;
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'expenses'));
    const list: Transaction[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Add transaction to group
export async function addExpenseToGroup(
  groupId: string,
  expense: Omit<Transaction, 'id' | 'groupId'>,
  user?: User | null
): Promise<Transaction> {
  const expenseId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `groups/${groupId}/expenses/${expenseId}`;
  
  const fullExpense: Transaction = {
    ...expense,
    id: expenseId,
    groupId,
    createdBy: user?.uid || 'guest',
    createdByName: user?.displayName || user?.email?.split('@')[0] || 'Member',
    createdAt: new Date().toISOString()
  };

  if (!user || groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      const list: Transaction[] = savedTx ? JSON.parse(savedTx) : [];
      const updated = [fullExpense, ...list.filter(t => t.id !== expenseId)];
      localStorage.setItem('expenses_transactions', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save local expense to localStorage:', e);
    }
    return fullExpense;
  }

  try {
    await setDoc(doc(db, 'groups', groupId, 'expenses', expenseId), fullExpense);
    return fullExpense;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Check if a date string is within the past 30 days
export function isWithinPast30Days(dateStr?: string): boolean {
  if (!dateStr) return false;
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return false;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return (now - then) <= thirtyDaysMs;
}

// Edit transaction with audit tracking
export async function updateExpenseInGroup(
  groupId: string,
  expenseId: string,
  updates: Partial<Transaction>,
  user?: User | null
): Promise<void> {
  const now = new Date().toISOString();
  const enrichedUpdates: Partial<Transaction> = { ...updates };
  if (user) {
    enrichedUpdates.lastEditedBy = user.uid;
    enrichedUpdates.lastEditedByName = user.displayName || user.email?.split('@')[0] || 'Member';
    enrichedUpdates.lastEditedAt = now;
  }

  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const updated = list.map(t => t.id === expenseId ? { ...t, ...enrichedUpdates } : t);
        localStorage.setItem('expenses_transactions', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not update local expense in localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expenseId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), enrichedUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Soft delete transaction (moved to 30-day Recently Deleted list)
export async function softDeleteExpenseInGroup(
  groupId: string,
  expenseId: string,
  user?: User | null,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Member';
  const updates: Partial<Transaction> = {
    isDeleted: true,
    deletedAt: now,
    deletedBy: user?.uid || 'guest',
    deletedByName: userName,
    deletedReason: reason || 'Manual deletion'
  };

  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const updated = list.map(t => t.id === expenseId ? { ...t, ...updates } : t);
        localStorage.setItem('expenses_transactions', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not soft-delete local expense in localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expenseId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Restore transaction from Recently Deleted
export async function restoreExpenseInGroup(
  groupId: string,
  expenseId: string
): Promise<void> {
  const updates: any = {
    isDeleted: false,
    deletedAt: deleteField(),
    deletedBy: deleteField(),
    deletedByName: deleteField(),
    deletedReason: deleteField()
  };

  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const updated = list.map(t => {
          if (t.id === expenseId) {
            const { isDeleted, deletedAt, deletedBy, deletedByName, deletedReason, ...rest } = t;
            return { ...rest, isDeleted: false };
          }
          return t;
        });
        localStorage.setItem('expenses_transactions', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not restore local expense in localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expenseId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Delete transaction permanently (hard delete)
export async function deleteExpenseFromGroup(
  groupId: string,
  expenseId: string
): Promise<void> {
  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const filtered = list.filter(t => t.id !== expenseId);
        localStorage.setItem('expenses_transactions', JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Could not delete local expense from localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export const permanentDeleteExpenseFromGroup = deleteExpenseFromGroup;

// Settle transaction
export async function settleExpenseInGroup(
  groupId: string,
  expense: Transaction,
  refundAmount: number,
  note: string
): Promise<void> {
  const finalAmount = Math.max(0, expense.amount - refundAmount);
  const updates: Partial<Transaction> = {
    settled: true,
    originalAmount: expense.originalAmount || expense.amount,
    amount: finalAmount,
    note: note || 'Settled with refund/discount'
  };

  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const updated = list.map(t => t.id === expense.id ? { ...t, ...updates } : t);
        localStorage.setItem('expenses_transactions', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not settle local expense in localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expense.id}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expense.id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Undo settlement
export async function undoSettleExpenseInGroup(
  groupId: string,
  expense: Transaction
): Promise<void> {
  const updates: Partial<Transaction> = {
    settled: false,
    amount: expense.originalAmount || expense.amount,
    note: ''
  };

  if (groupId.startsWith('local_') || groupId === 'local_group') {
    try {
      const savedTx = localStorage.getItem('expenses_transactions');
      if (savedTx) {
        const list: Transaction[] = JSON.parse(savedTx);
        const updated = list.map(t => t.id === expense.id ? { ...t, ...updates } : t);
        localStorage.setItem('expenses_transactions', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not undo settle local expense in localStorage:', e);
    }
    return;
  }

  const path = `groups/${groupId}/expenses/${expense.id}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'expenses', expense.id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Real-time listener for shopping items
export function subscribeToGroupShopping(
  groupId: string,
  onShoppingUpdate: (items: ShoppingItem[]) => void,
  onError?: (error: unknown) => void
) {
  if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
    onShoppingUpdate([]);
    return () => {};
  }

  const path = `groups/${groupId}/shopping`;
  const shoppingRef = collection(db, 'groups', groupId, 'shopping');
  const q = query(shoppingRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ShoppingItem[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Omit<ShoppingItem, 'id'>), id: d.id });
      });
      onShoppingUpdate(list);
    },
    (error) => {
      console.error(`Error fetching shopping items for ${groupId}:`, error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Add shopping item
export async function addShoppingItemToGroup(
  groupId: string,
  name: string,
  user: User,
  options?: { category?: string; byWhen?: string }
): Promise<void> {
  const itemId = `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `groups/${groupId}/shopping/${itemId}`;
  const now = new Date().toISOString();

  const item: ShoppingItem = {
    id: itemId,
    name: name.trim(),
    status: 'pending',
    date: now.split('T')[0],
    groupId,
    category: options?.category || 'other',
    byWhen: options?.byWhen || 'whenever',
    createdBy: user.uid,
    createdAt: now
  };

  try {
    await setDoc(doc(db, 'groups', groupId, 'shopping', itemId), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Toggle shopping item status
export async function toggleShoppingItemStatus(
  groupId: string,
  itemId: string,
  currentStatus: 'pending' | 'bought'
): Promise<void> {
  const path = `groups/${groupId}/shopping/${itemId}`;
  const nextStatus = currentStatus === 'pending' ? 'bought' : 'pending';
  try {
    await updateDoc(doc(db, 'groups', groupId, 'shopping', itemId), {
      status: nextStatus
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Update shopping item attributes (name, category, byWhen)
export async function updateShoppingItemInGroup(
  groupId: string,
  itemId: string,
  updates: Partial<Pick<ShoppingItem, 'name' | 'category' | 'byWhen'>>
): Promise<void> {
  const path = `groups/${groupId}/shopping/${itemId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'shopping', itemId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Delete shopping item
export async function deleteShoppingItemFromGroup(
  groupId: string,
  itemId: string
): Promise<void> {
  const path = `groups/${groupId}/shopping/${itemId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'shopping', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// Real-time listener for recurring expenses
export function subscribeToGroupRecurring(
  groupId: string,
  onRecurringUpdate: (items: RecurringExpense[]) => void,
  onError?: (error: unknown) => void
) {
  if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
    onRecurringUpdate([]);
    return () => {};
  }

  const path = `groups/${groupId}/recurring`;
  const recurringRef = collection(db, 'groups', groupId, 'recurring');

  return onSnapshot(
    recurringRef,
    (snapshot) => {
      const list: RecurringExpense[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Omit<RecurringExpense, 'id'>), id: d.id });
      });
      onRecurringUpdate(list);
    },
    (error) => {
      console.error(`Error fetching recurring for ${groupId}:`, error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Add recurring expense
export async function addRecurringExpenseToGroup(
  groupId: string,
  item: Omit<RecurringExpense, 'id' | 'groupId'>,
  user: User
): Promise<void> {
  const recId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `groups/${groupId}/recurring/${recId}`;
  
  const fullItem: RecurringExpense = {
    ...item,
    id: recId,
    groupId,
    createdBy: user.uid,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'groups', groupId, 'recurring', recId), fullItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Toggle recurring active status
export async function toggleRecurringExpenseStatus(
  groupId: string,
  recId: string,
  currentStatus: 'active' | 'cancelled',
  todayStr: string = getLocalTodayIso()
): Promise<void> {
  const path = `groups/${groupId}/recurring/${recId}`;
  const isActivating = currentStatus === 'cancelled';
  const nextStatus = isActivating ? 'active' : 'cancelled';
  const payload: Record<string, any> = {
    status: nextStatus
  };
  if (isActivating) {
    payload.resumedAt = todayStr;
  } else {
    payload.pausedAt = todayStr;
  }
  try {
    await updateDoc(doc(db, 'groups', groupId, 'recurring', recId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Update recurring expense
export async function updateRecurringExpenseInGroup(
  groupId: string,
  recId: string,
  updates: Partial<RecurringExpense>
): Promise<void> {
  const path = `groups/${groupId}/recurring/${recId}`;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'recurring', recId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Helper: Get local date formatted as YYYY-MM-DD
export function getLocalTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Calculate the k-th occurrence date preserving the original Anchor Day
// Follows industry standard subscription billing (Netflix, Google Gemini, Apple, Stripe)
export function getNthOccurrenceDate(startDateStr: string, frequency: string, k: number): string {
  const [startY, startM, anchorDay] = startDateStr.split('-').map(Number);
  if (isNaN(startY) || isNaN(startM) || isNaN(anchorDay)) return startDateStr;
  const freq = (frequency || 'monthly').toLowerCase();

  if (freq === 'daily') {
    const d = new Date(startY, startM - 1, anchorDay + k);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  if (freq === 'weekly') {
    const d = new Date(startY, startM - 1, anchorDay + (k * 7));
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  if (freq === 'monthly') {
    const totalMonths = (startM - 1) + k;
    const targetYear = startY + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(anchorDay, daysInTargetMonth);
    const mo = String(targetMonth).padStart(2, '0');
    const da = String(targetDay).padStart(2, '0');
    return `${targetYear}-${mo}-${da}`;
  }

  if (freq === 'quarterly') {
    const totalMonths = (startM - 1) + (k * 3);
    const targetYear = startY + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(anchorDay, daysInTargetMonth);
    const mo = String(targetMonth).padStart(2, '0');
    const da = String(targetDay).padStart(2, '0');
    return `${targetYear}-${mo}-${da}`;
  }

  if (freq === 'yearly') {
    const targetYear = startY + k;
    const daysInTargetMonth = new Date(targetYear, startM, 0).getDate();
    const targetDay = Math.min(anchorDay, daysInTargetMonth);
    const mo = String(startM).padStart(2, '0');
    const da = String(targetDay).padStart(2, '0');
    return `${targetYear}-${mo}-${da}`;
  }

  return startDateStr;
}

// Helper: Calculate next date based on recurrence frequency (with optional anchorDay preservation)
export function getNextFrequencyDate(currentDateStr: string, frequency: string, anchorDay?: number): string {
  const [y, m, d] = currentDateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return currentDateStr;
  
  const freq = (frequency || 'monthly').toLowerCase();
  const effectiveAnchor = anchorDay || d;

  if (freq === 'daily') {
    const nextDate = new Date(y, m - 1, d + 1);
    const yr = nextDate.getFullYear();
    const mo = String(nextDate.getMonth() + 1).padStart(2, '0');
    const da = String(nextDate.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  if (freq === 'weekly') {
    const nextDate = new Date(y, m - 1, d + 7);
    const yr = nextDate.getFullYear();
    const mo = String(nextDate.getMonth() + 1).padStart(2, '0');
    const da = String(nextDate.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  if (freq === 'quarterly') {
    let targetYear = y;
    let targetMonth = m + 3;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear++;
    }
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(effectiveAnchor, daysInTargetMonth);
    const mo = String(targetMonth).padStart(2, '0');
    const da = String(targetDay).padStart(2, '0');
    return `${targetYear}-${mo}-${da}`;
  }

  if (freq === 'yearly') {
    const targetYear = y + 1;
    const daysInTargetMonth = new Date(targetYear, m, 0).getDate();
    const targetDay = Math.min(effectiveAnchor, daysInTargetMonth);
    const mo = String(m).padStart(2, '0');
    const da = String(targetDay).padStart(2, '0');
    return `${targetYear}-${mo}-${da}`;
  }

  // Default: monthly
  let targetYear = y;
  let targetMonth = m + 1;
  if (targetMonth > 12) {
    targetMonth = 1;
    targetYear++;
  }
  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(effectiveAnchor, daysInTargetMonth);
  const mo = String(targetMonth).padStart(2, '0');
  const da = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mo}-${da}`;
}

// Helper: Calculate all due occurrences for a recurring expense up to effective date
// Uses Anchor Day preservation: e.g. Jan 31 -> Feb 28 -> Mar 31 -> Apr 30 -> May 31
// Prevents phantom backfill during paused periods via resumedAt threshold
export function getDueOccurrences(
  rec: RecurringExpense,
  todayStr: string = getLocalTodayIso()
): string[] {
  if (rec.status === 'cancelled') return [];
  if (!rec.startDate) return [];

  // Effective end date is min(today, endDate) if endDate is specified, otherwise today
  const effectiveEnd = rec.endDate && rec.endDate < todayStr ? rec.endDate : todayStr;
  
  // Guard against phantom backfill: do not log dates prior to when the bill was reactivated
  const effectiveStart = rec.resumedAt && rec.resumedAt > rec.startDate ? rec.resumedAt : rec.startDate;

  if (effectiveStart > effectiveEnd && effectiveStart !== todayStr) return [];

  const occurrences: string[] = [];
  let k = 0;
  let safetyLimit = 1000;

  while (safetyLimit > 0) {
    const occDate = getNthOccurrenceDate(rec.startDate, rec.frequency || 'monthly', k);
    if (occDate > effectiveEnd) break;
    if (occDate >= effectiveStart) {
      occurrences.push(occDate);
    }
    k++;
    safetyLimit--;
  }

  return occurrences;
}

// Helper: Get next upcoming occurrence date (on or after given date)
export function getNextOccurrenceDate(
  rec: RecurringExpense,
  afterDateStr: string = getLocalTodayIso()
): string {
  if (!rec.startDate) return '';
  const effectiveStart = rec.resumedAt && rec.resumedAt > rec.startDate ? rec.resumedAt : rec.startDate;
  const threshold = afterDateStr > effectiveStart ? afterDateStr : effectiveStart;
  
  let k = 0;
  let safetyLimit = 1000;
  while (safetyLimit > 0) {
    const occDate = getNthOccurrenceDate(rec.startDate, rec.frequency || 'monthly', k);
    if (occDate >= threshold) {
      if (rec.endDate && occDate > rec.endDate) return '';
      return occDate;
    }
    k++;
    safetyLimit--;
  }
  return '';
}

// Delete recurring expense
export async function deleteRecurringExpenseFromGroup(
  groupId: string,
  recId: string
): Promise<void> {
  const path = `groups/${groupId}/recurring/${recId}`;
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'recurring', recId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// Migrate local storage records to Firebase for seamless transition with deduplication
export async function syncLocalDataToGroup(
  groupId: string,
  user: User,
  localTx: Transaction[],
  localShop: ShoppingItem[],
  localRec: RecurringExpense[]
): Promise<number> {
  const sanitizeId = (rawId: string | undefined, prefix: string) => {
    if (rawId && /^[a-zA-Z0-9_-]+$/.test(rawId) && rawId.length <= 128) {
      return rawId;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  };

  const nowIso = new Date().toISOString();
  const nowDate = nowIso.split('T')[0];
  let count = 0;

  // Retrieve existing records to protect against duplicate uploads
  const existingExpIds = new Set<string>();
  const existingExpKeys = new Set<string>();
  try {
    const expSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'));
    expSnap.forEach((d) => {
      existingExpIds.add(d.id);
      const data = d.data();
      if (data.name && data.amount !== undefined && data.date) {
        existingExpKeys.add(`${data.name.trim().toLowerCase()}_${Number(data.amount)}_${data.date}`);
      }
    });
  } catch (e) {
    console.warn('Deduplication check note (expenses):', e);
  }

  const existingShopIds = new Set<string>();
  const existingShopKeys = new Set<string>();
  try {
    const shopSnap = await getDocs(collection(db, 'groups', groupId, 'shopping'));
    shopSnap.forEach((d) => {
      existingShopIds.add(d.id);
      const data = d.data();
      if (data.name) {
        existingShopKeys.add(data.name.trim().toLowerCase());
      }
    });
  } catch (e) {
    console.warn('Deduplication check note (shopping):', e);
  }

  const existingRecIds = new Set<string>();
  const existingRecKeys = new Set<string>();
  try {
    const recSnap = await getDocs(collection(db, 'groups', groupId, 'recurring'));
    recSnap.forEach((d) => {
      existingRecIds.add(d.id);
      const data = d.data();
      if (data.name && data.amount !== undefined) {
        existingRecKeys.add(`${data.name.trim().toLowerCase()}_${Number(data.amount)}`);
      }
    });
  } catch (e) {
    console.warn('Deduplication check note (recurring):', e);
  }

  for (const tx of localTx) {
    const txId = sanitizeId(tx.id, 'tx');
    const cleanName = (tx.name || (tx as any).title || 'Expense').trim().substring(0, 150);
    const amountVal = Math.max(0, Number(tx.amount) || 0);
    const dateVal = tx.date || nowDate;
    const dedupeKey = `${cleanName.toLowerCase()}_${amountVal}_${dateVal}`;

    // Skip if an identical transaction is already recorded in the cloud ledger
    if (existingExpIds.has(txId) || existingExpKeys.has(dedupeKey)) {
      continue;
    }

    const path = `groups/${groupId}/expenses/${txId}`;
    try {
      await setDoc(doc(db, 'groups', groupId, 'expenses', txId), {
        id: txId,
        name: cleanName,
        amount: amountVal,
        category: (tx.category || 'other').substring(0, 50),
        date: dateVal,
        settled: Boolean(tx.settled),
        groupId,
        createdBy: user.uid,
        createdByName: (user.displayName || user.email?.split('@')[0] || 'Member').substring(0, 128),
        createdAt: (tx as any).createdAt || nowIso
      });
      existingExpIds.add(txId);
      existingExpKeys.add(dedupeKey);
      count++;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  }

  for (const shop of localShop) {
    const shopId = sanitizeId(shop.id, 'shop');
    const cleanName = (shop.name || 'Item').trim().substring(0, 100);
    const dedupeKey = cleanName.toLowerCase();

    // Skip if item is already in shopping list
    if (existingShopIds.has(shopId) || existingShopKeys.has(dedupeKey)) {
      continue;
    }

    const path = `groups/${groupId}/shopping/${shopId}`;
    try {
      await setDoc(doc(db, 'groups', groupId, 'shopping', shopId), {
        id: shopId,
        name: cleanName,
        status: shop.status === 'bought' ? 'bought' : 'pending',
        date: shop.date || nowDate,
        groupId,
        category: (shop.category || 'other').substring(0, 50),
        byWhen: (shop.byWhen || 'whenever').substring(0, 50),
        createdBy: user.uid,
        createdAt: shop.createdAt || nowIso
      });
      existingShopIds.add(shopId);
      existingShopKeys.add(dedupeKey);
      count++;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  }

  for (const rec of localRec) {
    const recId = sanitizeId(rec.id, 'rec');
    const cleanName = (rec.name || 'Recurring bill').trim().substring(0, 100);
    const amountVal = Math.max(0, Number(rec.amount) || 0);
    const dedupeKey = `${cleanName.toLowerCase()}_${amountVal}`;

    // Skip if recurring bill already exists
    if (existingRecIds.has(recId) || existingRecKeys.has(dedupeKey)) {
      continue;
    }

    const path = `groups/${groupId}/recurring/${recId}`;
    try {
      await setDoc(doc(db, 'groups', groupId, 'recurring', recId), {
        id: recId,
        name: cleanName,
        amount: amountVal,
        frequency: (rec.frequency || 'monthly').substring(0, 32),
        category: (rec.category || 'other').substring(0, 50),
        startDate: rec.startDate || nowDate,
        status: rec.status === 'cancelled' ? 'cancelled' : 'active',
        groupId,
        createdBy: user.uid,
        createdAt: rec.createdAt || nowIso
      });
      existingRecIds.add(recId);
      existingRecKeys.add(dedupeKey);
      count++;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err;
    }
  }

  return count;
}

// Migrate multiple local/offline groups and their items directly into Firestore cloud
export async function migrateLocalGroupsToCloud(
  user: User,
  localGroups: ExpenseGroup[],
  localTx: Transaction[],
  localShop: ShoppingItem[],
  localRec: RecurringExpense[]
): Promise<ExpenseGroup[]> {
  const createdCloudGroups: ExpenseGroup[] = [];

  // Filter out any invalid groups
  const validLocalGroups = localGroups.filter(g => g.name?.trim());
  const fallbackGroups = validLocalGroups.length > 0 
    ? validLocalGroups 
    : [{ id: 'local_group', name: 'Personal Expenses' } as ExpenseGroup];

  for (const localGrp of fallbackGroups) {
    const cloudGrp = await createGroup(localGrp.name || 'Personal Expenses', user);

    // Seamlessly preserve custom categories defined in local ledger
    if (localGrp.customCategories && Object.keys(localGrp.customCategories).length > 0) {
      try {
        await updateGroupCustomCategories(cloudGrp.id, localGrp.customCategories);
        cloudGrp.customCategories = localGrp.customCategories;
      } catch (e) {
        console.warn('Could not migrate local custom categories to cloud group:', e);
      }
    }

    createdCloudGroups.push(cloudGrp);

    const grpTx = localTx.filter(t => (t.groupId || fallbackGroups[0].id) === localGrp.id);
    const grpShop = localShop.filter(s => (s.groupId || fallbackGroups[0].id) === localGrp.id);
    const grpRec = localRec.filter(r => (r.groupId || fallbackGroups[0].id) === localGrp.id);

    if (grpTx.length > 0 || grpShop.length > 0 || grpRec.length > 0) {
      await syncLocalDataToGroup(cloudGrp.id, user, grpTx, grpShop, grpRec);
    }
  }

  // Any orphaned items without a matching groupId go into the primary created cloud group
  const knownLocalIds = new Set(fallbackGroups.map(g => g.id));
  const orphanTx = localTx.filter(t => t.groupId && !knownLocalIds.has(t.groupId));
  const orphanShop = localShop.filter(s => s.groupId && !knownLocalIds.has(s.groupId));
  const orphanRec = localRec.filter(r => r.groupId && !knownLocalIds.has(r.groupId));

  if (createdCloudGroups[0] && (orphanTx.length > 0 || orphanShop.length > 0 || orphanRec.length > 0)) {
    await syncLocalDataToGroup(createdCloudGroups[0].id, user, orphanTx, orphanShop, orphanRec);
  }

  return createdCloudGroups;
}

// Reassign a category to 'other' across Firestore collections for a given group
export async function reassignCategoryInCloudGroup(
  groupId: string,
  oldCategory: string,
  newCategory: string = 'other'
): Promise<{ txCount: number; shopCount: number; recCount: number }> {
  let txCount = 0;
  let shopCount = 0;
  let recCount = 0;

  try {
    // 1. Expenses
    const expQ = query(collection(db, 'groups', groupId, 'expenses'), where('category', '==', oldCategory));
    const expSnap = await getDocs(expQ);
    for (const d of expSnap.docs) {
      try {
        await updateDoc(d.ref, { category: newCategory });
        txCount++;
      } catch (e) {
        console.warn('Error updating expense category:', e);
      }
    }

    // 2. Shopping
    const shopQ = query(collection(db, 'groups', groupId, 'shopping'), where('category', '==', oldCategory));
    const shopSnap = await getDocs(shopQ);
    for (const d of shopSnap.docs) {
      try {
        await updateDoc(d.ref, { category: newCategory });
        shopCount++;
      } catch (e) {
        console.warn('Error updating shopping category:', e);
      }
    }

    // 3. Recurring
    const recQ = query(collection(db, 'groups', groupId, 'recurring'), where('category', '==', oldCategory));
    const recSnap = await getDocs(recQ);
    for (const d of recSnap.docs) {
      try {
        await updateDoc(d.ref, { category: newCategory });
        recCount++;
      } catch (e) {
        console.warn('Error updating recurring category:', e);
      }
    }
  } catch (error) {
    console.warn(`Could not reassign category in cloud group ${groupId}:`, error);
  }

  return { txCount, shopCount, recCount };
}

// Update custom categories for a specific group/ledger in Firestore
export async function updateGroupCustomCategories(
  groupId: string,
  customCategories: Record<string, CategoryData>
): Promise<void> {
  if (!groupId || groupId.startsWith('local_') || groupId === 'local_group') {
    return;
  }

  try {
    await updateDoc(doc(db, 'groups', groupId), {
      customCategories,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    throw error;
  }
}

/**
 * Real-time listener for user cloud preferences (such as per-ledger Gemini states)
 * Enables seamless cross-device synchronization.
 */
export function subscribeToUserPreferences(
  userId: string,
  onUpdate: (prefs: Record<string, boolean>) => void
): () => void {
  if (!userId) return () => {};
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const geminiPrefs = data?.geminiPreferences;
        if (geminiPrefs && typeof geminiPrefs === 'object') {
          onUpdate(geminiPrefs);
        }
      }
    },
    (err) => {
      console.warn('Could not sync user preferences from Firestore:', err);
    }
  );
}

/**
 * Saves a per-ledger Gemini preference to the user profile in Firestore
 */
export async function saveUserLedgerGeminiPreference(
  userId: string,
  groupId: string,
  enabled: boolean
): Promise<void> {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        geminiPreferences: {
          [groupId]: enabled
        }
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to save per-ledger preference to cloud:', err);
  }
}

/**
 * Updates the name of an existing ledger / group in Firestore and local storage.
 */
export async function updateGroupName(groupId: string, newName: string): Promise<void> {
  const cleanName = newName.trim();
  if (!cleanName) {
    throw new Error('Ledger name cannot be empty');
  }
  if (cleanName.length > 80) {
    throw new Error('Ledger name is too long (maximum 80 characters)');
  }

  // Update local storage groups cache
  const localGroupsStr = localStorage.getItem('hisaab_groups');
  if (localGroupsStr) {
    try {
      const localGroups: ExpenseGroup[] = JSON.parse(localGroupsStr);
      const updatedLocal = localGroups.map(g => g.id === groupId ? { ...g, name: cleanName, updatedAt: new Date().toISOString() } : g);
      localStorage.setItem('hisaab_groups', JSON.stringify(updatedLocal));
    } catch {}
  }

  // Update active group in local storage if matching
  const activeGrpStr = localStorage.getItem('hisaab_active_group');
  if (activeGrpStr) {
    try {
      const activeGrp = JSON.parse(activeGrpStr);
      if (activeGrp.id === groupId) {
        localStorage.setItem('hisaab_active_group', JSON.stringify({ ...activeGrp, name: cleanName, updatedAt: new Date().toISOString() }));
      }
    } catch {}
  }

  // Update in Firestore for cloud groups
  if (!groupId.startsWith('local_') && groupId !== 'local_group') {
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: cleanName,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
      throw error;
    }
  }
}



