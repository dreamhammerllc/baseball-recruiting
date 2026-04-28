'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';

export default function CoachSetupPage() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [organization, setOrganization]   = useState('');
  const [title, setTitle]                 = useState('');
  const [sportFocus, setSportFocus]       = useState('');
  const [yearsExp, setYearsExp]           = useState('');
  const [certifications, setCertifications] = useState('');
  const [bio, setBio]                     = useState('');
  const [photoUrl, setPhotoUrl]           = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]       = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: '0.5rem',
    color: '#f0f6fc',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'block',
    marginBottom: '0.4rem',
  };

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/coach/upload-photo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed.');
      setPhotoUrl(data.url);
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/coach/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:        fullName.trim(),
          email:            email.trim(),
          organization:     organization.trim(),
          title:            title.trim(),
          sport_focus:      sportFocus.trim()     || null,
          years_experience: yearsExp ? parseInt(yearsExp, 10) : null,
          certifications:   certifications.trim() || null,
          bio:              bio.trim()             || null,
          photo_url:        photoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save profile.');
      router.push('/dashboard/coach');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        <div style={{ maxWidth: '600px' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
              Complete Your Coach Profile
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              This information is shown to athletes when you verify their metrics.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Profile Photo */}
            <div>
              <label style={labelStyle}>Profile Photo (optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(232,160,32,0.08)',
                  border: '1px solid rgba(232,160,32,0.25)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{
                    display: 'inline-block',
                    background: 'transparent',
                    border: '1px solid #4b5563',
                    color: '#9ca3af',
                    borderRadius: '0.4rem',
                    padding: '0.35rem 0.875rem',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: photoUploading ? 'not-allowed' : 'pointer',
                    opacity: photoUploading ? 0.6 : 1,
                  }}>
                    {photoUploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      disabled={photoUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {photoError && (
                    <span style={{ color: '#f87171', fontSize: '0.78rem' }}>{photoError}</span>
                  )}
                  {!photoError && (
                    <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>JPEG, PNG or WebP, max 5 MB</span>
                  )}
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="coach@school.edu"
                required
                style={inputStyle}
              />
            </div>

            {/* Organization */}
            <div>
              <label style={labelStyle}>School / Organization *</label>
              <input
                type="text"
                value={organization}
                onChange={e => setOrganization(e.target.value)}
                placeholder="Lincoln High School"
                required
                style={inputStyle}
              />
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Your Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Head Baseball Coach"
                required
                style={inputStyle}
              />
            </div>

            {/* Sport Focus */}
            <div>
              <label style={labelStyle}>Sport Focus (optional)</label>
              <input
                type="text"
                value={sportFocus}
                onChange={e => setSportFocus(e.target.value)}
                placeholder="Baseball, Softball..."
                style={inputStyle}
              />
            </div>

            {/* Years of Experience */}
            <div>
              <label style={labelStyle}>Years of Experience (optional)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={yearsExp}
                onChange={e => setYearsExp(e.target.value)}
                placeholder="10"
                style={inputStyle}
              />
            </div>

            {/* Certifications */}
            <div>
              <label style={labelStyle}>Certifications (optional)</label>
              <input
                type="text"
                value={certifications}
                onChange={e => setCertifications(e.target.value)}
                placeholder="ABCA Certified, CPR..."
                style={inputStyle}
              />
            </div>

            {/* Bio */}
            <div>
              <label style={labelStyle}>Bio (optional)</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Brief background about your coaching experience..."
                rows={4}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: saving ? '#374151' : '#e8a020',
                color:           saving ? '#6b7280' : '#000000',
                border:          'none',
                borderRadius:    '0.5rem',
                padding:         '0.65rem 1.5rem',
                fontSize:        '0.9rem',
                fontWeight:      700,
                cursor:          saving ? 'not-allowed' : 'pointer',
                transition:      'background-color 0.15s',
                width:           'fit-content',
              }}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}
