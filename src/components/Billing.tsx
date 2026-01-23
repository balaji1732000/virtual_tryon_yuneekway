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

  async function loadStatus() {
    setError(null);
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load billing status");
      setStatus(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load billing status");
    }
  }

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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-panel p-4 space-y-2">
          <div className="text-sm font-semibold">Your plan</div>
          <div className="text-sm opacity-70">
            {status?.subscription ? (
              <>
                Status: <span className="font-medium">{String(status.subscription.status || "unknown")}</span>
                <br />
                Plan: <span className="font-medium">{String(status.subscription.plan_code || "-")}</span>
              </>
            ) : (
              <>No active subscription found.</>
            )}
          </div>
        </div>

        <div className="glass-panel p-4 space-y-2">
          <div className="text-sm font-semibold">Credits</div>
          <div className="text-sm opacity-70">
            {status?.credits ? (
              <>
                Remaining: <span className="font-medium">{status.credits.remaining}</span> / {status.credits.total}
                <br />
                Period: {new Date(status.credits.periodStart).toLocaleDateString()} →{" "}
                {new Date(status.credits.periodEnd).toLocaleDateString()}
              </>
            ) : (
              <>No active credit period.</>
            )}
          </div>
          <button className="btn-secondary" onClick={loadStatus} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="text-sm font-semibold">Subscribe</div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            className="px-3 py-2 rounded-xl bg-transparent border border-[color:var(--sp-border)]"
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value as PlanCode)}
          >
            {planOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.tier.toUpperCase()} · {p.interval} · {p.monthlyCredits}/mo credits
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={startSubscription} disabled={loading}>
            {loading ? "Starting..." : "Subscribe"}
          </button>
        </div>
        <div className="text-xs opacity-70">
          You’ll be taken to a Dodo Payments checkout page to complete payment. Once paid, return here and click Refresh.
        </div>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}


