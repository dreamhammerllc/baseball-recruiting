/**
 * Human-readable relative time, e.g. "just now", "3 minutes ago", "yesterday",
 * "5 days ago", "2 weeks ago". Falls through to a localized date string for
 * anything older than ~30 days. Returns "—" if the input cannot be parsed.
 */
export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const ms = Date.now() - t;
  if (ms < 0) return 'just now';

  const sec = Math.floor(ms / 1000);
  if (sec < 45) return 'just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;

  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7)   return `${day} days ago`;

  const wk = Math.floor(day / 7);
  if (day < 30)  return `${wk} week${wk === 1 ? '' : 's'} ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}
