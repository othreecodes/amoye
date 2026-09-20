import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { LEVELS, LEVEL_ORDER, type Level } from "@/design/levels";
import {
  BeliefCard, BeliefList, Empty, Err, Field, Loading, Page, PageHead, Panel,
  type Belief,
} from "@/design/ui";
import { call, type Conclusion, type Page as ApiPage } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { asList, countLevels, dedupeBeliefs, toBelief } from "@/lib/model";
import { usePeerNames } from "@/hooks/use-peer-names";
import { useAsync } from "@/hooks/use-async";

/* ────────────────────────────────────────────────────────────────────────
   "What we know" — every conclusion Amòye has drawn, in one place.

   Ported from the console design: warning banner, search by meaning, the
   level pills with live counts, the mix bar, then a grid of belief cards.
   Nothing here is sample data — the counts, the topics and the banner are
   all computed from what the API actually returned.
   ──────────────────────────────────────────────────────────────────────── */

/** Honcho pages conclusions. One page is rarely the whole picture, and the
 *  counts on the pills would lie if we only counted the first. Walk a bounded
 *  number of pages so a large workspace cannot hang the screen. */
const PAGE_SIZE = 100;
const MAX_PAGES = 4;

async function loadAll(workspace: string): Promise<Conclusion[]> {
  const out: Conclusion[] = [];
  let total: number | null = null;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const res = await call<ApiPage<Conclusion> | Conclusion[]>(
      "POST",
      `/v3/workspaces/${encodeURIComponent(workspace)}/conclusions/list`,
      {},
      { query: { page: p, size: PAGE_SIZE, reverse: true } },
    );
    const batch = asList<Conclusion>(res);
    out.push(...batch);
    const pages = (res as ApiPage<Conclusion>)?.pages;
    total = (res as ApiPage<Conclusion>)?.total ?? total;
    if (batch.length < PAGE_SIZE) break;
    if (typeof pages === "number" && p >= pages) break;
  }
  return out;
}

async function search(workspace: string, query: string): Promise<Conclusion[]> {
  const res = await call<ApiPage<Conclusion> | Conclusion[]>(
    "POST",
    `/v3/workspaces/${encodeURIComponent(workspace)}/conclusions/query`,
    { query, limit: 60 },
  );
  return asList<Conclusion>(res);
}

/** The design shows topic chips. There is no topics endpoint, so they are
 *  derived from the text of the conclusions we already hold — which keeps
 *  them honest: a chip only exists if something on this screen matches it. */
const TOPICS: Array<{ name: string; re: RegExp }> = [
  { name: "Money and charges", re: /\b(bank|charge|fee|debit|credit|card|payment|paid|refund|revers|transfer|balance|invoice)\b|[₦$£€]/i },
  { name: "What they want", re: /\b(want|wants|prefer|prefers|plan|plans|goal|hoping|looking for|would like|interested)/i },
  { name: "Complaints", re: /\b(complain|angry|upset|unhappy|frustrat|problem|issue|wrong|delay|stuck|fail|never received|still not)/i },
  { name: "How to reach them", re: /\b(email|phone|whatsapp|call|calls|contact|sms|text|reach|number)/i },
  { name: "Life events", re: /\b(birthday|married|wedding|moved|relocat|new job|school|university|baby|graduat|retire)/i },
];

