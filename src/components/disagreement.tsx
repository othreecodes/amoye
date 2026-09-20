import * as React from "react";
import { call, type Conclusion } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAsync } from "@/hooks/use-async";
import { asList } from "@/lib/model";
import { stamp } from "@/lib/format";
import { Loading, Note } from "@/design/ui";

/**
 * The two claims behind a contradiction, side by side.
 *
 * A contradiction is one derived claim that names the explicit claims it
 * conflicts with in `source_ids`. Reading those back is the only way to show
 * a person what actually disagrees — the contradiction's own sentence
 * describes the conflict but does not quote either side.
 *
 * Deliberately read-only. Resolving would mean deleting somebody's stated
 * fact, and Honcho offers no way to mark a claim as settled, so a "keep both,
 * flagged" button would have nothing to write. Showing the evidence is the
 * part that can be done honestly today.
 */
export function Disagreement({ conclusion }: { conclusion: Conclusion }) {
  const { workspace } = useApp();
  const ids = React.useMemo(() => {
    const raw = conclusion.source_ids;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  }, [conclusion.source_ids]);

  const sources = useAsync(async () => {
    if (ids.length === 0) return [];
    const ws = encodeURIComponent(workspace);
    // No endpoint fetches conclusions by id, so this pulls a window and picks
    // the ones named. A source older than the window simply does not show,
    // which is why the count below is stated rather than assumed.
    const res = await call<{ items?: Conclusion[] }>(
      "POST",
      `/v3/workspaces/${ws}/conclusions/list`,
      { filters: { observed: conclusion.observed_id ?? conclusion.observed } },
      { query: { size: 100, reverse: false } },
    );
    const byId = new Map(asList<Conclusion>(res).map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter((c): c is Conclusion => !!c);
  }, [workspace, ids.join(","), conclusion.observed_id]);

  if (ids.length === 0) return null;
  if (sources.loading) return <Loading label="Reading both sides" />;

  const found = sources.data ?? [];
  if (found.length === 0) {
    return <Note>The claims behind this are older than the window this screen loads.</Note>;
  }

  const ordered = [...found].sort(
    (a, b) => Date.parse(String(a.created_at ?? 0)) - Date.parse(String(b.created_at ?? 0)),
  );

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {ordered.map((c) => (
        <div
          key={c.id}
          className="rounded-[10px] px-3.5 py-2.5"
          style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}
        >
          <div className="mono mb-1 text-[10.5px] uppercase tracking-[0.07em] text-ink3">
            {c.created_at ? stamp(String(c.created_at)) : "undated"}
          </div>
          <div className="text-[14px] leading-[1.6]">{String(c.content ?? c.conclusion ?? "")}</div>
        </div>
      ))}
      {found.length < ids.length && (
        <Note>
          Showing {found.length} of {ids.length}; the rest are outside the loaded window.
        </Note>
      )}
    </div>
  );
}
