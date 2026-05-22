// Pricing/tier definitions now live in lib/pricing.ts (single source of truth).
// This module re-exports the subscription primitives so existing
// `@/lib/subscription` imports keep working.

export type { SubscriptionTier } from './pricing';
export { SUBSCRIPTION_TIERS, isPaidTier } from './pricing';
