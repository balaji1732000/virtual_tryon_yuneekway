import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDodoClient } from "@/lib/dodo";
import { ensureCurrentMonthlyCredits } from "@/lib/billing/periods";
import { getPlan, PlanCode } from "@/lib/billing/plans";

function header(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdminClient();
  const dodo = getDodoClient();

  const payload = await req.text();
  const webhookId = header(req, "webhook-id");
  const webhookSignature = header(req, "webhook-signature");
  const webhookTimestamp = header(req, "webhook-timestamp");

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  let evt: any;
  try {
    evt = (dodo as any).webhooks.unwrap({
      payload,
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid webhook signature" }, { status: 400 });
  }

  const eventType = String(evt?.type || evt?.event_type || evt?.name || "");
  const eventId = String(evt?.id || webhookId);

  // Idempotency
  const ins = await admin.from("billing_webhook_events").insert({
    event_id: eventId,
    event_type: eventType || null,
    payload: evt,
  });
  if (ins.error) {
    // Duplicate -> already processed
    if (String(ins.error.message || "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // If table missing, surface a helpful error.
    if (String(ins.error.message || "").toLowerCase().includes("billing_webhook_events")) {
      return NextResponse.json({ error: "Billing tables not configured. Apply docs/billing-schema.sql in Supabase." }, { status: 500 });
    }
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  // We currently only react to subscription lifecycle events.
  if (!eventType.startsWith("subscription.")) return NextResponse.json({ received: true });

  const sub = evt?.data?.subscription || evt?.data || evt?.subscription || null;
  if (!sub) return NextResponse.json({ received: true });

  const dodoCustomerId = String(sub?.customer?.customer_id || sub?.customer_id || "");
  const dodoSubscriptionId = String(sub?.subscription_id || sub?.id || "");
  const status = String(sub?.status || "").toLowerCase() || "unknown";
  const planCode = String(sub?.metadata?.plan_code || evt?.data?.metadata?.plan_code || "") as PlanCode;
  const nextBillingDate = sub?.next_billing_date ? String(sub.next_billing_date) : null;

  let userId = String(sub?.metadata?.supabase_user_id || evt?.data?.metadata?.supabase_user_id || "");
  if (!userId && dodoCustomerId) {
    const map = await admin.from("billing_customers").select("user_id").eq("dodo_customer_id", dodoCustomerId).maybeSingle();
    if (map.data?.user_id) userId = String(map.data.user_id);
  }

  if (!userId) return NextResponse.json({ received: true, skipped: "unmapped_user" });

  // Ensure plan_code is valid (must exist in our config)
  const plan = planCode ? getPlan(planCode) : null;
  if (!plan) {
    // Keep state, but do not create credits if we can't determine plan.
    await admin.from("billing_subscriptions").upsert(
      {
        user_id: userId,
        plan_code: planCode || "starter_monthly",
        status,
        dodo_subscription_id: dodoSubscriptionId || null,
        current_period_end: nextBillingDate,
        updated_at: new Date().toISOString(),
        metadata: { raw: sub?.metadata || {} },
      } as any,
      { onConflict: "user_id" }
    );
    return NextResponse.json({ received: true, skipped: "unknown_plan_code" });
  }

  await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan_code: plan.code,
      status,
      dodo_subscription_id: dodoSubscriptionId || null,
      dodo_product_id: sub?.product_id ? String(sub.product_id) : null,
      current_period_end: nextBillingDate,
      cancel_at_period_end: !!sub?.cancel_at_period_end,
      updated_at: new Date().toISOString(),
      metadata: { ...(sub?.metadata || {}), event_type: eventType },
    } as any,
    { onConflict: "user_id" }
  );

  // Create/refresh monthly credits only when active.
  if (status === "active") {
    await ensureCurrentMonthlyCredits({ admin, userId, planCode: plan.code });
  }

  return NextResponse.json({ received: true });
}