export default function Knowledge() {
  const { nameFor, knownName, humanize } = usePeerNames();
  const nameBelief = React.useCallback(
    (b: Belief): Belief => ({
      ...b,
      text: humanize(b.text),
      person: b.person && b.person !== "they" ? nameFor(b.person) : undefined,
      personId: b.personId ?? b.person,
    }),
    [humanize, nameFor],
  );
  const { workspace, vocab } = useApp();
  const navigate = useNavigate();

  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  // Today deep-links here with ?level=contradiction, so the filter is seeded
  // from the URL rather than always starting at "all".
  const [params, setParams] = useSearchParams();
  const seeded = params.get("level");
  const [filter, setFilter] = React.useState<Level | "all">(
    seeded && ["explicit", "deductive", "inductive", "contradiction"].includes(seeded)
      ? (seeded as Level)
      : "all",
  );
  const pick = React.useCallback(
    (l: Level | "all") => {
      setFilter(l);
      setParams(l === "all" ? {} : { level: l }, { replace: true });
    },
    [setParams],
  );
  const [topic, setTopic] = React.useState<string | null>(null);

  const all = useAsync(() => loadAll(workspace), [workspace]);
  const found = useAsync(
    () => (query ? search(workspace, query) : Promise.resolve(null)),
    [workspace, query],
  );

  // Reset the view when the workspace changes underneath us.
  React.useEffect(() => {
    setQ(""); setQuery(""); pick("all"); setTopic(null);
  }, [workspace]);

  const everything: Belief[] = React.useMemo(
    // Honcho writes conclusions with the peer id inside the sentence; swap in
    // the name so the page reads as people rather than identifiers.
    () => dedupeBeliefs((all.data ?? []).map(toBelief)).map(nameBelief),
    [all.data, nameBelief],
  );
  const searched: Belief[] | null = React.useMemo(
    () => (found.data ? dedupeBeliefs(found.data.map(toBelief)).map(nameBelief) : null),
    [found.data, nameBelief],
  );

  const counts = React.useMemo(() => countLevels(everything), [everything]);
  const total = everything.length;
  const contradictions = counts.contradiction;

  const topics = React.useMemo(
    () =>
      TOPICS.map((t) => ({
        name: t.name,
        n: everything.filter((b) => t.re.test(b.text)).length,
      })).filter((t) => t.n > 0),
    [everything],
  );

  const base = searched ?? everything;
  const shown = React.useMemo(() => {
    let list = base;
    if (filter !== "all") list = list.filter((b) => b.level === filter);
    if (topic) {
      const re = TOPICS.find((t) => t.name === topic)?.re;
      if (re) list = list.filter((b) => re.test(b.text));
    }
    return list;
  }, [base, filter, topic]);

  const searching = !!query;
  const loading = all.loading || (searching && found.loading);
  const error = all.error ?? found.error;

  const runSearch = () => setQuery(q.trim());
  const clearSearch = () => { setQ(""); setQuery(""); };

  return (
    <Page>
      <PageHead
        title="What we know"
        lede={`Every conclusion Amòye has drawn about your ${vocab.audience}, and how it got there.`}
      />

      {contradictions > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3"
          style={{ borderColor: "var(--warn)", background: "var(--warnsoft)" }}
        >
          <span className="size-[15px] shrink-0 rotate-45"
            style={{ border: "1.5px solid var(--warn)", background: "linear-gradient(90deg,transparent 47%,var(--warn) 47%)" }} />
          <span className="min-w-[200px] flex-1 text-[13.5px]">
            {contradictions === 1
              ? "One thing we believe disagrees with something else we believe."
              : `${contradictions} things we believe disagree with each other.`}{" "}
            Worth a look before repeating any of it.
          </span>
          <button
            onClick={() => pick("contradiction")}
            className="cursor-pointer rounded-[7px] border bg-transparent px-[11px] py-[5px] text-[12.5px] font-semibold"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            Show only those
          </button>
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Field
          value={q}
          onChange={setQ}
          onSubmit={runSearch}
          icon="search"
          full
          className="min-w-[220px] flex-1"
          placeholder="Search by meaning — “money worries”, “wants to leave”"
        />
        {searching && (
          <button
            onClick={clearSearch}
            className="cursor-pointer rounded-[8px] border px-3 py-[7px] text-[12.5px] text-ink2 hover:text-ink"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
          >
            Clear search
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-[7px]">
        <FilterPill
          label="Everything"
          n={total}
          on={filter === "all"}
          onClick={() => pick("all")}
        />
        {LEVEL_ORDER.map((l) => (
          <FilterPill
            key={l}
            label={LEVELS[l].filterWord}
            n={counts[l]}
            on={filter === l}
            onClick={() => pick(filter === l ? "all" : l)}
          />
        ))}
      </div>

      {topics.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-[7px]">
          {topics.map((t) => (
            <button
              key={t.name}
              onClick={() => setTopic(topic === t.name ? null : t.name)}
              className="tnum cursor-pointer whitespace-nowrap rounded-full border border-dashed px-2.5 py-[5px] text-[12px] transition-colors"
              style={
                topic === t.name
                  ? { borderColor: "var(--ink3)", color: "var(--ink)" }
                  : { borderColor: "var(--line2)", color: "var(--ink3)" }
              }
            >
              {t.name} · {t.n}
            </button>
          ))}
        </div>
      )}


      {error && <Err>Could not load what we know: {error}</Err>}

      {!error && loading && <Loading label="Reading everything we know" />}

      {!error && !loading && shown.length === 0 && (
        <Panel pad={false}>
          {total === 0 ? (
            <Empty
              headline="Nothing has been concluded yet"
              hint={`Once Amòye has read some ${vocab.conversations.toLowerCase()}, what it works out about your ${vocab.audience} will appear here.`}
            />
          ) : searching ? (
            <Empty
              headline="Nothing matches that"
              hint="Try describing it differently — the search looks for meaning, not exact words."
            />
          ) : (
            <Empty
              headline="Nothing under that filter"
              hint="There are things we know, but none of this kind."
            />
          )}
        </Panel>
      )}

      {!error && !loading && shown.length > 0 && (
        <>
          {(searching || topic) && (
            <p className="tnum m-0 mb-3 text-[12.5px] text-ink3">
              {searching ? `${shown.length} closest to “${query}”` : `${shown.length} under ${topic}`}
            </p>
          )}
          <BeliefList>
            {shown.map((b) => {
              const who = b.person ?? knownName(b.personId ?? "") ?? null;
              return (
                <BeliefCard
                  key={b.id}
                  // personId must stay the peer id. Overwriting it with the
                  // display name sent clicks to /people/Jane, and the person
                  // page then CREATED a peer called "Jane" by asking Honcho
                  // about it.
                  b={{ ...b, person: who ?? undefined }}
                  onPerson={(id) => navigate(`/people/${encodeURIComponent(id)}`)}
                />
              );
            })}
          </BeliefList>
        </>
      )}
    </Page>
  );
}

function FilterPill({
  label, n, on, onClick,
}: { label: string; n: number; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tnum cursor-pointer rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
      style={
        on
          ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }
          : { background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink2)" }
      }
    >
      {label} {n}
    </button>
  );
}
