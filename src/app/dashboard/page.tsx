"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Store, Users, Tag, Ticket, Clock, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface Stats {
  totalProviders: number;
  totalCustomers: number;
  totalDeals: number;
  totalRedemptions: number;
  pendingProviders: number;
  activeDeals: number;
  dealsByCategory: { name: string; count: number }[];
  providerStatusData: { name: string; value: number }[];
  redemptionsByMonth: { month: string; count: number }[];
}

const COLORS = ["#862045", "#A83258", "#C94468", "#D96B8A", "#E89BAE"];

const ICON_BG: Record<string, string> = {
  Store: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  Users: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  Tag: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  Ticket: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  Clock: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  TrendingUp: "bg-primary/10 text-primary",
};

function StatCardSkeleton({ index }: { index: number }) {
  return (
    <Card className={`animate-fade-in stagger-${index + 1}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2.5 flex-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const isRtl = i18n.language === "ar";

  const fetchStats = async () => {
    setLoading(true);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      providersRes,
      customersRes,
      dealsRes,
      redemptionsRes,
      pendingRes,
      activeDealsRes,
      categoriesRes,
      approvedRes,
      pendingStatusRes,
      rejectedRes,
      redemptionsByDate,
    ] = await Promise.all([
      supabase.from("provider_profiles").select("id", { count: "exact" }),
      supabase.from("customer_profiles").select("id", { count: "exact" }),
      supabase.from("discounts").select("id", { count: "exact" }),
      supabase.from("redemptions").select("id", { count: "exact" }),
      supabase
        .from("provider_profiles")
        .select("id", { count: "exact" })
        .eq("approval_status", "pending"),
      supabase
        .from("discounts")
        .select("id", { count: "exact" })
        .eq("status", "active"),
      supabase
        .from("categories")
        .select("id, name, name_ar"),
      supabase
        .from("provider_profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "approved"),
      supabase
        .from("provider_profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending"),
      supabase
        .from("provider_profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "rejected"),
      supabase
        .from("redemptions")
        .select("claimed_at")
        .gte("claimed_at", sixMonthsAgo.toISOString())
        .order("claimed_at", { ascending: true }),
    ]);

    const categories = categoriesRes.data || [];

    const categoryCounts = await Promise.all(
      categories.map(async (cat) => {
        const { count } = await supabase
          .from("discounts")
          .select("id", { count: "exact", head: true })
          .eq("category_id", cat.id);
        return {
          name: isRtl ? cat.name_ar : cat.name,
          count: count || 0,
        };
      })
    );

    const dealsByCategory = categoryCounts;

    const providerStatusData = [
      { name: t("admin.approved"), value: approvedRes.count || 0 },
      { name: t("admin.pending"), value: pendingStatusRes.count || 0 },
      { name: t("admin.rejected"), value: rejectedRes.count || 0 },
    ].filter((d) => d.value > 0);

    const monthCounts: Record<string, number> = {};
    redemptionsByDate.data?.forEach((r) => {
      const date = new Date(r.claimed_at);
      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    });

    const redemptionsByMonth = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));

    setStats({
      totalProviders: providersRes.count || 0,
      totalCustomers: customersRes.count || 0,
      totalDeals: dealsRes.count || 0,
      totalRedemptions: redemptionsRes.count || 0,
      pendingProviders: pendingRes.count || 0,
      activeDeals: activeDealsRes.count || 0,
      dealsByCategory,
      providerStatusData,
      redemptionsByMonth,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = stats
    ? [
        {
          title: t("admin.totalProviders"),
          value: stats.totalProviders,
          icon: Store,
          iconKey: "Store",
        },
        {
          title: t("admin.totalCustomers"),
          value: stats.totalCustomers,
          icon: Users,
          iconKey: "Users",
        },
        {
          title: t("admin.totalDeals"),
          value: stats.totalDeals,
          icon: Tag,
          iconKey: "Tag",
        },
        {
          title: t("admin.totalRedemptions"),
          value: stats.totalRedemptions,
          icon: Ticket,
          iconKey: "Ticket",
        },
        {
          title: t("admin.pendingProviders"),
          value: stats.pendingProviders,
          icon: Clock,
          iconKey: "Clock",
        },
        {
          title: t("admin.activeDeals"),
          value: stats.activeDeals,
          icon: TrendingUp,
          iconKey: "TrendingUp",
        },
      ]
    : [];

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <PageHeader title={t("admin.dashboard")} />

        {/* Stat cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} index={i} />
              ))
            : statCards.map((card, i) => (
                <Card
                  key={card.title}
                  className={`animate-fade-in stagger-${i + 1} hover:shadow-md transition-shadow duration-200`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          {card.title}
                        </p>
                        <p className="text-2xl font-bold tracking-tight">
                          {card.value.toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`flex items-center justify-center w-11 h-11 rounded-xl ${
                          ICON_BG[card.iconKey]
                        }`}
                      >
                        <card.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="animate-fade-in stagger-3">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium">
                {t("admin.charts.dealsByCategory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.dealsByCategory || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--color-muted-foreground)" }}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--color-muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in stagger-4">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium">
                {t("admin.charts.providersByStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.providerStatusData || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                        strokeWidth={2}
                        stroke="var(--color-card)"
                      >
                        {(stats?.providerStatusData || []).map(
                          (_entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 animate-fade-in stagger-5">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium">
                {t("admin.charts.redemptionsOverTime")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full rounded-lg" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats?.redemptionsByMonth || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                      <XAxis
                        dataKey="month"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--color-muted-foreground)" }}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--color-muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        dot={{ fill: "var(--chart-1)", strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--color-card)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageWrapper>
  );
}
