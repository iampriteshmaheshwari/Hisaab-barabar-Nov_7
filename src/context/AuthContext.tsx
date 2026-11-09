import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  signInWithGoogle as fbSignIn, 
  logOut as fbLogOut, 
  onAuthStateChanged, 
  getRedirectResult,
  testConnection, 
  db,
  type User 
} from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  deleteUserAccount as serviceDeleteAccount, 
  reauthenticateGoogleUser, 
  type DeleteAccountResult 
} from '../services/accountService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  logOut: () => Promise<void>;
  deleteAccount: () => Promise<DeleteAccountResult>;
  reauthenticate: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => null,
  logOut: async () => {},
  deleteAccount: async () => ({ success: false }),
  reauthenticate: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testConnection();

    // Handle any completed redirect sign-in flow
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((err) => {
        const code = err?.code || '';
        if (code !== 'auth/cancelled-popup-request' && code !== 'auth/popup-closed-by-user') {
          console.warn('Redirect auth notice:', err?.message || err);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Record / sync user profile in Firestore
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              uid: currentUser.uid,
              email: (currentUser.email || '').toLowerCase(),
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              photoURL: currentUser.photoURL || '',
              lastLoginAt: new Date().toISOString()
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Could not sync user profile to Firestore:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const loggedUser = await fbSignIn();
      return loggedUser;
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return null;
      }
      if (code === 'auth/popup-blocked') {
        setAuthError('Pop-up was blocked by browser. Please allow pop-ups for this site or open in a new tab.');
        return null;
      }
      console.warn('Sign-in status:', error?.message || error);
      setAuthError('Sign in could not be completed. Please try again.');
      return null;
    }
  };

  const logOut = async () => {
    try {
      await fbLogOut();
      setAuthError(null);
    } catch (error) {
      console.warn('Logout notice:', error);
    }
  };

  const reauthenticate = async (): Promise<boolean> => {
    if (!user) return false;
    return await reauthenticateGoogleUser(user);
  };

  const deleteAccount = async (): Promise<DeleteAccountResult> => {
    if (!user) {
      return { success: false, error: 'No active user session to delete.' };
    }
    const result = await serviceDeleteAccount(user);
    if (result.success) {
      setUser(null);
      setAuthError(null);
    }
    return result;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      authError, 
      clearAuthError, 
      signInWithGoogle, 
      logOut,
      deleteAccount,
      reauthenticate
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
