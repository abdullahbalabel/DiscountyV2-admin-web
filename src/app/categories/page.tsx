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
import { Pencil, Plus, Search, Eye, EyeOff } from "lucide-react";
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

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t("admin.categories")}</h2>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.addCategory")}
            </Button>
          </div>

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
                      <TableHead>{t("admin.categoryName")}</TableHead>
                      <TableHead>{t("admin.categoryNameAr")}</TableHead>
                      <TableHead>{t("admin.icon")}</TableHead>
                      <TableHead>{t("admin.sortOrder")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead>{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          {t("admin.loading")}
                        </TableCell>
                      </TableRow>
                    ) : categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          {t("admin.noResults")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">
                            {category.name}
                          </TableCell>
                          <TableCell>{category.name_ar}</TableCell>
                          <TableCell>{category.icon || "—"}</TableCell>
                          <TableCell>{category.sort_order}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                category.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {category.is_active
                                ? t("admin.active")
                                : t("admin.inactive")}
                            </span>
                          </TableCell>
                           <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={category.is_active ? "text-orange-500" : "text-green-600"}
                                onClick={() => handleToggleVisibility(category)}
                                title={category.is_active ? (t("admin.hide") || "Hide") : (t("admin.show") || "Show")}
                              >
                                {category.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                <div className="space-y-2">
                  <Label>{t("admin.categoryName")}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.categoryNameAr")}</Label>
                  <Input
                    value={formData.name_ar}
                    onChange={(e) =>
                      setFormData({ ...formData, name_ar: e.target.value })
                    }
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.icon")}</Label>
                  <Input
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    placeholder="e.g., restaurant, shopping_bag"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
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
