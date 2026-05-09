interface Props {
  gamechanger: string | null;
  iscore:      string | null;
  perfectgame: string | null;
}

const pillStyle: React.CSSProperties = {
  fontFamily:    'monospace',
  display:       'inline-flex',
  alignItems:    'center',
  gap:           '0.4rem',
  background:    '#111827',
  border:        '1px solid #e8a020',
  borderRadius:  '2rem',
  color:         '#e8a020',
  fontSize:      '0.8rem',
  fontWeight:    600,
  padding:       '0.45rem 1.1rem',
  textDecoration:'none',
  letterSpacing: '0.03em',
};

export default function ExternalProfilePills({ gamechanger, iscore, perfectgame }: Props) {
  if (!gamechanger && !iscore && !perfectgame) return null;

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2
        style={{
          fontFamily: 'monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.18em',
          color: '#6b7280',
          textTransform: 'uppercase',
          margin: '0 0 1rem',
        }}
      >
        External Profiles
      </h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {gamechanger && (
          <a href={gamechanger} target="_blank" rel="noopener noreferrer" style={pillStyle}>
            GameChanger &#8599;
          </a>
        )}
        {iscore && (
          <a href={iscore} target="_blank" rel="noopener noreferrer" style={pillStyle}>
            iScore &#8599;
          </a>
        )}
        {perfectgame && (
          <a href={perfectgame} target="_blank" rel="noopener noreferrer" style={pillStyle}>
            Perfect Game &#8599;
          </a>
        )}
      </div>
    </section>
  );
}
