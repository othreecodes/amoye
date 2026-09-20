import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Page as PageShell, PageHead, Button, Field, Loading, Empty, Err, Note, Chip, Avatar,
  Spark, isAgent,
} from "@/design/ui";
import { Icon } from "@/design/icons";
import { LEVELS, LEVEL_ORDER, type Level } from "@/design/levels";
import { call, ApiError, type Page, type Peer, type Session } from "@/lib/api";
import { beliefsFromRepresentation, countLevels } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useAsync } from "@/hooks/use-async";
import { ago, num } from "@/lib/format";
import { displayName } from "@/lib/peer-names";

/** The address to try Gravatar with: the one they gave themselves first. */
function emailOf(p: Peer): string | undefined {
  const m = p.metadata ?? {};
  for (const k of ["learnedEmail", "email"]) {
    const v = m[k];
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────
   People — a table of everyone the workspace is building a picture of.
   The list itself is one paged call; the per-person colour (what we know,
   how active they are, whether anything disagrees) is filled in afterwards,
   row by row, so a slow or missing profile never holds up the table.
   ──────────────────────────────────────────────────────────────────────── */

const SIZE = 12;

/** The design switches layout at 900 and 1080. Mirrored here rather than in
 *  Tailwind breakpoints because the column template is a single string. */
function useWidth() {
  const [w, setW] = React.useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  React.useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** How long we have known them, in the roundest true unit. */
function tenure(created?: string | null): string {
  if (!created) return "Here since we started";
  const t = Date.parse(created);
  if (Number.isNaN(t)) return "Here since we started";
  const days = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  if (days < 1) return "New today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} known`;
  if (days < 60) return `${Math.round(days / 7)} weeks known`;
  if (days < 730) return `${Math.max(1, Math.round(days / 30))} months known`;
  return `${(days / 365).toFixed(days % 365 < 60 ? 0 : 1)} years known`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function repText(d: unknown): string {
  if (typeof d === "string") return d;
  const o = d as Record<string, unknown> | null;
  if (!o) return "";
  for (const k of ["representation", "content", "text", "card", "peer_card"]) {
    const v = o[k];
    if (typeof v === "string") return v;
  }
  return "";
}

type Detail = {
  counts: Record<Level, number>;
  known: number;
  conversations: number | null;
  lastSeen: string | null;
  spark: number[];
};

/** Eight buckets between their first conversation and now: are we hearing
 *  more from this person lately, or less? */
function trajectory(stamps: number[]): number[] {
  if (stamps.length < 3) return [];
  const lo = Math.min(...stamps);
  const hi = Math.max(Date.now(), Math.max(...stamps));
  if (hi <= lo) return [];
  const bins = new Array(8).fill(0) as number[];
  for (const t of stamps) {
    const i = Math.min(7, Math.floor(((t - lo) / (hi - lo)) * 8));
    bins[i] += 1;
  }
  return bins;
}

async function loadDetail(ws: string, id: string): Promise<Detail> {
  const enc = encodeURIComponent(id);
  const [rep, sess] = await Promise.allSettled([
    call<unknown>("POST", `/v3/workspaces/${encodeURIComponent(ws)}/peers/${enc}/representation`, {}),
    call<Page<Session>>(
      "POST", `/v3/workspaces/${encodeURIComponent(ws)}/peers/${enc}/sessions`, {},
      { query: { page: 1, size: 50, reverse: true } },
    ),
  ]);

  const beliefs = rep.status === "fulfilled" ? beliefsFromRepresentation(repText(rep.value)) : [];
  const items = sess.status === "fulfilled" ? (sess.value?.items ?? []) : [];
  const stamps = items
    .map((s) => Date.parse(String(s?.created_at ?? "")))
    .filter((t) => !Number.isNaN(t));

  return {
    counts: countLevels(beliefs),
    known: beliefs.length,
    conversations: sess.status === "fulfilled" ? (sess.value?.total ?? items.length) : null,
    lastSeen: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null,
    spark: trajectory(stamps),
  };
}

/** The row's knowledge mix: the same four colours as everywhere else, at the
 *  width a table row can spare. */
function RowMix({ counts }: { counts: Record<Level, number> }) {
  const total = LEVEL_ORDER.reduce((a, l) => a + (counts[l] ?? 0), 0);
  const label = total
    ? LEVEL_ORDER.filter((l) => counts[l]).map((l) => `${counts[l]} ${LEVELS[l].word.toLowerCase()}`).join(", ")
    : "nothing yet";
  return (
    <span
      className="flex h-[8px] w-[88px] shrink-0 gap-[1.5px] overflow-hidden rounded-[5px]"
      title={label}
      style={total ? undefined : { background: "var(--line)" }}
    >
      {LEVEL_ORDER.filter((l) => counts[l]).map((l) => (
        <span key={l} style={{ width: `${(counts[l] / total) * 100}%`, background: LEVELS[l].color }} />
      ))}
    </span>
  );
}

function AddPerson({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const { workspace, vocab } = useApp();
  const [name, setName] = React.useState("");
  const [id, setId] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const finalId = (touched ? id : slug(name)).trim();

  async function submit() {
    if (!finalId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await call("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/peers`, {
        id: finalId,
        metadata: name.trim() ? { name: name.trim() } : {},
      });
      onAdded(finalId);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]"
      style={{ background: "color-mix(in oklab, var(--bg) 72%, transparent)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog" aria-modal="true" aria-label={`Add a ${vocab.person.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        className="hx-fade w-full max-w-[420px] rounded-[14px] border p-5"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[16px] font-semibold tracking-[-0.01em]">
            Add a {vocab.person.toLowerCase()}
          </h2>
          <button onClick={onClose} className="text-ink3 hover:text-ink" aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>
        <p className="m-0 mb-4 text-[13px] text-ink2">
          Amòye starts a fresh picture and fills it in as conversations arrive.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <p className="m-0 mb-1.5 text-[12.5px] font-medium">Their name</p>
            <Field value={name} onChange={setName} placeholder="Adaeze Okonkwo" full onSubmit={submit} />
          </div>
          <div>
            <p className="m-0 mb-1.5 text-[12.5px] font-medium">How your system refers to them</p>
            <Field
              value={touched ? id : slug(name)}
              onChange={(v) => { setTouched(true); setId(v); }}
              placeholder="adaeze-okonkwo" mono full onSubmit={submit}
            />
            <div className="mt-1.5">
              <Note>This must match the name your app sends with their messages.</Note>
            </div>
          </div>
          {error && <Err>{error}</Err>}
          <div className="mt-1 flex justify-end gap-2">
            <Button kind="quiet" onClick={onClose}>Cancel</Button>
            <Button kind="primary" icon="plus" onClick={submit} disabled={!finalId || busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function People() {
  const { workspace, vocab } = useApp();
  const navigate = useNavigate();
  const width = useWidth();
  const wide = width >= 900;
  const roomy = width >= 1080;

  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [details, setDetails] = React.useState<Record<string, Detail>>({});

  React.useEffect(() => { setPage(1); }, [workspace]);

  const list = useAsync<Page<Peer>>(
    () => call<Page<Peer>>(
      "POST", `/v3/workspaces/${encodeURIComponent(workspace)}/peers/list`, {},
      { query: { page, size: SIZE } },
    ),
    [workspace, page],
  );

  const peers = React.useMemo(() => {
    const items = list.data?.items;
    return Array.isArray(items) ? items.filter((p): p is Peer => !!p && typeof p.id === "string") : [];
  }, [list.data]);

  // Colour the rows in once the page of names is on screen.
  React.useEffect(() => {
    if (!peers.length) return;
    let live = true;
    const ids = peers.map((p) => p.id);
    void Promise.all(
      ids.map(async (id) => {
        try {
          const d = await loadDetail(workspace, id);
          if (live) setDetails((prev) => ({ ...prev, [`${workspace}::${id}`]: d }));
        } catch {
          /* one unreadable profile must not blank the table */
        }
      }),
    );
    return () => { live = false; };
  }, [workspace, peers]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return peers;
    return peers.filter(
      (p) =>
        displayName(p).toLowerCase().includes(needle) ||
        p.id.toLowerCase().includes(needle) ||
        // Support often has the email and nothing else to go on.
        String(p.metadata?.email ?? "").toLowerCase().includes(needle),
    );
  }, [peers, q]);

  const total = list.data?.total;
  const pages = Math.max(1, list.data?.pages ?? 1);

  const cols = roomy
    ? "minmax(0,2fr) minmax(0,1.6fr) minmax(0,1fr) 70px"
    : wide
      ? "minmax(0,2fr) minmax(0,1.4fr) 60px"
      : "minmax(0,1fr)";

  return (
    <PageShell>
      <PageHead
        title={vocab.people}
        lede="Everyone Amòye is building a picture of."
        actions={
          <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>
            Add someone
          </Button>
        }
      />

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <div className="min-w-[220px] flex-1">
          <Field
            value={q} onChange={setQ} icon="search" full
            placeholder={`Find a ${vocab.person.toLowerCase()} by name or email`}
          />
        </div>
        <div
          className="mono flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[11.5px] text-ink3"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}
        >
          {list.loading && !list.data ? "counting…" : `${num(total ?? peers.length)} in total`}
        </div>
        <Button kind="ghost" icon="refresh" onClick={list.reload} title="Check again">
          {wide ? "Refresh" : ""}
        </Button>
      </div>

      <div
        className="overflow-hidden rounded-[14px] border"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        {roomy && (
          <div
            className="grid gap-3.5 border-b px-[18px] py-2.5"
            style={{ gridTemplateColumns: cols, borderColor: "var(--line)", background: "var(--panel2)" }}
          >
            {[vocab.person, "What we know", "Activity", "Last seen"].map((h, i) => (
              <span
                key={h}
                className="mono text-[10.5px] uppercase tracking-[0.09em] text-ink3"
                style={i === 3 ? { textAlign: "right" } : undefined}
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {list.loading && !list.data && <Loading label={`Fetching ${vocab.people.toLowerCase()}`} />}

        {list.error && (
          <div className="p-4">
            <Err>
              Could not load {vocab.people.toLowerCase()}: {list.error}
            </Err>
            <div className="mt-3">
              <Button kind="ghost" icon="refresh" onClick={list.reload}>Try again</Button>
            </div>
          </div>
        )}

        {!list.loading && !list.error && shown.length === 0 && (
          <Empty
            headline={q.trim() ? `Nobody here matches “${q.trim()}”` : `No ${vocab.people.toLowerCase()} yet`}
            hint={
              q.trim()
                ? "Search looks at this page of names. Try clearing it, or move to another page."
                : `Amòye adds someone the first time your app sends a message on their behalf. You can also add one by hand.`
            }
            action={
              q.trim()
                ? <Button kind="ghost" onClick={() => setQ("")}>Clear search</Button>
                : <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>Add someone</Button>
            }
          />
        )}

        {shown.map((p) => {
          const d = details[`${workspace}::${p.id}`];
          const name = displayName(p);
          const agent = isAgent(p.id);
          const contra = (d?.counts.contradiction ?? 0) > 0;
          const convs = d?.conversations;
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/people/${encodeURIComponent(p.id)}`)}
              className="grid w-full cursor-pointer items-center gap-3.5 border-b px-[18px] py-[13px] text-left transition-colors last:border-b-0 hover:brightness-[1.08]"
              style={{ gridTemplateColumns: cols, borderColor: "var(--line)", background: "transparent" }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar
                  id={agent ? p.id : name}
                  size={34}
                  email={emailOf(p)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-[7px]">
                    <span className="truncate text-[14.5px] font-semibold">{name}</span>
                    {agent && (
                      <Chip tone="var(--a3)" soft="var(--a3soft)" mono title="Answers on your behalf">
                        Assistant
                      </Chip>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-ink3">
                    {tenure(p.created_at)}
                    {convs !== null && convs !== undefined
                      ? ` · ${convs} ${convs === 1 ? vocab.conversation.toLowerCase() : vocab.conversations.toLowerCase()}`
                      : ""}
                  </span>
                </span>
              </span>

              <span className="flex min-w-0 items-center gap-2.5">
                <RowMix counts={d?.counts ?? { explicit: 0, deductive: 0, inductive: 0, contradiction: 0 }} />
                <span className="truncate text-[13px] text-ink2">
                  {d
                    ? d.known === 0
                      ? "nothing learned yet"
                      : `${d.known} thing${d.known === 1 ? "" : "s"} known`
                    : "still reading…"}
                </span>
                {contra && (
                  <span
                    className="size-[11px] shrink-0 rotate-45"
                    style={{ border: "1.5px solid var(--warn)" }}
                    title="Something we believe about them disagrees"
                  />
                )}
              </span>

              {roomy && (
                <span className="flex items-center">
                  {d && d.spark.length > 1
                    ? <Spark points={d.spark} tone="var(--a2)" w={110} h={24} />
                    : <span className="text-[12px] text-ink3">—</span>}
                </span>
              )}

              <span className="mono text-[12px] text-ink3" style={{ textAlign: wide ? "right" : "left" }}>
                {d?.lastSeen ? ago(d.lastSeen) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <Note>
            Page {page} of {pages}
          </Note>
          <div className="flex gap-2">
            <Button kind="ghost" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button
              kind="ghost"
              onClick={() => setPage((n) => Math.min(pages, n + 1))}
              disabled={page >= pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {adding && (
        <AddPerson
          onClose={() => setAdding(false)}
          onAdded={(id) => { setAdding(false); navigate(`/people/${encodeURIComponent(id)}`); }}
        />
      )}
    </PageShell>
  );
}
