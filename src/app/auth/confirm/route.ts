import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email "magic link" / PKCE-style confirmations by exchanging token_hash for a session.
 *
 * Expected URL shape (recommended email template):
 *   /auth/confirm?token_hash=...&type=email&next=/app
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/app";

  if (!token_hash || !type) {
    const to = new URL("/login", req.url);
    to.searchParams.set("error", "missing_token");
    return NextResponse.redirect(to);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as any,
  });

  if (error) {
    const to = new URL("/login", req.url);
    to.searchParams.set("error", "invalid_or_expired");
    return NextResponse.redirect(to);
  }

  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}


