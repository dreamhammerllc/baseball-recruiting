/**
 * Diamond Verified badge.
 *
 * Single source of truth for the "◆ Verified" pill across the product. The
 * badge means exactly one thing: this athlete has at least one coach-verified
 * metric (`athletes.verification_tier > 0`). It is NOT tied to subscription
 * tier, NOT tied to is_verified (the document-upload boolean), and NOT tied
 * to any other signal.
 *
 * Pure presentational, no event handlers, no state, no `'use client'` —
 * usable from both server pages and client components.
 *
 * Variants pick how much text to show:
 *   - 'icon'  → just the diamond (compact list contexts)
 *   - 'short' → "◆ Verified"
 *   - 'full'  → "◆ Diamond Verified"
 */

interface VerifiedBadgeProps {
  verificationTier: number | null | undefined;
  variant?: 'icon' | 'short' | 'full';
}

const PILL_STYLE: React.CSSProperties = {
  display:        'inline-block',
  backgroundColor:'rgba(232,160,32,0.12)',
  border:         '1px solid #e8a020',
  borderRadius:   '0.375rem',
  padding:        '0.25rem 0.75rem',
  color:          '#e8a020',
  fontFamily:     'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize:       '0.75rem',
  fontWeight:     700,
  letterSpacing:  '0.05em',
  whiteSpace:     'nowrap',
};

export default function VerifiedBadge({
  verificationTier,
  variant = 'short',
}: VerifiedBadgeProps) {
  if ((verificationTier ?? 0) === 0) return null;

  const text =
    variant === 'icon'  ? '◆' :
    variant === 'full'  ? '◆ Diamond Verified' :
                          '◆ Verified';

  // The tooltip carries the meaning for the icon-only variant (where the
  // text alone is ambiguous), but it's harmless on the other variants too.
  return (
    <span style={PILL_STYLE} title="Diamond Verified — coach-verified metrics">
      {text}
    </span>
  );
}
