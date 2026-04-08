"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { CustomerProfile } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { customerEditSchema } from "@/lib/validations";
import { Eye, Search, Trash2, Pause, Play, Pencil } from "lucide-react";
import { toast } from "sonner";

interface CustomerWithStats extends CustomerProfile {
  redemption_count?: number;
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerWithStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    display_name: "",
    preferences: "",
    is_banned: false,
  });
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error, count } = await supabase
      .from("customer_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (!error && data) {
      setTotalCount(count || 0);
      const customerIds = data.map((c) => c.id);

      const redemptionCounts: Record<string, number> = {};
      if (customerIds.length > 0) {
        const { data: redemptions } = await supabase
          .from("redemptions")
          .select("customer_id")
          .in("customer_id", customerIds);

        redemptions?.forEach((r) => {
          redemptionCounts[r.customer_id] =
            (redemptionCounts[r.customer_id] || 0) + 1;
        });
      }

      const withStats = data.map((customer) => ({
        ...customer,
        redemption_count: redemptionCounts[customer.id] || 0,
      }));

      let filtered = withStats;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = withStats.filter((c) =>
          c.display_name?.toLowerCase().includes(s)
        );
      }
      setCustomers(filtered);
    }
    setLoading(false);
  }, [debouncedSearch, offset, pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleDelete = async () => {
    if (!selectedCustomer) return;

    const { error } = await supabase
      .from("customer_profiles")
      .delete()
      .eq("id", selectedCustomer.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.delete"));
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    }
  };

  const handleToggleBan = async (customer: CustomerWithStats) => {
    const newBanStatus = !customer.is_banned;

    // Optimistic UI update - immediately reflect the change
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id ? { ...c, is_banned: newBanStatus } : c
      )
    );
    setSelectedCustomer((prev) =>
      prev && prev.id === customer.id ? { ...prev, is_banned: newBanStatus } : prev
    );

    const { error } = await supabase
      .from("customer_profiles")
      .update({ is_banned: newBanStatus, updated_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (error) {
      toast.error(error.message);
      // Revert on error
      fetchCustomers();
    } else {
      toast.success(
        newBanStatus
          ? t("admin.suspended") || "Suspended"
          : t("admin.reactivated") || "Reactivated"
      );
      fetchCustomers();
    }
  };

  const openEditDialog = (customer: CustomerWithStats) => {
    setSelectedCustomer(customer);
    setEditFormData({
      display_name: customer.display_name || "",
      preferences: customer.preferences?.join(", ") || "",
      is_banned: customer.is_banned,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedCustomer) return;

    const result = customerEditSchema.safeParse(editFormData);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    const preferences = result.data.preferences
      ? result.data.preferences.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    const { error } = await supabase
      .from("customer_profiles")
      .update({
        display_name: result.data.display_name || null,
        preferences,
        is_banned: result.data.is_banned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedCustomer.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.customerUpdated") || "Customer updated successfully");
      setEditDialogOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    }
  };

  return (
    <AdminPageWrapper>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">{t("admin.customers")}</h2>

          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                  placeholder={t("admin.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ltr:pl-9 rtl:pr-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead>{t("admin.displayName")}</TableHead>
                       <TableHead>{t("admin.redemptions")}</TableHead>
                       <TableHead>{t("admin.status")}</TableHead>
                       <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead>{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          {t("admin.loading")}
                        </TableCell>
                      </TableRow>
                    ) : customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          {t("admin.noResults")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.display_name || "—"}
                          </TableCell>
                          <TableCell>{customer.redemption_count}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                customer.is_banned
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              }`}
                            >
                              {customer.is_banned
                                ? t("admin.suspended")
                                : t("admin.active")}
                            </span>
                          </TableCell>
                          <TableCell dir="ltr">
                            {new Date(customer.created_at).toLocaleDateString()}
                          </TableCell>
                           <TableCell>
                            <div className="flex gap-1">
                               <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(customer)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={customer.is_banned ? "text-green-600" : "text-orange-500"}
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setSuspendDialogOpen(true);
                                }}
                                title={customer.is_banned ? t("admin.reactivate") : t("admin.suspend")}
                              >
                                {customer.is_banned ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedCustomer(customer);
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.customerDetails")}</DialogTitle>
              </DialogHeader>
              {selectedCustomer && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.displayName")}:
                    </span>
                    <p className="font-medium">
                      {selectedCustomer.display_name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.redemptions")}:
                    </span>
                    <p>{selectedCustomer.redemption_count}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.createdAt")}:
                    </span>
                    <p dir="ltr">
                      {new Date(selectedCustomer.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("admin.cancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.delete") || "Delete Customer"}</DialogTitle>
              </DialogHeader>
              <p>{t("admin.deleteConfirm") || "Are you sure you want to delete this customer?"}</p>
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
                  {selectedCustomer?.is_banned
                    ? t("admin.reactivateCustomer")
                    : t("admin.suspendCustomer")}
                </DialogTitle>
              </DialogHeader>
              <p>
                {selectedCustomer?.is_banned
                  ? t("admin.reactivateConfirm")
                  : t("admin.suspendConfirm")}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                  {t("admin.cancel")}
                </Button>
                <Button
                  variant={selectedCustomer?.is_banned ? "default" : "destructive"}
                  onClick={() => {
                    if (selectedCustomer) {
                      handleToggleBan(selectedCustomer);
                    }
                    setSuspendDialogOpen(false);
                  }}
                >
                  {selectedCustomer?.is_banned
                    ? t("admin.reactivate")
                    : t("admin.suspend")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.editCustomer") || "Edit Customer"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("admin.displayName")}</Label>
                  <Input
                    value={editFormData.display_name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, display_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.preferences")}</Label>
                  <Input
                    value={editFormData.preferences}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, preferences: e.target.value })
                    }
                    placeholder="e.g., food, shopping, travel"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editFormData.is_banned}
                    onCheckedChange={(checked) =>
                      setEditFormData({ ...editFormData, is_banned: checked })
                    }
                  />
                  <Label>{t("admin.suspended")}</Label>
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
