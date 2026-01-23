import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentMonthlyCredits } from "@/lib/billing/periods";
import { getPlan, PlanCode } from "@/lib/billing/plans";

export async function GET(req: NextRequest) {
  const secret = process.env.BILLING_CRON_SECRET || "";
  const token = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("token") || "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("billing_subscriptions").select("user_id,plan_code,status").eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let ok = 0;
  let skipped = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const row of data || []) {
    const userId = String((row as any).user_id);
    const planCode = String((row as any).plan_code) as PlanCode;
    if (!getPlan(planCode)) {
      skipped++;
      continue;
    }
    try {
      await ensureCurrentMonthlyCredits({ admin, userId, planCode });
      ok++;
    } catch (e: any) {
      errors.push({ userId, error: e?.message || "unknown" });
    }
  }

  return NextResponse.json({ ok, skipped, errorsCount: errors.length, errors });
}


