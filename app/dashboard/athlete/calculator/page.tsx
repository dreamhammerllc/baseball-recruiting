'use client';

import { useState, useCallback } from 'react';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import { getSchoolMatches, type SchoolMatch, type MatchInput } from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

type Position = 'pitcher' | 'catcher' | 'position';
type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO';
type Region = 'Northeast' | 'Southeast' | 'Midwest' | 'Southwest' | 'West' | 'Any';
type CampusSize = 'small' | 'medium' | 'large' | 'any';

interface FormData {
  // Round 1
  gradYear: string; state: string; gpa: string; testType: 'SAT' | 'ACT'; testScore: string;
  // Round 2
  position: Position | '';
  velocity: string; secondaryPitch: string; inningsPitched: string; era: string;
  popTime: string; catcherExitVelo: string; catcherAvg: string; armStrength: string;
  exitVelocity: string; battingAvg: string; fieldingPosition: string; dash60: string;
  // Round 3
  division: Division | ''; region: Region | ''; majorInterest: string; campusSize: CampusSize | '';
  // Round 4
  hasCoach: boolean | null; hasMeasurables: boolean | null; willingCombine: boolean | null;
  // Round 5
  fullName: string; phone: string; parentEmail: string;
}

const EMPTY: FormData = {
  gradYear: '', state: '', gpa: '', testType: 'SAT', testScore: '',
  position: '',
  velocity: '', secondaryPitch: '', inningsPitched: '', era: '',
  popTime: '', catcherExitVelo: '', catcherAvg: '', armStrength: '',
  exitVelocity: '', battingAvg: '', fieldingPosition: '', dash60: '',
  division: '', region: '', majorInterest: '', campusSize: '',
  hasCoach: null, hasMeasurables: null, willingCombine: null,
  fullName: '', phone: '', parentEmail: '',
};

