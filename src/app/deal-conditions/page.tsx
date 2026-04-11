"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { DealCondition } from "@/lib/types";
import { dealConditionSchema } from "@/lib/validations";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Icon } from "@iconify-icon/react";
import { IconPicker } from "@/components/ui/icon-picker";
import { Pencil, Plus, Search, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function DealConditionsPage() {
  const { t } = useTranslation();
  const [conditions, setConditions] = useState<DealCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<DealCondition | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    icon: "",
    category: "other" as DealCondition["category"],
    sort_order: 0,
    is_active: true,
  });

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deal_conditions")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) {
      let filtered = data as DealCondition[];
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name?.toLowerCase().includes(s) ||
            c.name_ar?.toLowerCase().includes(s)
        );
      }
      setConditions(filtered);
    }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  const openCreateDialog = () => {
    setEditingCondition(null);
    setFormData({ name: "", name_ar: "", icon: "", category: "other", sort_order: 0, is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (condition: DealCondition) => {
    setEditingCondition(condition);
    setFormData({
      name: condition.name,
      name_ar: condition.name_ar,
      icon: condition.icon || "",
      category: condition.category,
      sort_order: condition.sort_order,
      is_active: condition.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const result = dealConditionSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    if (editingCondition) {
      const { error } = await supabase
        .from("deal_conditions")
        .update({
          name: result.data.name,
          name_ar: result.data.name_ar,
          icon: result.data.icon,
          category: result.data.category,
          sort_order: result.data.sort_order,
          is_active: result.data.is_active,
        })
        .eq("id", editingCondition.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.dealConditions.updated"));
        setDialogOpen(false);
        fetchConditions();
      }
    } else {
      const { error } = await supabase.from("deal_conditions").insert({
        name: result.data.name,
        name_ar: result.data.name_ar,
        icon: result.data.icon,
        category: result.data.category,
        sort_order: result.data.sort_order,
        is_active: result.data.is_active,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.dealConditions.created"));
        setDialogOpen(false);
        fetchConditions();
      }
    }
  };

  const handleDelete = async (condition: DealCondition) => {
    const { error } = await supabase
      .from("deal_conditions")
      .delete()
      .eq("id", condition.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.dealConditions.deleted"));
      fetchConditions();
    }
  };

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      time: t("admin.dealConditions.categoryTime"),
      quantity: t("admin.dealConditions.categoryQuantity"),
      scope: t("admin.dealConditions.categoryScope"),
      payment: t("admin.dealConditions.categoryPayment"),
      other: t("admin.dealConditions.categoryOther"),
    };
    return map[cat] || cat;
  };

  const categoryBadgeClass = (cat: string) => {
    const map: Record<string, string> = {
      time: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-none",
      quantity: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 border-none",
      scope: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none",
      payment: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none",
      other: "bg-muted text-muted-foreground border-none",
    };
    return map[cat] || map.other;
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader
          title={t("admin.dealConditions.title")}
          description={t("admin.dealConditions.subtitle")}
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 me-1.5" />
              {t("admin.dealConditions.addCondition")}
            </Button>
          }
        />

        <Card className="animate-fade-in stagger-1">
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
              <Input
                placeholder={t("admin.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={7} />
              ) : conditions.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title={t("admin.dealConditions.noConditions")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.dealConditions.name")}</TableHead>
                      <TableHead>{t("admin.dealConditions.nameAr")}</TableHead>
                      <TableHead>{t("admin.dealConditions.icon")}</TableHead>
                      <TableHead>{t("admin.dealConditions.category")}</TableHead>
                      <TableHead>{t("admin.dealConditions.sortOrder")}</TableHead>
                      <TableHead>{t("admin.dealConditions.active")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditions.map((condition) => (
                      <TableRow
                        key={condition.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {condition.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {condition.name_ar}
                        </TableCell>
                        <TableCell>
                          {condition.icon ? (
                            <Icon icon={`material-symbols:${condition.icon}`} width={22} height={22} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={categoryBadgeClass(condition.category)}>
                            {categoryLabel(condition.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {condition.sort_order}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              condition.is_active
                                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                : "bg-muted text-muted-foreground border-none"
                            }
                          >
                            {condition.is_active
                              ? t("admin.active")
                              : t("admin.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(condition)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(condition)}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCondition
                  ? t("admin.dealConditions.editCondition")
                  : t("admin.dealConditions.addCondition")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.dealConditions.name")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.dealConditions.nameAr")}</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) =>
                    setFormData({ ...formData, name_ar: e.target.value })
                  }
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.dealConditions.icon")}</Label>
                <IconPicker
                  value={formData.icon}
                  onChange={(icon) => setFormData({ ...formData, icon })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.dealConditions.category")}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as DealCondition["category"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">{t("admin.dealConditions.categoryTime")}</SelectItem>
                    <SelectItem value="quantity">{t("admin.dealConditions.categoryQuantity")}</SelectItem>
                    <SelectItem value="scope">{t("admin.dealConditions.categoryScope")}</SelectItem>
                    <SelectItem value="payment">{t("admin.dealConditions.categoryPayment")}</SelectItem>
                    <SelectItem value="other">{t("admin.dealConditions.categoryOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.dealConditions.sortOrder")}</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>{t("admin.dealConditions.active")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleSave}>
                {t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
