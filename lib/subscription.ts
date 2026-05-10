export const SUBSCRIPTION_TIERS = ['free', 'verified', 'elite', 'pro'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

export function isPaidTier(tier: SubscriptionTier | null | undefined): boolean {
  return tier != null && tier !== 'free';
}
