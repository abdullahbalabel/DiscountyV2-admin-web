"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Pencil,
  Copy,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

interface StripeProduct {
  id: string;
  name: string;
  active: boolean;
  metadata: Record<string, string>;
}

interface StripePrice {
  id: string;
  product: string;
  active: boolean;
  recurring: { interval: string } | null;
  unit_amount: number;
  currency: string;
}

interface PlanMapping {
  id: string;
  name: string;
  name_ar: string;
  monthly_price_sar: number | null;
  yearly_price_sar: number | null;
  stripe_product_id: string | null;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface StripeStatus {
  connected: boolean;
  webhookConfigured: boolean;
  error?: string;
  products: StripeProduct[];
  prices: StripePrice[];
  plans: PlanMapping[];
  priceMap: Record<string, StripePrice[]>;
}

export default function StripeSettingsPage() {
  const { t, i18n } = useTranslation();
  const sarLabel = i18n.language === 'ar' ? 'ر.س' : 'SAR';
  const { hasPermission, permissionsLoading } = usePermissions();
  const canView = hasPermission("stripe_settings", "view");
  const canEdit = hasPermission("stripe_settings", "edit");
  const canManage = hasPermission("stripe_settings", "manage");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanMapping | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editMonthlyPriceId, setEditMonthlyPriceId] = useState("");
  const [editYearlyPriceId, setEditYearlyPriceId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expired");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-settings`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
        }
      );

      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        connected: false,
        webhookConfigured: false,
        error: "Failed to connect",
        products: [],
        prices: [],
        plans: [],
        priceMap: {},
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expired");
        setSyncing(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ action: "sync" }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
      } else {
        toast.success(
          t("admin.syncSuccess") ||
            `Synced ${data.updated} plans`
        );
        await fetchStatus();
      }
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
  };

  const openEditDialog = (plan: PlanMapping) => {
    setEditingPlan(plan);
    setEditProductId(plan.stripe_product_id || "");
    setEditMonthlyPriceId(plan.stripe_monthly_price_id || "");
    setEditYearlyPriceId(plan.stripe_yearly_price_id || "");
    setEditDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expired");
        setSaving(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            action: "update-plan",
            plan_id: editingPlan.id,
            stripe_product_id: editProductId || null,
            stripe_monthly_price_id: editMonthlyPriceId || null,
            stripe_yearly_price_id: editYearlyPriceId || null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Update failed");
      } else {
        toast.success(t("admin.subscriptionPlanUpdated"));
        setEditDialogOpen(false);
        setEditingPlan(null);
        await fetchStatus();
      }
    } catch {
      toast.error("Update failed");
    }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("admin.copied") || "Copied!");
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-webhook`;

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
        <PageHeader title={t("admin.stripeSettings") || "Stripe Settings"} />

        {/* Connection Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                {status?.connected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : loading ? (
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.stripeConnection") || "Stripe Connection"}
                  </p>
                  <p className={`text-sm font-medium ${
                    loading
                      ? ""
                      : status?.connected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}>
                    {loading
                      ? t("admin.checking") || "Checking..."
                      : status?.connected
                      ? t("admin.connected") || "Connected"
                      : t("admin.disconnected") || "Disconnected"}
                  </p>
                  {status?.error && (
                    <p className="text-xs text-destructive mt-0.5">
                      {status.error}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                {status?.webhookConfigured ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.webhookSecret") || "Webhook Secret"}
                  </p>
                  <p className={`text-sm font-medium ${
                    status?.webhookConfigured
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {status?.webhookConfigured
                      ? t("admin.configured") || "Configured"
                      : t("admin.notConfigured") || "Not Configured"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Webhook URL */}
        <Card className="animate-fade-in stagger-1">
          <CardHeader>
            <p className="text-sm font-medium">
              {t("admin.webhookEndpoint") || "Webhook Endpoint"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                dir="ltr"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  window.open(
                    "https://dashboard.stripe.com/webhooks",
                    "_blank"
                  )
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("admin.webhookEndpointHint") ||
                "Add this URL in your Stripe Dashboard → Developers → Webhooks. Events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted"}
            </p>
          </CardContent>
        </Card>

        {/* Plan Mappings */}
        <Card className="animate-fade-in stagger-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t("admin.stripePlanMapping") || "Plan → Stripe Mapping"}
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing || !status?.connected}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 me-1.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  {t("admin.autoSync") || "Auto-Sync"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !status?.plans || status.plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CreditCard className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{t("admin.noPlans")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.planName")}</TableHead>
                      <TableHead>{t("admin.monthlyPrice")}</TableHead>
                      <TableHead>{t("admin.yearlyPrice")}</TableHead>
                      <TableHead>{t("admin.stripeMonthlyPriceId") || "Monthly Price ID"}</TableHead>
                      <TableHead>{t("admin.stripeYearlyPriceId") || "Yearly Price ID"}</TableHead>
                      <TableHead className="text-end">
                        {t("admin.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.plans.map((plan) => {
                      const hasMonthly = !!plan.stripe_monthly_price_id;
                      const hasYearly = !!plan.stripe_yearly_price_id;
                      return (
                        <TableRow
                          key={plan.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="font-medium">
                            {plan.name}
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
                          <TableCell>
                            {hasMonthly ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none font-mono text-[10px]">
                                {plan.stripe_monthly_price_id?.slice(0, 16)}
                                ...
                              </Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground border-none">
                                {t("admin.notLinked") || "Not Linked"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasYearly ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none font-mono text-[10px]">
                                {plan.stripe_yearly_price_id?.slice(0, 16)}...
                              </Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground border-none">
                                {t("admin.notLinked") || "Not Linked"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEditDialog(plan)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Products Reference */}
        {status?.products && status.products.length > 0 && (
          <Card className="animate-fade-in stagger-3">
            <CardHeader>
              <p className="text-sm font-medium">
                {t("admin.stripeProducts") || "Stripe Products"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.name")}</TableHead>
                      <TableHead>{t("admin.stripeProductId") || "Product ID"}</TableHead>
                      <TableHead>{t("admin.monthlyPrice")} / {t("admin.yearlyPrice")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.products.map((product) => {
                      const productPrices =
                        status.priceMap[product.id] || [];
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell
                            dir="ltr"
                            className="font-mono text-xs text-muted-foreground"
                          >
                            {product.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {productPrices.map((price) => (
                                <Badge
                                  key={price.id}
                                  variant="outline"
                                  className="text-[10px] font-mono"
                                >
                                  {price.recurring?.interval === "month"
                                    ? t("admin.monthly")
                                    : price.recurring?.interval === "year"
                                    ? t("admin.yearly")
                                    : "One-time"}
                                  : {(price.unit_amount / 100).toFixed(2)}{" "}
                                  {price.currency.toUpperCase()}
                                </Badge>
                              ))}
                              {productPrices.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {t("admin.noResults")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                product.active
                                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                                  : "bg-muted text-muted-foreground border-none"
                              }
                            >
                              {product.active
                                ? t("admin.active")
                                : t("admin.inactive")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Mapping Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("admin.editStripeMapping") || "Edit Stripe Mapping"}
                {editingPlan ? ` — ${editingPlan.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  {t("admin.stripeProductId") || "Stripe Product ID"}
                </Label>
                <Input
                  value={editProductId}
                  onChange={(e) => setEditProductId(e.target.value)}
                  placeholder="prod_..."
                  dir="ltr"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("admin.stripeMonthlyPriceId") || "Monthly Price ID"}
                </Label>
                <Input
                  value={editMonthlyPriceId}
                  onChange={(e) => setEditMonthlyPriceId(e.target.value)}
                  placeholder="price_..."
                  dir="ltr"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("admin.stripeYearlyPriceId") || "Yearly Price ID"}
                </Label>
                <Input
                  value={editYearlyPriceId}
                  onChange={(e) => setEditYearlyPriceId(e.target.value)}
                  placeholder="price_..."
                  dir="ltr"
                  className="font-mono text-xs"
                />
              </div>
              {/* Quick select from Stripe products */}
              {status?.products && status.products.length > 0 && (
                <div className="space-y-1.5">
                  <Label>
                    {t("admin.quickSelect") || "Quick Select from Stripe"}
                  </Label>
                  <Select
                    value={editProductId}
                    onValueChange={(v: string | null) => {
                      if (!v) return;
                      setEditProductId(v);
                      const prices = (status.priceMap[v] || []) as StripePrice[];
                      const monthly = prices.find(
                        (p: StripePrice) => p.recurring?.interval === "month"
                      );
                      const yearly = prices.find(
                        (p: StripePrice) => p.recurring?.interval === "year"
                      );
                      if (monthly) setEditMonthlyPriceId(monthly.id);
                      if (yearly) setEditYearlyPriceId(yearly.id);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {status.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.id.slice(0, 12)}...)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingPlan(null);
                }}
              >
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleSaveMapping} disabled={saving}>
                {saving
                  ? t("admin.saving") || "Saving..."
                  : t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
