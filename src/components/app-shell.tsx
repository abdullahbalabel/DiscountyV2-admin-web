"use client";

import { Providers } from "@/app/providers";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
