"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

export default function HomePage() {
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  }, [user, isAdmin, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
