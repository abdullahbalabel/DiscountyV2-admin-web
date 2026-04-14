"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Notification } from "@/lib/types";
import { notificationSchema } from "@/lib/validations";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Bell,
  Send,
  Search,
  Eye,
  Trash2,
  Mail,
  MailOpen,
  CalendarDays,
  BellRing,
  Users,
  User,
  Smile,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker, { Theme as EmojiTheme, EmojiClickData } from "emoji-picker-react";
import { useTheme } from "next-themes";

interface Stats {
  total: number;
  unread: number;
  sentToday: number;
}

interface UserOption {
  user_id: string;
  display_name: string;
  role: "customer" | "provider";
}

interface GroupedNotification {
  isGroup: true;
  groupId: string;
  title: string;
  body: string;
  type: string;
  count: number;
  firstCreated: string;
  sampleNotif: Notification;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<(Notification | GroupedNotification)[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusTab, setStatusTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupedNotification | null>(null);
  const [sendForm, setSendForm] = useState({
    title: "",
    body: "",
    targetUser: "all",
  });
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const debouncedUserSearch = useDebounce(userSearch, 300);
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState<"title" | "body" | null>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, sentToday: 0 });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupRecipients, setGroupRecipients] = useState<Record<string, { user_id: string; display_name: string; role: string; is_read: boolean }[]>>({});
  const [loadingRecipients, setLoadingRecipients] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Record<string, string>>({});
  const { resolvedTheme } = useTheme();
  const { page, pageSize, offset, nextPage, prevPage, resetPage } = usePagination();

  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      if (emojiTarget === "title") {
        setSendForm((prev) => ({
          ...prev,
          title: prev.title + emojiData.emoji,
        }));
      } else if (emojiTarget === "body") {
        setSendForm((prev) => ({
          ...prev,
          body: prev.body + emojiData.emoji,
        }));
      }
      setEmojiTarget(null);
    },
    [emojiTarget]
  );

  useEffect(() => {
    if (!emojiTarget) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiTarget(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiTarget]);

  useEffect(() => {
    if (!debouncedUserSearch || debouncedUserSearch.length < 2) {
      setUserResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearchingUsers(true);
      const searchStr = `%${debouncedUserSearch}%`;

      const [customersRes, providersRes] = await Promise.all([
        supabase
          .from("customer_profiles")
          .select("user_id, display_name")
          .ilike("display_name", searchStr)
          .limit(10),
        supabase
          .from("provider_profiles")
          .select("user_id, business_name")
          .ilike("business_name", searchStr)
          .limit(10),
      ]);

      const results: UserOption[] = [];

      if (customersRes.data) {
        customersRes.data.forEach((c) => {
          if (c.display_name) {
            results.push({
              user_id: c.user_id,
              display_name: c.display_name,
              role: "customer",
            });
          }
        });
      }

      if (providersRes.data) {
        providersRes.data.forEach((p) => {
          results.push({
            user_id: p.user_id,
            display_name: p.business_name,
            role: "provider",
          });
        });
      }

      setUserResults(results);
      setSearchingUsers(false);
    };

    searchUsers();
  }, [debouncedUserSearch]);

  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRes, unreadRes, todayRes] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
    ]);

    setStats({
      total: totalRes.count || 0,
      unread: unreadRes.count || 0,
      sentToday: todayRes.count || 0,
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusTab === "read") {
      query = query.eq("is_read", true);
    } else if (statusTab === "unread") {
      query = query.eq("is_read", false);
    }

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      let filtered = data;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = data.filter(
          (n) =>
            n.title?.toLowerCase().includes(s) ||
            n.body?.toLowerCase().includes(s) ||
            n.type?.toLowerCase().includes(s)
        );
      }

      const result: (Notification | GroupedNotification)[] = [];
      const broadcastGroups = new Map<string, Notification[]>();

      for (const notif of filtered) {
        if (notif.type === "admin_broadcast" || notif.type === "provider_broadcast") {
          const key = `${notif.type}||${notif.title}||${notif.body}`;
          const group = broadcastGroups.get(key);
          if (group) {
            group.push(notif);
          } else {
            broadcastGroups.set(key, [notif]);
          }
        } else {
          result.push(notif);
        }
      }

      for (const [, group] of broadcastGroups) {
        const sorted = [...group].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        result.push({
          isGroup: true,
          groupId: `${sorted[0].type}||${sorted[0].title}||${sorted[0].body}`,
          title: sorted[0].title,
          body: sorted[0].body,
          type: sorted[0].type,
          count: group.length,
          firstCreated: sorted[0].created_at,
          sampleNotif: sorted[0],
        });
      }

      result.sort(
        (a, b) =>
          new Date("created_at" in b ? b.created_at : b.firstCreated).getTime() -
          new Date("created_at" in a ? a.created_at : a.firstCreated).getTime()
      );

      setTotalCount(result.length);
      setNotifications(result.slice(offset, offset + pageSize));
    }
    setLoading(false);
  }, [debouncedSearch, offset, pageSize, statusTab, typeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSend = async () => {
    const result = notificationSchema.safeParse({
      title: sendForm.title,
      body: sendForm.body,
    });
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    setSending(true);

    if (sendForm.targetUser === "all" || sendForm.targetUser === "providers" || sendForm.targetUser === "customers") {
      let userIds: string[] = [];

      if (sendForm.targetUser === "all") {
        const [customersRes, providersRes] = await Promise.all([
          supabase.from("customer_profiles").select("user_id").eq("is_banned", false),
          supabase.from("provider_profiles").select("user_id").eq("approval_status", "approved"),
        ]);

        userIds = [
          ...(customersRes.data?.map((c) => c.user_id) || []),
          ...(providersRes.data?.map((p) => p.user_id) || []),
        ];
      } else if (sendForm.targetUser === "providers") {
        const providersRes = await supabase
          .from("provider_profiles")
          .select("user_id")
          .eq("approval_status", "approved");

        userIds = providersRes.data?.map((p) => p.user_id) || [];
      } else if (sendForm.targetUser === "customers") {
        const customersRes = await supabase
          .from("customer_profiles")
          .select("user_id")
          .eq("is_banned", false);

        userIds = customersRes.data?.map((c) => c.user_id) || [];
      }

      if (userIds.length > 0) {
        const inserts = userIds.map((uid) => ({
          user_id: uid,
          type: "admin_broadcast",
          title: result.data.title,
          body: result.data.body,
          data: {},
          is_read: false,
        }));

        const { error } = await supabase
          .from("notifications")
          .insert(inserts);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t("admin.notificationSent"));
          setSendDialogOpen(false);
          setSendForm({ title: "", body: "", targetUser: "all" });
          setSelectedUser(null);
          setUserSearch("");
          fetchNotifications();
          fetchStats();
        }
      }
    } else {
      const { error } = await supabase.from("notifications").insert({
        user_id: sendForm.targetUser,
        type: "admin_message",
        title: result.data.title,
        body: result.data.body,
        data: {},
        is_read: false,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.notificationSent"));
        setSendDialogOpen(false);
        setSendForm({ title: "", body: "", targetUser: "all" });
        setSelectedUser(null);
        setUserSearch("");
        fetchNotifications();
        fetchStats();
      }
    }

    setSending(false);
  };

  const handleDelete = async () => {
    if (!selectedNotif) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", selectedNotif.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.notificationDeleted"));
      setDeleteDialogOpen(false);
      setSelectedNotif(null);
      fetchNotifications();
      fetchStats();
    }
  };

  const handleToggleGroup = async (group: GroupedNotification) => {
    const next = new Set(expandedGroups);
    if (next.has(group.groupId)) {
      next.delete(group.groupId);
      setExpandedGroups(next);
      return;
    }
    next.add(group.groupId);
    setExpandedGroups(next);

    if (groupRecipients[group.groupId]) return;

    setLoadingRecipients((prev) => new Set(prev).add(group.groupId));

    const { data } = await supabase
      .from("notifications")
      .select("user_id, is_read")
      .in("type", ["admin_broadcast", "provider_broadcast"])
      .eq("title", group.title)
      .eq("body", group.body);

    if (data) {
      const userIds = data.map((n) => n.user_id);
      const readMap: Record<string, boolean> = {};
      data.forEach((n) => {
        readMap[n.user_id] = n.is_read;
      });

      const [customersRes, providersRes, rolesRes] = await Promise.all([
        supabase
          .from("customer_profiles")
          .select("user_id, display_name")
          .in("user_id", userIds),
        supabase
          .from("provider_profiles")
          .select("user_id, business_name")
          .in("user_id", userIds),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds),
      ]);

      const nameMap: Record<string, { name: string; role: string }> = {};
      customersRes.data?.forEach((c) => {
        if (c.display_name) nameMap[c.user_id] = { name: c.display_name, role: "customer" };
      });
      providersRes.data?.forEach((p) => {
        nameMap[p.user_id] = { name: p.business_name, role: "provider" };
      });
      rolesRes.data?.forEach((r) => {
        if (!nameMap[r.user_id]) {
          nameMap[r.user_id] = {
            name: r.role.charAt(0).toUpperCase() + r.role.slice(1),
            role: r.role,
          };
        }
      });

      const recipients = userIds.map((uid) => ({
        user_id: uid,
        display_name: nameMap[uid]?.name || uid.slice(0, 8),
        role: nameMap[uid]?.role || "unknown",
        is_read: readMap[uid] ?? false,
      }));

      recipients.sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return a.display_name.localeCompare(b.display_name);
      });

      setGroupRecipients((prev) => ({ ...prev, [group.groupId]: recipients }));
    }

    setLoadingRecipients((prev) => {
      const s = new Set(prev);
      s.delete(group.groupId);
      return s;
    });
  };

  const handleDeleteGroup = async (group: GroupedNotification) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("type", ["admin_broadcast", "provider_broadcast"])
      .eq("title", group.title)
      .eq("body", group.body);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.notificationDeleted"));
      setDeleteDialogOpen(false);
      setSelectedNotif(null);
      fetchNotifications();
      fetchStats();
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      admin_broadcast: "bg-primary/10 text-primary border-none",
      provider_broadcast: "bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 border-none",
      admin_message: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-none",
      deal_redeemed: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none",
      new_deal: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none",
      account_activity: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 border-none",
      deal_expiring: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 border-none",
      review_received: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400 border-none",
    };
    const labels: Record<string, string> = {
      admin_broadcast: t("admin.adminBroadcast"),
      provider_broadcast: t("admin.providerBroadcast"),
      admin_message: t("admin.adminMessage"),
      deal_redeemed: "Deal Redeemed",
      new_deal: "New Deal",
      account_activity: "Account Activity",
      deal_expiring: "Deal Expiring",
      review_received: "Review Received",
    };
    return (
      <Badge className={styles[type] || "bg-muted text-muted-foreground border-none"}>
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        {/* Header */}
        <PageHeader
          title={t("admin.notifications")}
          description={t("admin.totalNotifications")}
          action={
            <Button onClick={() => setSendDialogOpen(true)}>
              <Bell className="h-4 w-4 me-1.5" />
              {t("admin.sendNotification")}
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="animate-fade-in stagger-1">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {t("admin.totalNotifications")}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{stats.total}</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                  <BellRing className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in stagger-2">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {t("admin.unreadCount")}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{stats.unread}</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  <Mail className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in stagger-3">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {t("admin.sentToday")}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{stats.sentToday}</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="animate-fade-in stagger-2">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <Tabs
                value={statusTab}
                onValueChange={(v) => {
                  if (v) {
                    setStatusTab(v);
                    resetPage();
                  }
                }}
              >
                <TabsList>
                  <TabsTrigger value="all">{t("admin.all")}</TabsTrigger>
                  <TabsTrigger value="unread">
                    <Mail className="h-3.5 w-3.5 me-1.5" />
                    {t("admin.unread")}
                  </TabsTrigger>
                  <TabsTrigger value="read">
                    <MailOpen className="h-3.5 w-3.5 me-1.5" />
                    {t("admin.read")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
                  <Input
                    placeholder={t("admin.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ps-9"
                  />
                </div>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    if (v) {
                      setTypeFilter(v);
                      resetPage();
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t("admin.type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.all")}</SelectItem>
                    <SelectItem value="admin_broadcast">
                      {t("admin.adminBroadcast")}
                    </SelectItem>
                    <SelectItem value="provider_broadcast">
                      {t("admin.providerBroadcast")}
                    </SelectItem>
                    <SelectItem value="admin_message">
                      {t("admin.adminMessage")}
                    </SelectItem>
                    <SelectItem value="deal_redeemed">Deal Redeemed</SelectItem>
                    <SelectItem value="new_deal">New Deal</SelectItem>
                    <SelectItem value="account_activity">
                      Account Activity
                    </SelectItem>
                    <SelectItem value="deal_expiring">Deal Expiring</SelectItem>
                    <SelectItem value="review_received">
                      Review Received
                    </SelectItem>
                    <SelectItem value="rejection_report">
                      {t("admin.rejectionReport")}
                    </SelectItem>
                    <SelectItem value="report_reviewed">
                      {t("admin.reportReviewed")}
                    </SelectItem>
                    <SelectItem value="report_resolved">
                      {t("admin.reportResolved")}
                    </SelectItem>
                    <SelectItem value="report_dismissed">
                      {t("admin.reportDismissed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={6} />
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.titleLabel")}</TableHead>
                      <TableHead>{t("admin.description")}</TableHead>
                      <TableHead>{t("admin.type")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead className="text-end">
                        {t("admin.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((item) => {
                      if ("isGroup" in item) {
                        const group = item as GroupedNotification;
                        const isExpanded = expandedGroups.has(group.groupId);
                        const isLoading = loadingRecipients.has(group.groupId);
                        const recipients = groupRecipients[group.groupId] || [];
                        const readCount = recipients.filter((r) => r.is_read).length;

                        return (
                          <React.Fragment key={group.groupId}>
                            <TableRow className="hover:bg-muted/40 transition-colors">
                              <TableCell className="font-medium max-w-[200px]">
                                <button
                                  type="button"
                                  onClick={() => handleToggleGroup(group)}
                                  className="flex items-center gap-2 w-full text-start hover:opacity-80 transition-opacity"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{group.title}</span>
                                </button>
                              </TableCell>
                              <TableCell className="max-w-[280px] truncate text-muted-foreground text-sm">
                                {group.body}
                              </TableCell>
                              <TableCell>{getTypeBadge(group.type)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {group.count} {t("admin.recipients") || "recipients"}
                                </Badge>
                              </TableCell>
                              <TableCell dir="ltr" className="text-muted-foreground text-xs">
                                {new Date(group.firstCreated).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-0.5 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleToggleGroup(group)}
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive"
                                    onClick={() => {
                                      setSelectedGroup(group);
                                      setSelectedNotif(null);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={6} className="bg-muted/30 p-0">
                                  <div className="px-6 py-3">
                                    {isLoading ? (
                                      <p className="text-sm text-muted-foreground py-2">
                                        {t("admin.loading")}
                                      </p>
                                    ) : recipients.length > 0 ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                          <span>
                                            {t("admin.totalRecipients") || "Total"}: {recipients.length}
                                          </span>
                                          <span className="text-emerald-600">
                                            {t("admin.read")}: {readCount}
                                          </span>
                                          <span className="text-amber-600">
                                            {t("admin.unread")}: {recipients.length - readCount}
                                          </span>
                                          <Select
                                            value={roleFilter[group.groupId] || "all"}
                                            onValueChange={(v) => {
                                              if (v) {
                                                setRoleFilter((prev) => ({ ...prev, [group.groupId]: v }));
                                              }
                                            }}
                                          >
                                            <SelectTrigger className="w-[130px] h-7 text-[11px]">
                                              <SelectValue placeholder={t("admin.filterByRole")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="all">{t("admin.allRoles")}</SelectItem>
                                              <SelectItem value="customer">{t("admin.customer")}</SelectItem>
                                              <SelectItem value="provider">{t("admin.provider")}</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="rounded-lg border">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="h-8 text-xs">{t("admin.name") || "User"}</TableHead>
                                                <TableHead className="h-8 text-xs">{t("admin.type") || "Role"}</TableHead>
                                                <TableHead className="h-8 text-xs">{t("admin.status")}</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {recipients
                                                .filter((r) => {
                                                  const filter = roleFilter[group.groupId] || "all";
                                                  return filter === "all" || r.role === filter;
                                                })
                                                .map((r) => (
                                                <TableRow key={r.user_id} className="h-8">
                                                  <TableCell className="py-1.5 text-sm">
                                                    {r.display_name}
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                      {r.role}
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className="py-1.5">
                                                    <Badge
                                                      className={
                                                        r.is_read
                                                          ? "bg-muted text-muted-foreground border-none text-[10px] px-1.5 py-0"
                                                          : "bg-primary/10 text-primary border-none text-[10px] px-1.5 py-0"
                                                      }
                                                    >
                                                      {r.is_read
                                                        ? t("admin.read")
                                                        : t("admin.unread")}
                                                    </Badge>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground py-2">
                                        {t("admin.noResults")}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      }

                      const notif = item as Notification;
                      return (
                        <TableRow
                          key={notif.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {notif.title}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate text-muted-foreground text-sm">
                            {notif.body}
                          </TableCell>
                          <TableCell>{getTypeBadge(notif.type)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                notif.is_read
                                  ? "bg-muted text-muted-foreground border-none"
                                  : "bg-primary/10 text-primary border-none"
                              }
                            >
                              {notif.is_read
                                ? t("admin.read")
                                : t("admin.unread")}
                            </Badge>
                          </TableCell>
                          <TableCell dir="ltr" className="text-muted-foreground text-xs">
                            {new Date(notif.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5 justify-end">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setSelectedNotif(notif);
                                  setSelectedGroup(null);
                                  setViewDialogOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedNotif(notif);
                                  setSelectedGroup(null);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-xs text-muted-foreground">
              {t("admin.showing")} {offset + 1}-
              {Math.min(offset + pageSize, totalCount)} {t("admin.of")}{" "}
              {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={page === 1}
              >
                {t("admin.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={offset + pageSize >= totalCount}
              >
                {t("admin.next")}
              </Button>
            </div>
          </div>
        )}

        {/* Send Notification Dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("admin.sendNotification")}</DialogTitle>
              <DialogDescription>
                {t("admin.sendTo")}{" "}
                {sendForm.targetUser === "all"
                  ? t("admin.allUsers").toLowerCase()
                  : sendForm.targetUser === "providers"
                    ? t("admin.providersOnly").toLowerCase()
                    : sendForm.targetUser === "customers"
                      ? t("admin.customersOnly").toLowerCase()
                      : t("admin.specificUser").toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {/* Target Selection */}
              <div className="space-y-2">
                <Label>{t("admin.sendTo")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSendForm({ ...sendForm, targetUser: "all" })
                    }
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                      sendForm.targetUser === "all"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        sendForm.targetUser === "all"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}
                    >
                      <Users
                        className={`h-4 w-4 ${
                          sendForm.targetUser === "all"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("admin.allUsers")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.allProviders")} & {t("admin.allCustomers")}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSendForm({ ...sendForm, targetUser: "providers" })
                    }
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                      sendForm.targetUser === "providers"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        sendForm.targetUser === "providers"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}
                    >
                      <Users
                        className={`h-4 w-4 ${
                          sendForm.targetUser === "providers"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("admin.providersOnly")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.allProviders")}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSendForm({ ...sendForm, targetUser: "customers" })
                    }
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                      sendForm.targetUser === "customers"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        sendForm.targetUser === "customers"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}
                    >
                      <Users
                        className={`h-4 w-4 ${
                          sendForm.targetUser === "customers"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("admin.customersOnly")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.allCustomers")}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSendForm({ ...sendForm, targetUser: "" })
                    }
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                      sendForm.targetUser !== "all" && sendForm.targetUser !== "providers" && sendForm.targetUser !== "customers"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        sendForm.targetUser !== "all" && sendForm.targetUser !== "providers" && sendForm.targetUser !== "customers"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}
                    >
                      <User
                        className={`h-4 w-4 ${
                          sendForm.targetUser !== "all" && sendForm.targetUser !== "providers" && sendForm.targetUser !== "customers"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t("admin.specificUser")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser
                          ? selectedUser.display_name
                          : "Single user"}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* User Search */}
              {sendForm.targetUser !== "all" && sendForm.targetUser !== "providers" && sendForm.targetUser !== "customers" && (
                <div className="space-y-2">
                  {selectedUser ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {selectedUser.display_name}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {selectedUser.role}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(null);
                          setSendForm({ ...sendForm, targetUser: "" });
                          setUserSearch("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
                        <Input
                          placeholder="Search users by name..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="ps-9"
                        />
                      </div>

                      {debouncedUserSearch.length >= 2 && (
                        <div className="rounded-lg border max-h-[200px] overflow-y-auto">
                          {searchingUsers ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {t("admin.loading")}
                            </div>
                          ) : userResults.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {t("admin.noResults")}
                            </div>
                          ) : (
                            userResults.map((user) => (
                              <button
                                key={user.user_id}
                                type="button"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setSendForm({
                                    ...sendForm,
                                    targetUser: user.user_id,
                                  });
                                  setUserSearch("");
                                }}
                                className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                              >
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {user.display_name}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {user.role}
                                </Badge>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <Separator />

              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("admin.notificationTitle")}</Label>
                  <span
                    className={`text-xs ${
                      sendForm.title.length > 200
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {sendForm.title.length}/200
                  </span>
                </div>
                <div className="relative">
                  <Input
                    value={sendForm.title}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, title: e.target.value })
                    }
                    placeholder="Enter notification title..."
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEmojiTarget(emojiTarget === "title" ? null : "title")
                    }
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {emojiTarget === "title" && (
                    <div
                      ref={emojiRef}
                      className="absolute z-50 mt-1 end-0"
                    >
                      <EmojiPicker
                        theme={
                          resolvedTheme === "dark"
                            ? EmojiTheme.DARK
                            : EmojiTheme.LIGHT
                        }
                        onEmojiClick={onEmojiClick}
                        width={300}
                        height={350}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("admin.notificationBody")}</Label>
                  <span
                    className={`text-xs ${
                      sendForm.body.length > 1000
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {sendForm.body.length}/1000
                  </span>
                </div>
                <div className="relative">
                  <Textarea
                    value={sendForm.body}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, body: e.target.value })
                    }
                    placeholder="Enter notification message..."
                    rows={4}
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEmojiTarget(emojiTarget === "body" ? null : "body")
                    }
                    className="absolute top-3 end-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {emojiTarget === "body" && (
                    <div
                      ref={emojiRef}
                      className="absolute z-50 mt-1 end-0"
                    >
                      <EmojiPicker
                        theme={
                          resolvedTheme === "dark"
                            ? EmojiTheme.DARK
                            : EmojiTheme.LIGHT
                        }
                        onEmojiClick={onEmojiClick}
                        width={300}
                        height={350}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview */}
              {(sendForm.title || sendForm.body) && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                      {t("admin.preview")}
                    </Label>
                    <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                          <Bell className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">
                              {sendForm.title || "Notification Title"}
                            </p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              now
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {sendForm.body || "Notification body text..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSendDialogOpen(false);
                  setSelectedUser(null);
                  setUserSearch("");
                  setSendForm({ title: "", body: "", targetUser: "all" });
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button
                onClick={handleSend}
                disabled={
                  sending ||
                  !sendForm.title.trim() ||
                  !sendForm.body.trim() ||
                  (sendForm.targetUser !== "all" && sendForm.targetUser !== "providers" && sendForm.targetUser !== "customers" && !selectedUser)
                }
              >
                <Send className="h-4 w-4 me-1.5" />
                {sending ? t("admin.loading") : t("admin.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Notification Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("admin.viewNotification")}</DialogTitle>
            </DialogHeader>
            {selectedNotif && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <Bell className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {selectedNotif.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedNotif.body}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                      {t("admin.type")}
                    </p>
                    {getTypeBadge(selectedNotif.type)}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                      {t("admin.status")}
                    </p>
                    <Badge
                      className={
                        selectedNotif.is_read
                          ? "bg-muted text-muted-foreground border-none"
                          : "bg-primary/10 text-primary border-none"
                      }
                    >
                      {selectedNotif.is_read
                        ? t("admin.read")
                        : t("admin.unread")}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                      {t("admin.sentAt")}
                    </p>
                    <p dir="ltr" className="text-sm">
                      {new Date(selectedNotif.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewDialogOpen(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setViewDialogOpen(false);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 me-1.5" />
                {t("admin.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.deleteNotification")}</DialogTitle>
              <DialogDescription>
                {t("admin.deleteNotificationConfirm")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={() => {
                if (selectedGroup) {
                  handleDeleteGroup(selectedGroup);
                } else {
                  handleDelete();
                }
              }}>
                <Trash2 className="h-4 w-4 me-1.5" />
                {t("admin.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
