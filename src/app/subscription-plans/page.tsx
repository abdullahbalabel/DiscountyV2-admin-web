"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { SubscriptionPlan } from "@/lib/types";
import { subscriptionPlanSchema } from "@/lib/validations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Search, Trash2, CreditCard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

export default function SubscriptionPlansPage() {
  const { t, i18n } = useTranslation();
  const sarLabel = i18n.language === 'ar' ? 'ر.س' : 'SAR';
  const { hasPermission, permissionsLoading } = usePermissions();
  const canView = hasPermission("subscription_plans", "view");
  const canCreate = hasPermission("subscription_plans", "create");
  const canEdit = hasPermission("subscription_plans", "edit");
  const canDelete = hasPermission("subscription_plans", "delete");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [activeSubCount, setActiveSubCount] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    description: "",
    description_ar: "",
    max_active_deals: 5,
    max_featured_deals: 0,
    has_analytics: false,
    max_push_notifications: 0,
    has_priority_support: false,
    profile_badge: "",
    profile_badge_ar: "",
    has_homepage_placement: false,
    monthly_price_sar: null as number | null,
    yearly_price_sar: null as number | null,
    is_active: true,
    sort_order: 0,
  });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) {
      let filtered = data as SubscriptionPlan[];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name?.toLowerCase().includes(s) ||
            p.name_ar?.toLowerCase().includes(s)
        );
      }
      setPlans(filtered);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      name_ar: "",
      description: "",
      description_ar: "",
      max_active_deals: 5,
      max_featured_deals: 0,
      has_analytics: false,
      max_push_notifications: 0,
      has_priority_support: false,
      profile_badge: "",
      profile_badge_ar: "",
      has_homepage_placement: false,
      monthly_price_sar: null,
      yearly_price_sar: null,
      is_active: true,
      sort_order: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      name_ar: plan.name_ar,
      description: plan.description || "",
      description_ar: plan.description_ar || "",
      max_active_deals: plan.max_active_deals,
      max_featured_deals: plan.max_featured_deals,
      has_analytics: plan.has_analytics,
      max_push_notifications: plan.max_push_notifications,
      has_priority_support: plan.has_priority_support,
      profile_badge: plan.profile_badge || "",
      profile_badge_ar: plan.profile_badge_ar || "",
      has_homepage_placement: plan.has_homepage_placement,
      monthly_price_sar: plan.monthly_price_sar,
      yearly_price_sar: plan.yearly_price_sar,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;

    const result = subscriptionPlanSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }

    setSaving(true);

    const payload = {
      name: result.data.name,
      name_ar: result.data.name_ar,
      description: result.data.description || null,
      description_ar: result.data.description_ar || null,
      max_active_deals: result.data.max_active_deals,
      max_featured_deals: result.data.max_featured_deals,
      has_analytics: result.data.has_analytics,
      max_push_notifications: result.data.max_push_notifications,
      has_priority_support: result.data.has_priority_support,
      profile_badge: result.data.profile_badge || null,
      profile_badge_ar: result.data.profile_badge_ar || null,
      has_homepage_placement: result.data.has_homepage_placement,
      monthly_price_sar: result.data.monthly_price_sar,
      yearly_price_sar: result.data.yearly_price_sar,
      is_active: result.data.is_active,
      sort_order: result.data.sort_order,
    };

    try {
      if (editingPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingPlan.id);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t("admin.subscriptionPlanUpdated"));
          setDialogOpen(false);
          fetchPlans();
        }
      } else {
        const { error } = await supabase.from("subscription_plans").insert(payload);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t("admin.subscriptionPlanCreated"));
          setDialogOpen(false);
          fetchPlans();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = async (plan: SubscriptionPlan) => {
    setDeletingPlan(plan);
    const { count } = await supabase
      .from("provider_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .eq("status", "active");
    setActiveSubCount(count || 0);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;

    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", deletingPlan.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.subscriptionPlanDeleted"));
      setDeleteDialogOpen(false);
      setDeletingPlan(null);
      fetchPlans();
    }
  };

  if (!permissionsLoading && !canView) {
    return (
      <AdminPageWrapper>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ShieldAlert className="h-12 w-12" />
          <p className="text-lg font-medium">{t("admin.noPermission") || "You do not have permission to view this page"}</p>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader
          title={t("admin.subscriptionPlans")}
          action={
            canCreate ? (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 me-1.5" />
                {t("admin.createPlan")}
              </Button>
            ) : undefined
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
                <TableSkeleton columns={8} />
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title={t("admin.noPlans")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.planName")}</TableHead>
                      <TableHead>{t("admin.planNameAr")}</TableHead>
                      <TableHead>{t("admin.monthlyPrice")}</TableHead>
                      <TableHead>{t("admin.yearlyPrice")}</TableHead>
                      <TableHead>{t("admin.maxActiveDeals")}</TableHead>
                      <TableHead>{t("admin.hasAnalytics")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead>{t("admin.sortOrder")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow
                        key={plan.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {plan.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {plan.name_ar}
                        </TableCell>
                        <TableCell dir="ltr">
                          {plan.monthly_price_sar != null
                            ? `${plan.monthly_price_sar} ${sarLabel}`
                            : "—"}
                        </TableCell>
                        <TableCell dir="ltr">
                          {plan.yearly_price_sar != null
                            ? `${plan.yearly_price_sar} ${sarLabel}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {plan.max_active_deals}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              plan.has_analytics
                                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                : "bg-muted text-muted-foreground border-none"
                            }
                          >
                            {plan.has_analytics ? t("admin.active") : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              plan.is_active
                                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                : "bg-muted text-muted-foreground border-none"
                            }
                          >
                            {plan.is_active
                              ? t("admin.active")
                              : t("admin.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {plan.sort_order}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEditDialog(plan)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => openDeleteDialog(plan)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan
                  ? t("admin.editPlan")
                  : t("admin.createPlan")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pe-2">
              {/* Basic Info */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("admin.basicInfo")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.planName")}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.planNameAr")}</Label>
                    <Input
                      value={formData.name_ar}
                      onChange={(e) =>
                        setFormData({ ...formData, name_ar: e.target.value })
                      }
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.description")}</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={2}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.descriptionAr")}</Label>
                    <Textarea
                      value={formData.description_ar}
                      onChange={(e) =>
                        setFormData({ ...formData, description_ar: e.target.value })
                      }
                      rows={2}
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("admin.features")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.maxActiveDeals")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.max_active_deals}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_active_deals: parseInt(e.target.value) || 1,
                        })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.maxFeaturedDeals")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.max_featured_deals}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_featured_deals: parseInt(e.target.value) || 0,
                        })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.maxPushNotifications")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.max_push_notifications}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_push_notifications: parseInt(e.target.value) || 0,
                        })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.profileBadge")} (EN)</Label>
                    <Input
                      value={formData.profile_badge}
                      onChange={(e) =>
                        setFormData({ ...formData, profile_badge: e.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.profileBadge")} (AR)</Label>
                    <Input
                      value={formData.profile_badge_ar}
                      onChange={(e) =>
                        setFormData({ ...formData, profile_badge_ar: e.target.value })
                      }
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.has_analytics}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, has_analytics: checked })
                      }
                    />
                    <Label>{t("admin.hasAnalytics")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.has_priority_support}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, has_priority_support: checked })
                      }
                    />
                    <Label>{t("admin.hasPrioritySupport")}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.has_homepage_placement}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, has_homepage_placement: checked })
                      }
                    />
                    <Label>{t("admin.hasHomepagePlacement")}</Label>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("admin.monthlyPrice")} / {t("admin.yearlyPrice")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.monthlyPrice")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.monthly_price_sar ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          monthly_price_sar: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        })
                      }
                      dir="ltr"
                      placeholder="Leave empty if unavailable"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.yearlyPrice")}</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.yearly_price_sar ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearly_price_sar: e.target.value
                            ? parseFloat(e.target.value)
                            : null,
                        })
                      }
                      dir="ltr"
                      placeholder="Leave empty if unavailable"
                    />
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("admin.status")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.sortOrder")}</Label>
                    <Input
                      type="number"
                      min={0}
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
                  <div className="flex items-center gap-2 pt-5">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                    <Label>{t("admin.planActive")}</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("admin.saving") : t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.deletePlan")}</DialogTitle>
            </DialogHeader>
            {activeSubCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.deletePlanWarning", { count: activeSubCount })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin.deactivatePlanConfirm") || "This plan will be deactivated. Existing subscriptions referencing it will keep working."}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletingPlan(null);
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("admin.deactivate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
