import { call, type Page, type Peer } from "@/lib/api";

/* ────────────────────────────────────────────────────────────────────────
   Peer ids are stable and opaque on purpose — `wa-66168b295ead…` is
   what the writing agent keys on, and renaming it would split a person in
   two. Nobody should have to read it. The name lives in peer metadata and
   this module is the one place that turns one into the other.
   ──────────────────────────────────────────────────────────────────────── */

/** Metadata keys a name might arrive under, in order of trust.
 *  `learnedName` leads: it is what the person said about themselves, while
 *  the rest are the CRM record — and for a WhatsApp lead that record is only
 *  ever their self-chosen display handle. */
const NAME_KEYS = ["learnedName", "name", "display_name", "full_name", "label"] as const;

/** Identifiers are not names. "cust-ada_okonkwo" reads as a person once the
 *  punctuation goes; a metadata name always wins over that guess. */
export function displayName(p: Pick<Peer, "id" | "metadata">): string {
  const m = p.metadata ?? {};
  for (const k of NAME_KEYS) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return prettifyId(p.id);
}

/** Last resort: make the id itself as readable as it can be. */
export function prettifyId(id: string | undefined): string {
  const words = String(id ?? "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "Someone with no name yet";
  return words.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** What to call them in a sentence: "Ask about Esther". */
export function firstName(name: string): string {
  return name.split(/[\s\-_.]+/)[0] || name;
}

/**
 * Honcho writes its conclusions using the peer id — "wa-66168b… stated
 * that their transfer has not landed." The id is correct and unreadable, so
 * swap in the name wherever one is known. Ids are matched whole, never inside
 * a longer token.
 */
export function humanizeIds(text: string, nameFor: (id: string) => string | undefined): string {
  if (!text) return text;
  return text.replace(/[A-Za-z0-9][A-Za-z0-9_-]{2,}/g, (token) => nameFor(token) ?? token);
}

/* ── loading ─────────────────────────────────────────────────────────────
   One pass per workspace, shared by every screen. The server caps a page at
   100, and a workspace can hold far more people than anyone will scroll, so
   the sweep stops at MAX_PEERS and screens fall back to the id past that.
   ──────────────────────────────────────────────────────────────────────── */

const PAGE = 100;
const MAX_PEERS = 1000;

export type PeerNames = ReadonlyMap<string, string>;

const cache = new Map<string, Promise<PeerNames>>();

export function loadPeerNames(workspace: string): Promise<PeerNames> {
  const hit = cache.get(workspace);
  if (hit) return hit;
  const work = (async (): Promise<PeerNames> => {
    const names = new Map<string, string>();
    const ws = encodeURIComponent(workspace);
    for (let page = 1; names.size < MAX_PEERS; page += 1) {
      const res = await call<Page<Peer>>(
        "POST",
        `/v3/workspaces/${ws}/peers/list`,
        {},
        { query: { size: PAGE, page } },
      );
      const items = res.items ?? [];
      for (const p of items) {
        const named = p.metadata && NAME_KEYS.some((k) => typeof p.metadata?.[k] === "string");
        if (named) names.set(p.id, displayName(p));
      }
      if (items.length < PAGE) break;
    }
    return names;
  })().catch(() => new Map<string, string>() as PeerNames);
  cache.set(workspace, work);
  return work;
}

/** Drop the cache for a workspace — after a rename, or a workspace switch. */
export function forgetPeerNames(workspace?: string): void {
  if (workspace) cache.delete(workspace);
  else cache.clear();
}
