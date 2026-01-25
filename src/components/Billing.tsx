"use client";

import { useEffect, useMemo, useState } from "react";
import { BILLING_PLANS, PlanCode } from "@/lib/billing/plans";

type BillingStatus = {
  subscription: any | null;
  credits:
    | null
    | {
        planCode: string;
        periodStart: string;
        periodEnd: string;
        total: number;
        used: number;
        remaining: number;
      };
};

export default function Billing() {
  const planOptions = useMemo(() => Object.values(BILLING_PLANS), []);
  const [planCode, setPlanCode] = useState<PlanCode>("starter_monthly");
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  async function loadStatus(forceSync = false) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/status", { 
        method: forceSync ? "POST" : "GET",
        cache: "no-store" 
      });
      const json = await res.json();
      if (!res.ok) {
        // Handle structured error responses
        const errorMsg = json?.error || "Failed to load billing status";
        const errorCode = json?.code || "unknown_error";
        const errorDetails = json?.details || {};
        
        // Provide more helpful error messages based on error code
        let displayError = errorMsg;
        if (errorCode === "no_customer_id") {
          displayError = "No Dodo customer ID found. Please click Subscribe first to create a customer account.";
        } else if (errorCode === "no_subscription_found") {
          displayError = errorMsg + (errorDetails?.customer_id ? ` (Customer ID: ${errorDetails.customer_id})` : "");
        } else if (errorCode === "dodo_api_error") {
          displayError = `Dodo API error: ${errorMsg}. Check your API keys and environment configuration.`;
        }
        
        throw new Error(displayError);
      }
      setStatus(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load billing status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Keep selected planCode aligned with interval toggle.
    const [tier] = String(planCode).split("_") as [string, string];
    const next = `${tier}_${interval}` as PlanCode;
    if ((BILLING_PLANS as any)[next]) setPlanCode(next);
  }, [interval]);

  useEffect(() => {
    loadStatus();
  }, []);

  async function startSubscription() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode, country: "US" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start subscription");
      if (json?.checkoutUrl) {
        window.open(json.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to start subscription");
    } finally {
      setLoading(false);
      await loadStatus();
    }
  }

  const subStatus = status?.subscription?.status ? String(status.subscription.status) : null;
  const subPlan = status?.subscription?.plan_code ? String(status.subscription.plan_code) : null;

  const tier = (String(planCode).split("_")[0] || "starter") as "starter" | "pro";
  const planCards = [
    { code: (`starter_${interval}` as PlanCode), title: "Starter", subtitle: "For trying out the workflow", credits: BILLING_PLANS[`starter_${interval}` as PlanCode].monthlyCredits },
    { code: (`pro_${interval}` as PlanCode), title: "Pro", subtitle: "For teams & higher volume", credits: BILLING_PLANS[`pro_${interval}` as PlanCode].monthlyCredits },
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <div className="glass-panel p-4 border border-red-200 bg-red-50/40">
          <div className="text-sm font-semibold text-red-700">Billing setup needed</div>
          <div className="text-sm text-red-700 mt-1">{error}</div>
          <div className="text-xs text-red-700/80 mt-2">
            If you’re running locally, ensure you set <code className="px-1">SUPABASE_SERVICE_ROLE_KEY</code> and{" "}
            <code className="px-1">DODO_PAYMENTS_API_KEY</code> (see <code className="px-1">docs/billing-setup.md</code>).
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="glass-panel p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Subscription</div>
              <div className="text-sm opacity-70">Choose a plan to get monthly credits.</div>
            </div>
            <div className="inline-flex rounded-xl border border-[color:var(--sp-border)] overflow-hidden">
              <button
                className={`px-3 py-2 text-sm ${interval === "monthly" ? "bg-[color:var(--sp-hover)]" : "opacity-70"}`}
                onClick={() => setInterval("monthly")}
                type="button"
              >
                Monthly
              </button>
              <button
                className={`px-3 py-2 text-sm ${interval === "yearly" ? "bg-[color:var(--sp-hover)]" : "opacity-70"}`}
                onClick={() => setInterval("yearly")}
                type="button"
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {planCards.map((p) => {
              const selected = planCode === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setPlanCode(p.code)}
                  className={`text-left glass-panel p-4 transition-colors border ${
                    selected ? "border-[color:var(--sp-border)] bg-[color:var(--sp-hover)]" : "border-transparent hover:bg-[color:var(--sp-hover)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-xs opacity-70">{p.subtitle}</div>
                    </div>
                    {selected ? <div className="text-xs font-semibold">Selected</div> : null}
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="font-semibold">{p.credits}</span> credits / month
                  </div>
                  <div className="mt-1 text-xs opacity-70">1 credit = 1 image generate/edit</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs opacity-70">
              You’ll be taken to a Dodo Payments checkout page to complete payment. After payment, return here and click Refresh.
            </div>
            <button className="btn-primary" onClick={startSubscription} disabled={loading}>
              {loading ? "Starting..." : "Subscribe"}
            </button>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-3">
          <div className="text-sm font-semibold">Current status</div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="opacity-70">Plan</span>
              <span className="font-medium">{subPlan || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="opacity-70">Status</span>
              <span className="font-medium">{subStatus || "no subscription"}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[color:var(--sp-border)] space-y-2">
            <div className="text-sm font-semibold">Credits</div>
            {status?.credits ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="opacity-70">Remaining</span>
                  <span className="font-semibold">{status.credits.remaining}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="opacity-70">Total</span>
                  <span className="font-medium">{status.credits.total}</span>
                </div>
                <div className="text-xs opacity-70">
                  Period: {new Date(status.credits.periodStart).toLocaleDateString()} → {new Date(status.credits.periodEnd).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="text-sm opacity-70">No active credit period.</div>
            )}

            <button className="btn-secondary w-full" onClick={() => loadStatus(true)} disabled={loading}>
              {loading ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


