import type { SupabaseClient } from "@supabase/supabase-js";
import { BILLING_PLANS, PlanCode } from "@/lib/billing/plans";

export function utcMonthRange(d: Date) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end };
}

export async function ensureCurrentMonthlyCredits(args: {
  admin: SupabaseClient;
  userId: string;
  planCode: PlanCode;
  now?: Date;
}) {
  const plan = (BILLING_PLANS as any)[args.planCode] as { monthlyCredits: number } | undefined;
  if (!plan) throw new Error(`Unknown planCode ${args.planCode}`);

  const now = args.now ?? new Date();
  const { start, end } = utcMonthRange(now);

  // Upsert monthly credit period; preserve credits_used if row already exists.
  const existing = await args.admin
    .from("billing_credit_periods")
    .select("id,credits_used")
    .eq("user_id", args.userId)
    .eq("period_start", start.toISOString())
    .eq("period_end", end.toISOString())
    .maybeSingle();

  const creditsUsed = existing.data?.credits_used ?? 0;
  const creditsTotal = plan.monthlyCredits;

  const up = await args.admin.from("billing_credit_periods").upsert(
    {
      ...(existing.data?.id ? { id: existing.data.id } : {}),
      user_id: args.userId,
      plan_code: args.planCode,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      credits_total: creditsTotal,
      credits_used: creditsUsed,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "user_id,period_start,period_end" }
  );

  if (up.error) throw new Error(up.error.message);

  return { periodStart: start.toISOString(), periodEnd: end.toISOString(), creditsTotal, creditsUsed };
}



