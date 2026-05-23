// ─── Pricing — single source of truth ─────────────────────────────────────────
//
// All Stripe price/product IDs, tier display data, the free/paid feature
// boundary, and tier-resolution helpers live here. Nothing else in the codebase
// should hardcode a Stripe price ID or a dollar amount.
//
// ENV POLICY (do not "fix" this — it is intentional):
//   • Price IDs are HARDCODED below and must NEVER be read from process.env.
//     Env-based price IDs are what caused test/live mismatches; do not re-add
//     them. The Stripe price_… / prod_… values are public identifiers, not
//     secrets, so pinning them here is safe and keeps checkout + webhook in
//     sync from one map.
//   • The ONLY process.env read in this file is the *prefix* of
//     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, used solely to pick the test vs live
//     price-ID set (see STRIPE_MODE). Keep that read — removing it lets the
//     Stripe keys and price IDs drift out of sync again.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'verified' | 'elite' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

/** Canonical tier list, ordered free → paid. Single source for SubscriptionTier. */
export const SUBSCRIPTION_TIERS = ['free', 'verified', 'elite', 'pro'] as const;

// ─── Stripe IDs (LIVE, public identifiers) ─────────────────────────────────────

// Live product IDs — informational only, not used at runtime.
export const STRIPE_PRODUCT_IDS = {
  verified: 'prod_UT5sNek5oJG6Kf',
  elite:    'prod_UT5szC4YxhlH0W',
} as const;

// Test vs live is auto-selected from the publishable-key prefix, so the
// Stripe keys and the price IDs can never mismatch. Defaults to 'test' when
// the key is unset — safe, never charges real money.
const STRIPE_MODE: 'test' | 'live' =
  (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_live_')
    ? 'live'
    : 'test';

// Pro has no Stripe price and no checkout — it is set manually on comp
// accounts — so it intentionally has no entry in either map.
const PRICE_IDS_BY_MODE = {
  test: {
    verified: {
      monthly: 'price_1TUBy1IJP5BSkTrOV2GWhk4e',
      yearly:  'price_1TUBy1IJP5BSkTrO38zxmCgU',
    },
    elite: {
      monthly: 'price_1TUBzdIJP5BSkTrOTlCFNfKX',
      yearly:  'price_1TUC0HIJP5BSkTrORs6SyEbm',
    },
  },
  live: {
    verified: {
      monthly: 'price_1TU9gUIJP5BSkTrOw7VGE6Jm',
      yearly:  'price_1TU9gUIJP5BSkTrOzYqTxpSM',
    },
    elite: {
      monthly: 'price_1TU9hBIJP5BSkTrO7pJiDi8d',
      yearly:  'price_1TU9jvIJP5BSkTrO5ZHF4eAF',
    },
  },
} as const;

// Mode-selected price IDs. Shape is identical (verified/elite × monthly/yearly)
// regardless of mode, so getPriceId and the route files need no changes.
export const STRIPE_PRICE_IDS = PRICE_IDS_BY_MODE[STRIPE_MODE];

// ─── Tier display data ─────────────────────────────────────────────────────────

export interface TierInfo {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  savingsPct?: number;
  bestValue?: boolean;
  /** Pro: never advertised, no checkout flow. */
  inactive?: boolean;
}

export const TIERS: Record<SubscriptionTier, TierInfo> = {
  free: {
    name: 'Scout',
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  verified: {
    name: 'Verified',
    monthlyPrice: 9.99,
    yearlyPrice: 79,
    savingsPct: 34,
  },
  elite: {
    name: 'Elite',
    monthlyPrice: 19.99,
    yearlyPrice: 159,
    savingsPct: 34,
    bestValue: true,
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 0,
    yearlyPrice: 0,
    inactive: true,
  },
};

// ─── Feature boundary (free vs paid) ───────────────────────────────────────────

export interface TierFeatures {
  highlightSlots: number;
  publicMetricsUnblurred: boolean;
  verifiedBadge: boolean;
  shareLink: boolean;
  schoolMatches: boolean;
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    highlightSlots: 0,
    publicMetricsUnblurred: false,
    verifiedBadge: false,
    shareLink: false,
    schoolMatches: false,
  },
  verified: {
    highlightSlots: 3,
    publicMetricsUnblurred: true,
    verifiedBadge: true,
    shareLink: true,
    schoolMatches: false,
  },
  elite: {
    highlightSlots: 6,
    publicMetricsUnblurred: true,
    verifiedBadge: true,
    shareLink: true,
    schoolMatches: true,
  },
  pro: {
    highlightSlots: 6,
    publicMetricsUnblurred: true,
    verifiedBadge: true,
    shareLink: true,
    schoolMatches: true,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** True for any tier that is not free (verified | elite | pro). */
export function isPaidTier(tier: SubscriptionTier | null | undefined): boolean {
  return tier != null && tier !== 'free';
}

/**
 * Resolve the Stripe price ID for a checkout-eligible tier + interval.
 * Throws on 'free'/'pro' or any invalid tier/interval combo — those tiers
 * have no Stripe price and must never reach checkout.
 */
export function getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
  if (tier !== 'verified' && tier !== 'elite') {
    throw new Error(`No Stripe price for tier '${tier}'`);
  }
  const priceId = STRIPE_PRICE_IDS[tier]?.[interval];
  if (!priceId) {
    throw new Error(`No Stripe price for ${tier}:${interval}`);
  }
  return priceId;
}

/**
 * Reverse-lookup a Stripe price ID to its tier. Searches BOTH the test and
 * live maps (all 8 IDs) so the webhook is mode-agnostic. Unknown price → 'free'.
 */
export function tierFromPriceId(priceId: string): SubscriptionTier {
  for (const mode of ['test', 'live'] as const) {
    for (const tier of ['verified', 'elite'] as const) {
      const prices = PRICE_IDS_BY_MODE[mode][tier];
      if (prices.monthly === priceId || prices.yearly === priceId) {
        return tier;
      }
    }
  }
  return 'free';
}

/**
 * Normalize a raw tier value from the DB or external input to a canonical
 * SubscriptionTier. Maps the legacy 'athlete_pro' value to 'pro'.
 * Unknown or null/undefined input → 'free'.
 */
export function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === 'athlete_pro') return 'pro';
  if (raw === 'free' || raw === 'verified' || raw === 'elite' || raw === 'pro') {
    return raw;
  }
  return 'free';
}
