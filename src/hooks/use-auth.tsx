import type { ReactNode } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { useFirebaseAuth } from "@/context/AuthContext";

type Ctx = {
  user: (FirebaseUser & { id: string }) | null;
  session: null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const useAuth = (): Ctx => {
  const { currentUser, loading, isAdmin, logout } = useFirebaseAuth();
  return {
    user: currentUser ? Object.assign(currentUser, { id: currentUser.uid }) : null,
    session: null,
    loading,
    isAdmin,
    signOut: logout,
  };
};