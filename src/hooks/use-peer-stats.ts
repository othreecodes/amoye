import * as React from "react";
import { call, reverseFor, type Conclusion, type Page } from "@/lib/api";
import { useApp } from "@/lib/app-state";

/**
 * How much is known about each person, and how much of it disagrees.
 *
 * The People screen can sort by "most known" and segment on "barely known" or
 * "has a disagreement", none of which can be answered per row — sorting a
 * page by a number you only have for that page sorts nothing. The obvious
 * approach, asking per peer, is two calls each and over four hundred for a
 * workspace this size. One sweep of the conclusions and a tally by person
 * costs a call per hundred claims instead, and is exact for everything it
 * covers.
 *
 * `complete` is false when the sweep hit its ceiling, so a screen can say the
 * numbers are partial rather than quietly present them as final.
 */

const PAGE = 100;
const MAX_PAGES = 60; // 6,000 claims — past that, say so rather than stall

export type PeerStat = { known: number; contradictions: number };
export type PeerStats = {
  by: ReadonlyMap<string, PeerStat>;
  loading: boolean;
  complete: boolean;
  counted: number;
};

const EMPTY: PeerStats = { by: new Map(), loading: true, complete: false, counted: 0 };

/** The agent's view of a person where it exists, their own where it does
 *  not — the same choice the screens make, so the numbers agree. */
function resolve(
  tally: ReadonlyMap<string, { agent: number; agentContra: number; self: number; selfContra: number }>,
): Map<string, PeerStat> {
  const by = new Map<string, PeerStat>();
  for (const [who, t] of tally) {
    by.set(who, t.agent > 0
      ? { known: t.agent, contradictions: t.agentContra }
      : { known: t.self, contradictions: t.selfContra });
  }
  return by;
}

export function usePeerStats(): PeerStats {
  const { workspace } = useApp();
  const [state, setState] = React.useState<PeerStats>(EMPTY);

  React.useEffect(() => {
    let live = true;
    setState(EMPTY);
    void (async () => {
      const ws = encodeURIComponent(workspace);
      const tally = new Map<string, { agent: number; agentContra: number; self: number; selfContra: number }>();
      let counted = 0;
      let complete = true;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        let batch: Conclusion[] = [];
        try {
          const res = await call<Page<Conclusion>>(
            "POST",
            `/v3/workspaces/${ws}/conclusions/list`,
            {},
            { query: { page, size: PAGE, reverse: reverseFor("conclusions", true) } },
          );
          batch = res?.items ?? [];
          for (const c of batch) {
            const who = String(c.observed_id ?? c.observed ?? "");
            if (!who) continue;
            // Tally the two perspectives apart and choose between them at the
            // end. Deciding per page would keep both for anyone whose two
            // views straddle a page boundary, which is most people.
            const mine = String(c.observer_id ?? c.observer ?? "") === who;
            const cur = tally.get(who) ?? { agent: 0, agentContra: 0, self: 0, selfContra: 0 };
            const contra = String(c.level ?? "") === "contradiction";
            if (mine) { cur.self += 1; if (contra) cur.selfContra += 1; }
            else { cur.agent += 1; if (contra) cur.agentContra += 1; }
            tally.set(who, cur);
          }
          counted += batch.length;
          if (batch.length < PAGE) break;
          if (page === MAX_PAGES) complete = false;
        } catch {
          // A failed page makes the tally partial, not wrong — stop and say so.
          complete = false;
          break;
        }
        // Publish as it goes: the table is usable before the sweep finishes.
        if (!live) return;
        setState({ by: resolve(tally), loading: true, complete: false, counted });
      }
      if (live) setState({ by: resolve(tally), loading: false, complete, counted });
    })();
    return () => { live = false; };
  }, [workspace]);

  return state;
}
