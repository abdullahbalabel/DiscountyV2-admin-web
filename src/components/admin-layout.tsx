"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Store,
  Tag,
  Users,
  FolderOpen,
  Star,
  Bell,
  LogOut,
  Globe,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isRtl = i18n.language === "ar";

  useEffect(() => setMounted(true), []);

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t("admin.dashboard") },
    { href: "/providers", icon: Store, label: t("admin.providers") },
    { href: "/deals", icon: Tag, label: t("admin.deals") },
    { href: "/customers", icon: Users, label: t("admin.customers") },
    { href: "/categories", icon: FolderOpen, label: t("admin.categories") },
    { href: "/reviews", icon: Star, label: t("admin.reviews") },
    { href: "/notifications", icon: Bell, label: t("admin.notifications") },
  ];

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-background" dir={isRtl ? "rtl" : "ltr"}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-50 w-64 bg-card border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        } ${
          sidebarOpen
            ? "translate-x-0"
            : isRtl
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <h1 className="text-lg font-bold text-primary truncate">
            {t("admin.title")}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <Separator />

        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            <span>{t("admin.logout")}</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            {mounted && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? t("admin.switchToLight") : t("admin.switchToDark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              {i18n.language === "en" ? "عربي" : "English"}
            </Button>

            {user && (
              <div className="text-sm text-muted-foreground hidden sm:block">
                {user.email}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
