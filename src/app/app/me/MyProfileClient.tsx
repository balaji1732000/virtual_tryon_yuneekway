"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ProfileForm = {
  full_name: string;
  company: string;
  role: string;
  intent: string;
};

type BillingSummary = {
  planName: string | null;
  subscriptionStatus: string | null;
  creditsRemaining: number | null;
  periodEnd: string | null;
  error: string | null;
};

function pickMetaString(meta: any, key: string): string {
  const direct = meta?.[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = meta?.onboarding?.[key];
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return "";
}

export default function MyProfileClient() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [email, setEmail] = useState<string>("");
  const [billingEmail, setBillingEmail] = useState<string>("");
  const [form, setForm] = useState<ProfileForm>({
    full_name: "",
    company: "",
    role: "",
    intent: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signOutAllLoading, setSignOutAllLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billing, setBilling] = useState<BillingSummary>({
    planName: null,
    subscriptionStatus: null,
    creditsRemaining: null,
    periodEnd: null,
    error: null,
  });

  const titleName = useMemo(() => form.full_name || email.split("@")[0] || "there", [form.full_name, email]);

  const refreshBilling = async () => {
    setBillingLoading(true);
    setBilling((b) => ({ ...b, error: null }));
    try {
      const res = await fetch("/api/billing/status", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load billing (${res.status})`);
      }

      setBilling({
        planName: json?.plan?.name ?? json?.planName ?? null,
        subscriptionStatus: json?.subscription?.status ?? json?.subscriptionStatus ?? null,
        creditsRemaining: json?.creditsRemaining ?? json?.credits?.remaining ?? json?.remainingCredits ?? null,
        periodEnd: json?.periodEnd ?? json?.creditPeriod?.end_at ?? json?.credits?.periodEnd ?? null,
        error: json?.error ?? null,
      });
    } catch (e: any) {
      setBilling({
        planName: null,
        subscriptionStatus: null,
        creditsRemaining: null,
        periodEnd: null,
        error: String(e?.message || "Failed to load billing"),
      });
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error("Not signed in");

        if (cancelled) return;

        const meta = (data.user.user_metadata || {}) as any;

        setEmail(data.user.email || "");
        setBillingEmail(String(meta?.billing_email || "").trim());
        setForm({
          full_name: pickMetaString(meta, "full_name"),
          company: pickMetaString(meta, "company"),
          role: pickMetaString(meta, "role"),
          intent: pickMetaString(meta, "intent"),
        });
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || "Failed to load profile"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    // Best-effort load; failure is displayed in Billing card.
    refreshBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        onboarded: true,
        full_name: form.full_name,
        company: form.company,
        role: form.role,
        intent: form.intent,
        billing_email: billingEmail,
        onboarding: {
          full_name: form.full_name,
          company: form.company,
          role: form.role,
          intent: form.intent,
        },
      };

      const { error } = await supabase.auth.updateUser({ data: payload });
      if (error) throw error;
      setSuccess("Profile updated.");
    } catch (e: any) {
      setError(String(e?.message || "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const onSignOutAllDevices = async () => {
    if (!supabase) return;
    setSignOutAllLoading(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } finally {
      setSignOutAllLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center opacity-70">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs opacity-70">Account</div>
        <h1 className="text-2xl font-semibold">Hi {titleName}</h1>
        <p className="text-sm opacity-70">Update your profile details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile form (2/3 width on large screens) */}
        <div className="lg:col-span-2">
          <form onSubmit={onSave} className="glass-panel p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium opacity-70">Full name</label>
                <input
                  className="w-full input-field"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium opacity-70">Email</label>
                <input className="w-full input-field opacity-70" value={email} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Company / Brand</label>
              <input
                className="w-full input-field"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                placeholder="Brand or company"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Billing email (for invoices)</label>
              <input
                className="w-full input-field"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="billing@company.com"
              />
              <div className="text-xs opacity-70">This can be different from your login email.</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Role</label>
              <input
                className="w-full input-field"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="Founder, marketer, designer…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Intent</label>
              <textarea
                className="w-full input-field min-h-[120px]"
                value={form.intent}
                onChange={(e) => setForm((p) => ({ ...p, intent: e.target.value }))}
                placeholder="What do you want to achieve with YUNEEKWAYAI?"
              />
            </div>

            {error && <div className="text-xs text-secondary">{error}</div>}
            {success && <div className="text-xs text-accent">{success}</div>}

            <div className="pt-2">
              <button disabled={saving || !supabase} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Billing + Security (1/3 width on large screens) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Billing</div>
                <div className="text-xs opacity-70">Plan and credits</div>
              </div>
              <button className="btn-secondary text-xs px-2 py-1" type="button" onClick={refreshBilling} disabled={billingLoading}>
                {billingLoading ? "..." : "↻"}
              </button>
            </div>

            {billing.error ? <div className="text-xs text-secondary break-words">{billing.error}</div> : null}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Plan</span>
                <span className="font-medium">{billing.planName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Status</span>
                <span className="font-medium">{billing.subscriptionStatus ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Credits</span>
                <span className="font-medium">{billing.creditsRemaining ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Renews</span>
                <span className="font-medium text-xs">{billing.periodEnd ? new Date(billing.periodEnd).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-3">
            <div>
              <div className="text-sm font-semibold">Security</div>
              <div className="text-xs opacity-70">Manage your sessions</div>
            </div>
            <button
              className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              onClick={onSignOutAllDevices}
              disabled={signOutAllLoading || !supabase}
            >
              {signOutAllLoading ? "Signing out..." : "Sign out all devices"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


