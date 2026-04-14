import { z } from "zod";

export const dealSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  status: z.enum(["draft", "active", "paused", "deleted"]),
});

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "English name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  name_ar: z
    .string()
    .min(1, "Arabic name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  icon: z
    .string()
    .max(50, "Icon must be less than 50 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  sort_order: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
});

export const notificationSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  body: z
    .string()
    .min(1, "Body is required")
    .max(1000, "Body must be less than 1000 characters")
    .trim(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const customerEditSchema = z.object({
  display_name: z
    .string()
    .max(100, "Display name must be less than 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  preferences: z.string().optional().or(z.literal("")),
  is_banned: z.boolean(),
});

export const providerEditSchema = z.object({
  business_name: z
    .string()
    .min(1, "Business name is required")
    .max(200, "Business name must be less than 200 characters")
    .trim(),
  category: z
    .string()
    .min(1, "Category is required")
    .max(100, "Category must be less than 100 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone must be less than 20 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .max(500, "Website must be less than 500 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  approval_status: z.enum(["pending", "approved", "rejected"]),
  logo_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  cover_photo_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .nullable()
    .optional(),
  social_instagram: z.string().max(200).optional().or(z.literal("")),
  social_facebook: z.string().max(200).optional().or(z.literal("")),
  social_tiktok: z.string().max(200).optional().or(z.literal("")),
  social_x: z.string().max(200).optional().or(z.literal("")),
  social_snapchat: z.string().max(200).optional().or(z.literal("")),
});

export const adminUserSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
  full_name: z
    .string()
    .max(200, "Name must be less than 200 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  role_id: z.string().min(1, "Role is required"),
  is_active: z.boolean(),
});

export const adminGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  role_id: z.string().min(1, "Role is required"),
});

export const subscriptionPlanSchema = z.object({
  name: z.string().min(1, "Required").max(50),
  name_ar: z.string().min(1, "مطلوب").max(50),
  description: z.string().max(200).optional().or(z.literal("")),
  description_ar: z.string().max(200).optional().or(z.literal("")),
  max_active_deals: z.coerce.number().int().min(1).max(999),
  max_featured_deals: z.coerce.number().int().min(0).max(99),
  has_analytics: z.boolean(),
  max_push_notifications: z.coerce.number().int().min(0).max(999),
  has_priority_support: z.boolean(),
  profile_badge: z.string().max(20).optional().or(z.literal("")),
  profile_badge_ar: z.string().max(20).optional().or(z.literal("")),
  has_homepage_placement: z.boolean(),
  monthly_price_sar: z.coerce.number().min(0).optional().nullable(),
  yearly_price_sar: z.coerce.number().min(0).optional().nullable(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});

export const dealConditionSchema = z.object({
  name: z.string().min(1).max(100),
  name_ar: z.string().min(1).max(100),
  icon: z.string().min(1),
  category: z.enum(['time', 'quantity', 'scope', 'payment', 'other']),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
});

export const rejectionReportReviewSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
  admin_notes: z.string().max(500).optional(),
});

export const dataRequestReviewSchema = z.object({
  action: z.enum(['process', 'reject']),
  admin_notes: z.string().max(500).optional(),
});

export type DealInput = z.infer<typeof dealSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type NotificationInput = z.infer<typeof notificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerEditInput = z.infer<typeof customerEditSchema>;
export type ProviderEditInput = z.infer<typeof providerEditSchema>;
export type AdminUserInput = z.infer<typeof adminUserSchema>;
export type AdminGroupInput = z.infer<typeof adminGroupSchema>;
export type DealConditionInput = z.infer<typeof dealConditionSchema>;
export type RejectionReportReviewInput = z.infer<typeof rejectionReportReviewSchema>;
export type DataRequestReviewInput = z.infer<typeof dataRequestReviewSchema>;
export type SubscriptionPlanInput = z.infer<typeof subscriptionPlanSchema>;
