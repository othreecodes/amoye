import * as React from "react";
import { usePeerNames } from "@/hooks/use-peer-names";
import { useNavigate } from "react-router-dom";

import {
  Page, PageHead, Button, Avatar, Spark, LearningChart, BeliefCard,
  Loading, Err, Empty, Note, type Belief,
} from "@/design/ui";
import { Icon } from "@/design/icons";
import { LEVELS, LEVEL_ORDER, type Level } from "@/design/levels";
import { call, type Conclusion, type Page as ApiPage, type Peer, type QueueStatus, type Session } from "@/lib/api";
import { asList, countLevels, dedupeBeliefs, toBelief } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useAsync, usePoll } from "@/hooks/use-async";
import { ago, num } from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────────
   Today — the overview. Four tiles, what was learned day by day, the newest
   conclusions, how solid the whole file is, who arrived last and what came
   in last. Everything below is the live workspace; nothing is sampled.
   ──────────────────────────────────────────────────────────────────────── */

const DAYS = 14;

/** Local midnight for a day offset back from today. */
function dayStart(offsetBack: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetBack);
  return d.getTime();
}

const DAY_KEYS: number[] = Array.from({ length: DAYS }, (_, i) => dayStart(DAYS - 1 - i));

function dayLabel(ms: number): string {
  return String(new Date(ms).getDate());
}

/** Which of the fourteen buckets a timestamp lands in, or -1 if it is older,
 *  absent or unparseable — real rows arrive with created_at missing. */
function bucketOf(iso?: unknown): number {
  if (typeof iso !== "string" && typeof iso !== "number") return -1;
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return -1;
  for (let i = DAY_KEYS.length - 1; i >= 0; i--) if (t >= DAY_KEYS[i]) return i;
  return -1;
}

function bucketCounts(rows: Array<{ created_at?: unknown }>): number[] {
  const out = new Array<number>(DAYS).fill(0);
  for (const r of rows) {
    const i = bucketOf(r.created_at);
    if (i >= 0) out[i] += 1;
  }
  return out;
}

function addedToday(counts: number[]): number {
  return counts[counts.length - 1] ?? 0;
}

type Tile = {
  label: string;
  value: string;
  sub: string;
  delta: string;
  tone: string;
  spark: number[];
};

function StatTile({ t }: { t: Tile }) {
  return (
    <div
      className="min-w-0 rounded-[12px] border p-4"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="mono text-[10.5px] uppercase tracking-[0.09em] text-ink3">{t.label}</span>
        <span className="mono text-[11px] font-medium" style={{ color: t.tone }}>{t.delta}</span>
      </div>
      <div className="flex items-end justify-between gap-2.5">
        <div className="tnum text-[30px] font-semibold leading-none tracking-[-0.03em]">{t.value}</div>
        <Spark points={t.spark} tone={t.tone} w={80} h={26} />
      </div>
      <div className="mt-2 text-[12.5px] text-ink3">{t.sub}</div>
    </div>
  );
}

