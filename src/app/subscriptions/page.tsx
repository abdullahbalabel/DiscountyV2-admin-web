"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { SubscriptionPlan } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Search, Receipt, Eye, XCircle, CalendarDays, UserPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

interface SubscriptionWithJoins {
  id: string;
  provider_id: string;
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  amount_sar: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  current_period_end: string;
  cancelled_at: string | null;
  pending_plan_id: string | null;
  pending_cycle: "monthly" | "yearly" | null;
  plan: SubscriptionPlan | null;
  provider: { business_name: string } | null;
  created_at: string;
  updated_at: string;
}

export default function SubscriptionsPage() {
  const { t, i18n } = useTranslation();
  const sarLabel = i18n.language === 'ar' ? 'ر.س' : 'SAR';
  const { hasPermission, permissionsLoading } = usePermissions();
  const canView = hasPermission("subscriptions", "view");
  const canCreate = hasPermission("subscriptions", "create");
  const canEdit = hasPermission("subscriptions", "edit");
  const canDelete = hasPermission("subscriptions", "delete");
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithJoins[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionWithJoins | null>(null);
  const [extendDate, setExtendDate] = useState("");

  const [providers, setProviders] = useState<Array<{ id: string; business_name: string }>>([]);
  const [assignProvider, setAssignProvider] = useState("");
  const [assignPlan, setAssignPlan] = useState("");
  const [assignCycle, setAssignCycle] = useState<"monthly" | "yearly">("monthly");
  const [assignPeriodEnd, setAssignPeriodEnd] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);

  const [stats, setStats] = useState({ activeCount: 0, monthlyRevenue: 0 });

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setPlans(data as SubscriptionPlan[]);
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("provider_subscriptions")
      .select(
        "*, plan:subscription_plans!plan_id(*), provider:provider_profiles!provider_id(business_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (planFilter !== "all") {
      query = query.eq("plan_id", planFilter);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (debouncedSearch) {
      query = query.ilike("provider_profiles.business_name", `%${debouncedSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching subscriptions:", error);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setTotalCount(count || 0);
      const items = (data as unknown as Array<Record<string, unknown>>).map((row) => {
        const provider = Array.isArray(row.provider) ? row.provider[0] : row.provider;
        const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
        return { ...row, provider: provider ?? null, plan: plan ?? null } as unknown as SubscriptionWithJoins;
      });
      setSubscriptions(items);
    }
    setLoading(false);
  }, [offset, pageSize, planFilter, statusFilter, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    const { count, error: countError } = await supabase
      .from("provider_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (countError) console.error("Error fetching active count:", countError);
    const activeCount = count || 0;

    const { data: revenueData, error: revenueError } = await supabase
      .from("provider_subscriptions")
      .select("amount_sar, billing_cycle")
      .eq("status", "active");
    if (revenueError) console.error("Error fetching revenue:", revenueError);

    let monthlyRevenue = 0;
    if (revenueData) {
      for (const sub of revenueData) {
        const amount = (sub as { amount_sar: number }).amount_sar;
        const cycle = (sub as { billing_cycle: string }).billing_cycle;
        monthlyRevenue += cycle === "yearly" ? amount / 12 : amount;
      }
    }
    setStats({ activeCount, monthlyRevenue });
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchStats();
  }, [fetchPlans, fetchStats]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const fetchProvidersForAssign = useCallback(async () => {
    const { data } = await supabase
      .from("provider_profiles")
      .select("id, business_name")
      .eq("approval_status", "approved")
      .order("business_name");
    if (data) setProviders(data);
  }, []);

  const handleAssign = async () => {
    if (!assignProvider || !assignPlan || !assignPeriodEnd) return;

    const periodEnd = new Date(assignPeriodEnd);
    if (isNaN(periodEnd.getTime()) || periodEnd <= new Date()) {
      toast.error(t("admin.periodEndMustBeFuture") || "Period end must be a future date");
      return;
    }

    setAssignLoading(true);

    const selectedPlan = plans.find((p) => p.id === assignPlan);
    if (!selectedPlan) {
      toast.error("Plan not found");
      setAssignLoading(false);
      return;
    }

    const amountSar = assignCycle === "yearly"
      ? (selectedPlan.yearly_price_sar || 0)
      : (selectedPlan.monthly_price_sar || 0);

    // Cancel existing active subscription
    const { error: cancelError } = await supabase
      .from("provider_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("provider_id", assignProvider)
      .eq("status", "active");

    if (cancelError) {
      toast.error(cancelError.message);
      setAssignLoading(false);
      return;
    }

    const { error } = await supabase
      .from("provider_subscriptions")
      .insert({
        provider_id: assignProvider,
        plan_id: assignPlan,
        billing_cycle: assignCycle,
        amount_sar: amountSar,
        status: "active",
        starts_at: new Date().toISOString(),
        current_period_end: assignPeriodEnd,
      });

    if (error) {
      toast.error(error.message);
    } else {
      // Pause excess deals beyond the new plan's limit
      const { data: activeDeals } = await supabase
        .from("discounts")
        .select("id")
        .eq("provider_id", assignProvider)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (activeDeals && activeDeals.length > selectedPlan.max_active_deals) {
        const dealsToPause = activeDeals.slice(selectedPlan.max_active_deals);
        if (dealsToPause.length > 0) {
          await supabase
            .from("discounts")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .in("id", dealsToPause.map((d) => d.id));
        }
      }

      toast.success(t("admin.subscriptionAssigned") || "Subscription assigned successfully");
      setAssignDialogOpen(false);
      setAssignProvider("");
      setAssignPlan("");
      setAssignCycle("monthly");
      setAssignPeriodEnd("");
      fetchSubscriptions();
      fetchStats();
    }
    setAssignLoading(false);
  };

  const handleCancel = async () => {
    if (!selectedSub || cancelLoading) return;
    setCancelLoading(true);

    // Cancel on Stripe first if linked
    if (selectedSub.stripe_subscription_id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-settings`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: "cancel-subscription",
                stripe_subscription_id: selectedSub.stripe_subscription_id,
              }),
            }
          );
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error || "Failed to cancel on Stripe");
            setCancelLoading(false);
            return;
          }
        }
      } catch {
        toast.error("Failed to cancel on Stripe");
        setCancelLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("provider_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedSub.id);

    if (error) {
      toast.error(error.message);
      setCancelLoading(false);
      return;
    }

    // For non-Stripe subscriptions: create Free plan subscription and pause excess deals
    if (!selectedSub.stripe_subscription_id) {
      const { data: freePlan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", "Free")
        .eq("is_active", true)
        .maybeSingle();

      if (freePlan) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setFullYear(periodEnd.getFullYear() + 100);

        await supabase.from("provider_subscriptions").insert({
          provider_id: selectedSub.provider_id,
          plan_id: freePlan.id,
          billing_cycle: "monthly",
          amount_sar: 0,
          stripe_subscription_id: null,
          stripe_customer_id: null,
          status: "active",
          starts_at: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });

        // Pause excess deals beyond Free plan limit
        const { data: activeDeals } = await supabase
          .from("discounts")
          .select("id")
          .eq("provider_id", selectedSub.provider_id)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (activeDeals && activeDeals.length > freePlan.max_active_deals) {
          const dealsToPause = activeDeals.slice(freePlan.max_active_deals);
          if (dealsToPause.length > 0) {
            await supabase
              .from("discounts")
              .update({ status: "paused", updated_at: now.toISOString() })
              .in("id", dealsToPause.map((d) => d.id));
          }
        }
      }
    }

    toast.success(t("admin.cancelSubscriptionConfirm") || "Subscription cancelled");
    setCancelDialogOpen(false);
    setSelectedSub(null);
    fetchSubscriptions();
    fetchStats();
    setCancelLoading(false);
  };

  const handleExtend = async () => {
    if (!selectedSub || !extendDate || extendLoading) return;

    const newEndDate = new Date(extendDate);
    const currentEnd = new Date(selectedSub.current_period_end);
    if (newEndDate <= currentEnd) {
      toast.error(t("admin.extendDateMustBeAfter") || "New date must be after current period end");
      return;
    }

    setExtendLoading(true);

    // Update Stripe subscription period if linked
    if (selectedSub.stripe_subscription_id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-settings`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: "update-subscription-period",
                stripe_subscription_id: selectedSub.stripe_subscription_id,
                period_end: extendDate,
              }),
            }
          );
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error || "Failed to update Stripe period");
            setExtendLoading(false);
            return;
          }
        }
      } catch {
        toast.error("Failed to update Stripe period");
        setExtendLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("provider_subscriptions")
      .update({
        current_period_end: extendDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedSub.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.update"));
      setExtendDialogOpen(false);
      setSelectedSub(null);
      setExtendDate("");
      fetchSubscriptions();
      fetchStats();
    }
    setExtendLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none",
      past_due: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none",
      cancelled: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-none",
      expired: "bg-muted text-muted-foreground border-none",
    };
    const labels: Record<string, string> = {
      active: t("admin.active"),
      past_due: t("admin.pastDue") || "Past Due",
      cancelled: t("admin.cancelled") || "Cancelled",
      expired: t("admin.expired") || "Expired",
    };
    return (
      <Badge className={styles[status] || styles.expired}>
        {labels[status] || status}
      </Badge>
    );
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
        <div className="flex items-center justify-between">
          <PageHeader title={t("admin.subscriptions")} />
          {canCreate && (
            <Button
              onClick={() => {
                fetchProvidersForAssign();
                setAssignDialogOpen(true);
              }}
              size="sm"
            >
              <UserPlus className="h-4 w-4 me-1.5" />
              {t("admin.manualAssign") || "Manual Assign"}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">
                {t("admin.activeSubscriptions")}
              </p>
              <p className="text-2xl font-bold mt-1">{stats.activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">
                {t("admin.totalRevenue")}
              </p>
              <p className="text-2xl font-bold mt-1" dir="ltr">
                {stats.monthlyRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                {sarLabel}
              </p>
            </CardContent>
          </Card>
        </div>

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
              <Select value={planFilter} onValueChange={(v) => v && setPlanFilter(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("admin.plan")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t("admin.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  <SelectItem value="active">{t("admin.active")}</SelectItem>
                  <SelectItem value="past_due">{t("admin.pastDue") || "Past Due"}</SelectItem>
                  <SelectItem value="cancelled">{t("admin.cancelled") || "Cancelled"}</SelectItem>
                  <SelectItem value="expired">{t("admin.expired") || "Expired"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={7} />
              ) : subscriptions.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.provider")}</TableHead>
                      <TableHead>{t("admin.plan")}</TableHead>
                      <TableHead>{t("admin.cycle")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead>{t("admin.periodEnd")}</TableHead>
                      <TableHead>{t("admin.stripeId")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow
                        key={sub.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {sub.provider?.business_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sub.plan?.name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {sub.billing_cycle === "monthly"
                            ? t("admin.monthly") || "Monthly"
                            : t("admin.yearly") || "Yearly"}
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(sub.current_period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs font-mono">
                          {sub.stripe_subscription_id
                            ? `${sub.stripe_subscription_id.slice(0, 12)}...`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedSub(sub);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {sub.status === "active" && (
                              <>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      setSelectedSub(sub);
                                      setExtendDate(
                                        sub.current_period_end
                                          ? new Date(sub.current_period_end).toISOString().split("T")[0]
                                          : ""
                                      );
                                      setExtendDialogOpen(true);
                                    }}
                                    title={t("admin.extendPeriod") || "Extend"}
                                  >
                                    <CalendarDays className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive"
                                    onClick={() => {
                                      setSelectedSub(sub);
                                      setCancelDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
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

        {totalCount > pageSize && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-xs text-muted-foreground">
              {t("admin.showing")} {offset + 1}-{Math.min(offset + pageSize, totalCount)}{" "}
              {t("admin.of")} {totalCount}
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
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("admin.subscriptions")}</DialogTitle>
            </DialogHeader>
            {selectedSub && (
              <div className="space-y-5 max-h-[60vh] overflow-y-auto pe-2">
                {/* Provider */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("admin.provider")}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.businessName")}
                      </span>
                      <p className="text-sm font-medium">
                        {selectedSub.provider?.business_name || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Plan */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("admin.plan")}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.planName")}
                      </span>
                      <p className="text-sm font-medium">
                        {selectedSub.plan?.name || "—"}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.cycle")}
                      </span>
                      <p className="text-sm capitalize">
                        {selectedSub.billing_cycle === "monthly"
                          ? t("admin.monthly") || "Monthly"
                          : t("admin.yearly") || "Yearly"}
                      </p>
                    </div>
                  </div>
                  {selectedSub.plan && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedSub.plan.has_analytics && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("admin.hasAnalytics")}
                        </Badge>
                      )}
                      {selectedSub.plan.has_priority_support && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("admin.hasPrioritySupport")}
                        </Badge>
                      )}
                      {selectedSub.plan.has_homepage_placement && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("admin.hasHomepagePlacement")}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {selectedSub.plan.max_active_deals} {t("admin.maxActiveDeals")}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Billing */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("admin.billing") || "Billing"}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.monthlyPrice")} / {t("admin.yearlyPrice")}
                      </span>
                        <p className="text-sm font-medium" dir="ltr">
                          {selectedSub.amount_sar} {sarLabel}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.status")}
                      </span>
                      <div>{getStatusBadge(selectedSub.status)}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.createdAt")}
                      </span>
                      <p className="text-sm" dir="ltr">
                        {new Date(selectedSub.starts_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        {t("admin.periodEnd")}
                      </span>
                      <p className="text-sm" dir="ltr">
                        {new Date(selectedSub.current_period_end).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stripe */}
                {(selectedSub.stripe_subscription_id || selectedSub.stripe_customer_id) && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Stripe
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedSub.stripe_subscription_id && (
                        <div className="space-y-0.5">
                          <span className="text-xs text-muted-foreground">
                            {t("admin.stripeId")}
                          </span>
                          <p className="text-xs font-mono" dir="ltr">
                            {selectedSub.stripe_subscription_id}
                          </p>
                        </div>
                      )}
                      {selectedSub.stripe_customer_id && (
                        <div className="space-y-0.5">
                          <span className="text-xs text-muted-foreground">
                            {t("admin.stripeCustomerId") || "Customer ID"}
                          </span>
                          <p className="text-xs font-mono" dir="ltr">
                            {selectedSub.stripe_customer_id}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending downgrade */}
                {selectedSub.pending_plan_id && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("admin.pendingDowngrade") || "Pending Downgrade"}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs text-muted-foreground">
                          {t("admin.plan")}
                        </span>
                        <p className="text-sm">
                          {plans.find((p) => p.id === selectedSub.pending_plan_id)?.name || selectedSub.pending_plan_id}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs text-muted-foreground">
                          {t("admin.cycle")}
                        </span>
                        <p className="text-sm capitalize">
                          {selectedSub.pending_cycle || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.cancelSubscriptionConfirm") || "Cancel Subscription"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {selectedSub?.stripe_subscription_id
                ? (t("admin.cancelSubscriptionWithStripeWarning") || "This will cancel the subscription immediately on both local records and Stripe. The provider will lose access at the end of the current billing period.")
                : (t("admin.cancelSubscriptionConfirm") || "Are you sure you want to cancel this subscription?")}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setSelectedSub(null);
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelLoading}>
                {cancelLoading ? t("admin.saving") || "Saving..." : t("admin.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extend Dialog */}
        <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.extendPeriod") || "Extend Period"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>{t("admin.periodEnd")}</Label>
              <Input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                dir="ltr"
              />
              {selectedSub?.stripe_subscription_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.extendStripeNote") || "This will also update the Stripe subscription trial end date."}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setExtendDialogOpen(false);
                  setSelectedSub(null);
                  setExtendDate("");
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleExtend} disabled={extendLoading || !extendDate}>
                {extendLoading ? t("admin.saving") || "Saving..." : t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.manualAssign") || "Manual Assign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.provider")}</Label>
                <Select value={assignProvider} onValueChange={(v) => v && setAssignProvider(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.selectProvider") || "Select provider"} />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.plan")}</Label>
                <Select value={assignPlan} onValueChange={(v) => v && setAssignPlan(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.selectPlan") || "Select plan"} />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.cycle")}</Label>
                <Select value={assignCycle} onValueChange={(v) => v && setAssignCycle(v as "monthly" | "yearly")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("admin.monthly") || "Monthly"}</SelectItem>
                    <SelectItem value="yearly">{t("admin.yearly") || "Yearly"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.periodEnd")}</Label>
                <Input
                  type="date"
                  value={assignPeriodEnd}
                  onChange={(e) => setAssignPeriodEnd(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAssignDialogOpen(false);
                  setAssignProvider("");
                  setAssignPlan("");
                  setAssignCycle("monthly");
                  setAssignPeriodEnd("");
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!assignProvider || !assignPlan || !assignPeriodEnd || assignLoading}
              >
                {assignLoading ? t("admin.saving") || "Saving..." : t("admin.assign") || "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
