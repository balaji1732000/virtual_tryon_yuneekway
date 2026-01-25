"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type OnboardingPayload = {
  full_name: string;
  company: string;
  role: string;
  intent: string;
};

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/app";

  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [payload, setPayload] = useState<OnboardingPayload>({
    full_name: "",
    company: "",
    role: "",
    intent: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: sessionErr } = await supabase.auth.getUser();
      if (sessionErr) throw sessionErr;
      if (!data.user) throw new Error("Not signed in");

      const { error: updateErr } = await supabase.auth.updateUser({
        data: {
          onboarded: true,
          onboarding: payload,
        },
      });
      if (updateErr) throw updateErr;

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(String(err?.message || "Failed to save"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl glass-panel p-8">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-semibold">Welcome to YUNEEKWAYAI</h1>
          <p className="text-sm opacity-70">Tell us a bit about you — this is asked only once.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Full name</label>
              <input
                className="w-full input-field"
                value={payload.full_name}
                onChange={(e) => setPayload((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium opacity-70">Company / Brand</label>
              <input
                className="w-full input-field"
                value={payload.company}
                onChange={(e) => setPayload((p) => ({ ...p, company: e.target.value }))}
                placeholder="Brand or company name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium opacity-70">Role</label>
            <input
              className="w-full input-field"
              value={payload.role}
              onChange={(e) => setPayload((p) => ({ ...p, role: e.target.value }))}
              placeholder="Founder, marketer, designer, ecommerce manager…"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium opacity-70">What do you want to achieve?</label>
            <textarea
              className="w-full input-field min-h-[110px]"
              value={payload.intent}
              onChange={(e) => setPayload((p) => ({ ...p, intent: e.target.value }))}
              placeholder="Example: Generate consistent product photos, try-on images, model shoots…"
              required
            />
          </div>

          {error && <div className="text-xs text-secondary">{error}</div>}

          <button disabled={loading || !supabase} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}


