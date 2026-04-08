import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check .env.local file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:
      typeof window !== "undefined"
        ? localStorage
        : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
