"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { AdminLayout } from "@/components/admin-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { ReactNode } from "react";
import "@/i18n";

export function AdminPageWrapper({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AdminLayout>
    </ProtectedRoute>
  );
}
