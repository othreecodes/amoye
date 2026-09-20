import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  call,
  type Page as ApiPage,
  type Peer,
  type QueueStatus,
  type Session,
} from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAsync, usePoll } from "@/hooks/use-async";
import { asList } from "@/lib/model";
import { ago, bucketOf, num } from "@/lib/format";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  Err,
  Field,
  Label,
  Note,
  Page,
  PageHead,
  Panel,
  Textarea,
  Bucket,
  Pager,
} from "@/design/ui";
import { Icon } from "@/design/icons";

/* ────────────────────────────────────────────────────────────────────────
   Conversations — browse every thread Amòye has read.

   One row per thread: who is in it, what it is called, how long ago it
   moved, and whether the system is still reading it. The reference is the
   only identifier on screen, and it is the thing a CX agent actually quotes
   back to a customer, so it stays.
   ──────────────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 25;
/** A search reaches further back than one page, but not unboundedly — the
 *  list endpoint has no text filter, so matching happens here. */
const SEARCH_SIZE = 100;

function humanize(raw: string): string {
  const t = String(raw ?? "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "Untitled";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function metaString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Threads rarely carry a subject. When one does, it leads; otherwise the
 *  reference is read back as a phrase rather than dumped as an id. */
function subjectOf(s: Session): string {
  return metaString(s.metadata, ["title", "subject", "name", "summary", "topic"]) ?? humanize(s.id);
}

function nameOfPeer(p: Peer): string {
  return metaString(p.metadata, ["name", "display_name", "full_name"]) ?? humanize(p.id);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}

/** Who is in each thread, fetched a page at a time and tolerant of any one
 *  of them failing — a thread whose people we cannot read still lists. */
function usePeople(sessions: Session[], workspace: string) {
  const [byId, setById] = React.useState<Record<string, Peer[]>>({});
  const key = sessions.map((s) => s.id).join("|");

  React.useEffect(() => {
    let live = true;
    const ids = key ? key.split("|") : [];
    if (ids.length === 0) return;
    Promise.allSettled(
      ids.map((id) =>
        call<ApiPage<Peer> | Peer[]>(
          "GET",
          `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/${encodeURIComponent(id)}/peers`,
        ).then((r) => [id, asList<Peer>(r)] as const),
      ),
    ).then((rs) => {
      if (!live) return;
      const next: Record<string, Peer[]> = {};
      for (const r of rs) if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      setById((prev) => ({ ...prev, ...next }));
    });
    return () => {
      live = false;
    };
  }, [key, workspace]);

  return byId;
}

/** The backlog knows which threads are mid-read. Same poll the rail uses. */
function useReading(workspace: string) {
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const load = React.useCallback(() => {
    call<QueueStatus>("GET", `/v3/workspaces/${encodeURIComponent(workspace)}/queue/status`)
      .then((q) => {
        const out: Record<string, boolean> = {};
        for (const [id, s] of Object.entries(q?.sessions ?? {})) {
          out[id] = (s?.pending_work_units ?? 0) + (s?.in_progress_work_units ?? 0) > 0;
        }
        setBusy(out);
      })
      .catch(() => setBusy({}));
  }, [workspace]);
  React.useEffect(load, [load]);
  usePoll(load, 10000);
  return busy;
}

function SkeletonRows() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 border-b px-[18px] py-[14px] last:border-b-0"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="hx-pulse size-8 shrink-0 rounded-full" style={{ background: "var(--panel2)" }} />
          <span className="min-w-0 flex-1">
            <span
              className="hx-pulse block h-[11px] rounded-full"
              style={{ background: "var(--panel2)", width: `${42 + ((i * 13) % 34)}%` }}
            />
            <span
              className="hx-pulse mt-2 block h-[9px] rounded-full"
              style={{ background: "var(--panel2)", width: `${24 + ((i * 7) % 18)}%`, opacity: 0.7 }}
            />
          </span>
          <span className="hx-pulse h-[9px] w-8 rounded-full" style={{ background: "var(--panel2)" }} />
        </div>
      ))}
    </div>
  );
}

