"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) Create the user
      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp.error) throw signUp.error;

      // 2) Ensure we can immediately sign in (avoids “invalid credentials” confusion)
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;

      setSuccess("Account created. Redirecting…");
      router.replace("/app");
      router.refresh();
    } catch (err: any) {
      const msg = String(err?.message || "Sign up failed");
      if (msg.toLowerCase().includes("email signups are disabled")) {
        setError("Email/password signup is disabled in Supabase. Enable it in Supabase Dashboard → Authentication → Providers → Email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-8">
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-semibold">Create an account</h2>
          <p className="text-sm opacity-70">Start generating ecommerce visuals in minutes.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium opacity-70">Email</label>
            <input
              className="w-full input-field"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium opacity-70">Password</label>
            <input
              className="w-full input-field"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && <div className="text-xs text-secondary">{error}</div>}
          {success && <div className="text-xs text-accent">{success}</div>}

          <button disabled={loading || !supabase} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Creating..." : "Sign up"}
          </button>

          <div className="text-xs opacity-70 text-center">
            Already have an account?{" "}
            <a className="hover:underline" href="/login">
              Log in
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}


