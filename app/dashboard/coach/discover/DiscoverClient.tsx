'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Result {
  clerk_user_id:      string;
  username:           string | null;
  first_name:         string | null;
  last_name:          string | null;
  photo_url:          string | null;
  position:           string | null;
  secondary_position: string | null;
  grad_year:          number | null;
  state:              string | null;
  bats:               string | null;
  throws:             string | null;
  gpa:                number | null;
  sixty_yard:         number | null;
  fb_velo:            number | null;
  exit_velo:          number | null;
  verification_tier:  number | null;
  is_saved:           boolean;
}

interface ApiResponse {
  results: Result[];
  total:   number;
  hasMore: boolean;
}

// All filter values are kept as strings in draft state (raw input forms).
// Empty string ⇒ filter omitted from the request.
interface Filters {
  // primary
  position:        string;
  gradYearMin:     string;
  gradYearMax:     string;
  state:           string;
  throws:          string;
  bats:            string;
  gpaMin:          string;
  gpaMax:          string;
  // athletic / speed
  sixtyMax:        string;
  vertJumpMin:     string;
  armStrengthMin:  string;
  // hitting
  exitVeloMin:     string;
  batSpeedMin:     string;
  launchAngleMin:  string;
  launchAngleMax:  string;
  distanceMin:     string;
  battingAvgMin:   string;
  // pitching
  fbVeloMin:       string;
  curveVeloMin:    string;
  sliderVeloMin:   string;
  eraMax:          string;
  inningsMin:      string;
  // catcher
  popTimeMax:      string;
  // academic
  satMin:          string;
  actMin:          string;
}

const EMPTY_FILTERS: Filters = {
  position: '', gradYearMin: '', gradYearMax: '', state: '',
  throws: '',   bats: '',
  gpaMin: '',   gpaMax: '',
  sixtyMax: '', vertJumpMin: '', armStrengthMin: '',
  exitVeloMin: '', batSpeedMin: '', launchAngleMin: '', launchAngleMax: '',
  distanceMin: '', battingAvgMin: '',
  fbVeloMin: '', curveVeloMin: '', sliderVeloMin: '', eraMax: '', inningsMin: '',
  popTimeMax: '',
  satMin: '', actMin: '',
};

const PAGE_SIZE = 20;

const POSITIONS = ['CF', 'RF', 'LF', '2B', '3B', 'SS', '1B', 'P', 'C', 'DH'];
const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// ── Styles ────────────────────────────────────────────────────────────────────

const colors = {
  bg:      '#0a0e14',
  surface: '#111827',
  border:  '#1e2530',
  gold:    '#e8a020',
  blue:    '#58a6ff',
  text:    '#f0f6fc',
  muted:   '#6b7280',
};

