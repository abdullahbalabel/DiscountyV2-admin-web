"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </AdminPageWrapper>
    );
  }

  const statCards = [
    {
      title: t("admin.totalProviders"),
      value: stats?.totalProviders ?? 0,
      icon: Store,
    },
    {
      title: t("admin.totalCustomers"),
      value: stats?.totalCustomers ?? 0,
      icon: Users,
    },
    {
      title: t("admin.totalDeals"),
      value: stats?.totalDeals ?? 0,
      icon: Tag,
    },
    {
      title: t("admin.totalRedemptions"),
      value: stats?.totalRedemptions ?? 0,
      icon: Ticket,
    },
    {
      title: t("admin.pendingProviders"),
      value: stats?.pendingProviders ?? 0,
      icon: Clock,
    },
    {
      title: t("admin.activeDeals"),
      value: stats?.activeDeals ?? 0,
      icon: TrendingUp,
    },
  ];

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">
          {t("admin.dashboard")}
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.charts.dealsByCategory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.dealsByCategory || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis fontSize={12} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.charts.providersByStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.providerStatusData || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                {t("admin.charts.redemptionsOverTime")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats?.redemptionsByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis fontSize={12} tickLine={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ fill: "var(--chart-1)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageWrapper>
  );
}
