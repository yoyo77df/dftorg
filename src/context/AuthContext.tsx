import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getDb, googleProvider } from "@/lib/firebase";

export type Role = "user" | "mod" | "admin";

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  role: Role;
}

interface AuthContextValue {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureUserDoc(user: User, fallbackName?: string) {
  const db = getDb();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const name = fallbackName || user.displayName || (user.email ? user.email.split("@")[0] : "Player");
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      name,
      username: name,
      photoURL: user.photoURL,
      role: "user",
      country: "",
      gaming_uid: "",
      bio: null,
      rank: "Rookie",
      xp: 0,
      wins: 0,
      total_kills: 0,
      matches_played: 0,
      earnings: 0,
      createdAt: serverTimestamp(),
    });
  } else if (fallbackName || user.displayName || user.photoURL || user.email) {
    const existing = snap.data() as Partial<UserProfile> & { username?: string };
    await setDoc(ref, {
      email: user.email,
      name: existing.name || name,
      username: existing.username || name,
      photoURL: user.photoURL,
    }, { merge: true });
  }
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    let unsubDoc: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      setCurrentUser(user);
      if (user) {
        try {
          await ensureUserDoc(user);
        } catch (e) {
          console.error("ensureUserDoc failed", e);
        }
        const db = getDb();
        unsubDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) {
            const d = snap.data() as Partial<UserProfile>;
            setUserProfile({
              uid: user.uid,
              email: d.email ?? user.email,
              name: d.name ?? user.displayName ?? null,
              photoURL: d.photoURL ?? user.photoURL ?? null,
              role: (d.role as Role) ?? "user",
            });
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("user doc snapshot error", err);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const register = async (email: string, password: string, name: string) => {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    await ensureUserDoc(cred.user, name);
    setCurrentUser(cred.user);
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(cred.user);
    setCurrentUser(cred.user);
    setLoading(false);
  };

  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user);
    setCurrentUser(cred.user);
    setLoading(false);
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    await fbSignOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  };

  const value: AuthContextValue = {
    currentUser,
    userProfile,
    loading,
    isAdmin: userProfile?.role === "admin",
    isMod: userProfile?.role === "mod" || userProfile?.role === "admin",
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useFirebaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider");
  return ctx;
}

export function mapFirebaseError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-email": return "Invalid email address.";
    case "auth/user-disabled": return "This account has been disabled.";
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/email-already-in-use": return "An account with this email already exists.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/popup-closed-by-user": return "Sign-in window was closed.";
    case "auth/popup-blocked": return "Popup blocked by browser. Allow popups and try again.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
    case "auth/too-many-requests": return "Too many attempts. Please try later.";
    case "auth/unauthorized-domain": return "This domain is not authorized in Firebase. Add it in Console → Authentication → Settings → Authorized domains.";
    default: return "Something went wrong. Please try again.";
  }
}