import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';

export interface InvestigatorProfile {
  uid: string;
  displayName: string;
  email: string;
  organization: string;
  roleTitle: string;
  photoURL?: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: InvestigatorProfile | null;
  authReady: boolean;
  signingIn: boolean;
  needsOnboarding: boolean;
  authError: string | null;
  signInWithGoogle: (pendingDetails?: {
    displayName?: string;
    organization?: string;
    roleTitle?: string;
  }) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    organization?: string;
    roleTitle?: string;
  }) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  saveInvestigatorProfile: (details: {
    displayName: string;
    organization: string;
    roleTitle: string;
  }) => Promise<void>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitize(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function mapFirebaseAuthError(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in your Firebase project yet. Enable it in Firebase Console → Authentication → Sign-in method, then try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completion. Please try again.';
    case 'auth/popup-blocked':
      return 'Browser blocked the sign-in popup. Allow popups for this site and try again.';
    default:
      return err instanceof Error ? err.message : fallback;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<InvestigatorProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadOrCreateProfile = useCallback(
    async (
      fbUser: User,
      pendingDetails?: {
        displayName?: string;
        organization?: string;
        roleTitle?: string;
      }
    ) => {
      const profilePath = `users/${fbUser.uid}`;
      const profileRef = doc(db, 'users', fbUser.uid);

      try {
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const data = snap.data();
          const loaded: InvestigatorProfile = {
            uid: fbUser.uid,
            displayName: String(data.displayName || fbUser.displayName || 'Investigator'),
            email: String(data.email || fbUser.email || ''),
            organization: String(data.organization || ''),
            roleTitle: String(data.roleTitle || ''),
            photoURL: fbUser.photoURL,
          };

          // If user supplied fresh profile fields during Sign Up mode, update them cleanly
          if (
            pendingDetails &&
            (pendingDetails.organization?.trim() ||
              pendingDetails.roleTitle?.trim() ||
              pendingDetails.displayName?.trim())
          ) {
            const nextDisplayName = sanitize(
              pendingDetails.displayName || loaded.displayName || 'Investigator',
              120
            );
            const nextOrg = sanitize(
              pendingDetails.organization ?? loaded.organization,
              120
            );
            const nextRole = sanitize(
              pendingDetails.roleTitle ?? loaded.roleTitle,
              100
            );
            await updateDoc(profileRef, {
              displayName: nextDisplayName || 'Investigator',
              email: sanitize(fbUser.email || loaded.email || 'user@example.com', 254),
              organization: nextOrg,
              roleTitle: nextRole,
              updatedAt: serverTimestamp(),
            });
            setProfile({
              ...loaded,
              displayName: nextDisplayName || loaded.displayName,
              organization: nextOrg,
              roleTitle: nextRole,
            });
          } else {
            setProfile(loaded);
          }
          setNeedsOnboarding(false);
          return;
        }

        // First-time user: create strictly validated profile document matching firebase-blueprint.json
        const displayName = sanitize(
          pendingDetails?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Investigator',
          120
        );
        const email = sanitize(fbUser.email || 'investigator@truthlens.app', 254);
        const organization = sanitize(pendingDetails?.organization || '', 120);
        const roleTitle = sanitize(pendingDetails?.roleTitle || 'Digital Forensics Investigator', 100);

        await setDoc(profileRef, {
          uid: fbUser.uid,
          displayName: displayName || 'Investigator',
          email,
          organization,
          roleTitle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setProfile({
          uid: fbUser.uid,
          displayName: displayName || 'Investigator',
          email,
          organization,
          roleTitle,
          photoURL: fbUser.photoURL,
        });
        setNeedsOnboarding(false);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        } catch (structuredErr) {
          console.error(structuredErr);
        }
        setProfile({
          uid: fbUser.uid,
          displayName: fbUser.displayName || pendingDetails?.displayName || 'Investigator',
          email: fbUser.email || '',
          organization: pendingDetails?.organization || '',
          roleTitle: pendingDetails?.roleTitle || 'Investigator',
          photoURL: fbUser.photoURL,
        });
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        await loadOrCreateProfile(fbUser);
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [loadOrCreateProfile]);

  const signInWithGoogle = useCallback(
    async (pendingDetails?: {
      displayName?: string;
      organization?: string;
      roleTitle?: string;
    }): Promise<boolean> => {
      setSigningIn(true);
      setAuthError(null);
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          await loadOrCreateProfile(result.user, pendingDetails);
          return true;
        }
        return false;
      } catch (err: unknown) {
        setAuthError(mapFirebaseAuthError(err, 'Unable to complete Google sign-in.'));
        return false;
      } finally {
        setSigningIn(false);
      }
    },
    [loadOrCreateProfile]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const cleanEmail = sanitize(email, 254);
      if (!cleanEmail || !password) {
        setAuthError('Please enter both your email address and password.');
        return false;
      }
      setSigningIn(true);
      setAuthError(null);
      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (result.user) {
          await loadOrCreateProfile(result.user);
          return true;
        }
        return false;
      } catch (err: unknown) {
        setAuthError(mapFirebaseAuthError(err, 'Unable to sign in with email and password.'));
        return false;
      } finally {
        setSigningIn(false);
      }
    },
    [loadOrCreateProfile]
  );

  const signUpWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      organization?: string;
      roleTitle?: string;
    }): Promise<boolean> => {
      const cleanEmail = sanitize(params.email, 254);
      const cleanName = sanitize(params.displayName, 120);
      if (!cleanEmail || !params.password) {
        setAuthError('Please enter both an email address and a password.');
        return false;
      }
      if (params.password.length < 6) {
        setAuthError('Password must be at least 6 characters long.');
        return false;
      }
      setSigningIn(true);
      setAuthError(null);
      try {
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        if (result.user) {
          if (cleanName) {
            await updateProfile(result.user, { displayName: cleanName });
          }
          await loadOrCreateProfile(result.user, {
            displayName: cleanName || cleanEmail.split('@')[0] || 'Investigator',
            organization: params.organization,
            roleTitle: params.roleTitle,
          });
          return true;
        }
        return false;
      } catch (err: unknown) {
        setAuthError(mapFirebaseAuthError(err, 'Unable to create your account.'));
        return false;
      } finally {
        setSigningIn(false);
      }
    },
    [loadOrCreateProfile]
  );

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    const cleanEmail = sanitize(email, 254);
    if (!cleanEmail) {
      setAuthError('Enter your email address first so we can send a password reset link.');
      return false;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return true;
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err, 'Unable to send password reset email.'));
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const saveInvestigatorProfile = useCallback(
    async (details: { displayName: string; organization: string; roleTitle: string }) => {
      if (!user) return;
      const profilePath = `users/${user.uid}`;
      const profileRef = doc(db, 'users', user.uid);
      const nextDisplayName = sanitize(details.displayName || 'Investigator', 120) || 'Investigator';
      const nextOrg = sanitize(details.organization || '', 120);
      const nextRole = sanitize(details.roleTitle || '', 100);

      try {
        await updateDoc(profileRef, {
          displayName: nextDisplayName,
          email: sanitize(user.email || profile?.email || 'investigator@truthlens.app', 254),
          organization: nextOrg,
          roleTitle: nextRole,
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: nextDisplayName,
                organization: nextOrg,
                roleTitle: nextRole,
              }
            : null
        );
        setNeedsOnboarding(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, profilePath);
      }
    },
    [user, profile]
  );

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setNeedsOnboarding(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        signingIn,
        needsOnboarding,
        authError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        saveInvestigatorProfile,
        signOutUser,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
