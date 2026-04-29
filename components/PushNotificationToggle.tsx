'use client';

import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function PushNotificationToggle() {
  const [supported, setSupported]   = useState(false);
  const [enabled, setEnabled]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [status, setStatus]         = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true);
      // Check current permission
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
          reg.pushManager.getSubscription().then(sub => {
            setEnabled(!!sub);
          });
        });
      }
    }
  }, []);

  async function handleToggle() {
    setLoading(true);
    setStatus(null);
    try {
      if (enabled) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        await fetch('/api/notifications/subscribe', { method: 'DELETE' });
        setEnabled(false);
        setStatus('Push notifications disabled.');
      } else {
        // Request permission + subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatus('Permission denied. Please allow notifications in your browser settings.');
          setLoading(false);
          return;
        }
        // Register service worker if not already registered
        let reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        setEnabled(true);
        setStatus('Push notifications enabled!');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 4000);
    }
  }

  if (!supported) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: '0 0 0.2rem', lineHeight: 1.4 }}>
            Push Notifications
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
            Get an instant alert when your session booking is confirmed or cancelled.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          aria-checked={enabled}
          role="switch"
          style={{
            flexShrink: 0,
            width: '44px',
            height: '24px',
            borderRadius: '999px',
            border: 'none',
            backgroundColor: enabled ? '#e8a020' : '#1e2530',
            cursor: loading ? 'not-allowed' : 'pointer',
            position: 'relative',
            transition: 'background-color 0.2s',
            opacity: loading ? 0.6 : 1,
            padding: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: '3px',
            left: enabled ? '23px' : '3px',
            width: '18px', height: '18px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            transition: 'left 0.2s',
            display: 'block',
          }} />
        </button>
      </div>
      {status && (
        <p style={{ color: enabled ? '#34d399' : '#9ca3af', fontSize: '0.78rem', margin: 0 }}>
          {status}
        </p>
      )}
    </div>
  );
}
