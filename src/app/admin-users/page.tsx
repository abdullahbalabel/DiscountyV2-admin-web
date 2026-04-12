"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type {
  AdminRole,
  AdminPermission,
  AdminProfileWithDetails,
  PermissionResource,
  PermissionAction,
} from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { adminUserSchema } from "@/lib/validations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Trash2,
  Pencil,
  ShieldCheck,
  Users,
  Plus,
  Eye,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";

const RESOURCES: PermissionResource[] = [
  "providers",
  "deals",
  "customers",
  "categories",
  "reviews",
  "notifications",
  "admin_users",
  "groups",
  "deal_conditions",
  "reports",
  "support_tickets",
  "data_requests",
];

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "manage"];

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { adminRole } = useAuth();

  // ── Roles state ──
  const [roles, setRoles] = useState<AdminRole[]>([]);

  // ── Users tab state ──
  const [admins, setAdmins] = useState<AdminProfileWithDetails[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsTotal, setAdminsTotal] = useState(0);
  const [adminsSearch, setAdminsSearch] = useState("");
  const debouncedAdminsSearch = useDebounce(adminsSearch);
  const { page: adminPage, pageSize: adminPageSize, offset: adminOffset, nextPage: adminNext, prevPage: adminPrev } = usePagination();
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfileWithDetails | null>(null);
  const [adminViewOpen, setAdminViewOpen] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);
  const [adminSuspendOpen, setAdminSuspendOpen] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role_id: "",
    is_active: true,
  });

  // ── Groups tab state (roles as groups) ──
  const [roleGroupMembers, setRoleGroupMembers] = useState<Record<string, AdminProfileWithDetails[]>>({});
  const [roleGroupLoading, setRoleGroupLoading] = useState(true);
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<AdminRole | null>(null);
  const [roleGroupMembersOpen, setRoleGroupMembersOpen] = useState(false);
  const [moveRoleDialogOpen, setMoveRoleDialogOpen] = useState(false);
  const [moveTargetAdmin, setMoveTargetAdmin] = useState<AdminProfileWithDetails | null>(null);
  const [moveTargetRoleId, setMoveTargetRoleId] = useState("");

  // ── Permissions tab state ──
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [selectedPermRole, setSelectedPermRole] = useState<string>("");

  // ── Fetch roles ──
  const fetchRoles = useCallback(async () => {
    const { data } = await supabase
      .from("admin_roles")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setRoles(data);
  }, []);

  // ── Fetch admins ──
  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    const { data, error } = await supabase.rpc("get_admin_users");

    if (!error && data) {
      const mapped: AdminProfileWithDetails[] = data.map(
        (row: Record<string, unknown>) => ({
          id: row.id as string,
          user_id: row.user_id as string,
          full_name: row.full_name as string | null,
          avatar_url: row.avatar_url as string | null,
          role_id: row.role_id as string,
          is_active: row.is_active as boolean,
          last_login_at: row.last_login_at as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          email: row.email as string,
          role: {
            id: row.role_id as string,
            name: row.role_name as AdminRole["name"],
            description: null,
            is_default: false,
            created_at: "",
          },
        })
      );

      setAdminsTotal(mapped.length);
      let filtered = mapped;
      if (debouncedAdminsSearch) {
        const s = debouncedAdminsSearch.toLowerCase();
        filtered = mapped.filter(
          (a) =>
            a.full_name?.toLowerCase().includes(s) ||
            a.email?.toLowerCase().includes(s)
        );
      }
      setAdmins(filtered.slice(adminOffset, adminOffset + adminPageSize));
    }
    setAdminsLoading(false);
  }, [adminOffset, adminPageSize, debouncedAdminsSearch]);

  // ── Fetch role group members ──
  const fetchRoleGroupMembers = useCallback(async () => {
    setRoleGroupLoading(true);
    const { data, error } = await supabase.rpc("get_admin_users");
    if (!error && data) {
      const mapped: AdminProfileWithDetails[] = data.map(
        (row: Record<string, unknown>) => ({
          id: row.id as string,
          user_id: row.user_id as string,
          full_name: row.full_name as string | null,
          avatar_url: row.avatar_url as string | null,
          role_id: row.role_id as string,
          is_active: row.is_active as boolean,
          last_login_at: row.last_login_at as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          email: row.email as string,
          role: {
            id: row.role_id as string,
            name: row.role_name as AdminRole["name"],
            description: null,
            is_default: false,
            created_at: "",
          },
        })
      );
      const grouped: Record<string, AdminProfileWithDetails[]> = {};
      for (const admin of mapped) {
        const key = admin.role?.name || "unknown";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(admin);
      }
      setRoleGroupMembers(grouped);
    }
    setRoleGroupLoading(false);
  }, []);

  // ── Fetch permissions ──
  const fetchPermissions = useCallback(async (roleId: string) => {
    setPermissionsLoading(true);
    const { data } = await supabase
      .from("admin_permissions")
      .select("*")
      .eq("role_id", roleId);
    if (data) setPermissions(data);
    setPermissionsLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  useEffect(() => {
    fetchRoleGroupMembers();
  }, [fetchRoleGroupMembers]);

  useEffect(() => {
    if (selectedPermRole) fetchPermissions(selectedPermRole);
  }, [selectedPermRole, fetchPermissions]);

  // ── Admin CRUD ──
  const invokeAdminFn = async (body: Record<string, unknown>) => {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const accessToken = refreshed?.session?.access_token;
    if (!accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-admin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return data;
  };

  const handleCreateAdmin = async () => {
    const result = adminUserSchema.safeParse(adminFormData);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    if (!result.data.password || result.data.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await invokeAdminFn({
        action: "create",
        email: result.data.email,
        password: result.data.password,
        full_name: result.data.full_name || null,
        role_id: result.data.role_id,
      });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    toast.success(t("admin.adminCreated"));
    setAdminEditOpen(false);
    resetAdminForm();
    fetchAdmins();
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;

    const result = adminUserSchema.safeParse(adminFormData);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    const { error } = await supabase
      .from("admin_profiles")
      .update({
        full_name: result.data.full_name || null,
        role_id: result.data.role_id,
        is_active: result.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedAdmin.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("admin.adminUpdated"));
    setAdminEditOpen(false);
    setSelectedAdmin(null);
    resetAdminForm();
    fetchAdmins();
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      await invokeAdminFn({
        action: "delete",
        user_id: selectedAdmin.user_id,
        profile_id: selectedAdmin.id,
      });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    toast.success(t("admin.adminDeleted"));
    setAdminDeleteOpen(false);
    setSelectedAdmin(null);
    fetchAdmins();
  };

  const handleToggleActive = async (admin: AdminProfileWithDetails) => {
    const newStatus = !admin.is_active;

    setAdmins((prev) =>
      prev.map((a) =>
        a.id === admin.id ? { ...a, is_active: newStatus } : a
      )
    );

    try {
      await invokeAdminFn({
        action: "toggle-active",
        profile_id: admin.id,
        user_id: admin.user_id,
        is_active: newStatus,
      });
    } catch (e) {
      toast.error((e as Error).message);
      fetchAdmins();
      return;
    }

    toast.success(newStatus ? t("admin.adminActivated") : t("admin.adminDeactivated"));
  };

  const resetAdminForm = () => {
    setAdminFormData({
      email: "",
      password: "",
      full_name: "",
      role_id: roles.find((r) => r.is_default)?.id || roles[0]?.id || "",
      is_active: true,
    });
  };

  const openAdminEdit = (admin?: AdminProfileWithDetails) => {
    if (admin) {
      setSelectedAdmin(admin);
      setAdminFormData({
        email: admin.email || "",
        password: "",
        full_name: admin.full_name || "",
        role_id: admin.role_id,
        is_active: admin.is_active,
      });
    } else {
      setSelectedAdmin(null);
      resetAdminForm();
    }
    setAdminEditOpen(true);
  };

  // ── Change admin role (move between groups) ──
  const handleChangeRole = async () => {
    if (!moveTargetAdmin || !moveTargetRoleId) return;

    const { error } = await supabase
      .from("admin_profiles")
      .update({ role_id: moveTargetRoleId, updated_at: new Date().toISOString() })
      .eq("id", moveTargetAdmin.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("admin.adminUpdated"));
    setMoveRoleDialogOpen(false);
    setMoveTargetAdmin(null);
    setMoveTargetRoleId("");
    fetchRoleGroupMembers();
    fetchAdmins();
  };

  // ── Permissions toggle ──
  const togglePermission = async (
    roleId: string,
    resource: PermissionResource,
    action: PermissionAction,
    hasPermission: boolean
  ) => {
    if (hasPermission) {
      const { error } = await supabase
        .from("admin_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("resource", resource)
        .eq("action", action);
      if (error) toast.error(error.message);
      else toast.success(t("admin.permissionRevoked"));
    } else {
      const { error } = await supabase
        .from("admin_permissions")
        .insert({ role_id: roleId, resource, action });
      if (error) toast.error(error.message);
      else toast.success(t("admin.permissionGranted"));
    }
    fetchPermissions(roleId);
  };

  const hasPermission = (resource: string, action: string) =>
    permissions.some((p) => p.resource === resource && p.action === action);

  const getRoleDisplayName = (roleName: string) =>
    roleName === "super_admin"
      ? t("admin.superAdmin")
      : roleName === "admin"
      ? t("admin.adminRole")
      : roleName === "moderator"
      ? t("admin.moderator")
      : t("admin.customerSupport");

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case "super_admin":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 border-none">
            {t("admin.superAdmin")}
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-none">
            {t("admin.adminRole")}
          </Badge>
        );
      case "moderator":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none">
            {t("admin.moderator")}
          </Badge>
        );
      case "customer_support":
        return (
          <Badge className="bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 border-none">
            {t("admin.customerSupport")}
          </Badge>
        );
      default:
        return <Badge>{roleName || "—"}</Badge>;
    }
  };

  const isSuperAdmin = adminRole === "super_admin";

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.adminUsersManagement")} />

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 me-1.5" />
              {t("admin.users")}
            </TabsTrigger>
            <TabsTrigger value="groups">
              <ShieldCheck className="h-4 w-4 me-1.5" />
              {t("admin.groups")}
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <ShieldCheck className="h-4 w-4 me-1.5" />
              {t("admin.permissions")}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════ USERS TAB ═══════════════════════ */}
          <TabsContent value="users" className="mt-4">
            <Card className="animate-fade-in stagger-1">
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative max-w-sm">
                    <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
                    <Input
                      placeholder={t("admin.search")}
                      value={adminsSearch}
                      onChange={(e) => setAdminsSearch(e.target.value)}
                      className="ps-9"
                    />
                  </div>
                  {isSuperAdmin && (
                    <Button size="sm" onClick={() => openAdminEdit()}>
                      <Plus className="h-4 w-4 me-1.5" />
                      {t("admin.addAdmin")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4">
                  {adminsLoading ? (
                    <TableSkeleton columns={5} />
                  ) : admins.length === 0 ? (
                    <EmptyState
                      icon={ShieldCheck}
                      title={t("admin.noAdmins")}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("admin.fullName")}</TableHead>
                          <TableHead>{t("admin.email")}</TableHead>
                          <TableHead>{t("admin.role")}</TableHead>
                          <TableHead>{t("admin.status")}</TableHead>
                          <TableHead>{t("admin.createdAt")}</TableHead>
                          <TableHead className="text-end">{t("admin.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.map((admin) => (
                          <TableRow
                            key={admin.id}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {admin.full_name || "—"}
                            </TableCell>
                            <TableCell dir="ltr" className="text-muted-foreground text-xs">
                              {admin.email || "—"}
                            </TableCell>
                            <TableCell>
                              {getRoleBadge(admin.role?.name)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  admin.is_active
                                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                    : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none"
                                }
                              >
                                {admin.is_active ? t("admin.active") : t("admin.inactive")}
                              </Badge>
                            </TableCell>
                            <TableCell dir="ltr" className="text-muted-foreground text-xs">
                              {new Date(admin.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-0.5 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    setSelectedAdmin(admin);
                                    setAdminViewOpen(true);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {isSuperAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => openAdminEdit(admin)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className={
                                        admin.is_active
                                          ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                                          : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                      }
                                      onClick={() => {
                                        setSelectedAdmin(admin);
                                        setAdminSuspendOpen(true);
                                      }}
                                      title={admin.is_active ? t("admin.deactivate") : t("admin.activate")}
                                    >
                                      {admin.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-destructive"
                                      onClick={() => {
                                        setSelectedAdmin(admin);
                                        setAdminDeleteOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>

            {adminsTotal > adminPageSize && (
              <div className="flex items-center justify-between animate-fade-in">
                <p className="text-xs text-muted-foreground">
                  {t("admin.showing")} {adminOffset + 1}-
                  {Math.min(adminOffset + adminPageSize, adminsTotal)} {t("admin.of")} {adminsTotal}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={adminPrev} disabled={adminPage === 1}>
                    {t("admin.previous")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={adminNext} disabled={adminOffset + adminPageSize >= adminsTotal}>
                    {t("admin.next")}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════ GROUPS TAB ═══════════════════════ */}
          <TabsContent value="groups" className="mt-4 space-y-4">
            {roleGroupLoading ? (
              <Card>
                <CardContent>
                  <TableSkeleton columns={3} />
                </CardContent>
              </Card>
            ) : (
              roles.map((role) => {
                const members = roleGroupMembers[role.name] || [];
                return (
                  <Card key={role.id} className="animate-fade-in stagger-1">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getRoleBadge(role.name)}
                          <span className="text-sm text-muted-foreground">
                            {role.description}
                          </span>
                        </div>
                        <Badge variant="outline">{members.length} {t("admin.members")}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {members.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("admin.noAdmins")}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {members.map((admin) => (
                            <div
                              key={admin.id}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase shrink-0">
                                  {admin.full_name?.charAt(0) || admin.email?.charAt(0) || "A"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {admin.full_name || "—"}
                                  </p>
                                  <p className="text-xs text-muted-foreground" dir="ltr">
                                    {admin.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge
                                  className={
                                    admin.is_active
                                      ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                      : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none"
                                  }
                                >
                                  {admin.is_active ? t("admin.active") : t("admin.inactive")}
                                </Badge>
                                {isSuperAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                      setMoveTargetAdmin(admin);
                                      setMoveTargetRoleId("");
                                      setMoveRoleDialogOpen(true);
                                    }}
                                  >
                                    {t("admin.assignRole")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ═══════════════════════ PERMISSIONS TAB ═══════════════════════ */}
          <TabsContent value="permissions" className="mt-4">
            <Card className="animate-fade-in stagger-1">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-48">
                    <Select
                      value={selectedPermRole}
                      onValueChange={(val) => setSelectedPermRole(val ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("admin.selectUser")} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {getRoleDisplayName(role.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedPermRole ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title={t("admin.noPermissions")}
                    description={t("admin.assignRole")}
                  />
                ) : permissionsLoading ? (
                  <TableSkeleton columns={6} />
                ) : (
                  <div className="overflow-x-auto -mx-4 px-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("admin.resource")}</TableHead>
                          {ACTIONS.map((action) => (
                            <TableHead key={action} className="text-center capitalize">
                              {action === "manage" ? t("admin.manage") : t(`admin.${action}`) || action}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {RESOURCES.map((resource) => (
                          <TableRow key={resource} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-medium capitalize">
                              {resource === "admin_users"
                                ? t("admin.adminUsers")
                                : resource === "groups"
                                ? t("admin.groups")
                                : resource === "deal_conditions"
                                ? t("admin.dealConditionsNav")
                                : resource === "reports"
                                ? t("admin.reportsNav")
                                : resource === "support_tickets"
                                ? t("admin.supportTickets.navTitle")
                                : resource === "data_requests"
                                ? t("admin.dataRequests.navTitle")
                                : t(`admin.${resource}`) || resource}
                            </TableCell>
                            {ACTIONS.map((action) => {
                              const active = hasPermission(resource, action);
                              return (
                                <TableCell key={action} className="text-center">
                                  <Switch
                                    checked={active}
                                    onCheckedChange={() =>
                                      isSuperAdmin &&
                                      togglePermission(selectedPermRole, resource, action, active)
                                    }
                                    disabled={!isSuperAdmin}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ═══════════════════════ DIALOGS ═══════════════════════ */}

        {/* Admin View Dialog */}
        <Dialog open={adminViewOpen} onOpenChange={setAdminViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.adminUsers")}</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">{t("admin.fullName")}</span>
                  <p className="text-sm font-medium">{selectedAdmin.full_name || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">{t("admin.email")}</span>
                  <p className="text-sm" dir="ltr">{selectedAdmin.email || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">{t("admin.role")}</span>
                  <div>{getRoleBadge(selectedAdmin.role?.name)}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">{t("admin.status")}</span>
                  <div>
                    <Badge
                      className={
                        selectedAdmin.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                          : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none"
                      }
                    >
                      {selectedAdmin.is_active ? t("admin.active") : t("admin.inactive")}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">{t("admin.createdAt")}</span>
                  <p className="text-sm" dir="ltr">
                    {new Date(selectedAdmin.created_at).toLocaleString()}
                  </p>
                </div>
                {selectedAdmin.last_login_at && (
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.lastLogin")}</span>
                    <p className="text-sm" dir="ltr">
                      {new Date(selectedAdmin.last_login_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdminViewOpen(false)}>
                {t("admin.cancel")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Create/Edit Dialog */}
        <Dialog open={adminEditOpen} onOpenChange={setAdminEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedAdmin ? t("admin.editAdmin") : t("admin.addAdmin")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!selectedAdmin && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("admin.email")}</Label>
                    <Input
                      type="email"
                      value={adminFormData.email}
                      onChange={(e) =>
                        setAdminFormData({ ...adminFormData, email: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.password")}</Label>
                    <Input
                      type="password"
                      value={adminFormData.password}
                      onChange={(e) =>
                        setAdminFormData({ ...adminFormData, password: e.target.value })
                      }
                      placeholder="Min. 6 characters"
                      dir="ltr"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>{t("admin.fullName")}</Label>
                <Input
                  value={adminFormData.full_name}
                  onChange={(e) =>
                    setAdminFormData({ ...adminFormData, full_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.role")}</Label>
                <Select
                  value={adminFormData.role_id}
                  onValueChange={(val) =>
                    setAdminFormData({ ...adminFormData, role_id: val ?? "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {getRoleDisplayName(role.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={adminFormData.is_active}
                  onCheckedChange={(checked) =>
                    setAdminFormData({ ...adminFormData, is_active: checked })
                  }
                />
                <Label>{t("admin.isActive")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdminEditOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={selectedAdmin ? handleUpdateAdmin : handleCreateAdmin}>
                {t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Delete Dialog */}
        <Dialog open={adminDeleteOpen} onOpenChange={setAdminDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.deleteAdmin")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("admin.deleteAdminConfirm")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdminDeleteOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteAdmin}>
                {t("admin.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Activate/Deactivate Dialog */}
        <Dialog open={adminSuspendOpen} onOpenChange={setAdminSuspendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedAdmin?.is_active ? t("admin.deactivate") : t("admin.activate")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {selectedAdmin?.is_active
                ? t("admin.suspendConfirm")
                : t("admin.reactivateConfirm")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdminSuspendOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button
                variant={selectedAdmin?.is_active ? "destructive" : "default"}
                onClick={() => {
                  if (selectedAdmin) handleToggleActive(selectedAdmin);
                  setAdminSuspendOpen(false);
                }}
              >
                {selectedAdmin?.is_active ? t("admin.deactivate") : t("admin.activate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Admin to Role Dialog */}
        <Dialog open={moveRoleDialogOpen} onOpenChange={setMoveRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.assignRole")}</DialogTitle>
            </DialogHeader>
            {moveTargetAdmin && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase shrink-0">
                    {moveTargetAdmin.full_name?.charAt(0) || moveTargetAdmin.email?.charAt(0) || "A"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{moveTargetAdmin.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{moveTargetAdmin.email}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.role")}</Label>
                  <Select
                    value={moveTargetRoleId}
                    onValueChange={(val) => setMoveTargetRoleId(val ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("admin.assignRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((r) => r.id !== moveTargetAdmin.role_id)
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {getRoleDisplayName(role.name)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveRoleDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleChangeRole} disabled={!moveTargetRoleId}>
                {t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
