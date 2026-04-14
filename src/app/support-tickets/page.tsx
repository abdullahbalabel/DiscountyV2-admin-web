"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { SupportTicket, TicketMessage } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagination } from "@/hooks/use-pagination";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Eye, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function SupportTicketsPage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (ticketMessages.length > 0 || loadingMessages) {
      scrollToBottom();
    }
  }, [ticketMessages, loadingMessages, scrollToBottom]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select("*, provider:provider_profiles(business_name)", { count: "exact" })
      .order("is_priority", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (priorityFilter === "priority") {
      query = query.eq("is_priority", true);
    }

    const { data, error, count } = await query;

    if (!error && data) {
      setTotalCount(count || 0);
      let filtered = data as unknown as SupportTicket[];
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.subject?.toLowerCase().includes(s) ||
            t.message?.toLowerCase().includes(s) ||
            t.provider?.business_name?.toLowerCase().includes(s)
        );
      }
      setTickets(filtered);
    }
    setLoading(false);
  }, [statusFilter, priorityFilter, debouncedSearch, offset, pageSize]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const loadMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setTicketMessages((data || []) as TicketMessage[]);
    setLoadingMessages(false);
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user!.id,
        sender_role: "admin",
        message: replyText.trim(),
      });

    if (msgError) {
      toast.error(msgError.message);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("support_tickets")
      .update({
        admin_reply: replyText.trim(),
        status: "replied",
        replied_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.supportTickets.replySent"));
      setReplyText("");
      await loadMessages(selectedTicket.id);
      fetchTickets();
    }
    setSubmitting(false);
  };

  const handleClose = async () => {
    if (!selectedTicket) return;

    setSubmitting(true);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", selectedTicket.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.supportTickets.ticketClosed"));
      setDialogOpen(false);
      setReplyText("");
      setSelectedTicket(null);
      fetchTickets();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      replied: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      closed: "bg-muted text-muted-foreground",
    };
    return (
      <Badge className={`${styles[status] || styles.open} border-none`}>
        {t(`admin.supportTickets.${status}`)}
      </Badge>
    );
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.supportTickets.title")} />

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
              <Select
                value={statusFilter}
                onValueChange={(v) => v && setStatusFilter(v)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("admin.supportTickets.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.supportTickets.all")}</SelectItem>
                  <SelectItem value="open">{t("admin.supportTickets.open")}</SelectItem>
                  <SelectItem value="replied">{t("admin.supportTickets.replied")}</SelectItem>
                  <SelectItem value="closed">{t("admin.supportTickets.closed")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={priorityFilter}
                onValueChange={(v) => v && setPriorityFilter(v)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t("admin.supportTickets.priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.supportTickets.all")}</SelectItem>
                  <SelectItem value="priority">{t("admin.supportTickets.priorityOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={6} />
              ) : tickets.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={t("admin.supportTickets.noTickets")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.supportTickets.provider")}</TableHead>
                      <TableHead>{t("admin.supportTickets.subject")}</TableHead>
                      <TableHead>{t("admin.supportTickets.priority")}</TableHead>
                      <TableHead>{t("admin.supportTickets.status")}</TableHead>
                      <TableHead>{t("admin.supportTickets.createdAt")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {ticket.provider?.business_name || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {ticket.subject}
                        </TableCell>
                        <TableCell>
                          {ticket.is_priority ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none">
                              {t("admin.supportTickets.priorityBadge")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(ticket.status)}</TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setReplyText("");
                                loadMessages(ticket.id);
                                setDialogOpen(true);
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

        {totalCount > pageSize && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-xs text-muted-foreground">
              {t("admin.showing")} {offset + 1}-{Math.min(offset + pageSize, totalCount)} {t("admin.of")} {totalCount}
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

        {/* View / Reply Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
            {selectedTicket && (
              <>
                {/* Header */}
                <div className="flex items-start gap-3 p-4 pb-3 border-b">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {selectedTicket.provider?.business_name || "—"}
                      </p>
                      {selectedTicket.is_priority && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none">
                          {t("admin.supportTickets.priorityBadge")}
                        </Badge>
                      )}
                      {statusBadge(selectedTicket.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {selectedTicket.subject}
                    </p>
                  </div>
                </div>

                {/* Conversation - scrollable area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {/* Original message */}
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-semibold text-primary mb-1">
                      {selectedTicket.provider?.business_name || t("admin.supportTickets.provider")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5" dir="ltr">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  {loadingMessages ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("common.sending")}</p>
                  ) : (
                    ticketMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg p-3 ${
                          msg.sender_role === "admin"
                            ? "bg-primary/10 border-s-2 border-s-primary ms-4"
                            : "bg-background border me-4"
                        }`}
                      >
                        <p className={`text-xs font-semibold mb-1 ${
                          msg.sender_role === "admin" ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {msg.sender_role === "admin"
                            ? t("admin.supportTickets.adminYou")
                            : selectedTicket.provider?.business_name || t("admin.supportTickets.provider")}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5" dir="ltr">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply area - fixed at bottom */}
                {selectedTicket.status !== "closed" && (
                  <div className="border-t p-4">
                    <textarea
                      className="flex min-h-[60px] max-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder={t("admin.supportTickets.replyPlaceholder")}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        disabled={submitting}
                      >
                        {t("admin.supportTickets.closeTicket")}
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                          {t("admin.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleReply}
                          disabled={!replyText.trim() || submitting}
                        >
                          {submitting ? t("common.sending") : t("admin.supportTickets.sendReply")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Closed ticket footer */}
                {selectedTicket.status === "closed" && (
                  <div className="border-t p-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                      {t("admin.cancel")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
