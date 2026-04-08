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
import { Eye, Search, Pencil, Trash2 } from "lucide-react";
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
    const variants: Record<
      DealStatus,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      active: "default",
      draft: "secondary",
      paused: "outline",
      deleted: "destructive",
    };
    return <Badge variant={variants[status]}>{t(`admin.${status}`)}</Badge>;
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

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">{t("admin.deals")}</h2>

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
                    <SelectItem value="active">{t("admin.active")}</SelectItem>
                    <SelectItem value="draft">{t("admin.draft")}</SelectItem>
                    <SelectItem value="paused">{t("admin.paused")}</SelectItem>
                    <SelectItem value="deleted">{t("admin.deleted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                      <TableHead>{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">
                          {t("admin.loading")}
                        </TableCell>
                      </TableRow>
                    ) : deals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">
                          {t("admin.noResults")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      deals.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {deal.title}
                          </TableCell>
                          <TableCell>
                            {deal.provider?.business_name || "—"}
                          </TableCell>
                          <TableCell>
                            {deal.type === "percentage"
                              ? `${deal.discount_value}%`
                              : `${deal.discount_value}`}
                          </TableCell>
                          <TableCell>
                            {deal.current_redemptions}/{deal.max_redemptions}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(deal.status)}
                          </TableCell>
                          <TableCell dir="ltr">
                            {deal.alphanumeric_code}
                          </TableCell>
                          <TableCell dir="ltr">
                            {new Date(deal.created_at).toLocaleDateString()}
                          </TableCell>
                           <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedDeal(deal);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(deal)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedDeal(deal);
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
                <DialogTitle>{t("admin.dealDetails")}</DialogTitle>
              </DialogHeader>
              {selectedDeal && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.titleLabel")}:
                    </span>
                    <p className="font-medium">{selectedDeal.title}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.description")}:
                    </span>
                    <p>{selectedDeal.description || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.provider")}:
                    </span>
                    <p>{selectedDeal.provider?.business_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.discountValue")}:
                    </span>
                    <p>
                      {selectedDeal.type === "percentage"
                        ? `${selectedDeal.discount_value}%`
                        : `${selectedDeal.discount_value}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.currentRedemptions")}/
                      {t("admin.maxRedemptions")}:
                    </span>
                    <p>
                      {selectedDeal.current_redemptions}/
                      {selectedDeal.max_redemptions}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.viewCount")}:
                    </span>
                    <p>{selectedDeal.view_count}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.status")}:
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

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.edit") || "Edit Deal"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("admin.titleLabel")}</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.description")}</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
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

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.delete") || "Delete Deal"}</DialogTitle>
              </DialogHeader>
              <p>{t("admin.deleteConfirm") || "Are you sure you want to delete this deal?"}</p>
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
