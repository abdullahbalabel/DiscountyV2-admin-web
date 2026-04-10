"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Discount, DealStatus } from "@/lib/types";
import { dealSchema } from "@/lib/validations";
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
import { Eye, Search, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function DealsPage() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDeal, setSelectedDeal] = useState<Discount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "active" as DealStatus,
  });
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("discounts")
      .select(
        "*, provider:provider_profiles(business_name), category:categories(name, name_ar)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error, count } = await query;

    if (!error && data) {
      setTotalCount(count || 0);
      let filtered = data as unknown as Discount[];
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.title?.toLowerCase().includes(s) ||
            d.provider?.business_name?.toLowerCase().includes(s) ||
            d.alphanumeric_code?.toLowerCase().includes(s)
        );
      }
      setDeals(filtered);
    }
    setLoading(false);
  }, [statusFilter, debouncedSearch, offset, pageSize]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const getStatusBadge = (status: DealStatus) => {
    const styles: Record<DealStatus, string> = {
      active: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none",
      draft: "bg-muted text-muted-foreground border-none",
      paused: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none",
      deleted: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none",
    };
    return <Badge className={styles[status]}>{t(`admin.${status}`)}</Badge>;
  };

  const openEditDialog = (deal: Discount) => {
    setSelectedDeal(deal);
    setEditForm({
      title: deal.title,
      description: deal.description || "",
      status: deal.status,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDeal) return;

    const result = dealSchema.safeParse(editForm);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    const { error } = await supabase
      .from("discounts")
      .update({
        title: result.data.title,
        description: result.data.description || null,
        status: result.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedDeal.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.update"));
      setEditDialogOpen(false);
      fetchDeals();
    }
  };

  const handleDelete = async () => {
    if (!selectedDeal) return;

    const { error } = await supabase
      .from("discounts")
      .delete()
      .eq("id", selectedDeal.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.delete"));
      setDeleteDialogOpen(false);
      setSelectedDeal(null);
      fetchDeals();
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.deals")} />

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
                  <SelectItem value="active">{t("admin.active")}</SelectItem>
                  <SelectItem value="draft">{t("admin.draft")}</SelectItem>
                  <SelectItem value="paused">{t("admin.paused")}</SelectItem>
                  <SelectItem value="deleted">{t("admin.deleted")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={8} />
              ) : deals.length === 0 ? (
                <EmptyState
                  icon={Tag}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.titleLabel")}</TableHead>
                      <TableHead>{t("admin.provider")}</TableHead>
                      <TableHead>{t("admin.discountValue")}</TableHead>
                      <TableHead>{t("admin.currentRedemptions")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead>{t("admin.code")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => (
                      <TableRow
                        key={deal.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {deal.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {deal.provider?.business_name || "—"}
                        </TableCell>
                        <TableCell>
                          {deal.type === "percentage"
                            ? `${deal.discount_value}%`
                            : `${deal.discount_value}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {deal.current_redemptions}/{deal.max_redemptions}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(deal.status)}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs font-mono">
                          {deal.alphanumeric_code}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(deal.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedDeal(deal);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(deal)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedDeal(deal);
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("admin.dealDetails")}</DialogTitle>
            </DialogHeader>
            {selectedDeal && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5 col-span-2">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.titleLabel")}
                  </span>
                  <p className="text-sm font-medium">{selectedDeal.title}</p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.description")}
                  </span>
                  <p className="text-sm">{selectedDeal.description || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.provider")}
                  </span>
                  <p className="text-sm">{selectedDeal.provider?.business_name || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.discountValue")}
                  </span>
                  <p className="text-sm">
                    {selectedDeal.type === "percentage"
                      ? `${selectedDeal.discount_value}%`
                      : `${selectedDeal.discount_value}`}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.currentRedemptions")}/{t("admin.maxRedemptions")}
                  </span>
                  <p className="text-sm">
                    {selectedDeal.current_redemptions}/{selectedDeal.max_redemptions}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.status")}
                  </span>
                  <div>{getStatusBadge(selectedDeal.status)}</div>
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

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.edit") || "Edit Deal"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.titleLabel")}</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.description")}</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.status")}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, status: v as DealStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("admin.active")}</SelectItem>
                    <SelectItem value="draft">{t("admin.draft")}</SelectItem>
                    <SelectItem value="paused">{t("admin.paused")}</SelectItem>
                    <SelectItem value="deleted">{t("admin.deleted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleSave}>{t("admin.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.delete") || "Delete Deal"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("admin.deleteConfirm") || "Are you sure you want to delete this deal?"}
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
      </div>
    </AdminPageWrapper>
  );
}
