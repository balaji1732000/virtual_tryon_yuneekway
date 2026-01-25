import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Use 303 so the browser follows the redirect with GET (prevents POST /login -> 405).
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

// Optional hardening: allow direct navigation to /auth/logout without 405.
export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}


