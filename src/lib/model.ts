import { type Conclusion } from "@/lib/api";
import { toLevel, type Level } from "@/design/levels";
import type { Belief } from "@/design/ui";
import { ago } from "@/lib/format";

/** Honcho returns a conclusion as data. The UI needs a sentence. This is the
 *  one place that translation happens, so a shape change lands in one file. */
export function toBelief(c: Conclusion, i: number): Belief {
  const raw = String(c.content ?? c.conclusion ?? "").trim();
  return {
    id: String(c.id ?? i),
    text: sentence(raw),
    level: toLevel(c.level),
    person: String(c.observed_id ?? c.observed ?? c.observer_id ?? c.observer ?? "they"),
    evidence: typeof c.message_count === "number" ? c.message_count : undefined,
    meta: c.created_at ? `${ago(String(c.created_at))} ago` : undefined,
    at: c.created_at ? String(c.created_at) : undefined,
  };
}

/** Claims read as English, not as field values. Capitalise, trim a trailing
 *  full stop back on, and leave the wording alone otherwise — inventing
 *  phrasing would misrepresent what Honcho actually concluded. */
function sentence(s: string): string {
  if (!s) return "Something was recorded, but with no text.";
  const t = s.replace(/\s+/g, " ").trim();
  // Do not capitalise an identifier — "Cust-ada banks with…" reads as a typo.
  const first = t.split(/\s+/)[0] ?? "";
  const looksLikeId = /[-_\d]/.test(first);
  const capped = looksLikeId ? t : t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/**
 * Honcho stores every fact twice: once observed by the agent, once observed by
 * the person themselves. Both copies come back from conclusions/list, so an
 * undeduped list shows "18 things known" for a person we know 9 things about,
 * and the same sentence appears twice in a row.
 *
 * The same claim derived again on a later turn also lands as its own row, so
 * the key is the wording rather than the id: same person, same level, same
 * sentence is one thing we know. The first copy wins, and since the list
 * arrives newest-first that is the most recent phrasing.
 */
/**
 * One perspective per person.
 *
 * Honcho keeps a separate collection for every (observer, observed) pair, so
 * each customer is described twice: once as the agent sees them, once as they
 * see themselves. Both are dreamt over separately, and the two dreams word
 * their conclusions differently — so the derived claims cannot be collapsed
 * by text the way the identical explicit ones can. Merged, a person appears
 * to know twice as much as they do, and the same guess is listed twice in
 * slightly different words. It grows by two sets every dream cycle.
 *
 * The agent's view is the one a support console is asking about, so it wins
 * where it exists. Where it does not — an agent's own page, or a peer nobody
 * else has observed — the self-observed view is all there is, and dropping it
 * would empty the screen.
 */
export function onePerspective<T extends Record<string, unknown>>(items: T[]): T[] {
  const observedOf = (c: T) => String(c.observed_id ?? c.observed ?? "");
  const observerOf = (c: T) => String(c.observer_id ?? c.observer ?? "");

  const hasOtherView = new Set<string>();
  for (const c of items) {
    const observed = observedOf(c);
    if (observed && observerOf(c) !== observed) hasOtherView.add(observed);
  }
  return items.filter((c) => {
    const observed = observedOf(c);
    if (!hasOtherView.has(observed)) return true;
    return observerOf(c) !== observed;
  });
}

export function dedupeBeliefs(bs: Belief[]): Belief[] {
  const seen = new Set<string>();
  const out: Belief[] = [];
  for (const b of bs) {
    const claim = b.text.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").trim();
    const key = `${b.person ?? ""}|${b.level}|${claim}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

export function countLevels(bs: Belief[]): Record<Level, number> {
  const out: Record<Level, number> = { explicit: 0, deductive: 0, inductive: 0, contradiction: 0 };
  for (const b of bs) out[b.level] += 1;
  return out;
}

export function asList<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  const o = d as { items?: T[] } | null;
  return o?.items ?? [];
}

/**
 * The representation endpoint returns level-grouped prose:
 *
 *   ## Explicit Observations
 *   [2026-09-20 03:20:25] ada does not have a delivery address on file.
 *
 * Parsing it into beliefs is what lets the Person page show designed cards
 * instead of a wall of text, and it is the only place that knows this format.
 */
export function beliefsFromRepresentation(raw: string): Belief[] {
  if (!raw) return [];
  const out: Belief[] = [];
  let level: Level = "explicit";
  let n = 0;
  for (const line of raw.split(/\r?\n/)) {
    const head = line.match(/^#{1,3}\s*(.+?)\s*$/);
    if (head) {
      level = toLevel(head[1].split(/\s+/)[0]);
      continue;
    }
    const m = line.match(/^\[([^\]]+)\]\s*(.+)$/);
    const body = m ? m[2] : line.trim().replace(/^[-*]\s*/, "");
    if (!body || body.length < 3) continue;
    out.push({
      id: `rep-${n++}`,
      text: sentence(body),
      level,
      meta: m ? relative(m[1]) : undefined,
    });
  }
  return out;
}

function relative(ts: string): string | undefined {
  const t = Date.parse(ts.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? undefined : `${ago(new Date(t).toISOString())} ago`;
}
