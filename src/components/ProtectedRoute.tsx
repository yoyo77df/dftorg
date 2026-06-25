import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFirebaseAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useFirebaseAuth();
  const navigate = useNavigate();
  const fbUser = typeof window !== "undefined" ? getFirebaseAuth().currentUser : null;
  const user = currentUser ?? fbUser;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}