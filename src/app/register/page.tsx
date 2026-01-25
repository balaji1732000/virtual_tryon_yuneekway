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

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [intent, setIntent] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpSent(true);
      setSuccess("We’ve sent a 8-digit code to your email.");
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
    setSuccess(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;

      // Save onboarding answers on first signup
      const { error: updateErr } = await supabase.auth.updateUser({
        data: {
          onboarded: true,
          onboarding: {
            full_name: fullName,
            company,
            role,
            intent,
          },
        },
      });
      if (updateErr) throw updateErr;

      setSuccess("Account created. Redirecting…");
      router.replace("/app");
      router.refresh();
    } catch (err: any) {
      setError(String(err?.message || "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-8">
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-semibold">Create an account</h2>
          <p className="text-sm opacity-70">We’ll send a one-time code to your email.</p>
        </div>

        <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="space-y-4">
          {!otpSent ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">Full name</label>
                  <input
                    className="w-full input-field"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium opacity-70">Company / Brand</label>
                  <input
                    className="w-full input-field"
                    placeholder="Brand or company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium opacity-70">Role</label>
                <input
                  className="w-full input-field"
                  placeholder="Founder, marketer, designer…"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium opacity-70">What do you want to achieve?</label>
                <textarea
                  className="w-full input-field min-h-[110px]"
                  placeholder="Example: Generate consistent product photos, try-on images…"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  required
                />
              </div>
            </>
          ) : null}

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
                    setSuccess(null);
                  }}
                >
                  Resend
                </button>
              </div>
            </div>
          ) : null}

          {error && <div className="text-xs text-secondary">{error}</div>}
          {success && <div className="text-xs text-accent">{success}</div>}

          <button disabled={loading || !supabase} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (otpSent ? "Verifying..." : "Sending...") : otpSent ? "Verify & Create account" : "Sign up"}
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


