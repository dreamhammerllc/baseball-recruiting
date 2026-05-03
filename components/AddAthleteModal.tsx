'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
  const [tab, setTab]             = useState<'code' | 'scan'>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [found, setFound]         = useState<FoundAthlete | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState('');

  // Camera scan state
  const videoRef     = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning]   = useState(false);
  const [scanError, setScanError] = useState('');
  const streamRef    = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef  = useRef<unknown>(null);

  const stopCamera = useCallback(() => {
    setScanning(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Clean up camera on unmount
  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  async function lookupById(athleteId: string) {
    setLookingUp(true);
    setLookupError('');
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

    if (!('BarcodeDetector' in window)) {
      setScanError('QR scanning is not supported in this browser. Please enter the invite code manually.');
      setTab('code');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      setScanning(true);

      const detect = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const barcodes = await (detectorRef.current as any).detect(videoRef.current);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue as string;
            stopCamera();
            // Parse the URL to extract athlete ID
            try {
              const url = new URL(raw);
              const athleteId = url.searchParams.get('athlete');
              if (athleteId) {
                await lookupById(athleteId);
                return;
              }
            } catch {
              // not a URL
            }
            setScanError('Invalid QR code. Please scan an athlete\'s Diamond Verified QR code.');
            return;
          }
        } catch {
          // frame not ready yet — keep scanning
        }
        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    } catch {
      setScanError('Camera access denied. Allow camera permissions and try again.');
    }
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
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      {/* Modal panel — stop clicks from closing */}
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

        {connected && found ? (
          // Success state
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
                fontSize: '0.875rem', padding: '0.65rem 1.5rem', borderRadius: '0.5rem',
                border: 'none', cursor: 'pointer', width: '100%',
              }}
            >
              Done
            </button>
          </div>
        ) : found ? (
          // Athlete preview + confirm
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
                    {[found.position, found.gradYear ? `Class of ${found.gradYear}` : null].filter(Boolean).join(' · ')}
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
                onClick={() => { setFound(null); setInviteCode(''); }}
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
          // Lookup UI — tabs
          <>
            {/* Tab switcher */}
            <div style={{
              display: 'flex', backgroundColor: '#0d1117',
              borderRadius: '0.5rem', padding: '3px', marginBottom: '1.25rem',
            }}>
              {(['code', 'scan'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setScanError(''); setLookupError(''); stopCamera(); }}
                  style={{
                    flex: 1, backgroundColor: tab === t ? '#1e2530' : 'transparent',
                    color: tab === t ? '#ffffff' : '#6b7280',
                    border: 'none', borderRadius: '0.35rem',
                    padding: '0.45rem', fontSize: '0.85rem', fontWeight: tab === t ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {t === 'code' ? 'Enter Code' : 'Scan QR'}
                </button>
              ))}
            </div>

            {/* Manual code entry */}
            {tab === 'code' && (
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                  Ask the athlete to open their dashboard and share their 6-character invite code.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') handleCodeLookup(); }}
                    placeholder="ABC123"
                    maxLength={6}
                    style={{
                      flex: 1, backgroundColor: '#0d1117', border: '1px solid #1e2530',
                      borderRadius: '0.5rem', color: '#f0f6fc', padding: '0.65rem 0.75rem',
                      fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.2em',
                      outline: 'none', textAlign: 'center',
                    }}
                  />
                  <button
                    onClick={handleCodeLookup}
                    disabled={inviteCode.trim().length !== 6 || lookingUp}
                    style={{
                      backgroundColor: inviteCode.trim().length === 6 && !lookingUp ? '#e8a020' : '#374151',
                      color: inviteCode.trim().length === 6 && !lookingUp ? '#000000' : '#6b7280',
                      border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1rem',
                      fontSize: '0.875rem', fontWeight: 700,
                      cursor: inviteCode.trim().length === 6 && !lookingUp ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lookingUp ? '...' : 'Find'}
                  </button>
                </div>
                {lookupError && (
                  <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.6rem' }}>{lookupError}</p>
                )}
              </div>
            )}

            {/* QR camera scan */}
            {tab === 'scan' && (
              <div>
                {!scanning && !lookingUp && (
                  <>
                    <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1rem' }}>
                      Ask the athlete to show their QR code, then tap the button to scan it.
                    </p>
                    <button
                      onClick={startScan}
                      style={{
                        backgroundColor: '#e8a020', color: '#000000', fontWeight: 700,
                        fontSize: '0.9rem', padding: '0.7rem', borderRadius: '0.5rem',
                        border: 'none', cursor: 'pointer', width: '100%',
                      }}
                    >
                      Open Camera
                    </button>
                    {scanError && (
                      <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.75rem' }}>{scanError}</p>
                    )}
                  </>
                )}

                {(scanning || lookingUp) && (
                  <div>
                    {scanning && (
                      <>
                        <div style={{
                          borderRadius: '0.65rem', overflow: 'hidden',
                          border: '2px solid #e8a020', marginBottom: '0.75rem', position: 'relative',
                        }}>
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            style={{ width: '100%', display: 'block', maxHeight: '260px', objectFit: 'cover' }}
                          />
                          {/* Aim reticle */}
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                          }}>
                            <div style={{
                              width: '120px', height: '120px',
                              border: '2px solid rgba(232,160,32,0.8)',
                              borderRadius: '0.5rem',
                              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                            }} />
                          </div>
                        </div>
                        <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 0.75rem' }}>
                          Hold the QR code in front of the camera
                        </p>
                        <button
                          onClick={stopCamera}
                          style={{
                            backgroundColor: 'transparent', border: '1px solid #1e2530',
                            color: '#6b7280', fontSize: '0.82rem', padding: '0.5rem',
                            borderRadius: '0.4rem', cursor: 'pointer', width: '100%',
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {lookingUp && !scanning && (
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                        Looking up athlete...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
