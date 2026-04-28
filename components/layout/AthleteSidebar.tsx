'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useClerk, useUser } from '@clerk/nextjs';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/athlete',          label: 'Dashboard',      icon: HomeIcon },
  { href: '/dashboard/athlete/profile',  label: 'My Profile',     icon: UserIcon },
  { href: '/dashboard/athlete/matches',  label: 'School Matches', icon: SearchIcon },
  { href: '/dashboard/athlete/calculator', label: 'Calculator',   icon: CalcIcon },
  { href: '/dashboard/athlete/settings', label: 'Settings',       icon: GearIcon },
];

export default function AthleteSidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const email = user?.emailAddresses[0]?.emailAddress ?? '';

  return (
    <>
      {/* Mobile top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1rem', height: '56px', backgroundColor: '#0a0e14',
        borderBottom: '1px solid #1e2530', position: 'sticky', top: 0, zIndex: 40,
      }} className="sidebar-mobile-header">
        <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
          ◆ Diamond Verified
        </span>
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#9ca3af' }}>
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 45 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        backgroundColor: '#0a0e14',
        borderRight: '1px solid #1e2530',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        // Mobile: slide in from left
        ...(typeof window !== 'undefined' && window.innerWidth < 768
          ? {
              position: 'fixed' as const,
              left: mobileOpen ? '0' : '-260px',
              top: 0,
              zIndex: 50,
              transition: 'left 0.2s ease',
            }
          : {}),
      }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid #1e2530' }}>
          <Link href="/dashboard/athlete" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#e8a020', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ◆ Diamond Verified
            </span>
            <span style={{ color: '#4b5563', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Athlete Portal
            </span>
          </Link>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0.75rem 0.75rem' }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '0.15rem',
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9rem',
                  color: active ? '#e8a020' : '#9ca3af',
                  backgroundColor: active ? 'rgba(232,160,32,0.1)' : 'transparent',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                <Icon active={active} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: email + sign out */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #1e2530' }}>
          <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: '0 0 0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </p>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #1e2530',
              backgroundColor: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <SignOutIcon />
            Sign Out
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar-mobile-header { display: none; }
        @media (max-width: 767px) {
          .sidebar-mobile-header { display: flex; }
        }
      `}</style>
    </>
  );
}

// ── Icons (inline SVG, no extra dependency) ─────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#e8a020' : 'none'} stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function CalcIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h4M8 18h2" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
