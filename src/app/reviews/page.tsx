"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { supabase } from "@/lib/supabase";
import { Review } from "@/lib/types";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Star, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ReviewsPage() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { page, pageSize, offset, nextPage, prevPage } = usePagination();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("reviews")
      .select(
        "*, provider:provider_profiles(business_name), customer:customer_profiles(display_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (ratingFilter !== "all") {
      query = query.eq("rating", parseInt(ratingFilter));
    }

    const { data, error, count } = await query;

    if (!error && data) {
      setTotalCount(count || 0);
      let filtered = data as unknown as Review[];
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.provider?.business_name?.toLowerCase().includes(s) ||
            r.customer?.display_name?.toLowerCase().includes(s) ||
            r.comment?.toLowerCase().includes(s)
        );
      }
      setReviews(filtered);
    }
    setLoading(false);
  }, [ratingFilter, debouncedSearch, offset, pageSize]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async () => {
    if (!selectedReview) return;

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", selectedReview.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("admin.delete"));
      setDeleteDialogOpen(false);
      setSelectedReview(null);
      fetchReviews();
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );

  return (
    <AdminPageWrapper>
      <div className="space-y-5">
        <PageHeader title={t("admin.reviews")} />

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
                value={ratingFilter}
                onValueChange={(v) => v && setRatingFilter(v)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("admin.rating")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 px-4">
              {loading ? (
                <TableSkeleton columns={7} />
              ) : reviews.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title={t("admin.noResults")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.provider")}</TableHead>
                      <TableHead>{t("admin.customer")}</TableHead>
                      <TableHead>{t("admin.rating")}</TableHead>
                      <TableHead>{t("admin.comment")}</TableHead>
                      <TableHead>{t("admin.reply")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead className="text-end">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => (
                      <TableRow
                        key={review.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {review.provider?.business_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {review.customer?.display_name || "—"}
                        </TableCell>
                        <TableCell>{renderStars(review.rating)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {review.comment || "—"}
                        </TableCell>
                        <TableCell>
                          {review.provider_reply ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border-none">
                              {t("admin.reply")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("admin.noReply")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell dir="ltr" className="text-muted-foreground text-xs">
                          {new Date(review.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedReview(review);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedReview(review);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* View Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.review")}</DialogTitle>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.provider")}
                    </span>
                    <p className="text-sm font-medium">
                      {selectedReview.provider?.business_name || "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.customer")}
                    </span>
                    <p className="text-sm">{selectedReview.customer?.display_name || "—"}</p>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.rating")}
                  </span>
                  <div>{renderStars(selectedReview.rating)}</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">
                    {t("admin.comment")}
                  </span>
                  <p className="text-sm">{selectedReview.comment || "—"}</p>
                </div>
                {selectedReview.provider_reply && (
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("admin.reply")}
                    </span>
                    <p className="text-sm">{selectedReview.provider_reply}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.delete") || "Delete Review"}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("admin.deleteConfirm") || "Are you sure you want to delete this review?"}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t("admin.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("admin.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminPageWrapper>
  );
}