const ROUND_TITLES = ['', 'Basic Info', 'Baseball Stats', 'Goals & Fit', 'Verification', 'Get Your Matches'];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const [round, setRound] = useState(1);
  const [dir, setDir] = useState<'fwd' | 'bk'>('fwd');
  const [data, setData] = useState<FormData>(EMPTY);
  type ResultState =
    | { phase: 'form' }
    | { phase: 'loading' }
    | { phase: 'results'; matches: SchoolMatch[] }
    | { phase: 'error'; message: string };

  const [result, setResult] = useState<ResultState>({ phase: 'form' });

  const patch = useCallback((partial: Partial<FormData>) => setData(d => ({ ...d, ...partial })), []);

  function goNext() { setDir('fwd'); setRound(r => r + 1); }
  function goBack() { setDir('bk'); setRound(r => r - 1); }

  async function handleSubmit() {
    setResult({ phase: 'loading' });
    try {
      const input: MatchInput = { ...data, position: data.position || 'position' };
      const matches = await getSchoolMatches(input);
      setResult({ phase: 'results', matches });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setResult({ phase: 'error', message });
    }
  }

  const roundProps = { data, patch, onNext: goNext, onBack: goBack };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>

          {/* Page header */}
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem', letterSpacing: '-0.02em' }}>
              Recruiting Calculator
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              Answer 5 rounds of questions to get your personalized school matches.
            </p>
          </div>

          {/* Diamond progress — hide once out of form phase */}
          {result.phase === 'form' && <DiamondProgress round={round} />}

          {/* Round card / results */}
          {result.phase === 'form' ? (
            <div key={`${round}-${dir}`} style={{ animation: `${dir === 'fwd' ? 'slideInRight' : 'slideInLeft'} 0.22s ease both` }}>
              <style>{`
                @keyframes slideInRight { from { opacity:0; transform:translateX(28px) } to { opacity:1; transform:translateX(0) } }
                @keyframes slideInLeft  { from { opacity:0; transform:translateX(-28px) } to { opacity:1; transform:translateX(0) } }
              `}</style>

              {/* Round label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ backgroundColor: '#e8a020', color: '#000', fontWeight: 700, fontSize: '0.7rem', borderRadius: '999px', padding: '0.2rem 0.6rem', letterSpacing: '0.04em' }}>
                  ROUND {round} / 5
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 600 }}>{ROUND_TITLES[round]}</span>
              </div>

              <div style={card}>
                {round === 1 && <Round1 {...roundProps} />}
                {round === 2 && <Round2 {...roundProps} />}
                {round === 3 && <Round3 {...roundProps} />}
                {round === 4 && <Round4 {...roundProps} />}
                {round === 5 && <Round5 {...roundProps} onSubmit={handleSubmit} />}
              </div>
            </div>
          ) : result.phase === 'loading' ? (
            <LoadingResults />
          ) : result.phase === 'results' ? (
            <ResultsScreen
              data={data}
              matches={result.matches}
              onReset={() => { setResult({ phase: 'form' }); setRound(1); setData(EMPTY); }}
            />
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: '#fca5a5', marginBottom: '1rem' }}>⚠️ {result.message}</p>
              <button onClick={() => setResult({ phase: 'form' })} style={{ backgroundColor: '#e8a020', color: '#000', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: 700, cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Diamond Progress Indicator ────────────────────────────────────────────────

function DiamondProgress({ round }: { round: number }) {
  // Bases: 0=none, 1=1B, 2=2B, 3=3B, 4=Home(score)
  // round 1→on way to 1B, 2→1B reached, etc.
  const reached = round - 1; // how many bases touched

  const bases = [
    { id: 'home', cx: 80, cy: 140, label: 'Start', index: 0 },
    { id: '1b',   cx: 150, cy: 80, label: '1B',    index: 1 },
    { id: '2b',   cx: 80,  cy: 20, label: '2B',    index: 2 },
    { id: '3b',   cx: 10,  cy: 80, label: '3B',    index: 3 },
    { id: 'score',cx: 80, cy: 140, label: '🏠',    index: 4 },
  ];

  // Current base being visited (0-indexed, 0 = home start, 4 = scored)
  const current = round - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: '#111827', borderRadius: '0.75rem', border: '1px solid #1e2530' }}>
      <svg viewBox="0 0 160 160" width="90" height="90" style={{ flexShrink: 0 }}>
        {/* Diamond lines */}
        {[
          [80, 140, 150, 80],
          [150, 80, 80, 20],
          [80, 20, 10, 80],
          [10, 80, 80, 140],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e2530" strokeWidth="2" />
        ))}

        {/* Bases */}
        {bases.slice(0, 4).map((b) => {
          const done = b.index < current;
          const active = b.index === current;
          return (
            <g key={b.id}>
              <rect
                x={b.cx - 10} y={b.cy - 10} width="20" height="20"
                rx="3" ry="3"
                transform={`rotate(45, ${b.cx}, ${b.cy})`}
                fill={done ? '#e8a020' : active ? '#e8a020' : '#1e2530'}
                stroke={active ? '#fbbf24' : done ? '#e8a020' : '#374151'}
                strokeWidth={active ? '2.5' : '1.5'}
                opacity={active ? 1 : done ? 0.9 : 0.5}
              />
              <text x={b.cx} y={b.cy + 28} textAnchor="middle" fill={active || done ? '#e8a020' : '#4b5563'} fontSize="9" fontWeight={active ? '700' : '400'}>
                {b.label}
              </text>
            </g>
          );
        })}

        {/* Runner dot */}
        {(() => {
          const pos = bases[Math.min(current, 3)];
          return (
            <circle cx={pos.cx} cy={pos.cy} r="5" fill="#e8a020" opacity="0.95">
              <animate attributeName="r" values="5;6.5;5" dur="1.2s" repeatCount="indefinite" />
            </circle>
          );
        })()}
      </svg>

      <div>
        <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Progress
        </p>
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem' }}>
          {[1, 2, 3, 4, 5].map(r => (
            <div key={r} style={{ width: '28px', height: '4px', borderRadius: '2px', backgroundColor: r <= round ? '#e8a020' : '#1e2530', transition: 'background-color 0.3s' }} />
          ))}
        </div>
        <p style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
          {ROUND_TITLES[round]}
        </p>
      </div>
    </div>
  );
}

// ── Round 1: Basic Info ───────────────────────────────────────────────────────

function Round1({ data, patch, onNext }: RoundProps) {
  const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  const years = ['2026','2027','2028','2029','2030','2031'];

  return (
    <div style={fieldStack}>
      <Row>
        <Field label="Graduation Year" required>
          <Select value={data.gradYear} onChange={v => patch({ gradYear: v })} placeholder="Select year">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
        <Field label="Home State" required>
          <Select value={data.state} onChange={v => patch({ state: v })} placeholder="Select state">
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </Row>
      <Field label="GPA (unweighted)" required>
        <Input type="text" inputMode="decimal" placeholder="e.g. 3.5" value={data.gpa} onChange={v => patch({ gpa: v })} />
      </Field>
      <Row>
        <Field label="Test Type">
          <Select value={data.testType} onChange={v => patch({ testType: v as 'SAT' | 'ACT' })} placeholder="">
            <option value="SAT">SAT</option>
            <option value="ACT">ACT</option>
          </Select>
        </Field>
        <Field label={`${data.testType} Score`}>
          <Input type="text" inputMode="numeric" placeholder={data.testType === 'SAT' ? 'e.g. 1150' : 'e.g. 24'} value={data.testScore} onChange={v => patch({ testScore: v })} />
        </Field>
      </Row>
      <NextBtn onClick={onNext} disabled={!data.gradYear || !data.state || !data.gpa} />
    </div>
  );
}

