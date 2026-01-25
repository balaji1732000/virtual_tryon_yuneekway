"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/app";

  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [mode, setMode] = useState<"otp" | "admin">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      const msg = String(err?.message || "Login failed");
      if (msg.toLowerCase().includes("email logins are disabled")) {
        setError("Email/password login is disabled in Supabase. Enable it in Supabase Dashboard → Authentication → Providers → Email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setError(String(err?.message || "Failed to send code"));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(String(err?.message || "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <section className="hidden lg:flex items-center justify-center p-12 bg-gradient-to-br from-[#0b1220] via-[#111827] to-[#0b1220]">
        <div className="max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-sm flex items-center justify-center">
              <Image
                src="/YuneekwayAI-transparent.png"
                alt="Yuneekwayai logo"
                width={48}
                height={48}
                className="object-contain"
                priority
              />
            </div>
            <div className="text-white/70 text-sm font-semibold tracking-wide">YUNEEKWAYAI</div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Supercharge Your Photos with AI</h1>
          <p className="text-white/70 text-lg">Boost sales in minutes with consistent ecommerce visuals.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md glass-panel p-8">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold">Log in to your account</h2>
            <p className="text-sm opacity-70">Sign in with a one-time code sent to your email.</p>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setMode("otp");
                setError(null);
              }}
              className={`flex-1 rounded-xl px-3 py-2 text-sm transition-colors border ${
                mode === "otp" ? "bg-[color:var(--sp-hover)] border-[color:var(--sp-border)]" : "border-[color:var(--sp-border)] opacity-70"
              }`}
            >
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("admin");
                setError(null);
              }}
              className={`flex-1 rounded-xl px-3 py-2 text-sm transition-colors border ${
                mode === "admin" ? "bg-[color:var(--sp-hover)] border-[color:var(--sp-border)]" : "border-[color:var(--sp-border)] opacity-70"
              }`}
            >
              Admin Password
            </button>
          </div>

          {mode === "otp" ? (
            <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="space-y-4">
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

              {otpSent ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">8-digit code</label>
                  <input
                    className="w-full input-field"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter the code from your email"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                  <div className="text-xs opacity-70">
                    Didn’t get a code?{" "}
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setError(null);
                      }}
                    >
                      Resend
                    </button>
                  </div>
                </div>
              ) : null}

              {error && <div className="text-xs text-secondary">{error}</div>}

              <button disabled={loading || !supabase} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (otpSent ? "Verifying..." : "Sending...") : otpSent ? "Verify & Sign in" : "Send code"}
              </button>

              <div className="text-xs opacity-70 text-center">
                New here?{" "}
                <a className="hover:underline" href="/register">
                  Create an account
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={onAdminSubmit} className="space-y-4">
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

            <button disabled={loading || !supabase} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
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
          )}
        </div>
      </section>
    </main>
  );
}


