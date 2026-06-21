import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFirebaseAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !currentUser) navigate({ to: "/login" });
  }, [loading, currentUser, navigate]);

  if (loading || !currentUser) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}