// ── Round 2: Baseball Stats ───────────────────────────────────────────────────

function Round2({ data, patch, onNext, onBack }: RoundProps) {
  if (!data.position) {
    return (
      <div style={fieldStack}>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>What is your primary position?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {([
            ['pitcher', '⚾ Pitcher', 'Starting / relief pitcher'],
            ['catcher', '🧤 Catcher', 'Behind the plate'],
            ['position', '🏃 Position Player', 'Infielder or outfielder'],
          ] as const).map(([val, label, sub]) => (
            <button key={val} type="button" onClick={() => patch({ position: val })} style={posBtn}>
              <span style={{ fontWeight: 600, color: '#f3f4f6' }}>{label}</span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sub}</span>
            </button>
          ))}
        </div>
        <BackBtn onClick={onBack} />
      </div>
    );
  }

  const pos = data.position;
  return (
    <div style={fieldStack}>
      <button type="button" onClick={() => patch({ position: '' })} style={{ background: 'none', border: 'none', color: '#e8a020', fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginBottom: '0.25rem', textAlign: 'left' }}>
        ← Change position
      </button>

      {pos === 'pitcher' && <>
        <Row>
          <Field label="Fastball Velocity (mph)" required><Input type="text" inputMode="numeric" placeholder="e.g. 85" value={data.velocity} onChange={v => patch({ velocity: v })} /></Field>
          <Field label="Best Secondary Pitch"><Input type="text" placeholder="e.g. Curveball" value={data.secondaryPitch} onChange={v => patch({ secondaryPitch: v })} /></Field>
        </Row>
        <Row>
          <Field label="Innings Pitched (season)"><Input type="text" inputMode="numeric" placeholder="e.g. 42" value={data.inningsPitched} onChange={v => patch({ inningsPitched: v })} /></Field>
          <Field label="ERA"><Input type="text" inputMode="decimal" placeholder="e.g. 2.40" value={data.era} onChange={v => patch({ era: v })} /></Field>
        </Row>
      </>}

      {pos === 'catcher' && <>
        <Row>
          <Field label="Pop Time (seconds)" required><Input type="text" inputMode="decimal" placeholder="e.g. 1.95" value={data.popTime} onChange={v => patch({ popTime: v })} /></Field>
          <Field label="Exit Velocity (mph)"><Input type="text" inputMode="numeric" placeholder="e.g. 88" value={data.catcherExitVelo} onChange={v => patch({ catcherExitVelo: v })} /></Field>
        </Row>
        <Row>
          <Field label="Batting Average"><Input type="text" inputMode="decimal" placeholder="e.g. .310" value={data.catcherAvg} onChange={v => patch({ catcherAvg: v })} /></Field>
          <Field label="Arm Strength (mph)"><Input type="text" inputMode="numeric" placeholder="e.g. 80" value={data.armStrength} onChange={v => patch({ armStrength: v })} /></Field>
        </Row>
      </>}

      {pos === 'position' && <>
        <Row>
          <Field label="Exit Velocity (mph)" required><Input type="text" inputMode="numeric" placeholder="e.g. 95" value={data.exitVelocity} onChange={v => patch({ exitVelocity: v })} /></Field>
          <Field label="Batting Average"><Input type="text" inputMode="decimal" placeholder="e.g. .320" value={data.battingAvg} onChange={v => patch({ battingAvg: v })} /></Field>
        </Row>
        <Row>
          <Field label="Primary Fielding Position">
            <Select value={data.fieldingPosition} onChange={v => patch({ fieldingPosition: v })} placeholder="Select position">
              {['SS','2B','3B','1B','CF','LF/RF','Util'].map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="60-Yard Dash (seconds)"><Input type="text" inputMode="decimal" placeholder="e.g. 7.1" value={data.dash60} onChange={v => patch({ dash60: v })} /></Field>
        </Row>
      </>}

      <NextBtn onClick={onNext} disabled={
        pos === 'pitcher' ? !data.velocity :
        pos === 'catcher' ? !data.popTime :
        !data.exitVelocity
      } />
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ── Round 3: Goals & Fit ──────────────────────────────────────────────────────

function Round3({ data, patch, onNext, onBack }: RoundProps) {
  return (
    <div style={fieldStack}>
      <Field label="Target Division" required>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {(['D1','D2','D3','NAIA','JUCO'] as Division[]).map(d => (
            <Chip key={d} active={data.division === d} onClick={() => patch({ division: d })}>{d}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Preferred Region" required>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {(['Northeast','Southeast','Midwest','Southwest','West','Any'] as Region[]).map(r => (
            <Chip key={r} active={data.region === r} onClick={() => patch({ region: r })}>{r}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Academic Major Interest">
        <Input type="text" placeholder="e.g. Business, Engineering, Undecided" value={data.majorInterest} onChange={v => patch({ majorInterest: v })} />
      </Field>
      <Field label="Campus Size Preference" required>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([['small','< 5k'], ['medium','5–15k'], ['large','15k+'], ['any','No preference']] as [CampusSize, string][]).map(([val, label]) => (
            <Chip key={val} active={data.campusSize === val} onClick={() => patch({ campusSize: val })}>{label}</Chip>
          ))}
        </div>
      </Field>
      <NextBtn onClick={onNext} disabled={!data.division || !data.region || !data.campusSize} />
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ── Round 4: Verification ─────────────────────────────────────────────────────

function Round4({ data, patch, onNext, onBack }: RoundProps) {
  const questions: { key: keyof FormData; label: string; sub: string }[] = [
    { key: 'hasCoach',       label: 'Do you have a HS or travel coach who can verify your stats?', sub: 'Verified athletes get priority placement' },
    { key: 'hasMeasurables', label: 'Do you have measurables from HitTrax, Rapsodo, or similar?', sub: 'Data-backed profiles rank higher' },
    { key: 'willingCombine', label: 'Are you willing to attend a Diamond Verified combine session?', sub: 'Combines unlock full verification badge' },
  ];

  const allAnswered = questions.every(q => data[q.key] !== null);

  return (
    <div style={fieldStack}>
      {questions.map(({ key, label, sub }) => (
        <div key={key} style={{ backgroundColor: '#0d1117', borderRadius: '0.6rem', padding: '1rem', border: '1px solid #1e2530' }}>
          <p style={{ color: '#f3f4f6', fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.2rem' }}>{label}</p>
          <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>{sub}</p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {([true, false] as const).map(val => (
              <button
                key={String(val)}
                type="button"
                onClick={() => patch({ [key]: val })}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '0.4rem', border: '1.5px solid',
                  borderColor: data[key] === val ? '#e8a020' : '#374151',
                  backgroundColor: data[key] === val ? 'rgba(232,160,32,0.1)' : 'transparent',
                  color: data[key] === val ? '#e8a020' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                }}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
      <NextBtn onClick={onNext} disabled={!allAnswered} />
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ── Round 5: Lead Capture ─────────────────────────────────────────────────────

interface Round5Props extends RoundProps { onSubmit: () => void; }

function Round5({ data, patch, onBack, onSubmit }: Round5Props) {
  const valid = data.fullName.trim() && data.phone.trim() && data.parentEmail.includes('@');
  return (
    <div style={fieldStack}>
      <div style={{ backgroundColor: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.25)', borderRadius: '0.6rem', padding: '0.875rem 1rem', marginBottom: '0.25rem' }}>
        <p style={{ color: '#e8a020', fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.25rem' }}>🏆 You&apos;re almost there!</p>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Enter your contact info to unlock your personalized school matches and recruiting score.</p>
      </div>
      <Field label="Full Name" required>
        <Input type="text" placeholder="First Last" value={data.fullName} onChange={v => patch({ fullName: v })} />
      </Field>
      <Field label="Phone Number" required>
        <Input type="tel" placeholder="(555) 000-0000" value={data.phone} onChange={v => patch({ phone: v })} />
      </Field>
      <Field label="Parent / Guardian Email" required>
        <Input type="email" placeholder="parent@email.com" value={data.parentEmail} onChange={v => patch({ parentEmail: v })} />
      </Field>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!valid}
        style={{ width: '100%', padding: '0.85rem', borderRadius: '0.5rem', border: 'none', backgroundColor: valid ? '#e8a020' : '#374151', color: valid ? '#000' : '#6b7280', fontWeight: 700, fontSize: '1rem', cursor: valid ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s', marginTop: '0.25rem' }}
      >
        ⚾ Get My School Matches
      </button>
      <BackBtn onClick={onBack} />
    </div>
  );
}

// ── Loading Results ───────────────────────────────────────────────────────────

function LoadingResults() {
  return (
    <div style={{ ...card, textAlign: 'center', padding: '2.5rem 2rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚾</div>
      <h2 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
        Calculating Your Matches…
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Our AI is analyzing your profile against hundreds of programs. This takes a few seconds.
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e8a020',
            animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({ data, matches, onReset }: { data: FormData; matches: SchoolMatch[]; onReset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'slideInRight 0.25s ease both' }}>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{ ...card, textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏆</div>
        <h2 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
          Your Top 20 School Matches
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>
          Hey {data.fullName.split(' ')[0]} — based on your profile as a {data.position} targeting {data.division}.
        </p>
      </div>

      {/* Match cards */}
      {matches.map((m, i) => (
        <div key={i} style={{ ...card, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ color: '#4b5563', fontSize: '0.75rem', fontWeight: 600 }}>#{i + 1}</span>
                <span style={{ backgroundColor: '#1e2530', color: '#9ca3af', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 500 }}>
                  {m.division}
                </span>
              </div>
              <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{m.school}</h3>
            </div>

            {/* Fit score ring */}
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" fill="none" stroke="#1e2530" strokeWidth="4" />
                <circle
                  cx="26" cy="26" r="22" fill="none"
                  stroke={m.fitScore >= 80 ? '#e8a020' : m.fitScore >= 60 ? '#3b82f6' : '#6b7280'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(m.fitScore / 100) * 138.2} 138.2`}
                  transform="rotate(-90 26 26)"
                />
                <text x="26" y="30" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">{m.fitScore}</text>
              </svg>
              <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fit</p>
            </div>
          </div>

          {/* Fit bar */}
          <div style={{ height: '3px', backgroundColor: '#1e2530', borderRadius: '2px', marginBottom: '0.75rem' }}>
            <div style={{ height: '100%', width: `${m.fitScore}%`, borderRadius: '2px', backgroundColor: m.fitScore >= 80 ? '#e8a020' : m.fitScore >= 60 ? '#3b82f6' : '#6b7280', transition: 'width 0.6s ease' }} />
          </div>

          <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>{m.reason}</p>
        </div>
      ))}

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid #1e2530', backgroundColor: 'transparent', color: '#6b7280', fontSize: '0.875rem', cursor: 'pointer' }}
      >
        ← Start Over
      </button>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

interface RoundProps { data: FormData; patch: (p: Partial<FormData>) => void; onNext: () => void; onBack: () => void; }

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
      <label style={{ color: '#9ca3af', fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.03em' }}>
        {label}{required && <span style={{ color: '#e8a020', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ type = 'text', placeholder, value, onChange, inputMode }: {
  type?: string; placeholder?: string; value: string;
  onChange: (v: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ backgroundColor: '#0d1117', color: '#fff', border: '1px solid #1e2530', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#e8a020'}
      onBlur={e => e.target.style.borderColor = '#1e2530'}
    />
  );
}

function Select({ value, onChange, placeholder, children }: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ backgroundColor: '#0d1117', color: value ? '#fff' : '#6b7280', border: '1px solid #1e2530', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', fontSize: '0.9rem', outline: 'none', width: '100%', appearance: 'none', cursor: 'pointer' }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {children}
    </select>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.4rem 0.9rem', borderRadius: '999px', border: '1.5px solid',
        borderColor: active ? '#e8a020' : '#374151',
        backgroundColor: active ? 'rgba(232,160,32,0.1)' : 'transparent',
        color: active ? '#e8a020' : '#6b7280',
        fontSize: '0.82rem', fontWeight: active ? 600 : 400, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '0.75rem' }}>{children}</div>;
}

function NextBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: disabled ? '#1e2530' : '#e8a020', color: disabled ? '#4b5563' : '#000', fontWeight: 700, fontSize: '0.95rem', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', marginTop: '0.25rem' }}>
      Continue →
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', padding: '0.25rem 0', textAlign: 'center', width: '100%' }}>
      ← Back
    </button>
  );
}

const posBtn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', textAlign: 'left',
  padding: '0.875rem 1rem', borderRadius: '0.6rem',
  border: '1.5px solid #1e2530', backgroundColor: '#0d1117',
  cursor: 'pointer', gap: '0.15rem', transition: 'border-color 0.15s',
};

const card: React.CSSProperties = {
  backgroundColor: '#111827',
  border: '1px solid #1e2530',
  borderRadius: '0.875rem',
  padding: '1.5rem',
};

const fieldStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};
