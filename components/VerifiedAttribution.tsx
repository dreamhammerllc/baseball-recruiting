/**
 * VerifiedAttribution — inline coach-verified attribution for a single metric.
 *
 * Phase 2c-iv. Pure presentational, server-renderable. Reads the resolved
 * coach-verified PB row passed in by the parent and renders a small line of
 * gold text identifying the verifying coach + organization + measurement
 * date. If the PB row carries a `video_url`, a "Watch proof" button is
 * rendered beneath the line — that button is a small client wrapper
 * (WatchProofButton) so the surrounding context can stay server-rendered.
 *
 * Returns null when:
 *   - pb is null (no coach-verified PB for this metric on this athlete), or
 *   - pb.verification_type !== 'coach_verified' (defensive).
 *
 * Source-label formatting (matches the spec's Q2):
 *   - "Coach Name - Org Name"  → "Verified by Coach Name, Org Name"
 *   - anything else (1 part, 3+ parts, parsed wrong) → "Verified by <verbatim>"
 *   - null/undefined source_label → "Coach verified" (no name)
 */

import type { AthleteMetric, MetricKey } from '@/lib/metrics';
import { METRIC_INFO } from '@/lib/metrics';
import WatchProofButton from './WatchProofButton';

interface VerifiedAttributionProps {
  pb: AthleteMetric | null;
}

function buildAttributionText(sourceLabel: string | null | undefined): string {
  if (!sourceLabel) return 'Coach verified';
  const parts = sourceLabel.split(' - ');
  if (parts.length === 2) return `Verified by ${parts[0]}, ${parts[1]}`;
  return `Verified by ${sourceLabel}`;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function VerifiedAttribution({ pb }: VerifiedAttributionProps) {
  if (!pb || pb.verification_type !== 'coach_verified') return null;

  const text     = buildAttributionText(pb.source_label);
  const dateStr  = formatDate(pb.recorded_at);
  const info     = METRIC_INFO[pb.metric_key as MetricKey];
  const modalTitle =
    info?.label ? `Verification: ${info.label}` : 'Verification Video';

  return (
    <div
      style={{
        marginTop:     '0.5rem',
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.35rem',
      }}
    >
      <p
        style={{
          fontFamily: 'monospace',
          fontSize:   '0.68rem',
          color:      '#e8a020',
          margin:     0,
          lineHeight: 1.4,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ marginRight: '0.3rem', fontWeight: 700 }}>✓</span>
        {text}
        {dateStr && (
          <span style={{ color: '#6b7280', marginLeft: '0.4rem' }}>
            · {dateStr}
          </span>
        )}
      </p>
      {pb.video_url && (
        <WatchProofButton videoUrl={pb.video_url} title={modalTitle} />
      )}
    </div>
  );
}
