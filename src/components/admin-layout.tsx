"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/lib/types";
import {
  LayoutDashboard,
  Store,
  Tag,
  Users,
  FolderOpen,
  ListChecks,
  Star,
  Bell,
  LogOut,
  Globe,
  Menu,
  Moon,
  Sun,
  X,
  ShieldCheck,
  AlertTriangle,
  Check,
  CheckCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface AdminLayoutProps {
  children: ReactNode;
}

function timeAgo(dateStr: string, lang: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return lang === "ar" ? "الآن" : "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getNotifIcon(type: string) {
  if (type.startsWith("report_") || type === "rejection_report") return AlertTriangle;
  if (type === "deal_hidden") return AlertTriangle;
  return Bell;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const isRtl = i18n.language === "ar";

  const toggleCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const lang = i18n.language;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [i18n.language]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  }, [user]);

  const fetchRecentNotifs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentNotifs(data as Notification[]);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (notifOpen) fetchRecentNotifs();
  }, [notifOpen, fetchRecentNotifs]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin-notif-bell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
          if (notifOpen) fetchRecentNotifs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount, notifOpen, fetchRecentNotifs]);

  const markAsRead = async (notifId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notifId);
    setRecentNotifs((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    setNotifOpen(false);
    if (notif.type === "rejection_report") {
      router.push("/reports");
    }
  };

  const navGroups = [
    {
      label: t("admin.groupOverview"),
      items: [
        { href: "/", icon: LayoutDashboard, label: t("admin.dashboard") },
      ],
    },
    {
      label: t("admin.groupBusiness"),
      items: [
        { href: "/providers", icon: Store, label: t("admin.providers") },
        { href: "/deals", icon: Tag, label: t("admin.deals") },
        { href: "/categories", icon: FolderOpen, label: t("admin.categories") },
        { href: "/customers", icon: Users, label: t("admin.customers") },
        { href: "/reviews", icon: Star, label: t("admin.reviews") },
      ],
    },
    {
      label: t("admin.groupSupport"),
      items: [
        { href: "/reports", icon: AlertTriangle, label: t("admin.reports.navTitle") },
        { href: "/support-tickets", icon: MessageSquare, label: t("admin.supportTickets.navTitle") },
        { href: "/data-requests", icon: Shield, label: t("admin.dataRequests.navTitle") },
        { href: "/notifications", icon: Bell, label: t("admin.notifications") },
      ],
    },
    {
      label: t("admin.groupAdmin"),
      items: [
        { href: "/deal-conditions", icon: ListChecks, label: t("admin.dealConditions.navTitle") },
        { href: "/admin-users", icon: ShieldCheck, label: t("admin.adminUsers") },
      ],
    },
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
    <TooltipProvider>
    <div className="flex h-screen bg-background" dir={isRtl ? "rtl" : "ltr"}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-50 bg-card border-border flex flex-col transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        } ${
          sidebarCollapsed ? "lg:w-[68px]" : "w-64"
        } ${
          sidebarOpen
            ? "translate-x-0 w-64"
            : isRtl
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-border/60 ${
          sidebarCollapsed ? "lg:justify-center lg:px-0 px-5" : "px-5 justify-between"
        }`}>
          <div className={`flex items-center ${sidebarCollapsed ? "lg:gap-0 gap-3" : "gap-3"}`}>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <img
                src="/logo.svg"
                alt="Discounty"
                width={22}
                height={22}
              />
            </div>
            <h1 className={`text-base font-semibold text-foreground tracking-tight transition-opacity duration-200 ${
              sidebarCollapsed ? "lg:hidden" : ""
            }`}>
              {t("admin.title")}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto scrollbar-none ${
          sidebarCollapsed ? "lg:px-2 px-3" : "px-3"
        }`}>
          {navGroups.map((group, groupIdx) => (
            <div key={group.label} className={groupIdx > 0 ? "mt-1" : ""}>
              {/* Group label */}
              {!sidebarCollapsed && (
                <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {sidebarCollapsed && groupIdx > 0 && (
                <div className="hidden lg:flex justify-center py-2">
                  <div className="w-5 h-px bg-border" />
                </div>
              )}

              {group.items.map((item) => {
                const active = isActive(item.href);
                const linkContent = (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative ${
                      sidebarCollapsed ? "lg:justify-center lg:px-0 px-3 py-2.5 gap-3" : "px-3 py-2.5 gap-3"
                    } ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span className={sidebarCollapsed ? "lg:hidden" : ""}>{item.label}</span>
                  </Link>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger
                        render={<div />}
                        className="hidden lg:block"
                      >
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side={isRtl ? "left" : "right"} sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle - desktop only */}
        <div className="hidden lg:block border-t border-border/60">
          <Tooltip>
            <TooltipTrigger
              render={<button />}
              type="button"
              onClick={toggleCollapsed}
              className="flex items-center justify-center w-full h-10 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {isRtl ? (
                sidebarCollapsed ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side={isRtl ? "left" : "right"} sideOffset={8}>
              {sidebarCollapsed ? t("admin.expandSidebar") : t("admin.collapseSidebar")}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 ms-auto">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors h-8 w-8">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">
                    {user.email?.charAt(0) || "A"}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.title")}</p>
                  </div>
                  <DropdownMenuItem
                    onClick={signOut}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("admin.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger
                className="relative inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors h-8 w-8"
                aria-label={t("admin.notifications")}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[380px] max-h-[480px] overflow-hidden p-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">{t("admin.notifications")}</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {t("admin.markAllRead")}
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="overflow-y-auto max-h-[360px]">
                  {recentNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Bell className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">{t("admin.noResults")}</p>
                    </div>
                  ) : (
                    recentNotifs.map((notif) => {
                      const Icon = getNotifIcon(notif.type);
                      return (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => handleNotifClick(notif)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-start hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 ${
                            !notif.is_read ? "bg-primary/5" : ""
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                              !notif.is_read
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-sm truncate ${
                                  !notif.is_read ? "font-semibold" : "font-medium"
                                }`}
                              >
                                {notif.title}
                              </p>
                              {!notif.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {notif.body}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1" dir="ltr">
                              {timeAgo(notif.created_at, i18n.language)}
                            </p>
                          </div>
                          {!notif.is_read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                              }}
                              className="mt-1 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              aria-label={t("admin.markRead")}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="border-t">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-primary hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("admin.viewAllNotifications")}
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {mounted && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? t("admin.switchToLight") : t("admin.switchToDark")}
                className="rounded-lg"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1.5 text-muted-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {i18n.language === "en" ? "عربي" : "EN"}
              </span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
