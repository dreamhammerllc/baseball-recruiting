'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import CoachSidebar from '@/components/layout/CoachSidebar';
import PushNotificationToggle from '@/components/PushNotificationToggle';

export const dynamic = 'force-dynamic';

// ── Notification preference keys ─────────────────────────────────────────────
interface CoachNotifPrefs {
  new_booking:        boolean;
  booking_cancelled:  boolean;
  athlete_message:    boolean;
  platform_updates:   boolean;
}

const DEFAULT_PREFS: CoachNotifPrefs = {
  new_booking:       true,
  booking_cancelled: true,
  athlete_message:   true,
  platform_updates:  false,
};

const NOTIF_ITEMS: { key: keyof CoachNotifPrefs; label: string; desc: string }[] = [
  { key: 'new_booking',       label: 'New booking',        desc: 'Email me when an athlete schedules a session' },
  { key: 'booking_cancelled', label: 'Booking cancelled',  desc: 'Email me when an athlete cancels a session' },
  { key: 'athlete_message',   label: 'Athlete messages',   desc: 'Email me when an athlete sends a message' },
  { key: 'platform_updates',  label: 'Platform updates',   desc: 'Occasional product news and feature announcements' },
];

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        flexShrink: 0, width: '44px', height: '24px', borderRadius: '999px',
        border: 'none', backgroundColor: on ? '#e8a020' : '#1e2530',
        cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
        transition: 'background-color 0.2s', opacity: disabled ? 0.6 : 1, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        backgroundColor: '#ffffff', transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CoachSettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut }        = useClerk();

  const [tier, setTier]               = useState('free');
  const [icalSecret, setIcalSecret]   = useState<string | null>(null);
  const [icalCopied, setIcalCopied]   = useState(false);

  const [prefs, setPrefs]             = useState<CoachNotifPrefs>(DEFAULT_PREFS);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg]       = useState<string | null>(null);

  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showPasswordForm, setShowPasswordForm]   = useState(false);
  const [currentPw, setCurrentPw]     = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwMsg, setPwMsg]             = useState<string | null>(null);
  const [pwError, setPwError]         = useState<string | null>(null);

  const email    = user?.emailAddresses[0]?.emailAddress ?? '';
  const hasPassword = user?.passwordEnabled ?? false;

  useEffect(() => {
    // Load coach profile for tier + ical secret
    fetch('/api/coach/setup')
      .then(r => r.json())
      .then(({ coach }) => {
        if (coach?.subscription_tier) setTier(coach.subscription_tier);
        if (coach?.ical_secret) setIcalSecret(coach.ical_secret);
        if (coach?.notification_preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...coach.notification_preferences });
        }
      })
      .catch(() => {});
  }, []);

  // ── Notifications save ────────────────────────────────────────────────────
  async function saveNotifs(updated: CoachNotifPrefs) {
    setNotifSaving(true); setNotifMsg(null);
    try {
      await fetch('/api/coach/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setNotifMsg('Saved');
      setTimeout(() => setNotifMsg(null), 2000);
    } catch { setNotifMsg('Error saving'); }
    finally { setNotifSaving(false); }
  }

  function togglePref(key: keyof CoachNotifPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotifs(updated);
  }

  // ── iCal copy ─────────────────────────────────────────────────────────────
  function copyIcal() {
    if (!icalSecret) return;
    const url = `${window.location.origin}/api/ical/${icalSecret}`;
    navigator.clipboard.writeText(url);
    setIcalCopied(true);
    setTimeout(() => setIcalCopied(false), 2500);
  }

  // ── Password change ───────────────────────────────────────────────────────
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null); setPwMsg(null);
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      await user?.updatePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwMsg(null); setShowPasswordForm(false); }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setPwError(msg);
    } finally { setPwSaving(false); }
  }

  if (!isLoaded) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading...</span>
      </main>
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#0d1117', border: '1px solid #1e2530',
    borderRadius: '0.5rem', color: '#f0f6fc', padding: '0.6rem 0.75rem',
    fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  };

  const isPaid = tier !== 'free';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>

          {/* Header */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>Settings</h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Manage your account, calendar, notifications, and privacy</p>
          </div>

          {/* ── Account ───────────────────────────────────────────────────── */}
          <Section title="Account">
            <div>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem' }}>Email</p>
              <p style={{ color: '#f0f6fc', fontSize: '0.9rem', margin: 0 }}>{email}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => signOut({ redirectUrl: '/' })}
                style={{ backgroundColor: 'transparent', border: '1px solid #1e2530', borderRadius: '0.5rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 1.1rem' }}>
                Sign Out
              </button>
              {hasPassword && (
                <button type="button" onClick={() => setShowPasswordForm(v => !v)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #1e2530', borderRadius: '0.5rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 1.1rem' }}>
                  {showPasswordForm ? 'Cancel' : 'Change Password'}
                </button>
              )}
            </div>

            {/* Password form */}
            {showPasswordForm && hasPassword && (
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, fontWeight: 600 }}>Change Password</p>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" style={inputStyle} />
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min 8 chars)" style={inputStyle} />
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" style={inputStyle} />
                {pwError && <p style={{ color: '#f87171', fontSize: '0.8rem', margin: 0 }}>{pwError}</p>}
                {pwMsg  && <p style={{ color: '#34d399', fontSize: '0.8rem', margin: 0 }}>{pwMsg}</p>}
                <button type="submit" disabled={pwSaving}
                  style={{ backgroundColor: pwSaving ? '#374151' : '#e8a020', color: pwSaving ? '#6b7280' : '#000', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, cursor: pwSaving ? 'not-allowed' : 'pointer', width: 'fit-content' }}>
                  {pwSaving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {/* Delete account */}
            <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
              {!showDeleteWarning ? (
                <button type="button" onClick={() => setShowDeleteWarning(true)}
                  style={{ backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 1rem' }}>
                  Delete Account
                </button>
              ) : (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>Account deletion requires contacting support</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                    Email us and we will permanently delete your account, coach profile, and all associated athlete data within 48 hours.
                  </p>
                  <a href="mailto:support@diamondverified.app?subject=Delete%20My%20Coach%20Account"
                    style={{ color: '#f87171', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginTop: '0.25rem' }}>
                    support@diamondverified.app →
                  </a>
                  <button type="button" onClick={() => setShowDeleteWarning(false)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem', padding: 0, textAlign: 'left', width: 'fit-content' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* ── Subscription ──────────────────────────────────────────────── */}
          <Section title="Subscription">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.2rem' }}>
                  {isPaid ? 'Coach Pro' : 'Free Plan'}
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>
                  {isPaid ? 'Unlimited athlete roster · Groups · Priority listing' : 'Up to 15 saved athletes · Basic coach profile'}
                </p>
              </div>
              <span style={{ backgroundColor: isPaid ? 'rgba(168,85,247,0.12)' : 'rgba(107,114,128,0.1)', border: `1px solid ${isPaid ? 'rgba(168,85,247,0.3)' : '#1e2530'}`, borderRadius: '9999px', color: isPaid ? '#a855f7' : '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.2rem 0.75rem', textTransform: 'uppercase' as const }}>
                {isPaid ? 'Pro' : 'Free'}
              </span>
            </div>
            {!isPaid && (
              <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
                {['Unlimited athlete roster + groups', 'Priority placement in athlete searches', 'Advanced booking analytics'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <span style={{ color: '#a855f7' }}>◆</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{f}</span>
                  </div>
                ))}
                <a href="/pricing" style={{ display: 'inline-block', marginTop: '0.75rem', backgroundColor: '#a855f7', color: '#fff', fontWeight: 700, padding: '0.55rem 1.4rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.85rem' }}>
                  Upgrade to Pro →
                </a>
              </div>
            )}
          </Section>

          {/* ── Calendar Sync ─────────────────────────────────────────────── */}
          <Section title="Calendar Sync">
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              Sync all your confirmed athlete bookings directly to Google Calendar, Apple Calendar, or any app that supports iCal subscriptions. The link updates automatically as new bookings are added.
            </p>

            {icalSecret ? (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#9ca3af', overflowX: 'auto', whiteSpace: 'nowrap', minWidth: 0, display: 'block' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/ical/${icalSecret}` : `/api/ical/${icalSecret}`}
                  </code>
                  <button type="button" onClick={copyIcal}
                    style={{ backgroundColor: icalCopied ? '#34d399' : '#374151', color: icalCopied ? '#000' : '#f0f6fc', border: 'none', borderRadius: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s' }}>
                    {icalCopied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>

                {/* How to add to calendar */}
                <div style={{ backgroundColor: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.15)', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
                  <p style={{ color: '#58a6ff', fontSize: '0.78rem', fontWeight: 600, margin: '0 0 0.5rem' }}>How to add to your calendar:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {[
                      { app: 'Google Calendar', steps: 'Other calendars → + → From URL → paste link' },
                      { app: 'Apple Calendar', steps: 'File → New Calendar Subscription → paste link' },
                      { app: 'Outlook', steps: 'Add calendar → Subscribe from web → paste link' },
                    ].map(({ app, steps }) => (
                      <p key={app} style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0 }}>
                        <span style={{ color: '#f0f6fc', fontWeight: 500 }}>{app}:</span> {steps}
                      </p>
                    ))}
                  </div>
                </div>

                <p style={{ color: '#4b5563', fontSize: '0.72rem', margin: 0 }}>
                  You can also set availability hours from the <a href="/dashboard/coach/availability" style={{ color: '#6b7280', textDecoration: 'underline' }}>Availability page</a>.
                </p>
              </>
            ) : (
              <div style={{ backgroundColor: '#0d1117', border: '1px dashed #1e2530', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  Set up your availability schedule to generate your iCal link.
                </p>
                <a href="/dashboard/coach/availability"
                  style={{ color: '#e8a020', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
                  Go to Availability →
                </a>
              </div>
            )}
          </Section>

          {/* ── Notifications ─────────────────────────────────────────────── */}
          <Section title="Notifications">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>Toggle individual email alerts below.</p>
              {notifMsg && (
                <span style={{ color: notifMsg === 'Saved' ? '#22c55e' : '#f87171', fontSize: '0.78rem', fontWeight: 500 }}>{notifMsg}</span>
              )}
            </div>

            {NOTIF_ITEMS.map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: '0 0 0.15rem', fontWeight: 500 }}>{label}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>{desc}</p>
                </div>
                <Toggle on={prefs[key]} disabled={notifSaving} onToggle={() => togglePref(key)} />
              </div>
            ))}

            {/* Push notification toggle */}
            <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1.25rem' }}>
              <PushNotificationToggle />
            </div>
          </Section>

          {/* ── Privacy & Visibility ──────────────────────────────────────── */}
          <Section title="Privacy & Visibility">
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              Your coach profile is publicly discoverable by athletes searching within your area. Your exact GPS coordinates are never shown — only your approximate city and state.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Profile visible to athletes', desc: 'Athletes can find and view your coach profile', active: true },
                { label: 'Location used for discovery', desc: 'Your approximate area is used in radius searches', active: true },
                { label: 'Email shown on profile card', desc: 'Athletes can see your contact email in search results', active: true },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: '0 0 0.1rem', fontWeight: 500 }}>{item.label}</p>
                    <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>{item.desc}</p>
                  </div>
                  <span style={{ backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.6rem', whiteSpace: 'nowrap' }}>
                    On
                  </span>
                </div>
              ))}
            </div>
            <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
              To toggle your availability off entirely, visit the <a href="/dashboard/coach/availability" style={{ color: '#6b7280', textDecoration: 'underline' }}>Availability page</a> and disable "Accepting Bookings".
            </p>
          </Section>

          {/* ── Verification Settings ─────────────────────────────────────── */}
          <Section title="Verification Settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.5rem', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <p style={{ color: '#f0f6fc', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.15rem' }}>72-Hour Cooldown</p>
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>Each metric can only be re-verified once every 72 hours per athlete to maintain data integrity.</p>
                </div>
                <span style={{ backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', color: '#e8a020', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.6rem' }}>Active</span>
              </div>
              <div style={{ backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.5rem', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <p style={{ color: '#f0f6fc', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.15rem' }}>Diamond Verified Badge</p>
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>Your verifications earn athletes the ◆ Diamond Verified badge on their public profile.</p>
                </div>
                <span style={{ backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.6rem' }}>Enabled</span>
              </div>
            </div>
          </Section>

          {/* ── Contact Support ───────────────────────────────────────────── */}
          <Section title="Contact Support">
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              Have a question or need help with your coach account? Our team responds within 24 hours.
            </p>
            <a href="mailto:support@diamondverified.app"
              style={{ backgroundColor: '#e8a020', border: 'none', borderRadius: '0.5rem', color: '#000', display: 'inline-block', fontSize: '0.85rem', fontWeight: 700, padding: '0.55rem 1.25rem', textDecoration: 'none', width: 'fit-content' }}>
              support@diamondverified.app
            </a>
          </Section>

        </div>
      </main>
    </div>
  );
}