const labelStyle: React.CSSProperties = {
  fontFamily:    'monospace',
  fontSize:      '0.7rem',
  color:         colors.muted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display:       'block',
  marginBottom:  '0.35rem',
};

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   '#0d1117',
  border:       `1px solid ${colors.border}`,
  borderRadius: '0.4rem',
  color:        colors.text,
  padding:      '0.45rem 0.6rem',
  fontSize:     '0.85rem',
  fontFamily:   'monospace',
  boxSizing:    'border-box',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscoverClient() {
  const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS);
  const [draft,   setDraft]       = useState<Filters>(EMPTY_FILTERS);
  const [sort,    setSort]        = useState('newest');
  const [results, setResults]     = useState<Result[]>([]);
  const [total,   setTotal]       = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [offset,  setOffset]      = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error,   setError]       = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Function-form setDraft keeps updates safe even if multiple events fire
  // before React commits — defends against stale closures.
  const updateDraft = (key: keyof Filters, v: string) =>
    setDraft(d => ({ ...d, [key]: v }));

  const fetchPage = useCallback(async (opts: { offset: number; append: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
      qs.set('sort',   sort);
      qs.set('offset', String(opts.offset));
      qs.set('limit',  String(PAGE_SIZE));

      const res  = await fetch(`/api/coach/discover?${qs}`);
      const json = (await res.json()) as ApiResponse | { error?: string };
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to load');
      const data = json as ApiResponse;
      setResults(prev => opts.append ? [...prev, ...data.results] : data.results);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(opts.offset + data.results.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  useEffect(() => { fetchPage({ offset: 0, append: false }); }, [fetchPage]);

  function applyFilters() {
    setFilters(draft);
    setFiltersOpen(false);
  }
  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className="discover-mobile-filter-btn"
        style={{
          background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`,
          borderRadius: '0.45rem', padding: '0.5rem 0.95rem', fontSize: '0.8rem',
          fontWeight: 600, cursor: 'pointer', marginBottom: '1rem', fontFamily: 'monospace',
        }}
      >
        ☰ Filters
      </button>

      <div className="discover-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

        {filtersOpen && (
          <div onClick={() => setFiltersOpen(false)} className="discover-filter-overlay" />
        )}
        <aside className={`discover-filters${filtersOpen ? ' open' : ''}`}>
          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: '0.75rem', padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h2 style={{ color: colors.text, fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="discover-filter-close"
                style={{ background: 'none', border: 'none', color: colors.muted, cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            {/* ─── Primary (always expanded) ─────────────────────────────── */}
            <Section title="Primary" defaultOpen>
              <Field label="Position">
                <select value={draft.position} onChange={e => updateDraft('position', e.target.value)} style={inputStyle}>
                  <option value="">Any</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="Grad year">
                <PairInputs minVal={draft.gradYearMin} maxVal={draft.gradYearMax}
                  onMin={v => updateDraft('gradYearMin', v)} onMax={v => updateDraft('gradYearMax', v)} />
              </Field>

              <Field label="State">
                <select value={draft.state} onChange={e => updateDraft('state', e.target.value)} style={inputStyle}>
                  <option value="">Any</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Throws">
                <Toggle name="throws" value={draft.throws}
                  options={[{ v: '', l: 'Any' }, { v: 'RHT', l: 'RHT' }, { v: 'LHT', l: 'LHT' }]}
                  onChange={v => updateDraft('throws', v)} />
              </Field>

              <Field label="Bats">
                <Toggle name="bats" value={draft.bats}
                  options={[{ v: '', l: 'Any' }, { v: 'RH', l: 'RH' }, { v: 'LH', l: 'LH' }, { v: 'Switch', l: 'Switch' }]}
                  onChange={v => updateDraft('bats', v)} />
              </Field>

              <Field label="GPA">
                <PairInputs step="0.01" minVal={draft.gpaMin} maxVal={draft.gpaMax}
                  onMin={v => updateDraft('gpaMin', v)} onMax={v => updateDraft('gpaMax', v)} />
              </Field>
            </Section>

            {/* ─── Athletic / Speed (collapsed) ─────────────────────────── */}
            <Section title="Athletic / Speed">
              <Field label="60-yard max (s)">
                <input type="number" step="0.01" placeholder="e.g. 6.8" value={draft.sixtyMax}
                  onChange={e => updateDraft('sixtyMax', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Vertical jump min (in)">
                <input type="number" step="0.5" placeholder="e.g. 28" value={draft.vertJumpMin}
                  onChange={e => updateDraft('vertJumpMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Arm strength min">
                <input type="number" placeholder="e.g. 80" value={draft.armStrengthMin}
                  onChange={e => updateDraft('armStrengthMin', e.target.value)} style={inputStyle} />
              </Field>
            </Section>

            {/* ─── Hitting (collapsed) ──────────────────────────────────── */}
            <Section title="Hitting">
              <Field label="Exit velo min (mph)">
                <input type="number" placeholder="e.g. 90" value={draft.exitVeloMin}
                  onChange={e => updateDraft('exitVeloMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Bat speed min (mph)">
                <input type="number" placeholder="e.g. 70" value={draft.batSpeedMin}
                  onChange={e => updateDraft('batSpeedMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Launch angle (deg)">
                <PairInputs step="0.5" placeholderMin="Min" placeholderMax="Max"
                  minVal={draft.launchAngleMin} maxVal={draft.launchAngleMax}
                  onMin={v => updateDraft('launchAngleMin', v)} onMax={v => updateDraft('launchAngleMax', v)} />
              </Field>
              <Field label="Distance min (ft)">
                <input type="number" placeholder="e.g. 280" value={draft.distanceMin}
                  onChange={e => updateDraft('distanceMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Batting avg min">
                <input type="number" step="0.001" placeholder="e.g. 0.300" value={draft.battingAvgMin}
                  onChange={e => updateDraft('battingAvgMin', e.target.value)} style={inputStyle} />
              </Field>
            </Section>

            {/* ─── Pitching (collapsed) ─────────────────────────────────── */}
            <Section title="Pitching">
              <Field label="FB velo min (mph)">
                <input type="number" placeholder="e.g. 85" value={draft.fbVeloMin}
                  onChange={e => updateDraft('fbVeloMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Curveball velo min (mph)">
                <input type="number" placeholder="e.g. 70" value={draft.curveVeloMin}
                  onChange={e => updateDraft('curveVeloMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Slider velo min (mph)">
                <input type="number" placeholder="e.g. 75" value={draft.sliderVeloMin}
                  onChange={e => updateDraft('sliderVeloMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="ERA max">
                <input type="number" step="0.01" placeholder="e.g. 3.50" value={draft.eraMax}
                  onChange={e => updateDraft('eraMax', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Innings pitched min">
                <input type="number" placeholder="e.g. 30" value={draft.inningsMin}
                  onChange={e => updateDraft('inningsMin', e.target.value)} style={inputStyle} />
              </Field>
            </Section>

            {/* ─── Catcher (collapsed) ──────────────────────────────────── */}
            <Section title="Catcher">
              <Field label="Pop time max (s)">
                <input type="number" step="0.01" placeholder="e.g. 2.00" value={draft.popTimeMax}
                  onChange={e => updateDraft('popTimeMax', e.target.value)} style={inputStyle} />
              </Field>
            </Section>

            {/* ─── Academic (collapsed) ─────────────────────────────────── */}
            <Section title="Academic">
              <Field label="SAT min">
                <input type="number" placeholder="e.g. 1200" value={draft.satMin}
                  onChange={e => updateDraft('satMin', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="ACT min">
                <input type="number" placeholder="e.g. 25" value={draft.actMin}
                  onChange={e => updateDraft('actMin', e.target.value)} style={inputStyle} />
              </Field>
            </Section>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
              <button type="button" onClick={applyFilters}
                style={{
                  flex: 1, background: colors.gold, color: colors.bg, border: 'none',
                  borderRadius: '0.45rem', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'monospace',
                }}>
                Apply Filters
              </button>
              <button type="button" onClick={clearFilters}
                style={{
                  background: 'transparent', color: colors.muted, border: `1px solid ${colors.border}`,
                  borderRadius: '0.45rem', padding: '0.55rem 0.75rem', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'monospace',
                }}>
                Clear
              </button>
            </div>
          </div>
        </aside>

        <section style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <p style={{ color: colors.muted, fontSize: '0.85rem', margin: 0, fontFamily: 'monospace' }}>
              {loading && results.length === 0 ? 'Searching…' : `${total} athlete${total === 1 ? '' : 's'} match`}
            </p>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '0.4rem 0.6rem' }}
            >
              <option value="newest">Newest</option>
              <option value="gradYearAsc">Grad Year Ascending</option>
              <option value="gpaDesc">GPA High to Low</option>
            </select>
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#f87171',
              fontSize: '0.85rem', marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div style={{
              background: colors.surface, border: `1px dashed ${colors.border}`,
              borderRadius: '0.75rem', padding: '3rem 1.5rem', textAlign: 'center',
            }}>
              <p style={{ color: colors.text, fontWeight: 600, margin: '0 0 0.5rem' }}>
                No athletes match your filters
              </p>
              <p style={{ color: colors.muted, fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                Try widening them, or clear all filters to see every discoverable athlete.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="discover-grid">
              {results.map(r => <ResultCard key={r.clerk_user_id} result={r} />)}
            </div>
          )}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => fetchPage({ offset, append: true })}
                disabled={loading}
                style={{
                  background: 'transparent', color: colors.gold, border: `1px solid ${colors.gold}`,
                  borderRadius: '0.45rem', padding: '0.55rem 1.5rem', fontSize: '0.8rem',
                  fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'monospace',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .discover-filter-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40;
        }
        .discover-mobile-filter-btn { display: none; }
        .discover-filters { width: 280px; flex-shrink: 0; }
        .discover-filter-close { display: none; }
        .discover-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }
        @media (max-width: 1100px) {
          .discover-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 767px) {
          .discover-mobile-filter-btn { display: inline-block; }
          .discover-filter-close { display: block; }
          .discover-filters {
            position: fixed; top: 0; left: -320px; width: 280px; height: 100vh;
            z-index: 45; overflow-y: auto; padding: 1rem; background: ${colors.bg};
            transition: left 0.25s ease;
          }
          .discover-filters.open { left: 0; }
          .discover-grid { grid-template-columns: minmax(0, 1fr); }
          .discover-layout { flex-direction: column; }
        }
      `}</style>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '0.75rem', marginTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          color: colors.text, fontSize: '0.78rem', fontWeight: 700,
          fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.25rem 0',
        }}
      >
        {title}
        <span style={{ color: colors.muted, fontSize: '0.7rem', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
          ▶
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginTop: '0.6rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function PairInputs({
  minVal, maxVal, onMin, onMax, step, placeholderMin = 'Min', placeholderMax = 'Max',
}: {
  minVal: string; maxVal: string;
  onMin: (v: string) => void; onMax: (v: string) => void;
  step?: string; placeholderMin?: string; placeholderMax?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <input type="number" step={step} placeholder={placeholderMin} value={minVal}
        onChange={e => onMin(e.target.value)} style={inputStyle} />
      <input type="number" step={step} placeholder={placeholderMax} value={maxVal}
        onChange={e => onMax(e.target.value)} style={inputStyle} />
    </div>
  );
}

interface ToggleOpt { v: string; l: string }

function Toggle({ name, value, options, onChange }: {
  name: string; value: string; options: ToggleOpt[]; onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={name} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const selected = value === opt.v;
        return (
          <button
            key={`${name}-${opt.v || 'any'}`}
            type="button"
            aria-pressed={selected}
            data-toggle-value={opt.v}
            onClick={() => onChange(opt.v)}
            style={{
              background:    selected ? 'rgba(232,160,32,0.16)' : 'transparent',
              color:         selected ? colors.gold : colors.muted,
              border:        `1px solid ${selected ? colors.gold : colors.border}`,
              borderRadius:  '0.4rem',
              padding:       '0.35rem 0.7rem',
              fontSize:      '0.75rem',
              fontWeight:    selected ? 700 : 500,
              cursor:        'pointer',
              fontFamily:    'monospace',
            }}
          >
            {opt.l}
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({ result }: { result: Result }) {
  const [saved,  setSaved]  = useState(result.is_saved);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const fullName = [result.first_name, result.last_name].filter(Boolean).join(' ') || 'Athlete';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPitcher = result.position?.toUpperCase() === 'P' || result.position?.toUpperCase() === 'TWP';
  const isVerified = (result.verification_tier ?? 0) > 0;
  const profileHref = `/profile/${result.username ?? result.clerk_user_id}`;

  async function toggleSave() {
    setBusy(true); setErr(null);
    try {
      if (saved) {
        const res = await fetch(`/api/coach/saved-athletes?athlete_clerk_id=${encodeURIComponent(result.clerk_user_id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Unsave failed');
        setSaved(false);
      } else {
        const res = await fetch('/api/coach/saved-athletes', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            athlete_clerk_id: result.clerk_user_id,
            athlete_name:     fullName,
            athlete_photo:    result.photo_url,
            athlete_username: result.username,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
        setSaved(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: '0.75rem', padding: '0.95rem', display: 'flex',
      flexDirection: 'column', gap: '0.7rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${colors.gold}`, background: 'rgba(232,160,32,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {result.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.photo_url} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: colors.gold, fontWeight: 700, fontSize: '1.05rem', fontFamily: 'monospace' }}>{initials}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: colors.text, fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.25rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {fullName}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {result.position           && <Pill>{result.position}</Pill>}
            {result.secondary_position && <Pill muted>{result.secondary_position}</Pill>}
            {result.grad_year          && <Pill>{`'${String(result.grad_year).slice(-2)}`}</Pill>}
            {result.state              && <Pill muted>{result.state}</Pill>}
            {isVerified                && <Pill gold>◆</Pill>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: `1px solid ${colors.border}`, paddingTop: '0.6rem' }}>
        {result.sixty_yard != null && <Metric label="60yd" value={`${result.sixty_yard}s`} />}
        {isPitcher && result.fb_velo  != null && <Metric label="FB"   value={`${result.fb_velo} mph`} />}
        {!isPitcher && result.exit_velo != null && <Metric label="Exit" value={`${result.exit_velo} mph`} />}
        {result.gpa != null && <Metric label="GPA" value={result.gpa.toFixed(2)} />}
      </div>

      {err && <div style={{ color: '#f87171', fontSize: '0.72rem', fontFamily: 'monospace' }}>{err}</div>}

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <a href={profileHref} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, background: 'transparent', color: colors.blue, border: `1px solid ${colors.border}`,
          borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontSize: '0.74rem',
          fontWeight: 600, textDecoration: 'none', textAlign: 'center', fontFamily: 'monospace',
        }}>
          View Profile
        </a>
        <button type="button" onClick={toggleSave} disabled={busy} style={{
          background:   saved ? 'rgba(232,160,32,0.12)' : 'transparent',
          color:        saved ? colors.gold : colors.muted,
          border:       `1px solid ${saved ? colors.gold : colors.border}`,
          borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontSize: '0.74rem',
          fontWeight:   600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
          fontFamily:   'monospace',
        }}>
          {saved ? '★ Saved' : '☆ Save'}
        </button>
      </div>
    </article>
  );
}

function Pill({ children, muted, gold }: { children: React.ReactNode; muted?: boolean; gold?: boolean }) {
  return (
    <span style={{
      fontFamily: 'monospace',
      background: gold ? 'rgba(232,160,32,0.12)' : '#0d1117',
      border:     `1px solid ${gold ? colors.gold : colors.border}`,
      borderRadius: '0.3rem', padding: '0.1rem 0.45rem', fontSize: '0.65rem',
      color: gold ? colors.gold : muted ? colors.muted : colors.text,
      letterSpacing: '0.04em', fontWeight: gold ? 700 : 500,
    }}>
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${colors.border}`,
      borderRadius: '0.35rem', padding: '0.25rem 0.55rem',
      display: 'flex', gap: '0.35rem', alignItems: 'baseline',
    }}>
      <span style={{ color: colors.muted, fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: colors.text, fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
