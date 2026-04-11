"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { DataRequest } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Eye, Shield, BarChart3, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface DataRequestWithJoins extends DataRequest {
  user_email?: string;
}

type StatusFilter = "all" | "pending" | "processing" | "completed" | "rejected";

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "processing", "completed", "rejected"];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  processing: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export default function DataRequestsPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<DataRequestWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DataRequestWithJoins | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (!error && data) {
      const enriched = await Promise.all(
        data.map(async (req) => {
          const { data: profile } = await supabase
            .from("customer_profiles")
            .select("display_name")
            .eq("user_id", req.user_id)
            .maybeSingle();
          return {
            ...req,
            user_email: profile?.display_name || `${req.user_id.slice(0, 8)}...`,
          } as DataRequestWithJoins;
        })
      );
      setRequests(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const totalRequests = requests.length;
  const pendingExport = requests.filter((r) => r.request_type === "export" && r.status === "pending").length;
  const pendingDeletion = requests.filter((r) => r.request_type === "delete" && r.status === "pending").length;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("admin.dataRequests.pending"),
      processing: t("admin.dataRequests.processing"),
      completed: t("admin.dataRequests.completed"),
      rejected: t("admin.dataRequests.rejected"),
    };
    return map[status] || status;
  };

  const handleProcessExport = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);

    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      let accessToken: string;

      if (refreshError || !session) {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (!fallbackSession) throw new Error("Not authenticated");
        accessToken = fallbackSession.access_token;
      } else {
        accessToken = session.access_token;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-data-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: "process",
          admin_notes: adminNotes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process export");
      }

      toast.success(t("admin.dataRequests.processed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process export");
    }

    setActionLoading(false);
    setViewDialogOpen(false);
    setSelectedRequest(null);
    setAdminNotes("");
    loadRequests();
  };

  const handleApproveDeletion = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);

    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      let accessToken: string;

      if (refreshError || !session) {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (!fallbackSession) throw new Error("Not authenticated");
        accessToken = fallbackSession.access_token;
      } else {
        accessToken = session.access_token;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ request_id: selectedRequest.id, user_id: selectedRequest.user_id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user data");
      }

      toast.success(t("admin.dataRequests.processed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user data");
    }

    setActionLoading(false);
    setViewDialogOpen(false);
    setSelectedRequest(null);
    setAdminNotes("");
    loadRequests();
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("data_requests")
      .update({
        status: "rejected",
        admin_notes: adminNotes || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast.error(error.message);
      setActionLoading(false);
      return;
    }

    toast.success(t("admin.dataRequests.rejectedSuccess"));

    await supabase.from("notifications").insert({
      user_id: selectedRequest.user_id,
      type: "data_request_completed",
      title: "Data Request Rejected",
      body: `Your ${selectedRequest.request_type} request has been rejected.`,
      data: { request_id: selectedRequest.id, type: selectedRequest.request_type, status: "rejected" },
      is_read: false,
    });

    setActionLoading(false);
    setViewDialogOpen(false);
    setSelectedRequest(null);
    setAdminNotes("");
    loadRequests();
  };

  const handleDownloadExport = (req: DataRequestWithJoins) => {
    if (!req.data_payload) return;
    const blob = new Blob([JSON.stringify(req.data_payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${req.user_id}-${new Date(req.completed_at || "").toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openViewDialog = (req: DataRequestWithJoins) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_notes || "");
    setViewDialogOpen(true);
  };

  return (
    <AdminPageWrapper>
      <PageHeader
        title={t("admin.dataRequests.title")}
        description={t("admin.dataRequests.subtitle")}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("admin.dataRequests.totalRequests")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">{t("admin.dataRequests.pendingExport")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingExport}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">{t("admin.dataRequests.pendingDeletion")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingDeletion}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={statusFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(filter)}
          >
            {filter === "all" ? t("admin.dataRequests.all") : getStatusLabel(filter)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{t("admin.loading")}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={t("admin.dataRequests.noRequests")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.dataRequests.user")}</TableHead>
                <TableHead>{t("admin.dataRequests.type")}</TableHead>
                <TableHead>{t("admin.dataRequests.status")}</TableHead>
                <TableHead>{t("admin.dataRequests.requestedAt")}</TableHead>
                <TableHead>{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.user_email || req.user_id}</TableCell>
                  <TableCell>
                    <Badge className={req.request_type === "export" ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400"}>
                      {req.request_type === "export" ? t("admin.dataRequests.export") : t("admin.dataRequests.delete")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[req.status] || ""}>
                      {getStatusLabel(req.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(req.requested_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => openViewDialog(req)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {req.request_type === "export" && req.status === "completed" && req.data_payload && (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDownloadExport(req)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.dataRequests.title")}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.dataRequests.user")}</p>
                  <p className="text-sm font-medium">{selectedRequest.user_email || selectedRequest.user_id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.dataRequests.type")}</p>
                  <Badge className={selectedRequest.request_type === "export" ? "bg-blue-500/10 text-blue-600" : "bg-red-500/10 text-red-600"}>
                    {selectedRequest.request_type === "export" ? t("admin.dataRequests.export") : t("admin.dataRequests.delete")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.dataRequests.status")}</p>
                  <Badge className={STATUS_BADGE[selectedRequest.status] || ""}>
                    {getStatusLabel(selectedRequest.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.dataRequests.requestedAt")}</p>
                  <p className="text-sm">{new Date(selectedRequest.requested_at).toLocaleString()}</p>
                </div>
                {selectedRequest.completed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.dataRequests.completedAt")}</p>
                    <p className="text-sm">{new Date(selectedRequest.completed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("admin.dataRequests.adminNotes")}</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t("admin.dataRequests.adminNotesPlaceholder")}
                  rows={3}
                />
              </div>

              <DialogFooter className="flex gap-2 flex-wrap">
                {selectedRequest.status === "pending" && selectedRequest.request_type === "export" && (
                  <Button onClick={handleProcessExport} disabled={actionLoading}>
                    {actionLoading ? t("admin.loading") : t("admin.dataRequests.processExport")}
                  </Button>
                )}
                {selectedRequest.status === "pending" && selectedRequest.request_type === "delete" && (
                  <Button variant="destructive" onClick={handleApproveDeletion} disabled={actionLoading}>
                    {actionLoading ? t("admin.loading") : t("admin.dataRequests.approveDeletion")}
                  </Button>
                )}
                {selectedRequest.status === "pending" && (
                  <Button variant="outline" onClick={handleReject} disabled={actionLoading}>
                    {t("admin.dataRequests.reject")}
                  </Button>
                )}
                {selectedRequest.request_type === "export" && selectedRequest.status === "completed" && selectedRequest.data_payload && (
                  <Button variant="outline" onClick={() => handleDownloadExport(selectedRequest)}>
                    <Download className="h-4 w-4 me-1" />
                    {t("admin.dataRequests.download")}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageWrapper>
  );
}
