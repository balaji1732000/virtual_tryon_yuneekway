"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!supabase) return;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSuccess("If an account exists, a reset email has been sent.");
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-8">
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-semibold">Reset password</h2>
          <p className="text-sm opacity-70">We’ll email you a password reset link.</p>
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

          {error && <div className="text-xs text-secondary">{error}</div>}
          {success && <div className="text-xs text-accent">{success}</div>}

          <button disabled={loading} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Sending..." : "Send reset email"}
          </button>

          <div className="text-xs opacity-70 text-center">
            <a className="hover:underline" href="/login">
              Back to login
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}


