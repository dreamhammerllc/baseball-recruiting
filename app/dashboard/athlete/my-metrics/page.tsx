'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import AthleteSidebar from '@/components/layout/AthleteSidebar';

// ─── Metric definitions ───────────────────────────────────────────────────────

type MetricKey =
  | 'sixty_yard_dash' | 'home_to_first'
  | 'exit_velocity' | 'bat_speed' | 'launch_angle' | 'attack_angle' | 'barrel_pct'
  | 'fastball_velocity' | 'secondary_pitch_velocity' | 'spin_rate'
  | 'horizontal_break' | 'vertical_break' | 'extension'
  | 'pop_time' | 'catcher_throwing_velocity'
  | 'outfield_throwing_velocity' | 'infield_throwing_velocity';

interface MetricDef {
  label:         string;
  unit:          string;
  lowerIsBetter: boolean;
  sources:       string[];
  category:      string;
}

const METRIC_DEFS: Record<MetricKey, MetricDef> = {
  sixty_yard_dash:            { label: '60-Yard Dash',              unit: 's',   lowerIsBetter: true,  sources: ['Pocket Radar', 'Coach In-Person'], category: 'Universal'      },
  home_to_first:              { label: 'Home-to-First',             unit: 's',   lowerIsBetter: true,  sources: ['Pocket Radar', 'Coach In-Person'], category: 'Universal'      },
  exit_velocity:              { label: 'Exit Velocity',             unit: 'mph', lowerIsBetter: false, sources: ['HitTrax', 'Rapsodo', 'Blast Motion'], category: 'Hitting'    },
  bat_speed:                  { label: 'Bat Speed',                 unit: 'mph', lowerIsBetter: false, sources: ['Blast Motion'],                    category: 'Hitting'        },
  launch_angle:               { label: 'Launch Angle',              unit: 'deg', lowerIsBetter: false, sources: ['HitTrax', 'Rapsodo'],              category: 'Hitting'        },
  attack_angle:               { label: 'Attack Angle',              unit: 'deg', lowerIsBetter: false, sources: ['Blast Motion'],                    category: 'Hitting'        },
  barrel_pct:                 { label: 'Barrel %',                  unit: '%',   lowerIsBetter: false, sources: ['HitTrax'],                         category: 'Hitting'        },
  fastball_velocity:          { label: 'Fastball Velocity',         unit: 'mph', lowerIsBetter: false, sources: ['Rapsodo', 'Trackman', 'Pocket Radar'], category: 'Pitching' },
  secondary_pitch_velocity:   { label: 'Secondary Pitch Velocity',  unit: 'mph', lowerIsBetter: false, sources: ['Rapsodo', 'Trackman', 'Pocket Radar'], category: 'Pitching' },
  spin_rate:                  { label: 'Spin Rate',                 unit: 'rpm', lowerIsBetter: false, sources: ['Rapsodo', 'Trackman'],             category: 'Pitching'       },
  horizontal_break:           { label: 'Pitch Movement (Horiz)',    unit: 'in',  lowerIsBetter: false, sources: ['Rapsodo', 'Trackman'],             category: 'Pitching'       },
  vertical_break:             { label: 'Pitch Movement (Vert)',     unit: 'in',  lowerIsBetter: false, sources: ['Rapsodo', 'Trackman'],             category: 'Pitching'       },
  extension:                  { label: 'Extension',                 unit: 'ft',  lowerIsBetter: false, sources: ['Rapsodo', 'Trackman'],             category: 'Pitching'       },
  pop_time:                   { label: 'Pop Time',                  unit: 's',   lowerIsBetter: true,  sources: ['Pocket Radar', 'Coach In-Person'], category: 'Catcher'        },
  catcher_throwing_velocity:  { label: 'Arm Strength',              unit: 'mph', lowerIsBetter: false, sources: ['Pocket Radar'],                    category: 'Catcher'        },
  outfield_throwing_velocity: { label: 'Arm Strength',              unit: 'mph', lowerIsBetter: false, sources: ['Pocket Radar'],                    category: 'Outfield'       },
  infield_throwing_velocity:  { label: 'Arm Strength',              unit: 'mph', lowerIsBetter: false, sources: ['Pocket Radar'],                    category: 'Infield'        },
};

