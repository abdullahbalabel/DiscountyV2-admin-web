"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import type { PermissionResource, PermissionAction } from "@/lib/types";

interface PermissionRow {
  resource: string;
  action: string;
}

export function usePermissions() {
  const { adminRole } = useAuth();
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    // super_admin bypasses — no need to fetch
    if (adminRole === "super_admin") {
      setPermissions([]);
      setPermissionsLoading(false);
      return;
    }

    if (!adminRole) {
      setPermissions([]);
      setPermissionsLoading(false);
      return;
    }

    setPermissionsLoading(true);
    try {
      // Look up the role ID first, then fetch its permissions
      const { data: roleData, error: roleError } = await supabase
        .from("admin_roles")
        .select("id")
        .eq("name", adminRole)
        .single();

      if (roleError || !roleData) {
        console.error("Failed to fetch admin role:", roleError);
        setPermissions([]);
        setPermissionsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("admin_permissions")
        .select("resource, action")
        .eq("role_id", roleData.id);

      if (error) {
        console.error("Failed to fetch permissions:", error);
        setPermissions([]);
      } else {
        setPermissions(data || []);
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, [adminRole]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useMemo(() => {
    return (resource: PermissionResource, action: PermissionAction): boolean => {
      // super_admin always has all permissions
      if (adminRole === "super_admin") return true;

      // No role or still loading — deny
      if (!adminRole) return false;

      // "manage" permission implies all other actions
      const hasManage = permissions.some(
        (p) => p.resource === resource && p.action === "manage"
      );
      if (hasManage) return true;

      return permissions.some(
        (p) => p.resource === resource && p.action === action
      );
    };
  }, [adminRole, permissions]);

  return { hasPermission, permissionsLoading };
}