function ThreadRow({
  session, people, reading, onOpen,
}: {
  session: Session;
  people: Peer[] | undefined;
  reading: boolean;
  onOpen: () => void;
}) {
  const names = (people ?? []).map(nameOfPeer);
  const who =
    names.length === 0
      ? null
      : names.length <= 2
        ? names.join(" and ")
        : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  const lead = people && people.length > 0 ? people[0].id : session.id;

  return (
    <button
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3.5 border-b px-[18px] py-[14px] text-left transition-colors last:border-b-0 hover:bg-panel2 focus-visible:bg-panel2"
      style={{ borderColor: "var(--line)" }}
    >
      <Avatar id={lead} size={32} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{subjectOf(session)}</span>
        <span className="mt-[2px] block truncate text-[12.5px] text-ink3">
          {who ? <>{who} · </> : null}
          <span className="mono">{session.id}</span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {reading && (
          <Chip tone="var(--a1)" soft="var(--a1soft)" title="Amòye is still reading this thread">
            reading
          </Chip>
        )}
        {session.is_active === false && (
          <span className="hidden text-[12.5px] text-ink3 sm:inline">closed</span>
        )}
        {people && people.length > 0 && (
          <span className="hidden whitespace-nowrap text-[12.5px] text-ink2 md:inline">
            {people.length === 1 ? "1 person" : `${people.length} people`}
          </span>
        )}
        <span className="mono tnum w-[34px] text-right text-[11.5px] text-ink3" title={session.created_at}>
          {ago(session.created_at)}
        </span>
      </span>
    </button>
  );
}

function NewThread({
  convWord, onCreated, onCancel,
}: { convWord: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const { workspace } = useApp();
  const [subject, setSubject] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const id = (ref.trim() || slug(subject)).trim();

  const submit = () => {
    if (!id || busy) return;
    setBusy(true);
    setError(null);
    call<Session>("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/sessions`, {
      id,
      metadata: subject.trim() ? { title: subject.trim() } : {},
    })
      .then((s) => onCreated(s?.id ?? id))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Panel title={`Start a ${convWord}`} icon="convs" className="mb-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label>What is it about</Label>
          <div className="mt-1.5">
            <Textarea
              rows={2}
              value={subject}
              onChange={setSubject}
              placeholder="Missing IPO allocation"
            />
          </div>
        </div>
        <div className="min-w-0">
          <Label>Reference</Label>
          <div className="mt-1.5">
            <Field
              full mono
              value={ref}
              onChange={setRef}
              onSubmit={submit}
              placeholder={slug(subject) || "ticket-8830"}
              icon="key"
            />
          </div>
          <div className="mt-1.5">
            <Note>
              The short handle you would quote back to someone. Left blank, it is made from the subject.
            </Note>
          </div>
        </div>
      </div>

      {error && <div className="mt-3"><Err>{error}</Err></div>}

      <div className="mt-3.5 flex items-center gap-2">
        <Button kind="primary" icon="plus" onClick={submit} disabled={!id || busy}>
          {busy ? "Starting…" : "Start it"}
        </Button>
        <Button kind="quiet" onClick={onCancel}>Cancel</Button>
        <span className="ml-auto">
          <Note>Nothing is known from it until someone says something.</Note>
        </span>
      </div>
    </Panel>
  );
}

