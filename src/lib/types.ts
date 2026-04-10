export type ApprovalStatus = "pending" | "approved" | "rejected";
export type DealStatus = "draft" | "active" | "paused" | "deleted";
export type DiscountType = "percentage" | "fixed";
export type RedemptionStatus = "claimed" | "redeemed" | "expired";
export type UserRole = "customer" | "provider" | "admin";

export interface ProviderProfile {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  approval_status: ApprovalStatus;
  phone: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
  business_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  average_rating: number;
  total_reviews: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: string[] | null;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  name_ar: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Discount {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  discount_value: number;
  type: DiscountType;
  category_id: string | null;
  image_url: string | null;
  start_time: string;
  end_time: string;
  status: DealStatus;
  max_redemptions: number;
  current_redemptions: number;
  view_count: number;
  alphanumeric_code: string;
  created_at: string;
  updated_at: string;
  provider?: ProviderProfile;
  category?: Category;
}

export interface Redemption {
  id: string;
  discount_id: string;
  customer_id: string;
  qr_code_hash: string;
  status: RedemptionStatus;
  claimed_at: string;
  redeemed_at: string | null;
  discount?: Discount;
  customer?: CustomerProfile;
}

export interface Review {
  id: string;
  provider_id: string;
  customer_id: string;
  redemption_id: string;
  rating: number;
  comment: string | null;
  provider_reply: string | null;
  created_at: string;
  replied_at: string | null;
  provider?: ProviderProfile;
  customer?: CustomerProfile;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ============================================================
// Admin Management Types
// ============================================================

export type AdminRoleName = "super_admin" | "admin" | "moderator";
export type PermissionAction = "view" | "create" | "edit" | "delete" | "manage";
export type PermissionResource =
  | "providers"
  | "deals"
  | "customers"
  | "categories"
  | "reviews"
  | "notifications"
  | "admin_users"
  | "groups";

export interface AdminRole {
  id: string;
  name: AdminRoleName;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role_id: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role?: AdminRole;
}

export interface AdminGroup {
  id: string;
  name: string;
  description: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
  role?: AdminRole;
  member_count?: number;
}

export interface AdminGroupMember {
  id: string;
  group_id: string;
  admin_profile_id: string;
  created_at: string;
  admin_profile?: AdminProfile;
  group?: AdminGroup;
}

export interface AdminPermission {
  id: string;
  role_id: string;
  resource: PermissionResource;
  action: PermissionAction;
  created_at: string;
}

export interface AdminProfileWithDetails extends AdminProfile {
  email?: string;
  groups?: AdminGroup[];
  permissions?: AdminPermission[];
}
