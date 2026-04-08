"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect, ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      window.location.href = "/login";
    }
  }, [user, isAdmin, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return <>{children}</>;
}
