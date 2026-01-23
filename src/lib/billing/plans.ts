export type PlanInterval = "monthly" | "yearly";
export type PlanTier = "starter" | "pro";

export type PlanCode = `${PlanTier}_${PlanInterval}`;

export type BillingPlan = {
  code: PlanCode;
  tier: PlanTier;
  interval: PlanInterval;
  monthlyCredits: number;
  dodoProductIdEnv: string; // env var name containing Dodo product_id
};

// Defaults (change freely). These are enforced server-side once your Supabase billing tables exist.
export const BILLING_PLANS: Record<PlanCode, BillingPlan> = {
  starter_monthly: {
    code: "starter_monthly",
    tier: "starter",
    interval: "monthly",
    monthlyCredits: 200,
    dodoProductIdEnv: "DODO_PRODUCT_ID_STARTER_MONTHLY",
  },
  starter_yearly: {
    code: "starter_yearly",
    tier: "starter",
    interval: "yearly",
    monthlyCredits: 200,
    dodoProductIdEnv: "DODO_PRODUCT_ID_STARTER_YEARLY",
  },
  pro_monthly: {
    code: "pro_monthly",
    tier: "pro",
    interval: "monthly",
    monthlyCredits: 1000,
    dodoProductIdEnv: "DODO_PRODUCT_ID_PRO_MONTHLY",
  },
  pro_yearly: {
    code: "pro_yearly",
    tier: "pro",
    interval: "yearly",
    monthlyCredits: 1000,
    dodoProductIdEnv: "DODO_PRODUCT_ID_PRO_YEARLY",
  },
};

export function getPlan(code: string): BillingPlan | null {
  return (BILLING_PLANS as any)[code] ?? null;
}

export function getDodoProductIdForPlan(plan: BillingPlan): string {
  const id = process.env[plan.dodoProductIdEnv];
  if (!id) throw new Error(`Missing env var ${plan.dodoProductIdEnv}`);
  return id;
}

export function creditsCostForOperation(args: { operation: "generate" | "edit"; outputs?: number }) {
  // Simple model for now:
  // - 1 credit == 1 output image (generate or edit), regardless of 1K/2K/4K (your selected routing is Flash for all).
  const outputs = Math.max(1, Math.floor(args.outputs ?? 1));
  return outputs;
}


