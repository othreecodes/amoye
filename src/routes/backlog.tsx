import * as React from "react";
import { usePeerNames } from "@/hooks/use-peer-names";
import { Icon } from "@/design/icons";
import {
  Button, Empty, Err, Loading, Note, Page, PageHead, Panel, Stat,
} from "@/design/ui";
import { call, ApiError, type Page as ApiPage, type Peer, type QueueStatus } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { usePoll } from "@/hooks/use-async";
import { asList } from "@/lib/model";
import { ago, num } from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────────
   Backlog — how far behind reading is. The queue is sampled every five
   seconds and the samples are kept in memory, so the chart grows while the
   page is open rather than pretending to know the last 24 hours.
   ──────────────────────────────────────────────────────────────────────── */

const TICK = 5000;
const KEEP = 48; // four minutes of history at one sample per five seconds

type Point = { at: number; waiting: number };

type SessionRow = {
  id: string;
  total: number;
  done: number;
  running: number;
  pending: number;
};

const n0 = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function rows(q: QueueStatus | null): SessionRow[] {
  const s = q?.sessions;
  if (!s || typeof s !== "object") return [];
  return Object.entries(s)
    .map(([key, v]) => {
      const done = n0(v?.completed_work_units);
      const running = n0(v?.in_progress_work_units);
      const pending = n0(v?.pending_work_units);
      const total = n0(v?.total_work_units) || done + running + pending;
      return { id: String(v?.session_id ?? key), total, done, running, pending };
    })
    .filter((r) => r.total > 0 || r.pending > 0 || r.running > 0)
    .sort((a, b) => b.running + b.pending - (a.running + a.pending))
    .slice(0, 12);
}

/** Plain English for how far behind we are, from the drain rate we have
 *  actually observed. No observation yet, no invented number. */
function behind(points: Point[], waiting: number): string {
  if (waiting === 0) return "nothing waiting";
  if (points.length < 3) return "still measuring";
  const first = points[0];
  const last = points[points.length - 1];
  const secs = (last.at - first.at) / 1000;
  const drained = first.waiting - last.waiting;
  if (secs <= 0 || drained <= 0) return "not going down yet";
  const perSec = drained / secs;
  const eta = Math.round(waiting / perSec);
  if (eta < 60) return `about ${eta} seconds behind`;
  if (eta < 3600) return `about ${Math.round(eta / 60)} minutes behind`;
  return `about ${Math.round(eta / 3600)} hours behind`;
}

function TrendChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12.5px] text-ink3">
        Watching the queue — the shape appears after a few seconds.
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.waiting));
  return (
    <div>
      <div className="flex h-[130px] items-end gap-[3px]">
        {points.map((p) => (
          <div
            key={p.at}
            title={`${ago(p.at)} ago · ${p.waiting} waiting`}
            className="min-w-0 flex-1 rounded-t-[2px]"
            style={{
              height: `${Math.max(2, (p.waiting / max) * 130)}px`,
              background: p.waiting > max * 0.66 ? "var(--a1)" : "var(--a2)",
            }}
          />
        ))}
      </div>
      <div className="mono mt-2 flex justify-between text-[10.5px] text-ink3">
        <span>{ago(points[0].at)} ago</span>
        <span>peak {max}</span>
        <span>now</span>
      </div>
    </div>
  );
}

function ProgressRow({ r, noun }: { r: SessionRow; noun: string }) {
  const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
  const busy = r.running > 0;
  const words =
    r.pending === 0 && r.running === 0
      ? "everything here has been read"
      : r.running > 0
        ? `reading now · ${r.pending} still to go`
        : `${r.pending} waiting to be read`;
  return (
    <div className="flex items-center gap-3 border-t px-[18px] py-[11px]" style={{ borderColor: "var(--line)" }}>
      <span
        className={busy ? "hx-pulse size-2 shrink-0 rounded-full" : "size-2 shrink-0 rounded-full"}
        style={{ background: busy ? "var(--a1)" : r.pending > 0 ? "var(--a2)" : "var(--a3)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">
          {noun} {r.id}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink3">{words}</span>
        <span className="mt-1.5 block h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: busy ? "var(--a1)" : "var(--a3)" }} />
        </span>
      </span>
      <span className="mono shrink-0 text-[11.5px] text-ink3">{pct}%</span>
    </div>
  );
}

function TidyUp({ workspace }: { workspace: string }) {
  const { nameFor } = usePeerNames();
  const { vocab } = useApp();
  const [people, setPeople] = React.useState<Peer[]>([]);
  const [who, setWho] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [last, setLast] = React.useState<number | null>(null);

  const lastKey = `honcho.tidy.${workspace}`;

  React.useEffect(() => {
    let live = true;
    setWho("");
    setMsg(null);
    setProblem(null);
    try {
      const v = localStorage.getItem(lastKey);
      setLast(v ? Number(v) || null : null);
    } catch {
      setLast(null);
    }
    call<ApiPage<Peer>>("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/peers/list`, {}, { query: { size: 100 } })
      .then((r) => {
        if (!live) return;
        const list = asList<Peer>(r).filter((p) => p && p.id);
        setPeople(list);
        setWho(list[0]?.id ?? "");
      })
      .catch((e) => live && setProblem(e instanceof ApiError ? e.detail : String(e)));
    return () => {
      live = false;
    };
  }, [workspace, lastKey]);

  async function run() {
    if (!who) return;
    setBusy(true);
    setMsg(null);
    setProblem(null);
    const path = `/v3/workspaces/${encodeURIComponent(workspace)}/schedule_dream`;
    try {
      try {
        await call("POST", path, { observer: who, observed: who });
      } catch (e) {
        // Older builds take the person as a single field instead of a pair.
        if (e instanceof ApiError && (e.status === 400 || e.status === 422)) {
          await call("POST", path, { peer_id: who });
        } else {
          throw e;
        }
      }
      const now = Date.now();
      setLast(now);
      try {
        localStorage.setItem(lastKey, String(now));
      } catch {
        /* private window — the note just will not survive a reload */
      }
      setMsg(`Queued. ${who} will be tidied up in the next minute or two.`);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-[14px] border p-[17px]"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      <div className="mb-1.5 text-[15px] font-semibold">Tidy up one {vocab.person.toLowerCase()}</div>
      <p className="m-0 mb-3 text-[13.5px] leading-[1.6] text-ink2">
        Re-reads everything known about someone, merges duplicates and rewrites their nutshell. Takes a minute or two.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          disabled={people.length === 0}
          className="min-w-[120px] flex-1 cursor-pointer rounded-[8px] border px-[11px] py-2 text-[13px] outline-none disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--ink)" }}
          aria-label={`Choose a ${vocab.person.toLowerCase()} to tidy up`}
        >
          {people.length === 0 && <option value="">Nobody here yet</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>{nameFor(p.id)}</option>
          ))}
        </select>
        <Button kind="primary" icon="refresh" onClick={run} disabled={busy || !who}>
          {busy ? "Sending…" : "Tidy up"}
        </Button>
      </div>
      {msg && (
        <p className="m-0 mt-2.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--a3)" }}>
          <Icon name="check" size={13} />
          {msg}
        </p>
      )}
      {problem && <div className="mt-2.5"><Err>{problem}</Err></div>}
      <div className="mono mt-[11px] text-[12px] text-ink3">
        {last ? `last run ${ago(last)} ago` : "no tidy-up run from here yet"}
      </div>
    </section>
  );
}

