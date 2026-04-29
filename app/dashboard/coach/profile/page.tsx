'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';

const SPORT_OPTIONS = [
  'Baseball', 'Softball', 'Basketball', 'Football', 'Soccer',
  'Track & Field', 'Volleyball', 'Wrestling', 'Swimming', 'Tennis',
  'Lacrosse', 'Golf', 'Multi-Sport', 'Other',
];

const AGE_GROUP_OPTIONS = [
  'Youth (8–12)', 'Middle School (12–14)', 'High School (14–18)',
  'College', 'All Ages',
];

const EXPERIENCE_OPTIONS = [
  { value: 1,  label: '1 year' },
  { value: 2,  label: '2 years' },
  { value: 3,  label: '3 years' },
  { value: 5,  label: '5 years' },
  { value: 10, label: '10 years' },
  { value: 15, label: '15+ years' },
  { value: 20, label: '20+ years' },
];

export default function CoachProfilePage() {
  const [fullName, setFullName]             = useState('');
  const [email, setEmail]                   = useState('');
  const [phone, setPhone]                   = useState('');
  const [title, setTitle]                   = useState('');
  const [organization, setOrganization]     = useState('');
  const [website, setWebsite]               = useState('');
  const [sportFocus, setSportFocus]         = useState('');
  const [yearsExp, setYearsExp]             = useState<number | ''>('');
  const [ageGroups, setAgeGroups]           = useState('');
  const [certifications, setCertifications] = useState('');
  const [bio, setBio]                       = useState('');
  const [coachingStyle, setCoachingStyle]   = useState('');
  const [achievements, setAchievements]     = useState('');
  const [instagram, setInstagram]           = useState('');
  const [twitter, setTwitter]               = useState('');
  const [photoUrl, setPhotoUrl]             = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]         = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/setup');
      if (!res.ok) return;
      const { coach } = await res.json();
      if (!coach) return;
      setFullName(coach.full_name ?? '');
      setEmail(coach.email ?? '');
      setPhone(coach.phone ?? '');
      setTitle(coach.title ?? '');
      setOrganization(coach.organization ?? '');
      setWebsite(coach.website ?? '');
      setSportFocus(coach.sport_focus ?? '');
      setYearsExp(coach.years_experience ?? '');
      setAgeGroups(coach.age_groups ?? '');
      setCertifications(coach.certifications ?? '');
      setBio(coach.bio ?? '');
      setCoachingStyle(coach.coaching_style ?? '');
      setAchievements(coach.achievements ?? '');
      setInstagram(coach.instagram ?? '');
      setTwitter(coach.twitter ?? '');
      setPhotoUrl(coach.photo_url ?? null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Max file size is 5 MB.'); return; }
    setPhotoUploading(true); setPhotoError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/coach/upload-photo', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed.');
      setPhotoUrl(data.url);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setPhotoUploading(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim())     { setError('Full name is required.'); return; }
    if (!email.trim())        { setError('Email is required.'); return; }
    if (!organization.trim()) { setError('Organization is required.'); return; }
    if (!title.trim())        { setError('Title is required.'); return; }
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/coach/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:       fullName.trim(),
          email:           email.trim(),
          phone:           phone.trim()          || null,
          title:           title.trim(),
          organization:    organization.trim(),
          website:         website.trim()        || null,
          sport_focus:     sportFocus            || null,
          years_experience: yearsExp !== '' ? Number(yearsExp) : null,
          age_groups:      ageGroups             || null,
          certifications:  certifications.trim() || null,
          bio:             bio.trim()            || null,
          coaching_style:  coachingStyle.trim()  || null,
          achievements:    achievements.trim()   || null,
          instagram:       instagram.trim()      || null,
          twitter:         twitter.trim()        || null,
          photo_url:       photoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  const label: React.CSSProperties = {
    color: '#9ca3af', fontSize: '0.78rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'block', marginBottom: '0.4rem',
  };
  const input: React.CSSProperties = {
    width: '100%', backgroundColor: '#0d1117', border: '1px solid #1e2530',
    borderRadius: '0.5rem', color: '#f0f6fc', padding: '0.6rem 0.75rem',
    fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
  };
  const section: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1e2530',
    borderRadius: '0.75rem', padding: '1.5rem',
    marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
  };
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontFamily: 'monospace' }}>Loading profile...</p>
      </main>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <form onSubmit={handleSave} style={{ maxWidth: '700px' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>My Profile</h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                This information is shown to athletes who find you in the Coach Finder.
              </p>
            </div>
          </div>

          {/* ── Profile Photo ─────────────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Profile Photo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '88px', height: '88px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'rgba(232,160,32,0.1)', border: '2px solid rgba(232,160,32,0.3)',
                  overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {photoUrl
                  ? <img src={photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#e8a020', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>{fullName ? fullName.charAt(0).toUpperCase() : '◆'}</span>
                }
                <div
                  style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <span style={{ color: '#fff', fontSize: '0.68rem', fontWeight: 600 }}>Change</span>
                </div>
              </div>
              <div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                  style={{ backgroundColor: '#1e2530', border: '1px solid #374151', borderRadius: '0.5rem', color: '#f0f6fc', cursor: photoUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 1.1rem' }}>
                  {photoUploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                <p style={{ color: '#4b5563', fontSize: '0.72rem', margin: '0.4rem 0 0' }}>JPG, PNG or WebP · Max 5 MB</p>
                {photoError && <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{photoError}</p>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
          </div>

          {/* ── Contact Info ──────────────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Contact Information</p>
            <div style={grid2}>
              <div>
                <label style={label}>Full Name *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Coach John Smith" style={input} />
              </div>
              <div>
                <label style={label}>Contact Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@school.edu" style={input} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={label}>Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" style={input} />
              </div>
              <div>
                <label style={label}>Website (optional)</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" style={input} />
              </div>
            </div>
          </div>

          {/* ── Role & Organization ───────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Role & Organization</p>
            <div style={grid2}>
              <div>
                <label style={label}>Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Head Coach / Trainer" style={input} />
              </div>
              <div>
                <label style={label}>School / Organization *</label>
                <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Lincoln High School" style={input} />
              </div>
            </div>
          </div>

          {/* ── Expertise ─────────────────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Expertise</p>
            <div style={grid2}>
              <div>
                <label style={label}>Sport / Focus</label>
                <select value={sportFocus} onChange={e => setSportFocus(e.target.value)} style={{ ...input, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select sport...</option>
                  {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Years of Experience</label>
                <select value={yearsExp} onChange={e => setYearsExp(e.target.value ? Number(e.target.value) : '')} style={{ ...input, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select...</option>
                  {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={label}>Age Groups You Work With</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {AGE_GROUP_OPTIONS.map(ag => {
                  const sel = ageGroups === ag;
                  return (
                    <button key={ag} type="button" onClick={() => setAgeGroups(sel ? '' : ag)}
                      style={{ padding: '0.35rem 0.85rem', borderRadius: '9999px', cursor: 'pointer', border: `1px solid ${sel ? '#e8a020' : '#1e2530'}`, backgroundColor: sel ? 'rgba(232,160,32,0.12)' : 'transparent', color: sel ? '#e8a020' : '#6b7280', fontSize: '0.8rem', fontWeight: sel ? 600 : 400, transition: 'all 0.1s' }}>
                      {ag}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={label}>Certifications & Licenses</label>
              <input type="text" value={certifications} onChange={e => setCertifications(e.target.value)}
                placeholder="e.g. NSCA-CSCS, Perfect Game Scout, USA Baseball Level 2" style={input} />
            </div>
          </div>

          {/* ── Bio & Story ───────────────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Bio & Story</p>
            <div>
              <label style={label}>Coach Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
                placeholder="Tell athletes about your coaching background, philosophy, and what makes your sessions valuable..."
                style={{ ...input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
              <p style={{ color: '#4b5563', fontSize: '0.7rem', margin: '0.25rem 0 0', textAlign: 'right' }}>{bio.length} chars</p>
            </div>
            <div>
              <label style={label}>Coaching Style</label>
              <textarea value={coachingStyle} onChange={e => setCoachingStyle(e.target.value)} rows={3}
                placeholder="e.g. Data-driven and athlete-focused. I use video analysis alongside performance metrics..."
                style={{ ...input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={label}>Achievements & Highlights</label>
              <textarea value={achievements} onChange={e => setAchievements(e.target.value)} rows={3}
                placeholder="e.g. 3x State Championship Coach · 12 athletes signed D1 · Region Coach of the Year 2023"
                style={{ ...input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
            </div>
          </div>

          {/* ── Social Links ──────────────────────────────────────────────────── */}
          <div style={section}>
            <p style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 -0.25rem' }}>
              Social Links <span style={{ color: '#4b5563', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span>
            </p>
            <div style={grid2}>
              <div>
                <label style={label}>Instagram</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '0.85rem', pointerEvents: 'none' }}>@</span>
                  <input type="text" value={instagram} onChange={e => setInstagram(e.target.value.replace('@', ''))} placeholder="yourhandle" style={{ ...input, paddingLeft: '1.75rem' }} />
                </div>
              </div>
              <div>
                <label style={label}>Twitter / X</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '0.85rem', pointerEvents: 'none' }}>@</span>
                  <input type="text" value={twitter} onChange={e => setTwitter(e.target.value.replace('@', ''))} placeholder="yourhandle" style={{ ...input, paddingLeft: '1.75rem' }} />
                </div>
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '2rem' }}>
            <button type="submit" disabled={saving}
              style={{ backgroundColor: saving ? '#374151' : '#e8a020', color: saving ? '#6b7280' : '#000', border: 'none', borderRadius: '0.5rem', padding: '0.7rem 2.25rem', fontSize: '0.95rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s' }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saved && <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 500 }}>✓ Changes saved</span>}
          </div>

        </form>
      </main>
    </div>
  );
}
