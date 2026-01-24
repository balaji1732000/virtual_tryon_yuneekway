import DodoPayments from "dodopayments";

export function getDodoClient() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  const baseURL = process.env.DODO_PAYMENTS_BASE_URL;
  const envRaw = (process.env.DODO_PAYMENTS_ENV || "").trim().toLowerCase();

  if (!bearerToken) {
    throw new Error("Missing DODO_PAYMENTS_API_KEY");
  }

  const environment =
    envRaw === "test" || envRaw === "test_mode" || envRaw === "sandbox"
      ? ("test_mode" as const)
      : envRaw === "live" || envRaw === "live_mode" || envRaw === "prod" || envRaw === "production"
        ? ("live_mode" as const)
        : undefined;

  // The SDK docs show bearerToken as the primary auth mechanism.
  // When webhook key is provided, SDK's webhooks.unwrap() can verify signatures.
  return new DodoPayments({
    bearerToken,
    ...(webhookKey ? { webhookKey } : {}),
    // Dodo defaults to live_mode; allow overriding via env for local testing.
    ...(environment
      ? {
          environment,
          // Important: SDK throws if both baseURL and environment are set (even via env var),
          // so force baseURL=null when using environment.
          baseURL: null,
        }
      : baseURL
        ? { baseURL }
        : {}),
  } as any);
}

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}


