import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class BillingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function consumeCredits(args: { userId: string; amount: number }) {
  const admin = createSupabaseAdminClient();

  try {
    const { data, error } = await admin.rpc("consume_credits", {
      p_user_id: args.userId,
      p_amount: args.amount,
    });
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("insufficient_credits")) throw new BillingError("insufficient_credits", "Insufficient credits.");
      if (msg.includes("no_active_credit_period"))
        throw new BillingError("no_active_credit_period", "No active credit period. Subscribe to continue.");
      if (msg.includes("subscription_not_active"))
        throw new BillingError("subscription_not_active", "Subscription is not active. Please subscribe or update payment method.");
      if (msg.includes("invalid_amount")) throw new BillingError("invalid_amount", "Invalid credit amount.");
      if (msg.toLowerCase().includes("function") && msg.toLowerCase().includes("consume_credits"))
        throw new BillingError(
          "billing_not_configured",
          "Billing is not configured in the database yet. Apply docs/billing-schema.sql in Supabase."
        );
      throw new BillingError("billing_error", error.message);
    }

    return data as any;
  } catch (e: any) {
    if (e instanceof BillingError) throw e;
    throw new BillingError("billing_error", e?.message || "Billing error");
  }
}

export async function refundCredits(args: { periodId: string; amount: number }) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("refund_credits", {
    p_period_id: args.periodId,
    p_amount: args.amount,
  });
  if (error) return null;
  return data as any;
}

export async function getBillingStatus(args: { userId: string }) {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const sub = await admin
    .from("billing_subscriptions")
    .select("plan_code,status,current_period_start,current_period_end,cancel_at_period_end,updated_at")
    .eq("user_id", args.userId)
    .maybeSingle();

  const credits = await admin
    .from("billing_credit_periods")
    .select("period_start,period_end,credits_total,credits_used,plan_code")
    .eq("user_id", args.userId)
    .lte("period_start", nowIso)
    .gt("period_end", nowIso)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const creditRow = credits.data || null;

  return {
    subscription: sub.data || null,
    credits: creditRow
      ? {
          planCode: creditRow.plan_code,
          periodStart: creditRow.period_start,
          periodEnd: creditRow.period_end,
          total: creditRow.credits_total,
          used: creditRow.credits_used,
          remaining: Math.max(0, (creditRow.credits_total || 0) - (creditRow.credits_used || 0)),
        }
      : null,
  };
}


