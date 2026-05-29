export default function StatCard({
  label,
  value,
  children,
}: {
  label:    string;
  value:    string;
  children?: React.ReactNode;
  /** Legacy prop accepted for compatibility with surfaces that pass a colors
   *  object; intentionally not used inside the card. */
  colors?:  unknown;
}) {
  return (
    <div
      style={{
        background:    '#111827',
        border:        '1px solid #1e2530',
        borderRadius:  '0.75rem',
        padding:       '0.875rem 1rem',
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.35rem',
      }}
    >
      <p
        style={{
          fontFamily:    'monospace',
          fontSize:      '0.65rem',
          color:         '#6b7280',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin:        0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'monospace',
          fontSize:   '1.25rem',
          fontWeight: 700,
          color:      '#f0f6fc',
          margin:     0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {children}
    </div>
  );
}
