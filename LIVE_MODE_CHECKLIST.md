# Stripe Live Mode Swap Checklist

Complete these steps in order. The entire swap takes ~30 minutes and requires zero code changes.

---

## 1. Stripe Dashboard — Create Live Products & Prices

1. In Stripe Dashboard, toggle the switch from **Test** to **Live** (top-left).
2. Go to **Products → Add product**.
3. Create two products with the same names used in test mode:

   | Product      | Price       | Interval | Expected ID prefix |
   |--------------|-------------|----------|--------------------|
   | Verified     | $9.99/mo    | Monthly  | `price_live_...`   |
   | Verified     | $79.00/yr   | Yearly   | `price_live_...`   |
   | Elite        | $19.99/mo   | Monthly  | `price_live_...`   |
   | Elite        | $159.00/yr  | Yearly   | `price_live_...`   |

4. Copy all four live price IDs.

---

## 2. Stripe Dashboard — Register Live Webhook

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://diamondverified.app/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_live_...`).

---

## 3. Stripe Dashboard — Enable Billing Portal

1. Go to **Settings → Billing → Customer portal**.
2. Enable the portal and configure allowed actions (cancel, update payment method, view invoices).
3. Save. No URL needed — the API creates sessions dynamically.

---

## 4. Vercel — Update Environment Variables

In the Vercel project dashboard under **Settings → Environment Variables**, update or add:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (from Stripe Dashboard → Developers → API keys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_live_...` (from step 2) |
| `STRIPE_VERIFIED_MONTHLY_PRICE_ID` | live price ID for Verified monthly |
| `STRIPE_VERIFIED_YEARLY_PRICE_ID` | live price ID for Verified yearly |
| `STRIPE_ELITE_MONTHLY_PRICE_ID` | live price ID for Elite monthly |
| `STRIPE_ELITE_YEARLY_PRICE_ID` | live price ID for Elite yearly |

> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not used server-side here, but update it too if any client-side Stripe.js is ever added.

---

## 5. Redeploy

Trigger a redeploy in Vercel (no code change required — env vars are baked in at build time for server components, and runtime for API routes):

```
vercel redeploy --prod
```

Or push an empty commit to trigger CI.

---

## 6. Smoke Test in Live Mode

- [ ] Go to `/dashboard/athlete/upgrade`, click a plan — Stripe Checkout opens with real card fields.
- [ ] Use a real card (or your own card) to complete a $0.01 test charge (you can refund it).
- [ ] Confirm webhook fires: check Vercel logs for `[stripe/webhook]` and confirm Supabase `subscription_tier` updates.
- [ ] Confirm confirmation email arrives via Resend.
- [ ] Open Settings → click **Manage Billing / Cancel** → Stripe portal opens.
- [ ] Cancel from the portal and confirm `subscription_tier` resets to `free` after the period ends (or immediately if you chose immediate cancel).

---

## Rollback

To revert to test mode, swap the env vars back to the `sk_test_...` / `whsec_test_...` / `price_test_...` values and redeploy.
