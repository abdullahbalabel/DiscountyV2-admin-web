"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Category } from "@/lib/types";
import { categorySchema } from "@/lib/validations";
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
import { Icon } from "@iconify-icon/react";
import { IconPicker } from "@/components/ui/icon-picker";
import { Pencil, Plus, Search, Eye, EyeOff, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    icon: "",
    sort_order: 0,
    is_active: true,
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    const { data, error } = await query;

    if (!error && data) {
      let filtered = data;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = data.filter(
          (c) =>
            c.name?.toLowerCase().includes(s) ||
            c.name_ar?.toLowerCase().includes(s)
        );
      }
      setCategories(filtered);
    }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({ name: "", name_ar: "", icon: "", sort_order: 0, is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      name_ar: category.name_ar,
      icon: category.icon || "",
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const result = categorySchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({
          name: result.data.name,
          name_ar: result.data.name_ar,
          icon: result.data.icon || null,
          sort_order: result.data.sort_order,
          is_active: result.data.is_active,
        })
        .eq("id", editingCategory.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.update"));
        setDialogOpen(false);
        fetchCategories();
      }
    } else {
      const { error } = await supabase.from("categories").insert({
        name: result.data.name,
        name_ar: result.data.name_ar,
        icon: result.data.icon || null,
        sort_order: result.data.sort_order,
        is_active: result.data.is_active,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.create"));
        setDialogOpen(false);
        fetchCategories();
      }
    }
  };

  const handleToggleVisibility = async (category: Category) => {
    const newStatus = !category.is_active;
    const { error } = await supabase
      .from("categories")
      .update({ is_active: newStatus })
      .eq("id", category.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        newStatus
          ? t("admin.shown") || "Category shown"
          : t("admin.hidden") || "Category hidden"
      );
      fetchCategories();
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader
          title={t("admin.categories")}
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 me-1.5" />
              {t("admin.addCategory")}
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
                <TableSkeleton columns={6} />
              ) : categories.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.categoryName")}</TableHead>
                      <TableHead>{t("admin.categoryNameAr")}</TableHead>
                      <TableHead>{t("admin.icon")}</TableHead>
                      <TableHead>{t("admin.sortOrder")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow
                        key={category.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {category.name_ar}
                        </TableCell>
                        <TableCell>
                          {category.icon ? (
                            <Icon icon={`material-symbols:${category.icon}`} width={22} height={22} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {category.sort_order}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              category.is_active
                                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                : "bg-muted text-muted-foreground border-none"
                            }
                          >
                            {category.is_active
                              ? t("admin.active")
                              : t("admin.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={
                                category.is_active
                                  ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              }
                              onClick={() => handleToggleVisibility(category)}
                              title={category.is_active ? (t("admin.hide") || "Hide") : (t("admin.show") || "Show")}
                            >
                              {category.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
                {editingCategory
                  ? t("admin.editCategory")
                  : t("admin.addCategory")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.categoryName")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.categoryNameAr")}</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) =>
                    setFormData({ ...formData, name_ar: e.target.value })
                  }
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.icon")}</Label>
                <IconPicker
                  value={formData.icon}
                  onChange={(icon) => setFormData({ ...formData, icon })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.sortOrder")}</Label>
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
                <Label>{t("admin.active")}</Label>
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