export default function Backlog() {
  const { workspace, vocab } = useApp();
  const [q, setQ] = React.useState<QueueStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [points, setPoints] = React.useState<Point[]>([]);

  const load = React.useCallback(() => {
    call<QueueStatus>("GET", `/v3/workspaces/${encodeURIComponent(workspace)}/queue/status`)
      .then((r) => {
        setQ(r);
        setError(null);
        const waiting = n0(r?.pending_work_units) + n0(r?.in_progress_work_units);
        setPoints((prev) => [...prev, { at: Date.now(), waiting }].slice(-KEEP));
      })
      .catch((e) => setError(e instanceof ApiError ? e.detail : String(e)))
      .finally(() => setLoading(false));
  }, [workspace]);

  React.useEffect(() => {
    setQ(null);
    setPoints([]);
    setLoading(true);
    load();
  }, [load]);
  usePoll(load, TICK);

  const pending = n0(q?.pending_work_units);
  const running = n0(q?.in_progress_work_units);
  const done = n0(q?.completed_work_units);
  const waiting = pending + running;
  const list = rows(q);
  const peak = points.length ? Math.max(...points.map((p) => p.waiting)) : waiting;

  return (
    <Page>
      <PageHead
        title="Backlog"
        lede="How far behind Amòye is on reading what's come in."
        actions={<Button icon="refresh" onClick={load}>Check again</Button>}
      />

      {error && <div className="mb-4"><Err>Could not read the queue: {error}</Err></div>}

      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="Waiting to be read" value={loading && !q ? "—" : num(pending)} sub="not started yet" icon="backlog"
          tone={pending > 0 ? "var(--a1)" : undefined} />
        <Stat label="Being read now" value={loading && !q ? "—" : num(running)} sub="in hand this moment" icon="spark"
          tone={running > 0 ? "var(--a2)" : undefined} />
        <Stat label="Read so far" value={loading && !q ? "—" : num(done)} sub="since this workspace began" icon="check" />
        <Stat label={vocab.conversations} value={loading && !q ? "—" : num(list.length)} sub="with something outstanding" icon="convs" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section
          className="min-w-0 overflow-hidden rounded-[14px] border"
          style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-[15px]" style={{ borderColor: "var(--line)" }}>
            <div>
              <div className="text-[15px] font-semibold">Waiting to be read</div>
              <div className="mt-0.5 text-[12.5px] text-ink3">
                Since you opened this page · peak {peak}, now {waiting}
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[26px] font-semibold tracking-[-0.02em]">{loading && !q ? "—" : waiting}</span>
              <span className="text-[12.5px] text-ink3">{behind(points, waiting)}</span>
            </div>
          </div>

          <div className="px-[18px] py-4">
            {loading && !q ? <Loading label="Reading the queue" /> : <TrendChart points={points} />}
          </div>

          <div className="border-t" style={{ borderColor: "var(--line)" }}>
            <div className="px-[18px] py-[13px] text-[14.5px] font-semibold">What it&rsquo;s working through</div>
            {loading && !q && <Loading label="Looking" />}
            {!loading && list.length === 0 && (
              <Empty
                headline="Nothing in hand"
                hint={`Every ${vocab.conversation.toLowerCase()} that has come in has been read.`}
              />
            )}
            {list.map((r) => (
              <ProgressRow key={r.id} r={r} noun={vocab.conversation} />
            ))}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section
            className="rounded-[14px] border p-[17px]"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            <div className="mb-1.5 text-[15px] font-semibold">When this is empty</div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-ink2" style={{ textWrap: "pretty" }}>
              …everything else in Amòye is up to date: every message sent has been read, and every conclusion reflects it.
            </p>
          </section>

          <TidyUp workspace={workspace} />

          <Panel title="How this is counted" icon="clock">
            <Note>
              The queue is checked every five seconds while this page is open, and each check adds a bar to the chart.
              Leaving the page loses the shape, not the work.
            </Note>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
