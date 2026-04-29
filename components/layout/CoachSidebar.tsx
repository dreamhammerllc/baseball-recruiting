'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useClerk, useUser } from '@clerk/nextjs';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/coach',              label: 'Dashboard',    icon: HomeIcon },
  { href: '/dashboard/coach/profile',      label: 'My Profile',   icon: ProfileIcon },
  { href: '/dashboard/coach/athletes',     label: 'My Athletes',  icon: UsersIcon },
  { href: '/dashboard/coach/evaluations',  label: 'Evaluations',  icon: ClipboardIcon },
  { href: '/dashboard/coach/availability', label: 'Availability', icon: CalendarIcon },
  { href: '/dashboard/coach/settings',     label: 'Settings',     icon: GearIcon },
];

export default function CoachSidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const email = user?.emailAddresses[0]?.emailAddress ?? '';

  return (
    <>
      {/* Mobile top bar — fixed at viewport top on mobile, hidden on desktop */}
      <header
        className="sidebar-mobile-header"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          height: '56px',
          backgroundColor: '#0a0e14',
          borderBottom: '1px solid #1e2530',
        }}
      >
        <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
          ◆ Diamond Verified
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#9ca3af' }}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Overlay — dims main content when sidebar is open on mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 45 }}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`coach-sidebar${mobileOpen ? ' sidebar-open' : ''}`}
        style={{
          backgroundColor: '#0a0e14',
          borderRight: '1px solid #1e2530',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem 1.25rem 1rem', borderBottom: '1px solid #1e2530' }}>
          <Link href="/dashboard/coach" style={{ textDecoration: 'none' }}>
            <span style={{ color: '#e8a020', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ◆ Diamond Verified
            </span>
            <span style={{ color: '#4b5563', fontSize: '0.7rem', marginTop: '0.2rem', display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Coach Portal
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem' }}>
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

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #1e2530' }}>
          <p style={{ color: '#4b5563', fontSize: '0.75rem', margin: '0 0 0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </p>
          <button
            type="button"
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
            }}
          >
            <SignOutIcon />
            Sign Out
          </button>
        </div>
      </aside>

      <style>{`
        /* Mobile header: hidden on desktop */
        .sidebar-mobile-header {
          display: none;
        }

        /* Sidebar: desktop — sticky left column */
        .coach-sidebar {
          width: 240px;
          flex-shrink: 0;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        @media (max-width: 767px) {
          /* Show mobile header as fixed top bar */
          .sidebar-mobile-header {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 60;
          }

          /* Sidebar: slides in from left as overlay */
          .coach-sidebar {
            position: fixed;
            top: 0;
            left: -260px;
            width: 240px;
            height: 100vh;
            z-index: 55;
            transition: left 0.25s ease;
          }
          .coach-sidebar.sidebar-open {
            left: 0;
          }

          /* Push main content below the 56px fixed header */
          .coach-sidebar ~ main {
            padding-top: 72px !important;
          }
        }
      `}</style>
    </>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#e8a020' : 'none'} stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ClipboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
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

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#e8a020' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
