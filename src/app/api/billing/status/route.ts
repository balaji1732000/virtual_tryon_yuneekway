import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDodoClient } from "@/lib/dodo";
import { ensureCurrentMonthlyCredits } from "@/lib/billing/periods";
import { getBillingStatus } from "@/lib/billing/credits";
import { getPlanCodeForProductId, PlanCode } from "@/lib/billing/plans";

async function syncSubscriptionFromDodo(userId: string, userEmail?: string): Promise<{ status: string; resolvedPlanCode: string; productId: string; source: string } | { error: string; code: string; details?: any } | null> {
  const admin = createSupabaseAdminClient();
  const dodo = getDodoClient();

  // Step 1: Verify customer ID exists in our database
  const map = await admin.from("billing_customers").select("dodo_customer_id, metadata").eq("user_id", userId).maybeSingle();
  let dodoCustomerId = map.data?.dodo_customer_id ? String(map.data.dodo_customer_id) : "";
  
  // Step 2: If no mapping exists, try to recover by looking up customer in Dodo by email
  if (!dodoCustomerId && userEmail) {
    console.log(`[billing/status] No customer mapping found, attempting recovery for email: ${userEmail}`);
    try {
      const customersList = await (dodo as any).customers.list({ email: userEmail, page_size: 5 });
      const customers = customersList?.getPaginatedItems ? customersList.getPaginatedItems() : (customersList?.items || []);
      
      if (customers && Array.isArray(customers) && customers.length > 0) {
        const customer = customers[0];
        dodoCustomerId = String(customer.customer_id);
        console.log(`[billing/status] Found existing Dodo customer ${dodoCustomerId} for email ${userEmail}`);
        
        // Save the mapping to our database
        await admin
          .from("billing_customers")
          .upsert(
            { 
              user_id: userId, 
              dodo_customer_id: dodoCustomerId, 
              metadata: { email: userEmail, recovered: true } 
            }, 
            { onConflict: "user_id" }
          );
        console.log(`[billing/status] Saved customer mapping for user ${userId}`);
      } else {
        console.log(`[billing/status] No Dodo customer found for email ${userEmail}`);
      }
    } catch (recoveryErr: any) {
      console.error(`[billing/status] Customer recovery failed:`, recoveryErr?.message);
    }
  }
  
  if (!dodoCustomerId) {
    console.log(`[billing/status] No Dodo customer ID found for user ${userId}`);
    return { 
      error: "No Dodo customer ID found. Please click Subscribe first to create a customer account, or contact support if you already paid.", 
      code: "no_customer_id" 
    };
  }

  console.log(`[billing/status] Syncing for customer ${dodoCustomerId}`);

  try {
    // Step 2: Try to get subscriptions directly
    let items: any[] = [];
    try {
      const listPromise = (dodo as any).subscriptions.list({ customer_id: dodoCustomerId, page_size: 10 });
      const listPage = await listPromise;
      items = listPage?.getPaginatedItems ? listPage.getPaginatedItems() : (listPage?.items || []);
      console.log(`[billing/status] Found ${items.length} subscription(s) via subscriptions.list()`);
    } catch (e: any) {
      console.error(`[billing/status] subscriptions.list() failed:`, e?.message || e);
    }

    // Step 3: If no subscriptions found, try checkout sessions fallback
    if (!items || !Array.isArray(items) || !items.length) {
      console.log(`[billing/status] No subscriptions found, checking checkout sessions...`);
      
      // Check if we have a stored checkout session ID in metadata
      const storedSessionId = map.data?.metadata?.last_checkout_session_id;
      
      if (storedSessionId) {
        try {
          const session = await (dodo as any).checkoutSessions.retrieve(storedSessionId);
          console.log(`[billing/status] Retrieved checkout session ${storedSessionId}:`, {
            payment_id: session?.payment_id,
            payment_status: session?.payment_status,
          });
          
          // If payment completed, subscription might have been created - try listing again
          if (session?.payment_id && session?.payment_status === "succeeded") {
            console.log(`[billing/status] Payment succeeded, re-checking subscriptions...`);
            try {
              const retryList = await (dodo as any).subscriptions.list({ customer_id: dodoCustomerId, page_size: 10 });
              items = retryList?.getPaginatedItems ? retryList.getPaginatedItems() : (retryList?.items || []);
              console.log(`[billing/status] After payment check, found ${items.length} subscription(s)`);
            } catch (retryErr: any) {
              console.error(`[billing/status] Retry subscriptions.list() failed:`, retryErr?.message);
            }
          }
        } catch (sessionErr: any) {
          console.error(`[billing/status] Failed to retrieve checkout session:`, sessionErr?.message);
        }
      }
    }

    // Step 4: Process subscriptions if found
    if (items && Array.isArray(items) && items.length > 0) {
      // Prioritize active, then pending, then latest
      const active = items.find((s: any) => String(s?.status || "").toLowerCase() === "active");
      const pending = items.find((s: any) => String(s?.status || "").toLowerCase() === "pending");
      const latest = items
        .slice()
        .sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0];
      
      const sub = active || pending || latest;
      if (!sub) return null;

      const status = String(sub?.status || "").toLowerCase() || "unknown";
      const productId = sub?.product_id ? String(sub.product_id) : "";
      const planCode = String(sub?.metadata?.plan_code || "") as PlanCode;
      const resolvedPlanCode = (planCode || getPlanCodeForProductId(productId)) as PlanCode | "";
      const planCodeToStore = resolvedPlanCode || "starter_monthly";

      console.log(`[billing/status] Syncing subscription: status=${status}, productId=${productId}, planCode=${planCode}, resolvedPlanCode=${resolvedPlanCode}`);

      await admin.from("billing_subscriptions").upsert(
        {
          user_id: userId,
          plan_code: planCodeToStore,
          status,
          dodo_subscription_id: sub?.subscription_id ? String(sub.subscription_id) : null,
          dodo_product_id: productId || null,
          current_period_end: sub?.next_billing_date ? String(sub.next_billing_date) : null,
          cancel_at_period_end: !!sub?.cancel_at_next_billing_date,
          updated_at: new Date().toISOString(),
          metadata: { ...(sub?.metadata || {}), product_id: productId, plan_code_unresolved: !resolvedPlanCode },
        } as any,
        { onConflict: "user_id" }
      );

      // Create credits for active OR pending subscriptions (pending will become active after payment processes)
      if ((status === "active" || status === "pending") && resolvedPlanCode) {
        console.log(`[billing/status] Creating credits for plan ${resolvedPlanCode} (status: ${status})`);
        await ensureCurrentMonthlyCredits({ admin, userId, planCode: resolvedPlanCode });
      }

      return { status, resolvedPlanCode, productId, source: "subscriptions.list" };
    }

    // Step 5: No subscriptions found - return detailed error
    console.log(`[billing/status] No subscriptions found for customer ${dodoCustomerId}`);
    return {
      error: `No subscriptions found for Dodo customer ${dodoCustomerId}. If you just completed payment, it may take a few moments for the subscription to be created. Please wait a moment and try again, or check your Dodo dashboard.`,
      code: "no_subscription_found",
      details: { customer_id: dodoCustomerId },
    };
  } catch (e: any) {
    console.error(`[billing/status] Failed to sync from Dodo:`, e?.message || e);
    return {
      error: `Dodo API error: ${e?.message || "Unknown error"}`,
      code: "dodo_api_error",
      details: { message: e?.message, stack: e?.stack },
    };
  }
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let status = await getBillingStatus({ userId: user.id });

    // Best-effort sync from Dodo when credits or subscription are missing (common in local dev without webhooks).
    if (!status.subscription || !status.credits) {
      console.log(`[billing/status] Missing subscription or credits, syncing from Dodo for user ${user.id}`);
      const syncResult = await syncSubscriptionFromDodo(user.id, user.email);
      
      // If sync returned an error, log it but don't fail the request (user can manually sync)
      if (syncResult && "error" in syncResult) {
        console.log(`[billing/status] Sync returned error:`, syncResult);
      } else if (syncResult) {
        console.log(`[billing/status] Sync result:`, syncResult);
      }
      
      // Re-fetch status after sync (even if sync had errors, we want to show current state)
      status = await getBillingStatus({ userId: user.id });
    }

    return NextResponse.json(status);
  } catch (e: any) {
    const msg = String(e?.message || "Failed to load billing status");
    console.error(`[billing/status] Error:`, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST endpoint for manual sync (called by Refresh button)
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    console.log(`[billing/status] Manual sync requested for user ${user.id} (email: ${user.email})`);
    const syncResult = await syncSubscriptionFromDodo(user.id, user.email);
    
    // Check if sync returned an error object
    if (syncResult && "error" in syncResult) {
      return NextResponse.json({ 
        error: syncResult.error,
        code: syncResult.code,
        details: syncResult.details,
        synced: false 
      }, { status: 404 });
    }
    
    if (!syncResult) {
      return NextResponse.json({ 
        error: "No subscription found in Dodo. Make sure you completed payment and have a Dodo customer ID.",
        code: "no_subscription",
        synced: false 
      }, { status: 404 });
    }

    // Re-fetch status after sync
    const status = await getBillingStatus({ userId: user.id });
    
    return NextResponse.json({ 
      ...status, 
      synced: true, 
      syncResult 
    });
  } catch (e: any) {
    const msg = String(e?.message || "Failed to sync billing status");
    console.error(`[billing/status] Sync error:`, e);
    return NextResponse.json({ error: msg, synced: false, code: "sync_error" }, { status: 500 });
  }
}


