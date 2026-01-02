"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/app";

  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <section className="hidden lg:flex items-center justify-center p-12 bg-gradient-to-br from-[#0b1220] via-[#111827] to-[#0b1220]">
        <div className="max-w-md space-y-4">
          <div className="text-white/70 text-sm font-semibold tracking-wide">SellerPic Studio</div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Supercharge Your Photos with AI</h1>
          <p className="text-white/70 text-lg">Boost sales in minutes with consistent ecommerce visuals.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md glass-panel p-8">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold">Log in to your account</h2>
            <p className="text-sm opacity-70">Welcome back! Please enter your details.</p>
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="text-xs text-secondary">{error}</div>}

            <button disabled={loading} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className="flex justify-between text-xs opacity-70">
              <a className="hover:underline" href="/forgot">
                Forgot password
              </a>
              <a className="hover:underline" href="/register">
                Sign up
              </a>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}


