"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { ProviderProfile, ApprovalStatus } from "@/lib/types";
import { providerEditSchema } from "@/lib/validations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Check, X, Eye, Search, Trash2, Pause, Play, Pencil, Store } from "lucide-react";
import { toast } from "sonner";

export default function ProvidersPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    business_name: "",
    category: "",
    description: "",
    phone: "",
    website: "",
    approval_status: "pending" as ApprovalStatus,
    logo_url: "",
    cover_photo_url: "",
    latitude: null as number | null,
    longitude: null as number | null,
    social_instagram: "",
    social_facebook: "",
    social_tiktok: "",
    social_x: "",
    social_snapchat: "",
  });
  const [pendingAction, setPendingAction] = useState<{ id: string; status: ApprovalStatus; action?: "suspend" | "reactivate" } | null>(null);
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("provider_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (statusFilter !== "all") {
      query = query.eq("approval_status", statusFilter);
    }

    const { data, error, count } = await query;

    if (!error && data) {
      setTotalCount(count || 0);
      let filtered = data;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = data.filter(
          (p) =>
            p.business_name?.toLowerCase().includes(s) ||
            p.category?.toLowerCase().includes(s)
        );
      }
      setProviders(filtered);
    }
    setLoading(false);
  }, [statusFilter, debouncedSearch, offset, pageSize]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const updateStatus = async (
    id: string,
    status: ApprovalStatus,
    action?: "suspend" | "reactivate"
  ) => {
    const { error } = await supabase
      .from("provider_profiles")
      .update({ approval_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, approval_status: status } : p
        )
      );
      setSelectedProvider((prev) =>
        prev && prev.id === id ? { ...prev, approval_status: status } : prev
      );

      if (action === "suspend") {
        toast.success(t("admin.suspended"));
      } else if (action === "reactivate") {
        toast.success(t("admin.reactivated"));
      } else {
        toast.success(
          status === "approved"
            ? t("admin.approved")
            : status === "rejected"
            ? t("admin.rejected")
            : t("admin.update")
        );
      }
      fetchProviders();
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;

    const { error } = await supabase
      .from("provider_profiles")
      .delete()
      .eq("id", selectedProvider.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.delete"));
      setDeleteDialogOpen(false);
      setSelectedProvider(null);
      fetchProviders();
    }
  };

  const openEditDialog = (provider: ProviderProfile) => {
    setSelectedProvider(provider);
    const sl = provider.social_links || {};
    setEditFormData({
      business_name: provider.business_name,
      category: provider.category,
      description: provider.description || "",
      phone: provider.phone || "",
      website: provider.website || "",
      approval_status: provider.approval_status,
      logo_url: provider.logo_url || "",
      cover_photo_url: provider.cover_photo_url || "",
      latitude: provider.latitude,
      longitude: provider.longitude,
      social_instagram: sl.instagram || "",
      social_facebook: sl.facebook || "",
      social_tiktok: sl.tiktok || "",
      social_x: sl.x || "",
      social_snapchat: sl.snapchat || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedProvider) return;

    const result = providerEditSchema.safeParse(editFormData);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    const social_links: Record<string, string> = {};
    if (result.data.social_instagram) social_links.instagram = result.data.social_instagram;
    if (result.data.social_facebook) social_links.facebook = result.data.social_facebook;
    if (result.data.social_tiktok) social_links.tiktok = result.data.social_tiktok;
    if (result.data.social_x) social_links.x = result.data.social_x;
    if (result.data.social_snapchat) social_links.snapchat = result.data.social_snapchat;

    const { error } = await supabase
      .from("provider_profiles")
      .update({
        business_name: result.data.business_name,
        category: result.data.category,
        description: result.data.description || null,
        phone: result.data.phone || null,
        website: result.data.website || null,
        approval_status: result.data.approval_status,
        logo_url: result.data.logo_url || null,
        cover_photo_url: result.data.cover_photo_url || null,
        latitude: result.data.latitude ?? null,
        longitude: result.data.longitude ?? null,
        social_links: Object.keys(social_links).length > 0 ? social_links : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedProvider.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.providerUpdated") || "Provider updated successfully");
      setEditDialogOpen(false);
      setSelectedProvider(null);
      fetchProviders();
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    const styles: Record<ApprovalStatus, string> = {
      approved: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none",
      pending: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none",
      rejected: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none",
    };
    const labels: Record<ApprovalStatus, string> = {
      approved: t("admin.approved"),
      pending: t("admin.pending"),
      rejected: t("admin.suspended"),
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.providers")} />

        <Card className="animate-fade-in stagger-1">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
                <Input
                  placeholder={t("admin.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("admin.filter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  <SelectItem value="pending">{t("admin.pending")}</SelectItem>
                  <SelectItem value="approved">{t("admin.approved")}</SelectItem>
                  <SelectItem value="rejected">{t("admin.suspended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={7} />
              ) : providers.length === 0 ? (
                <EmptyState
                  icon={Store}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.businessName")}</TableHead>
                      <TableHead>{t("admin.category")}</TableHead>
                      <TableHead>{t("admin.phone")}</TableHead>
                      <TableHead>{t("admin.rating")}</TableHead>
                      <TableHead>{t("admin.approvalStatus")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider) => (
                      <TableRow
                        key={provider.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {provider.business_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {provider.category}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground">
                          {provider.phone || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {provider.average_rating?.toFixed(1) || "—"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(provider.approval_status)}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(provider.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedProvider(provider);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(provider)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {provider.approval_status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  onClick={() =>
                                    updateStatus(provider.id, "approved")
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive"
                                  onClick={() =>
                                    updateStatus(provider.id, "rejected")
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {provider.approval_status === "approved" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                                onClick={() => {
                                  setSelectedProvider(provider);
                                  setPendingAction({ id: provider.id, status: "rejected", action: "suspend" });
                                  setSuspendDialogOpen(true);
                                }}
                                title={t("admin.suspend")}
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {provider.approval_status === "rejected" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => {
                                  setSelectedProvider(provider);
                                  setPendingAction({ id: provider.id, status: "approved", action: "reactivate" });
                                  setSuspendDialogOpen(true);
                                }}
                                title={t("admin.reactivate")}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedProvider(provider);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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

        {totalCount > pageSize && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-xs text-muted-foreground">
              {t("admin.showing")} {offset + 1}-{Math.min(offset + pageSize, totalCount)} {t("admin.of")} {totalCount}
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

        {/* View Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("admin.providerDetails")}</DialogTitle>
            </DialogHeader>
            {selectedProvider && (
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pe-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.businessName")}
                    </span>
                    <p className="text-sm font-medium">
                      {selectedProvider.business_name}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.category")}
                    </span>
                    <p className="text-sm">{selectedProvider.category}</p>
                  </div>
                  <div className="space-y-0.5 col-span-2">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.description")}
                    </span>
                    <p className="text-sm">{selectedProvider.description || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.phone")}
                    </span>
                    <p className="text-sm" dir="ltr">{selectedProvider.phone || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.website")}
                    </span>
                    <p className="text-sm" dir="ltr">{selectedProvider.website || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.rating")}
                    </span>
                    <p className="text-sm">
                      {selectedProvider.average_rating?.toFixed(1)} (
                      {selectedProvider.total_reviews} {t("admin.totalReviews")})
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.approvalStatus")}
                    </span>
                    <div>{getStatusBadge(selectedProvider.approval_status)}</div>
                  </div>
                </div>

                {(selectedProvider.logo_url || selectedProvider.cover_photo_url) && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("admin.logo")} / {t("admin.coverPhoto")}</p>
                    <div className="flex gap-3">
                      {selectedProvider.logo_url && (
                        <div className="space-y-1">
                          <img src={selectedProvider.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                          <p className="text-[10px] text-muted-foreground text-center">{t("admin.logo")}</p>
                        </div>
                      )}
                      {selectedProvider.cover_photo_url && (
                        <div className="space-y-1 flex-1">
                          <img src={selectedProvider.cover_photo_url} alt="Cover" className="h-16 w-full rounded-lg object-cover border" />
                          <p className="text-[10px] text-muted-foreground text-center">{t("admin.coverPhoto")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedProvider.social_links && Object.values(selectedProvider.social_links).some(Boolean) && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("admin.socialLinks")}</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedProvider.social_links.instagram && (
                        <a href={selectedProvider.social_links.instagram} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">Instagram</Badge>
                        </a>
                      )}
                      {selectedProvider.social_links.facebook && (
                        <a href={selectedProvider.social_links.facebook} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">Facebook</Badge>
                        </a>
                      )}
                      {selectedProvider.social_links.tiktok && (
                        <a href={selectedProvider.social_links.tiktok} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">TikTok</Badge>
                        </a>
                      )}
                      {selectedProvider.social_links.x && (
                        <a href={selectedProvider.social_links.x} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">X</Badge>
                        </a>
                      )}
                      {selectedProvider.social_links.snapchat && (
                        <a href={selectedProvider.social_links.snapchat} target="_blank" rel="noopener noreferrer">
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">Snapchat</Badge>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedProvider.business_hours && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("admin.businessHours")}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((day) => {
                        const raw = selectedProvider.business_hours?.[day];
                        const dayLabel = t(`admin.day${day.charAt(0).toUpperCase() + day.slice(1)}`);
                        let display = "—";
                        if (raw === "closed") {
                          display = t("admin.closed");
                        } else if (typeof raw === "string" && raw.includes("-")) {
                          const [o, c] = raw.split("-");
                          const to12h = (t: string) => {
                            const [h, m] = t.split(":").map(Number);
                            const period = h >= 12 ? "PM" : "AM";
                            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                            return `${h12}:${String(m).padStart(2, "0")} ${period}`;
                          };
                          display = `${to12h(o)} - ${to12h(c)}`;
                        }
                        return (
                          <div key={day} className="flex justify-between">
                            <span className="text-muted-foreground">{dayLabel}</span>
                            <span className="font-medium">{display}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedProvider.latitude != null && selectedProvider.longitude != null && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("admin.location")}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm" dir="ltr">{selectedProvider.latitude}, {selectedProvider.longitude}</p>
                      <a
                        href={`https://maps.google.com/?q=${selectedProvider.latitude},${selectedProvider.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        {t("admin.viewOnMap")}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              {selectedProvider?.approval_status === "pending" && (
                <>
                  <Button
                    onClick={() => {
                      updateStatus(selectedProvider.id, "approved");
                      setDialogOpen(false);
                    }}
                  >
                    {t("admin.approve")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      updateStatus(selectedProvider.id, "rejected");
                      setDialogOpen(false);
                    }}
                  >
                    {t("admin.reject")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.delete") || "Delete Provider"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("admin.deleteConfirm") || "Are you sure you want to delete this provider?"}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("admin.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Dialog */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingAction?.status === "rejected"
                  ? t("admin.suspendProvider")
                  : t("admin.reactivateProvider")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {pendingAction?.status === "rejected"
                ? t("admin.suspendConfirm")
                : t("admin.reactivateConfirm")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSuspendDialogOpen(false); setPendingAction(null); }}>
                {t("admin.cancel")}
              </Button>
              <Button
                variant={pendingAction?.status === "rejected" ? "destructive" : "default"}
                onClick={() => {
                  if (pendingAction) {
                    updateStatus(pendingAction.id, pendingAction.status, pendingAction.action);
                  }
                  setSuspendDialogOpen(false);
                  setPendingAction(null);
                }}
              >
                {pendingAction?.status === "rejected"
                  ? t("admin.suspend")
                  : t("admin.reactivate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t("admin.editProvider") || "Edit Provider"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pe-2">
              {/* Basic Info */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("admin.basicInfo") || "Basic Info"}</p>
                <div className="space-y-1.5">
                  <Label>{t("admin.businessName")}</Label>
                  <Input
                    value={editFormData.business_name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, business_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.category")}</Label>
                  <Input
                    value={editFormData.category}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.description")}</Label>
                  <Textarea
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.phone")}</Label>
                    <Input
                      value={editFormData.phone}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, phone: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.website")}</Label>
                    <Input
                      value={editFormData.website}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, website: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.approvalStatus")}</Label>
                  <Select
                    value={editFormData.approval_status}
                    onValueChange={(v) =>
                      v && setEditFormData({ ...editFormData, approval_status: v as ApprovalStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t("admin.pending")}</SelectItem>
                      <SelectItem value="approved">{t("admin.approved")}</SelectItem>
                      <SelectItem value="rejected">{t("admin.suspended")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Images */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("admin.images") || "Images"}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.logo")} URL</Label>
                    <Input
                      value={editFormData.logo_url}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, logo_url: e.target.value })
                      }
                      dir="ltr"
                      placeholder="https://..."
                    />
                    {editFormData.logo_url && (
                      <img src={editFormData.logo_url} alt="Logo preview" className="h-16 w-16 rounded-lg object-cover border mt-1" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.coverPhoto")} URL</Label>
                    <Input
                      value={editFormData.cover_photo_url}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, cover_photo_url: e.target.value })
                      }
                      dir="ltr"
                      placeholder="https://..."
                    />
                    {editFormData.cover_photo_url && (
                      <img src={editFormData.cover_photo_url} alt="Cover preview" className="h-16 w-full rounded-lg object-cover border mt-1" />
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("admin.location")}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.latitude")}</Label>
                    <Input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={editFormData.latitude ?? ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, latitude: e.target.value ? parseFloat(e.target.value) : null })
                      }
                      dir="ltr"
                      placeholder="e.g. 24.7136"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.longitude")}</Label>
                    <Input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={editFormData.longitude ?? ""}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, longitude: e.target.value ? parseFloat(e.target.value) : null })
                      }
                      dir="ltr"
                      placeholder="e.g. 46.6753"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("admin.socialLinks")}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Instagram</Label>
                    <Input
                      value={editFormData.social_instagram}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, social_instagram: e.target.value })
                      }
                      dir="ltr"
                      placeholder="@handle or URL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Facebook</Label>
                    <Input
                      value={editFormData.social_facebook}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, social_facebook: e.target.value })
                      }
                      dir="ltr"
                      placeholder="@handle or URL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>TikTok</Label>
                    <Input
                      value={editFormData.social_tiktok}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, social_tiktok: e.target.value })
                      }
                      dir="ltr"
                      placeholder="@handle or URL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>X (Twitter)</Label>
                    <Input
                      value={editFormData.social_x}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, social_x: e.target.value })
                      }
                      dir="ltr"
                      placeholder="@handle or URL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Snapchat</Label>
                    <Input
                      value={editFormData.social_snapchat}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, social_snapchat: e.target.value })
                      }
                      dir="ltr"
                      placeholder="@handle or URL"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleEditSave}>
                {t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
