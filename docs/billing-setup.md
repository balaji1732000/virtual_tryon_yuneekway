### Billing setup (Dodo + monthly credits)

#### 1) Apply Supabase schema
- Run [`docs/billing-schema.sql`](docs/billing-schema.sql) in **Supabase SQL editor**.

This creates:
- `billing_customers`, `billing_subscriptions`, `billing_credit_periods`, `billing_webhook_events`
- RPCs: `consume_credits(...)` and `refund_credits(...)`

#### 2) Required environment variables (Vercel + local)
- **`SUPABASE_SERVICE_ROLE_KEY`**: for server-side billing + webhook writes.
- **`DODO_PAYMENTS_API_KEY`**: Dodo API key (test or live).
- **`DODO_PAYMENTS_WEBHOOK_KEY`**: signing secret used to verify webhook HMAC.
- **`DODO_PAYMENTS_ENV`**: set to `test_mode` for test keys, `live_mode` for live keys.
- **`DODO_PRODUCT_ID_STARTER_MONTHLY`**
- **`DODO_PRODUCT_ID_STARTER_YEARLY`**
- **`DODO_PRODUCT_ID_PRO_MONTHLY`**
- **`DODO_PRODUCT_ID_PRO_YEARLY`**

If you prefer overriding base URL directly, set:
- `DODO_PAYMENTS_BASE_URL=https://test.dodopayments.com` (or `https://live.dodopayments.com`)
and do not set `DODO_PAYMENTS_ENV`.

Optional:
- **`BILLING_CRON_SECRET`**: shared secret for `/api/cron/billing-reset` (used by Vercel Cron).

#### 3) Configure Dodo webhook
Point your Dodo webhook to:
- `POST /api/webhooks/dodo`

The handler expects the standard Dodo webhook headers:
- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`

Once Dodo sends `subscription.active`, the backend will upsert `billing_subscriptions` and create the current month’s credit bucket in `billing_credit_periods`.

#### 4) UI
Visit:
- `/app/billing`

Use **Subscribe** to create a Dodo checkout session and open the returned `checkout_url`.
After payment, click **Refresh** to load subscription + credit status.

#### Local note
This repo ignores `.env*` files. Create `nextjs_app/.env.local` manually with the required vars, then restart `npm run dev` so Next.js picks them up.


