"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AdminRoleName } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  adminRole: AdminRoleName | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  adminRole: null,
  loading: true,
  isPasswordRecovery: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  forgotPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRoleName | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const mountedRef = useRef(true);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error || !data || data.role !== "admin") {
        setIsAdmin(false);
        setAdminRole(null);
        return false;
      }
      setIsAdmin(true);

      // Fetch admin profile to get role level
      const { data: profile } = await supabase
        .from("admin_profiles")
        .select("role_id, admin_roles(name)")
        .eq("user_id", userId)
        .single();

      if (profile?.admin_roles) {
        const roleData = Array.isArray(profile.admin_roles)
          ? profile.admin_roles[0]
          : profile.admin_roles;
        setAdminRole((roleData?.name as AdminRoleName) || "admin");
      } else {
        setAdminRole("admin");
      }
      return true;
    } catch {
      setIsAdmin(false);
      setAdminRole(null);
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mountedRef.current) return;

      if (error) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkAdminRole(session.user.id).then(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        if (window.location.pathname !== "/reset-password") {
          window.location.href = "/reset-password";
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = await checkAdminRole(user.id);
      if (!admin) {
        await supabase.auth.signOut();
        return { error: "accessDenied" };
      }
    }
    window.location.href = "/";
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminRole(null);
    window.location.href = "/login";
  };

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { error: error.message };
    setIsPasswordRecovery(false);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        adminRole,
        loading,
        isPasswordRecovery,
        signIn,
        signOut,
        forgotPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
