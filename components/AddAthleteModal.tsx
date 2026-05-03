'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

type FoundAthlete = {
  athleteId: string;
  name: string;
  photo: string | null;
  position: string | null;
  gradYear: number | null;
};

interface Props {
  onClose: () => void;
  onConnected: (athlete: FoundAthlete) => void;
}

export default function AddAthleteModal({ onClose, onConnected }: Props) {
  const [tab, setTab]               = useState<'code' | 'scan'>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [lookingUp, setLookingUp]   = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [found, setFound]           = useState<FoundAthlete | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected]   = useState(false);
  const [connectError, setConnectError] = useState('');
  const [scanning, setScanning]     = useState(false);
  const [scanError, setScanError]   = useState('');

  const scannerRef = useRef<Html5QrcodeType | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // already stopped or never started
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Stop scanner on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  async function lookupById(athleteId: string) {
    setLookingUp(true);
    setScanError('');
    try {
      const res = await fetch(`/api/connections/lookup?id=${encodeURIComponent(athleteId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Athlete not found');
      setFound(data);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : 'Athlete not found');
    } finally {
      setLookingUp(false);
    }
  }

  async function startScan() {
    setScanError('');
    setFound(null);

    // Dynamic import keeps this SSR-safe and off the initial bundle
    let Html5Qrcode: typeof Html5QrcodeType;
    try {
      const mod = await import('html5-qrcode');
      Html5Qrcode = mod.Html5Qrcode;
    } catch {
      setScanError('QR scanner failed to load. Please use the invite code instead.');
      return;
    }

    try {
      const scanner = new Html5Qrcode('dv-qr-reader');
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decodedText: string) => {
          await stopScanner();
          try {
            const url = new URL(decodedText);
            const athleteId = url.searchParams.get('athlete');
            if (athleteId) {
              await lookupById(athleteId);
              return;
            }
          } catch {
            // not a URL
          }
          setScanError('Invalid QR code. Please scan an athlete\'s Diamond Verified QR code.');
        },
        () => { /* frame failed — keep scanning, library retries automatically */ }
      );
    } catch {
      scannerRef.current = null;
      setScanning(false);
      setScanError('Camera access denied. Allow camera permissions and try again.');
    }
  }

  async function handleTabSwitch(t: 'code' | 'scan') {
    await stopScanner();
    setScanError('');
    setLookupError('');
    setTab(t);
  }

  async function handleCodeLookup() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) return;
    setLookingUp(true);
    setLookupError('');
    setFound(null);
    try {
      const res = await fetch(`/api/connections/lookup?code=${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Code not found');
      setFound(data);
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Code not found');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConnect() {
    if (!found) return;
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/connections/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: found.athleteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to connect');
      }
      setConnected(true);
      onConnected(found);
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setConnecting(false);
    }
  }

  const initials = found
    ? found.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1e2530',
          borderRadius: '1rem',
          padding: '1.75rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
            Add Athlete
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Success state */}
        {connected && found ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ color: '#22c55e', fontSize: '2.5rem', marginBottom: '0.5rem' }}>✓</div>
            <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '1rem', margin: '0 0 0.35rem' }}>
              Connected!
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              {found.name} has been added to your roster.
            </p>
            <button
              onClick={onClose}
              style={{
                backgroundColor: '#e8a020', color: '#000000', fontWeight: 700,
                fontSize: '0.875rem', padding: '0.65rem', borderRadius: '0.5rem',
                border: 'none', cursor: 'pointer', width: '100%',
              }}
            >
              Done
            </button>
          </div>

        ) : found ? (
          /* Athlete preview + confirm */
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              backgroundColor: '#0d1117', borderRadius: '0.65rem', padding: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: '#1e2530', border: '2px solid #e8a020',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {found.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={found.photo} alt={found.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#e8a020', fontWeight: 700 }}>{initials}</span>
                }
              </div>
              <div>
                <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                  {found.name}
                </p>
                {(found.position || found.gradYear) && (
                  <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.1rem 0 0' }}>
                    {[found.position, found.gradYear ? `Class of ${found.gradYear}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {connectError && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{connectError}</p>
            )}

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  flex: 1, backgroundColor: connecting ? '#92400e' : '#e8a020',
                  color: '#000000', fontWeight: 700, fontSize: '0.875rem',
                  padding: '0.65rem', borderRadius: '0.5rem', border: 'none',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                }}
              >
                {connecting ? 'Adding...' : 'Add to Roster'}
              </button>
              <button
                onClick={() => { setFound(null); setInviteCode(''); setScanError(''); }}
                style={{
                  backgroundColor: 'transparent', border: '1px solid #1e2530',
                  color: '#6b7280', fontSize: '0.875rem', padding: '0.65rem 1rem',
                  borderRadius: '0.5rem', cursor: 'pointer',
                }}
              >
                Back
              </button>
            </div>
          </div>

        ) : (
          /* Lookup tabs */
          <>
            {/* Tab switcher */}
            <div style={{
              display: 'flex', backgroundColor: '#0d1117',
              borderRadius: '0.5rem', padding: '3px', marginBottom: '1.25rem',
            }}>
              {(['code', 'scan'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleTabSwitch(t)}
                  style={{
                    flex: 1, backgroundColor: tab === t ? '#1e2530' : 'transparent',
                    color: tab === t ? '#ffffff' : '#6b7280',
                    border: 'none', borderRadius: '0.35rem',
                    padding: '0.45rem', fontSize: '0.85rem', fontWeight: tab === t ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {t === 'code' ? 'Enter Code' : 'Scan QR'}
                </button>
              ))}
            </div>

            {/* ── Enter Code tab ── */}
            {tab === 'code' && (
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                  Ask the athlete to open their dashboard and share their 6-character invite code.
                </p>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => { if (e.key === 'Enter') handleCodeLookup(); }}
                  placeholder="ABC123"
                  maxLength={6}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: '#0d1117', border: '1px solid #1e2530',
                    borderRadius: '0.5rem', color: '#f0f6fc', padding: '0.75rem',
                    fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.3em',
                    outline: 'none', textAlign: 'center', marginBottom: '0.65rem',
                  }}
                />
                <button
                  onClick={handleCodeLookup}
                  disabled={inviteCode.trim().length !== 6 || lookingUp}
                  style={{
                    width: '100%',
                    backgroundColor: inviteCode.trim().length === 6 && !lookingUp ? '#e8a020' : '#374151',
                    color: inviteCode.trim().length === 6 && !lookingUp ? '#000000' : '#6b7280',
                    border: 'none', borderRadius: '0.5rem', padding: '0.7rem',
                    fontSize: '0.9rem', fontWeight: 700,
                    cursor: inviteCode.trim().length === 6 && !lookingUp ? 'pointer' : 'not-allowed',
                  }}
                >
                  {lookingUp ? 'Looking up...' : 'Find Athlete'}
                </button>
                {lookupError && (
                  <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.6rem' }}>{lookupError}</p>
                )}
              </div>
            )}

            {/* ── Scan QR tab ── */}
            {tab === 'scan' && (
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                  Ask the athlete to show their QR code, then tap the button to scan it.
                </p>

                {/* html5-qrcode mounts the camera feed into this div */}
                <div
                  id="dv-qr-reader"
                  style={{
                    width: '100%',
                    borderRadius: '0.65rem',
                    overflow: 'hidden',
                    border: scanning ? '2px solid #e8a020' : 'none',
                    marginBottom: scanning ? '0.75rem' : 0,
                    backgroundColor: '#0d1117',
                  }}
                />

                {lookingUp && (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', margin: '0 0 0.75rem' }}>
                    Looking up athlete...
                  </p>
                )}

                {!scanning && !lookingUp && (
                  <button
                    onClick={startScan}
                    style={{
                      width: '100%', backgroundColor: '#e8a020', color: '#000000',
                      fontWeight: 700, fontSize: '0.9rem', padding: '0.7rem',
                      borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Open Camera
                  </button>
                )}

                {scanning && (
                  <button
                    onClick={stopScanner}
                    style={{
                      width: '100%', backgroundColor: 'transparent',
                      border: '1px solid #1e2530', color: '#6b7280',
                      fontSize: '0.82rem', padding: '0.5rem',
                      borderRadius: '0.4rem', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}

                {scanError && (
                  <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.75rem' }}>{scanError}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
