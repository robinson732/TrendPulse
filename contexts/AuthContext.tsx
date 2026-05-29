import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { Platform } from "react-native";
import { isFirebaseConfigured, getFirebaseAuth } from "@/lib/firebaseConfig";

export type AuthError =
  | "invalid-email"
  | "wrong-password"
  | "user-not-found"
  | "email-in-use"
  | "weak-password"
  | "network"
  | "unknown";

export const AUTH_ERROR_MESSAGES: Record<AuthError, string> = {
  "invalid-email": "Adresse e-mail invalide.",
  "wrong-password": "Mot de passe incorrect.",
  "user-not-found": "Aucun compte trouvé pour cet e-mail.",
  "email-in-use": "Cet e-mail est déjà utilisé.",
  "weak-password": "Le mot de passe doit comporter au moins 6 caractères.",
  "network": "Erreur réseau. Vérifie ta connexion.",
  "unknown": "Une erreur est survenue. Réessaie.",
};

interface AuthContextValue {
  user: User | null;
  uid: string | null;
  displayName: string;
  email: string | null;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  showAuthSheet: boolean;
  openAuthSheet: () => void;
  closeAuthSheet: () => void;
  signInAnon: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  createAccount: (email: string, password: string, name: string) => Promise<AuthError | null>;
  signInWithGoogle: () => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  guestMode: boolean;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseError(code: string): AuthError {
  if (code.includes("invalid-email")) return "invalid-email";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "wrong-password";
  if (code.includes("user-not-found")) return "user-not-found";
  if (code.includes("email-already-in-use")) return "email-in-use";
  if (code.includes("weak-password")) return "weak-password";
  if (code.includes("network")) return "network";
  return "unknown";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const enterGuestMode = useCallback(() => setGuestMode(true), []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInAnon = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("[Auth] Anonymous sign-in failed:", err);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    const auth = getFirebaseAuth();
    if (!auth) return "unknown";
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (err: any) {
      return mapFirebaseError(err.code || "");
    }
  }, []);

  const createAccount = useCallback(async (email: string, password: string, name: string): Promise<AuthError | null> => {
    const auth = getFirebaseAuth();
    if (!auth) return "unknown";
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(newUser, { displayName: name.trim() });
      }
      setUser((prev) => prev ? { ...prev, displayName: name.trim() } as User : null);
      return null;
    } catch (err: any) {
      return mapFirebaseError(err.code || "");
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    if (Platform.OS !== "web") return "unknown";
    const auth = getFirebaseAuth();
    if (!auth) return "unknown";
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return null;
    } catch (err: any) {
      return mapFirebaseError(err.code || "");
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn("[Auth] Sign out failed:", err);
    }
  }, []);

  const openAuthSheet = useCallback(() => setShowAuthSheet(true), []);
  const closeAuthSheet = useCallback(() => setShowAuthSheet(false), []);

  const resolvedDisplayName = useMemo(() => {
    if (!user) return "You";
    if (user.displayName) return user.displayName;
    if (!user.isAnonymous && user.email) return user.email.split("@")[0];
    return `User_${user.uid.slice(0, 6)}`;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      uid: user?.uid || (guestMode ? "guest" : null),
      displayName: resolvedDisplayName,
      email: user?.email || null,
      isAnonymous: user?.isAnonymous ?? true,
      isAuthenticated: !!(user && !user.isAnonymous),
      isLoading,
      showAuthSheet,
      openAuthSheet,
      closeAuthSheet,
      signInAnon,
      signInWithEmail,
      createAccount,
      signInWithGoogle,
      signOut,
      guestMode,
      enterGuestMode,
    }),
    [user, resolvedDisplayName, isLoading, showAuthSheet, openAuthSheet, closeAuthSheet, signInAnon, signInWithEmail, createAccount, signInWithGoogle, signOut, guestMode, enterGuestMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
