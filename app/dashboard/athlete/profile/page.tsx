'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import AthleteSidebar from '@/components/layout/AthleteSidebar';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const POSITIONS  = ['P','C','1B','2B','3B','SS','LF','CF','RF','DH'];
const GRAD_YEARS = ['2025','2026','2027','2028','2029','2030','2031'];

interface Profile {
  full_name:           string;
  grad_year:           string;
  position:            string;
  secondary_position:  string;
  gpa_weighted:        string;
  gpa_unweighted:      string;
  home_state:          string;
  highlight_video_url: string;
  photo_url:           string;
  bio:                 string;
}

const EMPTY: Profile = {
  full_name: '', grad_year: '', position: '', secondary_position: '',
  gpa_weighted: '', gpa_unweighted: '', home_state: '',
  highlight_video_url: '', photo_url: '', bio: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

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

export default function AthleteProfilePage() {
  const { user, isLoaded } = useUser();

  const [profile, setProfile]     = useState<Profile>(EMPTY);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview]     = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const userId = user?.id ?? '';

  useEffect(() => {
    fetch('/api/athlete/profile')
      .then(r => r.json())
      .then(({ profile: p }) => {
        if (p) {
          setProfile({
            full_name:           p.full_name           ?? '',
            grad_year:           p.grad_year           ?? '',
            position:            p.position            ?? '',
            secondary_position:  p.secondary_position  ?? '',
            gpa_weighted:        p.gpa_weighted        != null ? String(p.gpa_weighted)   : '',
            gpa_unweighted:      p.gpa_unweighted      != null ? String(p.gpa_unweighted) : '',
            home_state:          p.home_state          ?? '',
            highlight_video_url: p.highlight_video_url ?? '',
            photo_url:           p.photo_url           ?? '',
            bio:                 p.bio                 ?? '',
          });
          if (p.photo_url) setPhotoPreview(p.photo_url);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set(field: keyof Profile, value: string) {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaveMsg(null);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setSaveMsg(null);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch('/api/athlete/upload-photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed.');
      setProfile(prev => ({ ...prev, photo_url: json.url }));
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Photo upload failed.');
      setPhotoPreview(profile.photo_url || null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        full_name:           profile.full_name           || null,
        grad_year:           profile.grad_year           || null,
        position:            profile.position            || null,
        secondary_position:  profile.secondary_position  || null,
        gpa_weighted:        profile.gpa_weighted        ? parseFloat(profile.gpa_weighted)   : null,
        gpa_unweighted:      profile.gpa_unweighted      ? parseFloat(profile.gpa_unweighted) : null,
        home_state:          profile.home_state          || null,
        highlight_video_url: profile.highlight_video_url || null,
        bio:                 profile.bio                 || null,
      };
      const res  = await fetch('/api/athlete/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed.');
      setSaveMsg('Saved!');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    const url = `https://diamondverified.app/profile/${userId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <AthleteSidebar />
        <main style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading profile...</span>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', maxWidth: '780px' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            My Profile
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Manage your public recruiting profile
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Photo upload */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: '#0d1117', border: '2px solid #1e2530',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              )}
              {photoUploading && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#e8a020', fontSize: '0.65rem', fontWeight: 700 }}>...</span>
                </div>
              )}
            </div>
            <div>
              <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', margin: '0 0 0.25rem' }}>Profile Photo</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>JPEG, PNG, or WebP — max 5 MB</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                style={{ backgroundColor: 'transparent', border: '1px solid #1e2530', borderRadius: '0.4rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
              >
                {photoUploading ? 'Uploading...' : 'Choose Photo'}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Basic info */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Basic Info</h2>

            <Field label="Full Name">
              <input
                type="text"
                value={profile.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="First Last"
                style={inputStyle}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Grad Year">
                <select value={profile.grad_year} onChange={e => set('grad_year', e.target.value)} style={selectStyle}>
                  <option value="">Select year</option>
                  {GRAD_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>

              <Field label="Primary Position">
                <select value={profile.position} onChange={e => set('position', e.target.value)} style={selectStyle}>
                  <option value="">Select position</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Secondary Position">
                <select value={profile.secondary_position} onChange={e => set('secondary_position', e.target.value)} style={selectStyle}>
                  <option value="">None</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <div /> {/* spacer */}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="GPA Weighted">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value={profile.gpa_weighted}
                  onChange={e => set('gpa_weighted', e.target.value)}
                  placeholder="e.g. 3.85"
                  style={inputStyle}
                />
              </Field>

              <Field label="GPA Unweighted">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={profile.gpa_unweighted}
                  onChange={e => set('gpa_unweighted', e.target.value)}
                  placeholder="e.g. 3.60"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Home State">
              <select value={profile.home_state} onChange={e => set('home_state', e.target.value)} style={{ ...selectStyle, maxWidth: '50%' }}>
                <option value="">Select state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Bio">
              <textarea
                value={profile.bio}
                onChange={e => set('bio', e.target.value)}
                placeholder="Tell coaches about yourself..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            </Field>
          </div>

          {/* Recruiting info */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Recruiting</h2>

            <Field label="Highlight Video URL">
              <input
                type="url"
                value={profile.highlight_video_url}
                onChange={e => set('highlight_video_url', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: saving ? '#92650f' : '#e8a020',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#000000',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 700,
                padding: '0.65rem 1.75rem',
              }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saveMsg && (
              <span style={{ color: saveMsg === 'Saved!' ? '#22c55e' : '#f87171', fontSize: '0.85rem', fontWeight: 500 }}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>

        {/* Share my profile */}
        <div style={{ marginTop: '2rem', backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Share My Profile
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: '1.5' }}>
            Send this link to coaches so they can view your verified metrics and profile.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <code style={{
              backgroundColor: '#0d1117',
              border: '1px solid #1e2530',
              borderRadius: '0.4rem',
              color: '#9ca3af',
              fontSize: '0.8rem',
              padding: '0.5rem 0.85rem',
              flex: 1,
              minWidth: '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}>
              diamondverified.app/profile/{userId}
            </code>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                backgroundColor: copied ? '#166534' : '#e8a020',
                border: 'none',
                borderRadius: '0.5rem',
                color: copied ? '#86efac' : '#000000',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '0.5rem 1.25rem',
                flexShrink: 0,
                transition: 'background-color 0.2s',
              }}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
