import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  deleteUser,
  reauthenticateWithPopup,
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust IndexedDB multi-tab offline persistence
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase: client is offline or network check pending.');
    }
  }
}

let activeSignInPromise: Promise<User | null> | null = null;

export async function signInWithGoogle(): Promise<User | null> {
  // If a sign-in operation is already in progress, reuse the existing promise to prevent auth/cancelled-popup-request
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  activeSignInPromise = (async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      return res.user;
    } catch (err: any) {
      const code = err?.code || '';

      // User closed popup or new request superseded it: graceful dismissal, do not throw
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        console.warn('Google sign-in popup was cancelled or closed.');
        return null;
      }

      // If popup was blocked by browser or iframe sandbox, attempt redirect fallback
      if (code === 'auth/popup-blocked') {
        console.warn('Google sign-in popup was blocked. Attempting redirect fallback...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr: any) {
          console.warn('Redirect sign-in fallback unavailable:', redirectErr?.message || redirectErr);
          const customErr = new Error('Pop-up was blocked by browser. Please enable pop-ups or open app in a new tab.');
          (customErr as any).code = 'auth/popup-blocked';
          throw customErr;
        }
      }

      console.warn('Google sign-in exception:', err?.message || err);
      throw err;
    } finally {
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
}

export async function logOut() {
  try {
    await signOut(auth);
  } catch (err: unknown) {
    console.warn('Logout error:', err);
  }
}

export { onAuthStateChanged, getRedirectResult, deleteUser, reauthenticateWithPopup, type User };