export function Conversations() {
  const { workspace, vocab } = useApp();
  const navigate = useNavigate();

  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [composing, setComposing] = React.useState(false);

  const searching = q.trim().length > 0;
  const size = searching ? SEARCH_SIZE : PAGE_SIZE;
  const wanted = searching ? 1 : page;

  React.useEffect(() => setPage(1), [workspace, q]);

  const listed = useAsync(
    () =>
      call<ApiPage<Session>>(
        "POST",
        `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/list`,
        {},
        { query: { page: wanted, size, reverse: true } },
      ),
    [workspace, wanted, size],
  );

  const all = React.useMemo(() => asList<Session>(listed.data), [listed.data]);
  const total = listed.data?.total;
  const pages = listed.data?.pages ?? 1;

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) =>
      `${s.id} ${subjectOf(s)}`.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const people = usePeople(rows.slice(0, 40), workspace);
  const reading = useReading(workspace);

  const open = (id: string) => navigate(`/conversations/${encodeURIComponent(id)}`);

  const convWord = vocab.conversation.toLowerCase();

  return (
    <Page>
      <PageHead
        title={vocab.conversations}
        lede="Every thread Amòye has read, and who was in each one."
        actions={
          <Button kind="primary" icon="plus" onClick={() => setComposing((c) => !c)}>
            New {convWord}
          </Button>
        }
      />

      {composing && (
        <NewThread
          convWord={convWord}
          onCancel={() => setComposing(false)}
          onCreated={(id) => {
            setComposing(false);
            listed.reload();
            open(id);
          }}
        />
      )}

      <div
        className="mb-3.5 flex items-center gap-2 rounded-[9px] border px-3 py-2"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <span className="shrink-0 text-ink3"><Icon name="search" size={14} /></span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Find a ${convWord}`}
          aria-label={`Find a ${convWord}`}
          className="w-full min-w-0 border-0 bg-transparent text-[13.5px] outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="shrink-0 text-ink3 hover:text-ink"
            aria-label="Clear"
          >
            <Icon name="close" size={13} />
          </button>
        )}
        <span className="mono tnum shrink-0 whitespace-nowrap text-[11.5px] text-ink3">
          {searching
            ? `${num(rows.length)} matching`
            : total === undefined ? "" : `${num(total)} total`}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-[14px] border"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        {listed.loading && all.length === 0 && <SkeletonRows />}

        {!listed.loading && listed.error && (
          <div className="p-4">
            <Err>Could not load {vocab.conversations.toLowerCase()} — {listed.error}</Err>
            <div className="mt-3">
              <Button icon="refresh" onClick={listed.reload}>Try again</Button>
            </div>
          </div>
        )}

        {!listed.error && !listed.loading && rows.length === 0 && (
          searching ? (
            <Empty
              headline={`Nothing matches “${q.trim()}”`}
              hint={`Searching the ${SEARCH_SIZE} most recent. Try the reference, or part of the subject.`}
              action={<Button onClick={() => setQ("")}>Clear the search</Button>}
              art={<span className="text-ink3"><Icon name="search" size={28} /></span>}
            />
          ) : (
            <Empty
              headline={`No ${vocab.conversations.toLowerCase()} yet`}
              hint="Once people start talking, every thread turns up here and Amòye begins reading it."
              action={
                <Button kind="primary" icon="plus" onClick={() => setComposing(true)}>
                  New {convWord}
                </Button>
              }
              art={<span className="text-ink3"><Icon name="convs" size={28} /></span>}
            />
          )
        )}

        {rows.map((s, i) => {
          // A heading whenever the recency band changes. The list is already
          // newest-first, so this groups without reordering anything.
          const bucket = bucketOf(s.created_at);
          const previous = i === 0 ? null : bucketOf(rows[i - 1].created_at);
          return (
            <React.Fragment key={s.id}>
              {bucket !== previous && <Bucket label={bucket} />}
              <ThreadRow
                session={s}
                people={people[s.id]}
                reading={reading[s.id] === true}
                onOpen={() => open(s.id)}
              />
            </React.Fragment>
          );
        })}

        {!searching && rows.length > 0 && (
          <Pager
            page={page}
            pages={Math.max(pages, page)}
            total={total ?? null}
            size={PAGE_SIZE}
            onPage={setPage}
            noun={vocab.conversations.toLowerCase()}
          />
        )}
      </div>

    </Page>
  );
}

export default Conversations;

/** The detail screen lives in its own file; App.tsx imports both names from
 *  here, so it is re-exported rather than duplicated. */
export { default as Conversation } from "./conversation";
