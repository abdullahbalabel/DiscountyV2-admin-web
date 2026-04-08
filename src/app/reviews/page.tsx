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
          className={`h-4 w-4 ${
            i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );

  return (
    <AdminPageWrapper>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">{t("admin.reviews")}</h2>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
                  <Input
                    placeholder={t("admin.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ltr:pl-9 rtl:pr-9"
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.provider")}</TableHead>
                      <TableHead>{t("admin.customer")}</TableHead>
                      <TableHead>{t("admin.rating")}</TableHead>
                      <TableHead>{t("admin.comment")}</TableHead>
                      <TableHead>{t("admin.reply")}</TableHead>
                      <TableHead>{t("admin.createdAt")}</TableHead>
                      <TableHead>{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          {t("admin.loading")}
                        </TableCell>
                      </TableRow>
                    ) : reviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">
                          {t("admin.noResults")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      reviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell className="font-medium">
                            {review.provider?.business_name || "—"}
                          </TableCell>
                          <TableCell>
                            {review.customer?.display_name || "—"}
                          </TableCell>
                          <TableCell>{renderStars(review.rating)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {review.comment || "—"}
                          </TableCell>
                          <TableCell>
                            {review.provider_reply ? (
                              <Badge variant="secondary">
                                {t("admin.reply")}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {t("admin.noReply")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell dir="ltr">
                            {new Date(review.created_at).toLocaleDateString()}
                          </TableCell>
                           <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedReview(review);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedReview(review);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {totalCount > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.review")}</DialogTitle>
              </DialogHeader>
              {selectedReview && (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.provider")}:
                    </span>
                    <p className="font-medium">
                      {selectedReview.provider?.business_name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.customer")}:
                    </span>
                    <p>{selectedReview.customer?.display_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.rating")}:
                    </span>
                    <div>{renderStars(selectedReview.rating)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.comment")}:
                    </span>
                    <p>{selectedReview.comment || "—"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.reply")}:
                    </span>
                    <p>{selectedReview.provider_reply || t("admin.noReply")}</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("admin.cancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.delete") || "Delete Review"}</DialogTitle>
              </DialogHeader>
              <p>{t("admin.deleteConfirm") || "Are you sure you want to delete this review?"}</p>
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
