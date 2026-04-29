'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import PushNotificationToggle from '@/components/PushNotificationToggle';

export const dynamic = 'force-dynamic';

const TIER_META: Record<string, { label: string; color: string; desc: string }> = {
  free:        { label: 'Free',        color: '#6b7280', desc: 'Basic profile + public metrics page' },
  athlete:     { label: 'Athlete',     color: '#e8a020', desc: 'Coach verifications + school matching' },
  athlete_pro: { label: 'Athlete Pro', color: '#a855f7', desc: 'Priority matching + advanced analytics' },
  coach:       { label: 'Coach',       color: '#58a6ff', desc: 'Coach portal access' },
};

interface NotifPrefs {
  coach_viewed_profile: boolean;
  school_match_results: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  coach_viewed_profile: false,
  school_match_results: false,
};

export default function AthleteSettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [tier, setTier]               = useState<string>('free');
  const [prefs, setPrefs]             = useState<NotifPrefs>(DEFAULT_PREFS);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg]       = useState<string | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  const email    = user?.emailAddresses[0]?.emailAddress ?? '';
  const tierMeta = TIER_META[tier] ?? TIER_META.free;
  const isFree   = tier === 'free';

  useEffect(() => {
    fetch('/api/athlete/profile')
      .then(r => r.json())
      .then(({ profile: p }) => {
        if (p?.subscription_tier) setTier(p.subscription_tier);
        if (p?.notification_preferences) {
          setPrefs({
            coach_viewed_profile: p.notification_preferences.coach_viewed_profile ?? false,
            school_match_results: p.notification_preferences.school_match_results ?? false,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function saveNotifs(updated: NotifPrefs) {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const res  = await fetch('/api/athlete/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.');
      setNotifMsg('Saved');
      setTimeout(() => setNotifMsg(null), 2000);
    } catch {
      setNotifMsg('Error saving');
    } finally {
      setNotifSaving(false);
    }
  }

  function togglePref(key: keyof NotifPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotifs(updated);
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <AthleteSidebar />
        <main style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading...</span>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Manage your account, notifications, and subscription
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>

          {/* ── Account ── */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Account</h2>

            <div>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500, margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</p>
              <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{email}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: '/' })}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #1e2530',
                  borderRadius: '0.5rem',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '0.5rem 1.1rem',
                }}
              >
                Sign Out
              </button>
            </div>

            {/* Delete account */}
            <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
              {!showDeleteWarning ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteWarning(true)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '0.5rem',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    padding: '0.45rem 1rem',
                  }}
                >
                  Delete Account
                </button>
              ) : (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    Account deletion requires contacting support
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                    Email us and we will permanently delete your account and all associated data within 48 hours.
                  </p>
                  <a
                    href="mailto:support@diamondverified.app?subject=Delete%20My%20Account"
                    style={{ color: '#f87171', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginTop: '0.25rem' }}
                  >
                    support@diamondverified.app →
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowDeleteWarning(false)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem', padding: 0, marginTop: '0.25rem', textAlign: 'left', width: 'fit-content' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Subscription ── */}
          <div style={{ backgroundColor: '#111827', border: `1px solid ${tierMeta.color}33`, borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Subscription</h2>
              <span style={{ backgroundColor: `${tierMeta.color}22`, border: `1px solid ${tierMeta.color}44`, borderRadius: '999px', color: tierMeta.color, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.2rem 0.7rem', textTransform: 'uppercase' as const }}>
                {tierMeta.label}
              </span>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>{tierMeta.desc}</p>

            {isFree && (
              <>
                <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {['Coach-verified metric badges on your profile', 'School match analysis based on your stats', 'Priority placement in recruiter searches'].map(feat => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#e8a020', fontSize: '0.9rem' }}>◆</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{feat}</span>
                    </div>
                  ))}
                </div>
                <a href="/pricing" style={{ backgroundColor: '#e8a020', border: 'none', borderRadius: '0.5rem', color: '#000000', cursor: 'pointer', display: 'inline-block', fontSize: '0.875rem', fontWeight: 700, padding: '0.6rem 1.5rem', textDecoration: 'none', width: 'fit-content' }}>
                  Upgrade Plan →
                </a>
              </>
            )}

            {!isFree && (
              <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
                <a href="/pricing" style={{ color: '#6b7280', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 500 }}>View all plans →</a>
              </div>
            )}
          </div>

          {/* ── Notifications ── */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Notifications</h2>
              {notifMsg && (
                <span style={{ color: notifMsg === 'Saved' ? '#22c55e' : '#f87171', fontSize: '0.78rem', fontWeight: 500 }}>
                  {notifMsg}
                </span>
              )}
            </div>

            {([
              { key: 'coach_viewed_profile' as const, label: 'Email me when a coach views my profile' },
              { key: 'school_match_results' as const,  label: 'Email me school match results' },
            ]).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: '#d1d5db', fontSize: '0.875rem', lineHeight: '1.4' }}>{label}</span>
                <button
                  type="button"
                  disabled={notifSaving}
                  onClick={() => togglePref(key)}
                  style={{
                    flexShrink: 0,
                    width: '44px',
                    height: '24px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: prefs[key] ? '#e8a020' : '#1e2530',
                    cursor: notifSaving ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    padding: 0,
                  }}
                  aria-checked={prefs[key]}
                  role="switch"
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: prefs[key] ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'left 0.2s',
                    display: 'block',
                  }} />
                </button>
              </div>
            ))}

            {/* Push notifications toggle */}
            <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1.25rem' }}>
              <PushNotificationToggle />
            </div>
          </div>

          {/* ── Contact Support ── */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Contact Support</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Have a question or need help? Our team usually responds within 24 hours.
            </p>
            <a
              href="mailto:support@diamondverified.app"
              style={{
                backgroundColor: '#e8a020',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#000000',
                cursor: 'pointer',
                display: 'inline-block',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '0.55rem 1.25rem',
                textDecoration: 'none',
                width: 'fit-content',
              }}
            >
              support@diamondverified.app
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
