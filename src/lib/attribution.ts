import type { Level } from "@/design/levels";

/* ────────────────────────────────────────────────────────────────────────
   Which claim is a sentence of the summary standing on?

   The summary is written by the model, so it paraphrases. Plain word overlap
   scores "blocked by a liveness check" at 0.25 against "received a prompt to
   complete liveness verification" — the sentence is clearly about that fact,
   and the rare word "liveness" is the reason a reader knows it. So weight
   words by how rare they are across what we know: shared boilerplate counts
   for almost nothing, a distinctive term carries the match.
   ──────────────────────────────────────────────────────────────────────── */

const STOP = new Set([
  "with", "that", "this", "they", "them", "their", "have", "been", "from", "about",
  "when", "were", "into", "than", "then", "there", "which", "would", "could", "still",
  "where", "while", "after", "before", "because", "being", "does", "doing", "also",
]);

/** Crude stemmer: the first five letters. Enough to tie withdraw/withdrawal
 *  and block/blocked together without dragging in a stemming library. */
const STEM_LEN = 5;

export function stems(text: string): string[] {
  const found = text.toLowerCase().match(/[a-zà-ɏ]{4,}/g) ?? [];
  const out: string[] = [];
  for (const w of found) {
    if (STOP.has(w)) continue;
    out.push(w.slice(0, STEM_LEN));
  }
  return out;
}

export type Attributed = { level: Level; score: number };

/**
 * Build a matcher over one person's claims. Returns null when nothing is a
 * convincing match — an unattributed sentence is drawn plain, which is the
 * honest answer and better than underlining it as something it is not.
 */
/** When two claims match equally well, say the more certain one. A fact the
 *  person stated outranks something we worked out from it. */
const CERTAINTY: Record<Level, number> = {
  explicit: 3, deductive: 2, inductive: 1, contradiction: 0,
};
// Only an exact tie. A wider window lets the twenty near-duplicate explicit
// claims outrank a genuine deduction that scored higher.
const TIE = 1e-9;

export function buildAttributor(
  beliefs: ReadonlyArray<{ text: string; level: Level }>,
  // Measured against real summaries: sentences drawn from the person's own
  // claims score 0.27 and up, unrelated sentences score 0.00. The gap is
  // wide, so the cut sits low enough to catch a loose paraphrase.
  { threshold = 0.25 }: { threshold?: number } = {},
): (sentence: string) => Attributed | null {
  const docs = beliefs.map((b) => ({ level: b.level, set: new Set(stems(b.text)) }));

  // Document frequency, so a word in every claim is worth nearly nothing.
  const df = new Map<string, number>();
  for (const d of docs) for (const s of d.set) df.set(s, (df.get(s) ?? 0) + 1);
  const n = Math.max(1, docs.length);
  const idf = (s: string) => Math.log((n + 1) / ((df.get(s) ?? 0) + 1)) + 1;

  return (sentence: string) => {
    const mine = [...new Set(stems(sentence))];
    if (mine.length < 2) return null;
    const total = mine.reduce((sum, s) => sum + idf(s), 0);
    if (total <= 0) return null;

    let best: Attributed | null = null;
    for (const d of docs) {
      let hit = 0;
      let matched = 0;
      for (const s of mine) {
        if (!d.set.has(s)) continue;
        hit += idf(s);
        matched += 1;
      }
      // One word in common is a coincidence, not a citation. A short sentence
      // can clear the score on a single rare match -- "The workspace was
      // created in 2019" sharing only "workspace" -- and an underline there
      // claims a source the sentence does not have.
      if (matched < 2) continue;
      const score = hit / total;
      if (!best || score > best.score + TIE) {
        best = { level: d.level, score };
      } else if (Math.abs(score - best.score) <= TIE && CERTAINTY[d.level] > CERTAINTY[best.level]) {
        best = { level: d.level, score };
      }
    }
    return best && best.score >= threshold ? best : null;
  };
}
