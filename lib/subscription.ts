export type SubscriptionTier = 'free' | 'athlete' | 'athlete_pro' | 'coach'

export function canAccessFeature(tier: SubscriptionTier, feature: string): boolean {
  const features: Record<string, SubscriptionTier[]> = {
    verified_badge: ['athlete', 'athlete_pro', 'coach'],
    document_upload: ['athlete', 'athlete_pro', 'coach'],
    ai_scout_report: ['athlete', 'athlete_pro', 'coach'],
    pdf_download: ['athlete_pro', 'coach'],
    email_share: ['athlete_pro', 'coach'],
    development_roadmap: ['athlete_pro', 'coach'],
    priority_search: ['athlete_pro', 'coach'],
    coach_dashboard: ['coach'],
    unlimited_matches: ['athlete', 'athlete_pro', 'coach'],
  }
  return features[feature]?.includes(tier) ?? false
}

export function getTierName(tier: SubscriptionTier): string {
  const names = {
    free: 'Free',
    athlete: 'Athlete',
    athlete_pro: 'Athlete Pro',
    coach: 'Team / Coach',
  }
  return names[tier]
}

export function getUpgradeMessage(feature: string): string {
  const messages: Record<string, string> = {
    verified_badge: 'Upgrade to Athlete to get your Diamond Verified badge',
    document_upload: 'Upgrade to Athlete to upload verification documents',
    ai_scout_report: 'Upgrade to Athlete to unlock your AI scout assessment',
    pdf_download: 'Upgrade to Athlete Pro to download your profile as PDF',
    email_share: 'Upgrade to Athlete Pro to email your profile to coaches',
    development_roadmap: 'Upgrade to Athlete Pro to unlock your AI development roadmap',
    priority_search: 'Upgrade to Athlete Pro for priority placement in coach searches',
  }
  return messages[feature] ?? 'Upgrade your plan to access this feature'
}