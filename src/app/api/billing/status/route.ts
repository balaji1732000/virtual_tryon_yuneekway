import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { getBillingStatus } from "@/lib/billing/credits";

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await getBillingStatus({ userId: user.id });
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load billing status" }, { status: 500 });
  }
}


