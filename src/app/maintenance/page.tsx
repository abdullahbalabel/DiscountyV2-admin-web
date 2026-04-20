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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  ShieldAlert,
  Power,
  PowerOff,
  Clock,
  History,
  XCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

interface MaintenanceStatus {
  is_enabled: boolean;
  message_title: string;
  message_body: string;
  estimated_duration: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  performed_by: string | null;
  performed_at: string;
  details: Record<string, unknown> | null;
  performer_name?: string | null;
}

type MaintenanceState = "Active" | "Scheduled" | "Inactive";

function getMaintenanceState(status: MaintenanceStatus | null): MaintenanceState {
  if (!status) return "Inactive";
  if (status.is_enabled) return "Active";
  if (status.scheduled_start && status.scheduled_end) return "Scheduled";
  return "Inactive";
}

function toDatetimeLocal(utcString: string | null): string {
  if (!utcString) return "";
  const date = new Date(utcString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toUTCString(localDatetime: string): string | null {
  if (!localDatetime) return null;
  const date = new Date(localDatetime);
  return date.toISOString();
}

export default function MaintenancePage() {
  const { t } = useTranslation();
  const { hasPermission, permissionsLoading } = usePermissions();
  const canManage = hasPermission("maintenance", "manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // Form state
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  // Dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_maintenance_status");
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const statusData = data as MaintenanceStatus;
      setStatus(statusData);
      setMessageTitle(statusData.message_title || "");
      setMessageBody(statusData.message_body || "");
      setEstimatedDuration(statusData.estimated_duration || "");
      setScheduledStart(toDatetimeLocal(statusData.scheduled_start));
      setScheduledEnd(toDatetimeLocal(statusData.scheduled_end));
    } catch {
      toast.error(t("admin.maintenanceFetchError"));
    }
    setLoading(false);
  }, [t]);

  const fetchAuditLog = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("resource_type", "maintenance")
        .order("performed_at", { ascending: false })
        .limit(50);
      if (error || !data) return;

      // Fetch admin names for unique performer IDs
      const performerIds = [...new Set(data.map((e: AuditEntry) => e.performed_by).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (performerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("admin_profiles")
          .select("user_id, full_name")
          .in("user_id", performerIds);
        if (profiles) {
          nameMap = Object.fromEntries(profiles.map((p: { user_id: string; full_name: string | null }) => [p.user_id, p.full_name || ""]));
        }
      }

      const enriched = data.map((entry: AuditEntry) => ({
        ...entry,
        performer_name: entry.performed_by ? nameMap[entry.performed_by] || null : null,
      }));
      setAuditLog(enriched);
    } catch {
      // Audit log fetch is non-critical
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAuditLog();
  }, [fetchStatus, fetchAuditLog]);

  const handleToggle = async () => {
    if (scheduledStart && scheduledEnd && scheduledEnd <= scheduledStart) {
      toast.error(t("admin.maintenanceScheduleOrderError"));
      setToggleDialogOpen(false);
      return;
    }
    setSaving(true);
    try {
      const newEnabled = !status?.is_enabled;
      const { error } = await supabase.rpc("set_maintenance_settings", {
        p_is_enabled: newEnabled,
        p_message_title: messageTitle,
        p_message_body: messageBody,
        p_estimated_duration: estimatedDuration || null,
        p_scheduled_start: toUTCString(scheduledStart),
        p_scheduled_end: toUTCString(scheduledEnd),
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          newEnabled
            ? t("admin.maintenanceEnabled")
            : t("admin.maintenanceDisabled")
        );
        await fetchStatus();
        await fetchAuditLog();
      }
    } catch {
      toast.error(t("admin.maintenanceToggleError"));
    }
    setSaving(false);
    setToggleDialogOpen(false);
  };

  const handleSaveSettings = async () => {
    if (scheduledStart && scheduledEnd && scheduledEnd <= scheduledStart) {
      toast.error(t("admin.maintenanceScheduleOrderError"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_maintenance_settings", {
        p_is_enabled: status?.is_enabled ?? false,
        p_message_title: messageTitle,
        p_message_body: messageBody,
        p_estimated_duration: estimatedDuration || null,
        p_scheduled_start: toUTCString(scheduledStart),
        p_scheduled_end: toUTCString(scheduledEnd),
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.maintenanceSettingsSaved"));
        setSettingsDialogOpen(false);
        await fetchStatus();
        await fetchAuditLog();
      }
    } catch {
      toast.error(t("admin.maintenanceSaveError"));
    }
    setSaving(false);
  };

  const handleCancelScheduled = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("cancel_scheduled_maintenance");
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("admin.maintenanceScheduledCancelled"));
        setScheduledStart("");
        setScheduledEnd("");
        await fetchStatus();
        await fetchAuditLog();
      }
    } catch {
      toast.error(t("admin.maintenanceCancelError"));
    }
    setSaving(false);
    setCancelDialogOpen(false);
  };

  const maintenanceState = getMaintenanceState(status);

  if (!permissionsLoading && !canManage) {
    return (
      <AdminPageWrapper>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ShieldAlert className="h-12 w-12" />
          <p className="text-lg font-medium">
            {t("admin.noPermission")}
          </p>
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.maintenanceSettings")} />

        {/* Status Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                {loading ? (
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : maintenanceState === "Active" ? (
                  <Power className="h-5 w-5 text-amber-500" />
                ) : maintenanceState === "Scheduled" ? (
                  <Clock className="h-5 w-5 text-blue-500" />
                ) : (
                  <PowerOff className="h-5 w-5 text-emerald-500" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.maintenanceStatus")}
                  </p>
                  <Badge
                    className={
                      maintenanceState === "Active"
                        ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none"
                        : maintenanceState === "Scheduled"
                        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-none"
                        : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                    }
                  >
                    {maintenanceState === "Active"
                      ? t("admin.maintenanceActive")
                      : maintenanceState === "Scheduled"
                      ? t("admin.maintenanceScheduled")
                      : t("admin.maintenanceInactive")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("admin.maintenanceScheduledStart")}
                </p>
                <p className="text-sm font-medium" dir="ltr">
                  {status?.scheduled_start
                    ? new Date(status.scheduled_start).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("admin.maintenanceScheduledEnd")}
                </p>
                <p className="text-sm font-medium" dir="ltr">
                  {status?.scheduled_end
                    ? new Date(status.scheduled_end).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 animate-fade-in stagger-1">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsDialogOpen(true)}
              disabled={saving || loading}
            >
              <Settings className="h-3.5 w-3.5 me-1.5" />
              {t("admin.maintenanceSettings")}
            </Button>
          )}
          {maintenanceState === "Scheduled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              disabled={saving || loading}
            >
              <XCircle className="h-3.5 w-3.5 me-1.5" />
              {t("admin.maintenanceCancelScheduled")}
            </Button>
          )}
          <Button
            variant={status?.is_enabled ? "destructive" : "default"}
            size="sm"
            onClick={() => setToggleDialogOpen(true)}
            disabled={saving || loading}
          >
            {status?.is_enabled ? (
              <>
                <PowerOff className="h-3.5 w-3.5 me-1.5" />
                {t("admin.maintenanceDisable")}
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5 me-1.5" />
                {t("admin.maintenanceEnable")}
              </>
            )}
          </Button>
        </div>

        {/* Audit Log */}
        <Card className="animate-fade-in stagger-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t("admin.maintenanceAuditLog")}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">{t("admin.maintenanceNoHistory")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.maintenanceAction")}</TableHead>
                      <TableHead>{t("admin.maintenanceHistoryTitle")}</TableHead>
                      <TableHead>{t("admin.maintenanceHistoryWindow")}</TableHead>
                      <TableHead>{t("admin.maintenancePerformedBy")}</TableHead>
                      <TableHead>{t("admin.maintenancePerformedAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((entry) => {
                      const details = entry.details as Record<string, unknown> | null;
                      const title = details?.message_title as string | undefined;
                      const schedStart = details?.scheduled_start as string | undefined;
                      const schedEnd = details?.scheduled_end as string | undefined;
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge
                              className={
                                entry.action === "maintenance_enabled"
                                  ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-none"
                                  : entry.action === "maintenance_schedule_updated" || entry.action === "maintenance_schedule_cancelled"
                                  ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border-none"
                                  : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none"
                              }
                            >
                              {entry.action === "maintenance_enabled"
                                ? t("admin.maintenanceEnabled_action")
                                : entry.action === "maintenance_disabled"
                                ? t("admin.maintenanceDisabled_action")
                                : entry.action === "maintenance_schedule_updated"
                                ? t("admin.maintenanceScheduleUpdated_action")
                                : entry.action === "maintenance_schedule_cancelled"
                                ? t("admin.maintenanceScheduleCancelled_action")
                                : entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {title || "—"}
                          </TableCell>
                          <TableCell dir="ltr" className="text-xs whitespace-nowrap">
                            {schedStart && schedEnd
                              ? `${new Date(schedStart).toLocaleString()} → ${new Date(schedEnd).toLocaleString()}`
                              : schedStart
                              ? new Date(schedStart).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {entry.performer_name || (entry.performed_by
                              ? entry.performed_by.slice(0, 8) + "..."
                              : "—")}
                          </TableCell>
                          <TableCell dir="ltr">
                            {new Date(entry.performed_at).toLocaleString()}
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

        {/* Toggle Confirmation Dialog */}
        <Dialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {status?.is_enabled
                  ? t("admin.maintenanceDisable")
                  : t("admin.maintenanceEnable")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {status?.is_enabled
                ? t("admin.maintenanceDisableConfirm")
                : t("admin.maintenanceEnableConfirm")}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setToggleDialogOpen(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button
                variant={status?.is_enabled ? "destructive" : "default"}
                onClick={handleToggle}
                disabled={saving}
              >
                {saving
                  ? t("admin.saving")
                  : t("admin.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Scheduled Confirmation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("admin.maintenanceCancelScheduled")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("admin.maintenanceCancelScheduledConfirm")}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelScheduled}
                disabled={saving}
              >
                {saving
                  ? t("admin.saving")
                  : t("admin.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("admin.maintenanceSettings")}</DialogTitle>
              <DialogDescription>
                {t("admin.maintenanceSettingsDescription")}
              </DialogDescription>
            </DialogHeader>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Message Title */}
                <div className="space-y-1.5">
                  <Label>{t("admin.maintenanceMessageTitle")}</Label>
                  <Input
                    value={messageTitle}
                    onChange={(e) => setMessageTitle(e.target.value)}
                    disabled={!canManage}
                    placeholder="Scheduled Maintenance"
                  />
                </div>

                {/* Message Body */}
                <div className="space-y-1.5">
                  <Label>{t("admin.maintenanceMessageBody")}</Label>
                  <textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    disabled={!canManage}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Estimated Duration */}
                <div className="space-y-1.5">
                  <Label>{t("admin.maintenanceEstimatedDuration")}</Label>
                  <Input
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    disabled={!canManage}
                    placeholder="2 hours"
                  />
                </div>

                {/* Scheduled Start/End */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("admin.maintenanceScheduledStart")}</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={(e) => setScheduledStart(e.target.value)}
                      disabled={!canManage}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.maintenanceScheduledEnd")}</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledEnd}
                      onChange={(e) => setScheduledEnd(e.target.value)}
                      disabled={!canManage}
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSettingsDialogOpen(false)}
              >
                {t("admin.cancel")}
              </Button>
              <Button onClick={handleSaveSettings} disabled={saving || loading}>
                {saving
                  ? t("admin.saving")
                  : t("admin.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