// ─── Position to metric mapping ───────────────────────────────────────────────

const UNIVERSAL: MetricKey[]        = ['sixty_yard_dash', 'home_to_first'];
const HITTING: MetricKey[]          = ['exit_velocity', 'bat_speed', 'launch_angle', 'attack_angle', 'barrel_pct'];
const PITCHING: MetricKey[]         = ['fastball_velocity', 'secondary_pitch_velocity', 'spin_rate', 'horizontal_break', 'vertical_break', 'extension'];
const CATCHER: MetricKey[]          = ['pop_time', 'catcher_throwing_velocity'];
const OUTFIELD: MetricKey[]         = ['outfield_throwing_velocity'];
const MIDDLE_INFIELD: MetricKey[]   = ['infield_throwing_velocity'];

function getMetricsForPosition(primary: string, secondary?: string | null): MetricKey[] {
  const seen = new Set<MetricKey>();
  const result: MetricKey[] = [];

  function add(keys: MetricKey[]) {
    for (const k of keys) {
      if (!seen.has(k)) { seen.add(k); result.push(k); }
    }
  }

  function addForPos(pos: string) {
    add(UNIVERSAL);
    if (pos !== 'P' && pos !== 'DH') add(HITTING);
    if (pos === 'P') add(PITCHING);
    if (pos === 'C') add(CATCHER);
    if (pos === 'LF' || pos === 'CF' || pos === 'RF') add(OUTFIELD);
    if (pos === '2B' || pos === 'SS') add(MIDDLE_INFIELD);
  }

  addForPos(primary);
  if (secondary) addForPos(secondary);
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedMetric {
  id: string;
  metric_key: MetricKey;
  value: number;
  unit: string;
  source_label: string | null;
  verification_type: string;
  is_personal_best: boolean;
  recorded_at: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0d1117',
  border: '1px solid #1e2530',
  borderRadius: '0.5rem',
  color: '#f0f6fc',
  fontSize: '0.9rem',
  padding: '0.6rem 0.85rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  paddingRight: '2.5rem',
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  metricKey,
  def,
  personalBest,
  onSaved,
}: {
  metricKey: MetricKey;
  def: MetricDef;
  personalBest: SavedMetric | null;
  onSaved: (metric: SavedMetric) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [value, setValue]       = useState('');
  const [source, setSource]     = useState(def.sources[0]);
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);

  const verColor = personalBest?.verification_type === 'coach_verified'
    ? '#e8a020'
    : personalBest?.verification_type?.startsWith('third_party')
    ? '#58a6ff'
    : '#6b7280';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      setMsg({ text: 'Enter a valid positive number.', ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/athlete/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_key:    metricKey,
          metric_value:  num,
          source,
          date_recorded: date,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed.');
      if (json.updated) {
        setMsg({ text: 'New personal best saved!', ok: true });
        onSaved(json.metric as SavedMetric);
      } else {
        setMsg({ text: 'Submitted but did not beat your personal best.', ok: false });
      }
      setValue('');
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Save failed.', ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      backgroundColor: '#111827',
      border: `1px solid ${open ? '#e8a020' : '#1e2530'}`,
      borderRadius: '0.75rem',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setMsg(null); }}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            color: '#6b7280',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: '0 0 0.3rem',
          }}>
            {def.label}
          </p>
          {personalBest ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '1.35rem', fontWeight: 700, color: '#f0f6fc' }}>
                {personalBest.value}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
                {def.unit}
              </span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: verColor,
                background: `${verColor}18`,
                border: `1px solid ${verColor}40`,
                borderRadius: '0.25rem',
                padding: '0.1rem 0.35rem',
                letterSpacing: '0.04em',
              }}>
                {personalBest.source_label ?? personalBest.verification_type}
              </span>
            </div>
          ) : (
            <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#4b5563', margin: 0 }}>
              No entry yet — tap to add
            </p>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Inline form */}
      {open && (
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid #1e2530',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                Value ({def.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0.00"
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                Source
              </label>
              <select value={source} onChange={e => setSource(e.target.value)} style={selectStyle}>
                {def.sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
              Date Recorded
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark', maxWidth: '180px' }}
            />
          </div>

          <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#4b5563', margin: 0 }}>
            {def.lowerIsBetter
              ? 'Lower is better — only saved if it beats your personal best.'
              : 'Higher is better — only saved if it beats your personal best.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: saving ? '#92650f' : '#e8a020',
                border: 'none',
                borderRadius: '0.4rem',
                color: '#000',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.5rem 1.25rem',
              }}
            >
              {saving ? 'Saving...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setMsg(null); }}
              style={{
                background: 'none',
                border: '1px solid #1e2530',
                borderRadius: '0.4rem',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '0.5rem 0.9rem',
              }}
            >
              Cancel
            </button>
            {msg && (
              <span style={{ color: msg.ok ? '#22c55e' : '#f87171', fontSize: '0.8rem', fontWeight: 500 }}>
                {msg.text}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyMetricsPage() {
  const { user, isLoaded } = useUser();

  const [primaryPos, setPrimaryPos]   = useState<string>('');
  const [secondaryPos, setSecondaryPos] = useState<string | null>(null);
  const [metrics, setMetrics]         = useState<SavedMetric[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) return;
    Promise.all([
      fetch('/api/athlete/profile').then(r => r.json()),
      fetch('/api/athlete/metrics').then(r => r.json()),
    ]).then(([profileData, metricsData]) => {
      const p = profileData.profile;
      if (p) {
        setPrimaryPos(p.position ?? '');
        setSecondaryPos(p.secondary_position ?? null);
      }
      setMetrics((metricsData.metrics ?? []) as SavedMetric[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isLoaded, user]);

  function handleSaved(updated: SavedMetric) {
    setMetrics(prev => {
      const without = prev.map(m =>
        m.metric_key === updated.metric_key && m.is_personal_best
          ? { ...m, is_personal_best: false }
          : m
      );
      return [updated, ...without];
    });
  }

  const personalBests = new Map<MetricKey, SavedMetric>();
  for (const m of metrics) {
    if (m.is_personal_best) personalBests.set(m.metric_key as MetricKey, m);
  }

  const metricKeys = primaryPos ? getMetricsForPosition(primaryPos, secondaryPos) : [];

  const universalKeys = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Universal');
  const hittingKeys   = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Hitting');
  const pitchingKeys  = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Pitching');
  const catcherKeys   = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Catcher');
  const outfieldKeys  = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Outfield');
  const infieldKeys   = metricKeys.filter(k => METRIC_DEFS[k]?.category === 'Infield');

  const sections = [
    { title: 'Speed',        keys: universalKeys  },
    { title: 'Hitting',      keys: hittingKeys    },
    { title: 'Pitching',     keys: pitchingKeys   },
    { title: 'Catcher',      keys: catcherKeys    },
    { title: 'Outfield',     keys: outfieldKeys   },
    { title: 'Infield',      keys: infieldKeys    },
  ].filter(s => s.keys.length > 0);

  if (!isLoaded || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <AthleteSidebar />
        <main style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading metrics...</span>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', maxWidth: '780px' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            My Metrics
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Track your personal bests. Only your best number is kept on file.
          </p>
        </div>

        {!primaryPos ? (
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(232,160,32,0.3)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <p style={{ color: '#e8a020', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.5rem', fontFamily: 'monospace' }}>
              &#9670; Set your position first
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: '1.5' }}>
              Your position determines which metrics are tracked. Set your primary position in your profile.
            </p>
            <a
              href="/dashboard/athlete/profile"
              style={{
                backgroundColor: '#e8a020',
                borderRadius: '0.4rem',
                color: '#000',
                display: 'inline-block',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.5rem 1.25rem',
                textDecoration: 'none',
              }}
            >
              Go to Profile &#8594;
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {sections.map(({ title, keys }) => (
              <div key={title}>
                <h2 style={{
                  color: '#9ca3af',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  margin: '0 0 0.75rem',
                }}>
                  {title}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {keys.map(key => (
                    <MetricCard
                      key={key}
                      metricKey={key}
                      def={METRIC_DEFS[key]}
                      personalBest={personalBests.get(key) ?? null}
                      onSaved={handleSaved}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
