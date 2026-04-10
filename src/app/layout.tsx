import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Discounty Admin",
  description: "Discounty Admin Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
