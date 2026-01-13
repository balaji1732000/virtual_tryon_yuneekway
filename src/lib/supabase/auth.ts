import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSupabaseAuthedClient(req: Request) {
  // 1) Try cookie-based auth (preferred for browser)
  const cookieClient = await createSupabaseServerClient();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();
  if (cookieUser) return { user: cookieUser, supabase: cookieClient };

  // 2) Try bearer token (useful for scripts/tests and server-to-server)
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return { user: null, supabase: cookieClient };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const bearerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser();

  return { user: bearerUser ?? null, supabase: bearerClient };
}






