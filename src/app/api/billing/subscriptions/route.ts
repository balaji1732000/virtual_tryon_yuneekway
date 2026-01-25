import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "dodopayments";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDodoClient } from "@/lib/dodo";
import { getPlan, getDodoProductIdForPlan, PlanCode } from "@/lib/billing/plans";

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const planCode = String(body?.planCode || "").trim() as PlanCode;
    const country = String(body?.country || "US").trim().toUpperCase();

    const plan = getPlan(planCode);
    if (!plan) return NextResponse.json({ error: "Invalid planCode" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const dodo = getDodoClient();

    // Ensure Dodo customer exists.
    let dodoCustomerId: string | null = null;
    const existing = await admin.from("billing_customers").select("dodo_customer_id, metadata").eq("user_id", user.id).maybeSingle();
    if (existing.data?.dodo_customer_id) {
      dodoCustomerId = existing.data.dodo_customer_id;
    } else {
      if (!user.email) return NextResponse.json({ error: "User email missing" }, { status: 400 });
      const name = String((user.user_metadata as any)?.name || (user.user_metadata as any)?.full_name || user.email);
      const customer = await (dodo as any).customers.create({
        email: user.email,
        name,
        metadata: { supabase_user_id: user.id },
      });
      dodoCustomerId = String(customer.customer_id);
      await admin
        .from("billing_customers")
        .upsert({ user_id: user.id, dodo_customer_id: dodoCustomerId, metadata: { email: user.email } }, { onConflict: "user_id" });
    }

    const productId = getDodoProductIdForPlan(plan);
    const origin = req.headers.get("origin") || "";
    const returnUrl = origin ? `${origin}/app/billing` : null;

    // Recommended approach (per Dodo docs): create a checkout session for subscriptions.
    const checkout = await (dodo as any).checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { customer_id: dodoCustomerId },
      subscription_data: { trial_period_days: 0 },
      // let checkout collect billing details; minimal_address helps reduce friction when confirm is used.
      minimal_address: true,
      ...(returnUrl ? { return_url: returnUrl } : {}),
      metadata: {
        supabase_user_id: user.id,
        plan_code: plan.code,
        country,
      },
    });

    // Store checkout session ID in customer metadata for later retrieval during sync
    const currentMetadata = existing.data?.metadata || {};
    await admin
      .from("billing_customers")
      .update({ metadata: { ...currentMetadata, last_checkout_session_id: checkout.session_id } })
      .eq("user_id", user.id);

    return NextResponse.json({
      planCode: plan.code,
      sessionId: checkout.session_id,
      checkoutUrl: checkout.checkout_url,
    });
  } catch (e: any) {
    // Dodo auth failures are common when using a test key against live_mode.
    if (e instanceof AuthenticationError || e?.status === 401) {
      return NextResponse.json(
        {
          error:
            "Dodo API authentication failed (401). If you're using a TEST API key, set DODO_PAYMENTS_ENV=test_mode (or set DODO_PAYMENTS_BASE_URL=https://test.dodopayments.com). If using LIVE key, set DODO_PAYMENTS_ENV=live_mode.",
          code: "dodo_auth_failed",
        },
        { status: 401 }
      );
    }

    const msg = String(e?.message || "Failed to start subscription");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


