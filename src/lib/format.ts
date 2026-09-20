export function ago(iso?: string | number | null): string {
  if (!iso) return "—";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function stamp(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "—";
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function num(n?: number | null): string {
  return n === undefined || n === null ? "—" : n.toLocaleString();
}

/** Identity stripe for a peer. Hue-hashed from the id across a desaturated
 *  ramp that deliberately excludes amber/signal/rust/violet, so peer identity
 *  can never be mistaken for work state. */
export function peerStripe(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hues = [12, 48, 96, 140, 200, 256, 300, 336];
  return `hsl(${hues[h % hues.length]} 22% 58%)`;
}

export function truncate(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * The heading a dated row sits under. Support reads a list by recency before
 * it reads it by anything else, so the buckets are coarse and relative rather
 * than calendar-accurate: "this week" means the last seven days, not since
 * Monday, because the question being asked is "how stale is this".
 */
export function bucketOf(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(t)) return "No date";
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Earlier this week";
  if (days < 30) return "This month";
  if (days < 365) return "Earlier this year";
  return "Older";
}
