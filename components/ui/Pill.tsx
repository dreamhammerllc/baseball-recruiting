import type { ReactNode } from 'react';

interface PillProps {
  children: ReactNode;
  muted?:   boolean;
  gold?:    boolean;
}

export default function Pill({ children, muted, gold }: PillProps) {
  return (
    <span style={{
      fontFamily:    'monospace',
      background:    gold ? 'rgba(232,160,32,0.12)' : '#0d1117',
      border:        `1px solid ${gold ? '#e8a020' : '#1e2530'}`,
      borderRadius:  '0.3rem',
      padding:       '0.1rem 0.45rem',
      fontSize:      '0.65rem',
      color:         gold ? '#e8a020' : muted ? '#6b7280' : '#f0f6fc',
      letterSpacing: '0.04em',
      fontWeight:    gold ? 700 : 500,
    }}>
      {children}
    </span>
  );
}
