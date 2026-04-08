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
import { Check, X, Eye, Search, Trash2, Pause, Play, Pencil } from "lucide-react";
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
      // Optimistic UI update - immediately reflect the change
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
    setEditFormData({
      business_name: provider.business_name,
      category: provider.category,
      description: provider.description || "",
      phone: provider.phone || "",
      website: provider.website || "",
      approval_status: provider.approval_status,
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

    const { error } = await supabase
      .from("provider_profiles")
      .update({
        business_name: result.data.business_name,
        category: result.data.category,
        description: result.data.description || null,
        phone: result.data.phone || null,
        website: result.data.website || null,
        approval_status: result.data.approval_status,
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
    const variants: Record<ApprovalStatus, "default" | "secondary" | "destructive"> = {
      approved: "default",
      pending: "secondary",
      rejected: "destructive",
    };
    const labels: Record<ApprovalStatus, string> = {
      approved: t("admin.approved"),
      pending: t("admin.pending"),
      rejected: t("admin.suspended"),
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <AdminPageWrapper>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t("admin.providers")}</h2>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
                  <Input
                    placeholder={t("admin.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ltr:pl-9 rtl:pr-9"
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.businessName")}</TableHead>
                      <TableHead>{t("admin.category")}</TableHead>
                      <TableHead>{t("admin.phone")}</TableHead>
                      <TableHead>{t("admin.rating")}</TableHead>
                      <TableHead>{t("admin.approvalStatus")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead>{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          {t("admin.loading")}
                        </TableCell>
                      </TableRow>
                    ) : providers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          {t("admin.noResults")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      providers.map((provider) => (
                        <TableRow key={provider.id}>
                          <TableCell className="font-medium">
                            {provider.business_name}
                          </TableCell>
                          <TableCell>{provider.category}</TableCell>
                          <TableCell dir="ltr">{provider.phone || "—"}</TableCell>
                          <TableCell>
                            {provider.average_rating?.toFixed(1) || "—"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(provider.approval_status)}
                          </TableCell>
                          <TableCell dir="ltr">
                            {new Date(provider.created_at).toLocaleDateString()}
                          </TableCell>
                           <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedProvider(provider);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(provider)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {provider.approval_status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600"
                                    onClick={() =>
                                      updateStatus(provider.id, "approved")
                                    }
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() =>
                                      updateStatus(provider.id, "rejected")
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {provider.approval_status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-orange-500"
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setPendingAction({ id: provider.id, status: "rejected", action: "suspend" });
                                    setSuspendDialogOpen(true);
                                  }}
                                  title={t("admin.suspend")}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {provider.approval_status === "rejected" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600"
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setPendingAction({ id: provider.id, status: "approved", action: "reactivate" });
                                    setSuspendDialogOpen(true);
                                  }}
                                  title={t("admin.reactivate")}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedProvider(provider);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {totalCount > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("admin.providerDetails")}</DialogTitle>
              </DialogHeader>
              {selectedProvider && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.businessName")}:
                    </span>
                    <p className="font-medium">
                      {selectedProvider.business_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.category")}:
                    </span>
                    <p>{selectedProvider.category}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.description")}:
                    </span>
                    <p>{selectedProvider.description || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.phone")}:
                    </span>
                    <p dir="ltr">{selectedProvider.phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.website")}:
                    </span>
                    <p dir="ltr">{selectedProvider.website || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.rating")}:
                    </span>
                    <p>
                      {selectedProvider.average_rating?.toFixed(1)} (
                      {selectedProvider.total_reviews} {t("admin.totalReviews")})
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.approvalStatus")}:
                    </span>
                    <div>{getStatusBadge(selectedProvider.approval_status)}</div>
                  </div>
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

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.delete") || "Delete Provider"}</DialogTitle>
              </DialogHeader>
              <p>{t("admin.deleteConfirm") || "Are you sure you want to delete this provider?"}</p>
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

          <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {pendingAction?.status === "rejected"
                    ? t("admin.suspendProvider")
                    : t("admin.reactivateProvider")}
                </DialogTitle>
              </DialogHeader>
              <p>
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

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("admin.editProvider") || "Edit Provider"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("admin.businessName")}</Label>
                  <Input
                    value={editFormData.business_name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, business_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.category")}</Label>
                  <Input
                    value={editFormData.category}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.description")}</Label>
                  <Input
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.phone")}</Label>
                  <Input
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, phone: e.target.value })
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.website")}</Label>
                  <Input
                    value={editFormData.website}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, website: e.target.value })
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
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
