import DodoPayments from "dodopayments";

export function getDodoClient() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY!;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

  // The SDK docs show bearerToken as the primary auth mechanism.
  // When webhook key is provided, SDK's webhooks.unwrap() can verify signatures.
  return new DodoPayments({
    bearerToken,
    ...(webhookKey ? { webhookKey } : {}),
  } as any);
}

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}


