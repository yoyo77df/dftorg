import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFirebaseAuth } from "@/context/AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { currentUser, userProfile, loading, isAdmin } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      navigate({ to: "/login" });
    } else if (userProfile && !isAdmin) {
      navigate({ to: "/" });
    }
  }, [loading, currentUser, userProfile, isAdmin, navigate]);

  if (loading || !currentUser || !userProfile) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) return null;
  return <>{children}</>;
}