function SidePanel({ title, hint, children, action }: {
  title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[14px] border"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-[17px] py-[13px]"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{title}</div>
          {hint && <div className="mt-0.5 text-[12.5px] text-ink3">{hint}</div>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function Today() {
  const { nameFor, humanize } = usePeerNames();
  const nav = useNavigate();
  const { workspace, vocab } = useApp();

  const peers = useAsync(
    () => call<ApiPage<Peer>>("POST", `/v3/workspaces/${workspace}/peers/list`, {}, { query: { size: 100, reverse: true } }),
    [workspace],
  );
  const sessions = useAsync(
    () => call<ApiPage<Session>>("POST", `/v3/workspaces/${workspace}/sessions/list`, {}, { query: { size: 100, reverse: true } }),
    [workspace],
  );
  const conclusions = useAsync(
    () => call<ApiPage<Conclusion>>("POST", `/v3/workspaces/${workspace}/conclusions/list`, {}, { query: { size: 100, reverse: false } }),
    [workspace],
  );
  const queue = useAsync(
    () => call<QueueStatus>("GET", `/v3/workspaces/${workspace}/queue/status`),
    [workspace],
  );

  // The backlog is the one thing that moves on its own.
  usePoll(queue.reload, 15000);

  const peerRows = asList<Peer>(peers.data);
  const sessionRows = asList<Session>(sessions.data);
  const conclusionRows = asList<Conclusion>(conclusions.data);

  const beliefs: Belief[] = React.useMemo(
    // Same renaming as the other screens: the id belongs in the link, the
    // name belongs on the screen.
    () =>
      dedupeBeliefs(conclusionRows.map((c, i) => {
        const b = toBelief(c, i);
        return {
          ...b,
          text: humanize(b.text),
          person: b.person && b.person !== "they" ? nameFor(b.person) : undefined,
          personId: b.personId ?? b.person,
        };
      })),
    [conclusionRows, humanize, nameFor],
  );
  const counts = React.useMemo(() => countLevels(beliefs), [beliefs]);
  const totalKnown = conclusions.data?.total ?? beliefs.length;

  const series = React.useMemo(() => {
    const rows = DAY_KEYS.map((k) => ({
      label: dayLabel(k), explicit: 0, deductive: 0, inductive: 0,
    }));
    conclusionRows.forEach((c, i) => {
      const day = bucketOf(c.created_at);
      if (day < 0) return;
      const lvl = beliefs[i]?.level ?? "explicit";
      if (lvl === "explicit") rows[day].explicit += 1;
      else if (lvl === "deductive") rows[day].deductive += 1;
      else if (lvl === "inductive") rows[day].inductive += 1;
    });
    return rows;
  }, [conclusionRows, beliefs]);

  const peerDaily = React.useMemo(() => bucketCounts(peerRows), [peerRows]);
  const sessionDaily = React.useMemo(() => bucketCounts(sessionRows), [sessionRows]);
  const knownDaily = React.useMemo(
    () => series.map((d) => d.explicit + d.deductive + d.inductive),
    [series],
  );

  const pending = queue.data?.pending_work_units ?? 0;
  const inFlight = queue.data?.in_progress_work_units ?? 0;
  const waiting = pending + inFlight;

  const loading = peers.loading || sessions.loading || conclusions.loading;
  const error = peers.error ?? sessions.error ?? conclusions.error;
  const nothingYet =
    !loading && !error &&
    (peers.data?.total ?? peerRows.length) === 0 &&
    (sessions.data?.total ?? sessionRows.length) === 0 &&
    totalKnown === 0;

  const plus = (n: number) => (n > 0 ? `+${n}` : "—");

  const tiles: Tile[] = [
    {
      label: vocab.people,
      value: num(peers.data?.total ?? peerRows.length),
      sub: "being tracked",
      delta: plus(addedToday(peerDaily)),
      tone: addedToday(peerDaily) > 0 ? "var(--a3)" : "var(--ink3)",
      spark: peerDaily,
    },
    {
      label: vocab.conversations,
      value: num(sessions.data?.total ?? sessionRows.length),
      sub: "read so far",
      delta: plus(addedToday(sessionDaily)),
      tone: addedToday(sessionDaily) > 0 ? "var(--a3)" : "var(--ink3)",
      spark: sessionDaily,
    },
    {
      label: "Things we know",
      value: num(totalKnown),
      sub: "across everyone we have met",
      delta: plus(addedToday(knownDaily)),
      tone: addedToday(knownDaily) > 0 ? "var(--a2)" : "var(--ink3)",
      spark: knownDaily,
    },
    {
      label: "Still to read",
      value: queue.error ? "—" : num(waiting),
      sub: queue.error ? "backlog unavailable" : waiting === 0 ? "nothing waiting" : `${num(inFlight)} being read now`,
      delta: waiting === 0 ? "clear" : "waiting",
      tone: waiting > 0 ? "var(--a1)" : "var(--a3)",
      spark: [],
    },
  ];

  const recent = beliefs.slice(0, 3);
  const newest = peerRows.slice(0, 4);
  const latest = sessionRows.slice(0, 4);

  return (
    <Page>
      <PageHead
        title="Today"
        lede={`What Amòye has learned about the ${vocab.audience} you talk to — and whether it is keeping up.`}
        actions={
          <>
            <Button icon="ask" onClick={() => nav("/ask")}>Ask a question</Button>
            <Button kind="primary" icon="backlog" onClick={() => nav("/backlog")}>Check the backlog</Button>
          </>
        }
      />

      {error && <div className="mb-4"><Err>Could not load the workspace: {error}</Err></div>}

      {loading && !error && (
        <div
          className="rounded-[14px] border"
          style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
        >
          <Loading label="Reading the workspace" />
        </div>
      )}

      {nothingYet && (
        <div
          className="rounded-[14px] border px-7 py-12 text-center"
          style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
        >
          <div className="mb-[22px] flex items-center justify-center gap-3">
            <span className="size-[30px] rounded-[9px] border-[1.5px]" style={{ borderColor: "var(--line2)" }} />
            <span className="h-[1.5px] w-[34px]" style={{ background: "var(--line2)" }} />
            <span className="size-[30px] rounded-full border-[1.5px] border-dashed" style={{ borderColor: "var(--line2)" }} />
            <span className="h-[1.5px] w-[34px]" style={{ background: "var(--line2)" }} />
            <span className="size-[30px] rounded-[9px] border-[1.5px]" style={{ background: "var(--a1soft)", borderColor: "var(--a1)" }} />
          </div>
          <Empty
            headline="Nothing known yet"
            hint={`Send a ${vocab.conversation.toLowerCase()} in and Amòye reads it, works out what it can about the ${vocab.people.toLowerCase()} in it, then keeps that picture up to date. The first conclusions usually appear a minute or two after the first message.`}
            action={
              <span className="flex flex-wrap items-center justify-center gap-2">
                <Button kind="primary" icon="plus" onClick={() => nav("/conversations?new=1")}>
                  Add your first {vocab.conversation.toLowerCase()}
                </Button>
                <Button icon="dev" onClick={() => nav("/developer")}>Connect from code</Button>
              </span>
            }
          />
        </div>
      )}

      {!loading && !nothingYet && !error && (
        <>
          <div className="mb-[18px] grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
            {tiles.map((t) => <StatTile key={t.label} t={t} />)}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            {/* ── left column ───────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-4">
              <SidePanel title="What it learned, day by day" hint={`Conclusions added, last ${DAYS} days`}>
                <div className="px-[18px] pb-3 pt-[18px]">
                  {knownDaily.some((n) => n > 0) ? (
                    <LearningChart series={series} height={150} />
                  ) : (
                    <Note>Nothing has been dated in the last fortnight, so there is no shape to draw yet.</Note>
                  )}
                </div>
              </SidePanel>

              <SidePanel
                title="Learned in the last few hours"
                action={
                  <button
                    onClick={() => nav("/knowledge")}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium"
                    style={{ color: "var(--a2)" }}
                  >
                    See all →
                  </button>
                }
              >
                <div className="flex flex-col gap-3 p-[17px]">
                  {recent.length === 0 && (
                    <Note>Nothing new has been worked out yet. The next conclusion will appear here.</Note>
                  )}
                  {recent.map((b) => (
                    <BeliefCard key={b.id} b={{ ...b, onOpen: () => nav("/knowledge") }} />
                  ))}
                </div>
              </SidePanel>
            </div>

            {/* ── right column ──────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-4">
              {counts.contradiction > 0 && (
                <div
                  className="rounded-[14px] border px-[17px] py-4"
                  style={{ background: "var(--warnsoft)", borderColor: "var(--warn)" }}
                >
                  <div className="mb-2 flex items-center gap-2.5" style={{ color: "var(--warn)" }}>
                    <Icon name="split" size={15} />
                    <span className="text-[14px] font-semibold">
                      {counts.contradiction === 1
                        ? "One thing disagrees"
                        : `${counts.contradiction} things disagree`}
                    </span>
                  </div>
                  <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-ink2">
                    Two things we believe can&rsquo;t both be true. Worth resolving before repeating any of it to
                    someone.
                  </p>
                  <button
                    onClick={() => nav("/knowledge?level=contradiction")}
                    className="cursor-pointer rounded-[7px] border bg-transparent px-[11px] py-1.5 text-[12.5px] font-semibold"
                    style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                  >
                    Resolve them
                  </button>
                </div>
              )}

              <SidePanel
                title="How solid is what we know"
                hint={`${num(totalKnown)} conclusions across everyone`}
              >
                <div className="p-[17px]">
                  {beliefs.length === 0 ? (
                    <Note>Nothing concluded yet.</Note>
                  ) : (
                    <>
                      <div className="mb-3.5 flex h-3 gap-0.5 overflow-hidden rounded-[6px]">
                        {LEVEL_ORDER.filter((l) => counts[l] > 0).map((l) => (
                          <span
                            key={l}
                            title={`${counts[l]} ${LEVELS[l].word.toLowerCase()}`}
                            style={{
                              width: `${(counts[l] / beliefs.length) * 100}%`,
                              background: LEVELS[l].color,
                            }}
                          />
                        ))}
                      </div>
                      {LEVEL_ORDER.map((l: Level) => (
                        <div
                          key={l}
                          className="flex items-center gap-2.5 border-t py-1.5"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <span className="size-[9px] shrink-0 rounded-[2px]" style={{ background: LEVELS[l].color }} />
                          <span className="flex-1 text-[13px]">{LEVELS[l].word}</span>
                          <span className="tnum mono text-[12.5px] text-ink2">{counts[l]}</span>
                        </div>
                      ))}
                      <p className="m-0 mt-2.5 text-[12px] text-ink3">
                        Counted from the {num(beliefs.length)} most recent.
                      </p>
                    </>
                  )}
                </div>
              </SidePanel>

              <SidePanel title={`Newest ${vocab.people.toLowerCase()}`}>
                {newest.length === 0 ? (
                  <div className="p-[17px]"><Note>Nobody has been seen yet.</Note></div>
                ) : (
                  newest.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => nav(`/people/${encodeURIComponent(p.id)}`)}
                      className="flex w-full cursor-pointer items-center gap-2.5 bg-transparent px-[17px] py-2.5 text-left hover:brightness-110"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <Avatar id={p.id} size={28} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{nameFor(p.id)}</span>
                      <span className="mono text-[11px] text-ink3">{ago(p.created_at)}</span>
                    </button>
                  ))
                )}
              </SidePanel>

              <SidePanel
                title={`Latest ${vocab.conversations.toLowerCase()}`}
                action={
                  <button
                    onClick={() => nav("/conversations")}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium"
                    style={{ color: "var(--a2)" }}
                  >
                    See all →
                  </button>
                }
              >
                {latest.length === 0 ? (
                  <div className="p-[17px]"><Note>Nothing has come in yet.</Note></div>
                ) : (
                  latest.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => nav(`/conversations/${encodeURIComponent(s.id)}`)}
                      className="flex w-full cursor-pointer items-center gap-2.5 bg-transparent px-[17px] py-2.5 text-left hover:brightness-110"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <span className="text-ink3"><Icon name="convs" size={15} /></span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{s.id}</span>
                      <span className="mono text-[11px] text-ink3">{ago(s.created_at)}</span>
                    </button>
                  ))
                )}
              </SidePanel>
            </div>
          </div>

          {queue.error && (
            <div className="mt-4">
              <Err>The backlog did not answer: {queue.error}</Err>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
