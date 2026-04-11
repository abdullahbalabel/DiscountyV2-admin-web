"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { RejectionReport } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
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
import { Eye, AlertTriangle, Search, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function sendPushNotification(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
    let accessToken: string | undefined;

    if (refreshError || !session) {
      const { data: { session: fallbackSession } } = await supabase.auth.getSession();
      if (!fallbackSession) return;
      accessToken = fallbackSession.access_token;
    } else {
      accessToken = session.access_token;
    }

    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, data: data || {} }),
    });
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}

interface ReportWithJoins extends RejectionReport {
  deal?: { title: string; status: string };
  customer?: { display_name: string };
}

type StatusFilter = "all" | "pending" | "reviewed" | "resolved" | "dismissed" | "auto_hidden";

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "reviewed", "resolved", "dismissed", "auto_hidden"];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  reviewed: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  dismissed: "bg-gray-500/10 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
  auto_hidden: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<ReportWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportWithJoins | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rejection_reports")
      .select(`
        *,
        deal:discounts!deal_id (title, status),
        customer:customer_profiles!customer_id (display_name)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReports(data as ReportWithJoins[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        r.deal?.title?.toLowerCase().includes(s) ||
        r.customer?.display_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalReports = reports.length;
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const autoHiddenCount = reports.filter((r) => r.status === "auto_hidden").length;

  const getReasonLabel = (reason: string) => {
    const key = `admin.reports.reason${reason.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`;
    return t(key);
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("admin.reports.pending"),
      reviewed: t("admin.reports.reviewed"),
      resolved: t("admin.reports.resolved"),
      dismissed: t("admin.reports.dismissed"),
      auto_hidden: t("admin.reports.autoHidden"),
    };
    return map[status] || status;
  };

  const handleUpdateStatus = async (status: string, restoreDeal?: boolean) => {
    if (!selectedReport) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("rejection_reports")
      .update({
        status,
        admin_notes: adminNotes || null,
        resolved_at: ["resolved", "dismissed", "auto_hidden"].includes(status)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", selectedReport.id);

    if (error) {
      toast.error(error.message);
      setActionLoading(false);
      return;
    }

    // Notify customer about status change
    const notificationKey: Record<string, string> = {
      reviewed: "reviewed",
      resolved: "resolved",
      dismissed: "dismissed",
    };
    const notifyType = notificationKey[status];
    if (notifyType) {
      const notifTitle = t(`admin.reports.notif${status.charAt(0).toUpperCase() + status.slice(1)}Title`);
      const notifBody = t(`admin.reports.notif${status.charAt(0).toUpperCase() + status.slice(1)}Body`, { deal: selectedReport.deal?.title || "" });
      const notifData = { report_id: selectedReport.id, deal_id: selectedReport.deal_id, status };

      await supabase.from("notifications").insert({
        user_id: selectedReport.customer_id,
        type: `report_${status}`,
        title: notifTitle,
        body: notifBody,
        data: notifData,
        is_read: false,
      });

      await sendPushNotification(selectedReport.customer_id, notifTitle, notifBody, notifData);
    }

    if (restoreDeal && selectedReport.deal_id) {
      const { error: dealError } = await supabase
        .from("discounts")
        .update({ status: "active" })
        .eq("id", selectedReport.deal_id);

      if (dealError) {
        toast.error(dealError.message);
      } else {
        toast.success(t("admin.reports.dealRestored"));
      }
    } else {
      toast.success(t("admin.reports.updated"));
    }

    setViewDialogOpen(false);
    setSelectedReport(null);
    setAdminNotes("");
    setActionLoading(false);
    loadReports();
  };

  const handlePermanentlyHide = async () => {
    if (!selectedReport) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("discounts")
      .update({ status: "hidden" })
      .eq("id", selectedReport.deal_id);

    if (error) {
      toast.error(error.message);
    } else {
      await supabase
        .from("rejection_reports")
        .update({ status: "resolved", admin_notes: adminNotes || null, resolved_at: new Date().toISOString() })
        .eq("id", selectedReport.id);

      const notifTitle = t("admin.reports.notifResolvedTitle");
      const notifBody = t("admin.reports.notifResolvedBody", { deal: selectedReport.deal?.title || "" });
      const notifData = { report_id: selectedReport.id, deal_id: selectedReport.deal_id, status: "resolved" };

      await supabase.from("notifications").insert({
        user_id: selectedReport.customer_id,
        type: "report_resolved",
        title: notifTitle,
        body: notifBody,
        data: notifData,
        is_read: false,
      });

      await sendPushNotification(selectedReport.customer_id, notifTitle, notifBody, notifData);

      toast.success(t("admin.reports.updated"));
      setViewDialogOpen(false);
      setSelectedReport(null);
      setAdminNotes("");
      loadReports();
    }
    setActionLoading(false);
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader
          title={t("admin.reports.title")}
          description={t("admin.reports.subtitle")}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in stagger-1">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalReports}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.totalReports")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.pendingReports")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{autoHiddenCount}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.autoHiddenDeals")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="animate-fade-in stagger-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
                <Input
                  placeholder={t("admin.search")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-9"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUS_FILTERS.map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className="text-xs"
                  >
                    {s === "all" ? t("admin.reports.all") : getStatusLabel(s)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : filteredReports.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title={t("admin.reports.noReports")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.reports.deal")}</TableHead>
                      <TableHead>{t("admin.reports.customer")}</TableHead>
                      <TableHead>{t("admin.reports.reason")}</TableHead>
                      <TableHead>{t("admin.reports.status")}</TableHead>
                      <TableHead>{t("admin.reports.createdAt")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium">
                          {report.deal?.title || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {report.customer?.display_name || "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getReasonLabel(report.reason_type)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_BADGE[report.status] || ""} border-none`}>
                            {getStatusLabel(report.status)}
                          </Badge>
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(report.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setAdminNotes(report.admin_notes || "");
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
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

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("admin.reports.title")}</DialogTitle>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.reports.deal")}</span>
                    <p className="text-sm font-medium">{selectedReport.deal?.title || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.reports.customer")}</span>
                    <p className="text-sm">{selectedReport.customer?.display_name || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.reports.reason")}</span>
                    <p className="text-sm">{getReasonLabel(selectedReport.reason_type)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.reports.status")}</span>
                    <div>
                      <Badge className={`${STATUS_BADGE[selectedReport.status] || ""} border-none`}>
                        {getStatusLabel(selectedReport.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {selectedReport.reason_detail && (
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">{t("admin.reports.reason")}</span>
                    <p className="text-sm">{selectedReport.reason_detail}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t("admin.reports.adminNotes")}</span>
                  <Textarea
                    placeholder={t("admin.reports.adminNotesPlaceholder")}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-wrap gap-2">
              {selectedReport?.status === "pending" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus("reviewed")}
                  disabled={actionLoading}
                >
                  {t("admin.reports.markReviewed")}
                </Button>
              )}
              {(selectedReport?.status === "pending" || selectedReport?.status === "reviewed") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus("resolved")}
                    disabled={actionLoading}
                  >
                    {t("admin.reports.resolve")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus("dismissed")}
                    disabled={actionLoading}
                  >
                    {t("admin.reports.dismiss")}
                  </Button>
                </>
              )}
              {selectedReport?.status === "auto_hidden" && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleUpdateStatus("resolved", true)}
                    disabled={actionLoading}
                  >
                    {t("admin.reports.restoreDeal")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePermanentlyHide}
                    disabled={actionLoading}
                  >
                    {t("admin.reports.permanentlyHide")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
