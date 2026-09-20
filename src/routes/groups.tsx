import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/design/icons";
import {
  Button, Empty, Err, Field, Loading, Note, Page, PageHead, Panel, Row, Textarea,
} from "@/design/ui";
import { call, type Page as ApiPage, type Scope, type Session } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAsync, usePoll } from "@/hooks/use-async";
import { asList } from "@/lib/model";
import { ago, num } from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────────
   Groups — Honcho calls these scopes. A group is a named set of
   conversations that bounds what an answer is allowed to draw on, which
   makes an *empty* group the sharpest trap in the product: it returns
   nothing at all, not everything. The screen says so in three places —
   on the page, on the card, and again inside the group.
   ──────────────────────────────────────────────────────────────────────── */

type BackfillJob = { state?: string; updated_at?: string; docs_copied?: number };
type ScopeStatus = { backfill_status?: Record<string, BackfillJob> };

type Health = {
  badge: "ready" | "still reading" | "empty" | "needs a look";
  /** 0–100, already clamped. */
  pct: number;
  color: string;
  state: string;
  reading: boolean;
  empty: boolean;
  trouble: boolean;
};

type Card = {
  id: string;
  name: string;
  desc: string;
  members: number | null;
  health: Health;
};

const path = (ws: string, rest = "") =>
  `/v3/workspaces/${encodeURIComponent(ws)}/scopes${rest}`;

function titleCase(raw: string): string {
  const s = raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "Untitled group";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function metaOf(o: unknown): Record<string, unknown> {
  const m = (o as { metadata?: unknown } | null)?.metadata;
  return m && typeof m === "object" ? (m as Record<string, unknown>) : {};
}

function metaText(o: unknown, ...keys: string[]): string {
  const m = metaOf(o);
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function groupName(s: Scope): string {
  return metaText(s, "name", "title", "label") || titleCase(String(s.id ?? ""));
}

/** A conversation has no subject line of its own, so fall back to a tidied
 *  identifier rather than printing a bare one. */
function convName(s: Session): string {
  return metaText(s, "title", "subject", "name") || titleCase(String(s.id ?? ""));
}

/** Untidy by design: jobs arrive with no state, counts come back null, and a
 *  group that was never backfilled has no status at all. None of that may
 *  read as "broken" — only as "we do not know yet". */
function health(members: number | null, st: ScopeStatus | null): Health {
  const jobs = Object.values(st?.backfill_status ?? {}).filter(Boolean);
  const done = jobs.filter((j) => String(j?.state ?? "") === "completed").length;
  const failed = jobs.filter((j) => String(j?.state ?? "") === "failed").length;
  const waiting = Math.max(0, jobs.length - done - failed);

  if (members === 0) {
    return {
      badge: "empty", pct: 3, color: "var(--line2)",
      state: "nothing in it yet", reading: false, empty: true, trouble: false,
    };
  }
  if (waiting > 0) {
    const pct = jobs.length ? Math.round((done / jobs.length) * 100) : 0;
    return {
      badge: "still reading", pct: Math.max(4, Math.min(100, pct)), color: "var(--a1)",
      state: `${pct}% read`, reading: true, empty: false, trouble: false,
    };
  }
  if (failed > 0) {
    return {
      badge: "needs a look", pct: 100, color: "var(--warn)",
      state: `${failed} could not be read`, reading: false, empty: false, trouble: true,
    };
  }
  return {
    badge: "ready", pct: 100, color: "var(--a3)",
    state: "fully read", reading: false, empty: false, trouble: false,
  };
}

async function countMembers(ws: string, id: string): Promise<number | null> {
  try {
    const p = await call<ApiPage<Session>>(
      "POST", path(ws, `/${encodeURIComponent(id)}/sessions/list`), undefined, { query: { size: 1 } },
    );
    return typeof p?.total === "number" ? p.total : asList<Session>(p).length;
  } catch {
    return null;
  }
}

async function getStatus(ws: string, id: string): Promise<ScopeStatus | null> {
  try {
    return await call<ScopeStatus>("GET", path(ws, `/${encodeURIComponent(id)}/status`));
  } catch {
    return null;
  }
}

async function loadCards(ws: string): Promise<Card[]> {
  const page = await call<ApiPage<Scope>>("POST", path(ws, "/list"), undefined, { query: { size: 100 } });
  const scopes = asList<Scope>(page).filter((s) => s && s.id);
  return Promise.all(
    scopes.map(async (s) => {
      const id = String(s.id);
      const [members, st] = await Promise.all([countMembers(ws, id), getStatus(ws, id)]);
      return {
        id,
        name: groupName(s),
        desc: metaText(s, "description", "desc", "about"),
        members,
        health: health(members, st),
      };
    }),
  );
}

/* ── small local pieces ──────────────────────────────────────────────── */

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-[4px]" style={{ background: "var(--panel2)" }}>
      <div className="h-full rounded-[4px] transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="mono shrink-0 rounded-[5px] border px-1.5 py-px text-[10.5px]"
      style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

function Banner({
  tone, spin, children,
}: { tone: "warm" | "warn"; spin?: boolean; children: React.ReactNode }) {
  const c = tone === "warn" ? "var(--warn)" : "var(--a1)";
  const soft = tone === "warn" ? "var(--warnsoft)" : "var(--a1soft)";
  return (
    <div className="mb-4 flex items-start gap-3 rounded-[12px] border px-4 py-3.5"
      style={{ borderColor: c, background: soft }}>
      {spin ? (
        <span className="mt-0.5 size-[14px] shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none"
          style={{ borderColor: c, borderTopColor: "transparent" }} />
      ) : (
        <span className="mt-0.5 shrink-0" style={{ color: c }}><Icon name="warn" size={15} /></span>
      )}
      <div className="text-[13.5px] leading-[1.55] text-ink">{children}</div>
    </div>
  );
}

/* ── Groups: the list ────────────────────────────────────────────────── */

export function Groups() {
  const { workspace, vocab } = useApp();
  const nav = useNavigate();
  const convs = vocab.conversations.toLowerCase();

  const { data, error, loading, reload } = useAsync(() => loadCards(workspace), [workspace]);
  const cards = data ?? [];
  const anyReading = cards.some((c) => c.health.reading);
  usePoll(reload, 8000, anyReading);

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const create = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setFormErr(null);
    const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `group-${Date.now()}`;
    try {
      await call<Scope>("POST", path(workspace), {
        id,
        metadata: desc.trim() ? { name: clean, description: desc.trim() } : { name: clean },
      });
      setOpen(false);
      setName("");
      setDesc("");
      nav(`/groups/${encodeURIComponent(id)}`);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Groups"
        lede={`A named set of ${convs}. Ask a question inside a group and the answer only draws on what is in it.`}
        actions={
          <Button kind="primary" icon={open ? "close" : "plus"} onClick={() => setOpen((o) => !o)}>
            {open ? "Cancel" : "New group"}
          </Button>
        }
      />

      <Banner tone="warm" spin>
        <strong className="font-semibold">A group that is still being read answers with less than it should.</strong>{" "}
        An empty group returns nothing at all — not everything. Wait for it to finish before trusting an answer
        from it.
      </Banner>

      {open && (
        <div className="mb-4">
          <Panel title="New group" icon="groups">
            <div className="flex flex-col gap-3">
              <Field value={name} onChange={setName} placeholder="What is this group called?" icon="groups" full onSubmit={create} />
              <Textarea value={desc} onChange={setDesc} rows={2} placeholder={`What belongs in it? (optional)`} />
              {formErr && <Err>{formErr}</Err>}
              <div className="flex flex-wrap items-center gap-3">
                <Button kind="primary" icon="check" onClick={create} disabled={!name.trim() || busy}>
                  {busy ? "Creating…" : "Create group"}
                </Button>
                <Note>It starts empty. Add {convs} to it, then give it a moment to read them.</Note>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {loading && !data && <Loading label="Finding your groups" />}
      {error && <Err>Could not load groups — {error}</Err>}

      {data && cards.length === 0 && (
        <Panel>
          <Empty
            headline="No groups yet"
            hint={`A group narrows an answer to one set of ${convs} — billing complaints, say, or everything from last month.`}
            action={<Button kind="primary" icon="plus" onClick={() => setOpen(true)}>New group</Button>}
          />
        </Panel>
      )}

      {cards.length > 0 && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
          {cards.map((c) => (
            <GroupCard key={c.id} card={c} noun={convs} one={vocab.conversation.toLowerCase()} />
          ))}
        </div>
      )}
    </Page>
  );
}

function GroupCard({ card, noun, one }: { card: Card; noun: string; one: string }) {
  const h = card.health;
  const count =
    card.members === null
      ? "count unavailable"
      : `${num(card.members)} ${card.members === 1 ? one : noun}`;
  return (
    <Link
      to={`/groups/${encodeURIComponent(card.id)}`}
      className="block rounded-[14px] border p-4 transition-[border-color] hover:brightness-[1.06]"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)", color: "var(--ink)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2.5">
        <span className="truncate text-[15.5px] font-semibold">{card.name}</span>
        <Badge label={h.badge} color={h.color} />
      </div>
      <div className="mb-3 line-clamp-2 text-[13px] leading-[1.5] text-ink2">
        {card.desc || (h.empty
          ? "Nothing added yet — it will answer with nothing."
          : `Every ${one} put into this group.`)}
      </div>
      <Bar pct={h.pct} color={h.color} />
      <div className="mono mt-2 flex justify-between gap-2 text-[11px] text-ink3">
        <span className="truncate">{count}</span>
        <span className="shrink-0">{h.state}</span>
      </div>
    </Link>
  );
}

/* ── Group: one group, its members, and whether it can be trusted ────── */

export function Group() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = groupId ?? "";
  const { workspace, vocab } = useApp();
  const convs = vocab.conversations.toLowerCase();
  const one = vocab.conversation.toLowerCase();

  const scope = useAsync(
    () => call<Scope>("GET", path(workspace, `/${encodeURIComponent(id)}`)),
    [workspace, id],
  );
  const members = useAsync(
    () => call<ApiPage<Session>>("POST", path(workspace, `/${encodeURIComponent(id)}/sessions/list`), undefined, { query: { size: 100 } }),
    [workspace, id],
  );
  const status = useAsync(
    () => call<ScopeStatus>("GET", path(workspace, `/${encodeURIComponent(id)}/status`)),
    [workspace, id],
  );

  const list = asList<Session>(members.data);
  const total = typeof members.data?.total === "number" ? members.data.total : list.length;
  const h = health(members.loading && !members.data ? null : total, status.data ?? null);

  const refresh = React.useCallback(() => {
    members.reload();
    status.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.reload, status.reload]);
  usePoll(refresh, 8000, h.reading);

  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [actErr, setActErr] = React.useState<string | null>(null);

  const remove = async (sid: string) => {
    setBusy(true);
    setActErr(null);
    try {
      await call("DELETE", path(workspace, `/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sid)}`));
      refresh();
    } catch (e) {
      setActErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    setActErr(null);
    try {
      await call("POST", path(workspace, `/${encodeURIComponent(id)}/sessions`), { session_ids: ids.slice(0, 100) });
      setAdding(false);
      refresh();
    } catch (e) {
      setActErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const name = scope.data ? groupName(scope.data) : titleCase(id);
  const desc = scope.data ? metaText(scope.data, "description", "desc", "about") : "";

  return (
    <Page>
      <PageHead
        title={name}
        lede={desc || `Answers asked inside this group draw only on the ${convs} below.`}
        actions={
          <>
            <Button icon="refresh" onClick={refresh} title="Check again">Refresh</Button>
            <Button kind="primary" icon={adding ? "close" : "plus"} onClick={() => setAdding((a) => !a)}>
              {adding ? "Cancel" : `Add ${convs}`}
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Link to="/groups" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink3 hover:text-ink">
          <Icon name="chevron" size={13} /> All groups
        </Link>
      </div>

      {scope.error && <Err>Could not open this group — {scope.error}</Err>}

      {h.empty && !members.loading && (
        <Banner tone="warn">
          <strong className="font-semibold">This group is empty.</strong>{" "}
          A question asked inside it comes back with nothing at all — not with everything. Add {convs} before you
          rely on it.
        </Banner>
      )}
      {h.reading && (
        <Banner tone="warm" spin>
          <strong className="font-semibold">Still being read.</strong>{" "}
          An answer from this group right now will be built from part of it. Give it a moment.
        </Banner>
      )}
      {h.trouble && (
        <Banner tone="warn">
          <strong className="font-semibold">Some {convs} could not be read.</strong>{" "}
          Answers from this group will be missing whatever is in them.
        </Banner>
      )}

      <div className="mb-4">
        <Panel title="How much of it has been read" icon="backlog">
          <Bar pct={h.pct} color={h.color} />
          <p className="tnum m-0 mt-2.5 text-[13px] text-ink2">
            {members.loading && !members.data
              ? "Counting what is in this group…"
              : `${num(total)} ${total === 1 ? one : convs} in this group · ${h.state}.`}
          </p>
          {status.error && <Note>Progress is unavailable right now, so this may be out of date.</Note>}
        </Panel>
      </div>

      {actErr && <div className="mb-3"><Err>{actErr}</Err></div>}

      {adding && (
        <div className="mb-4">
          <AddPanel workspace={workspace} already={list.map((s) => String(s.id))} noun={convs} busy={busy} onAdd={add} />
        </div>
      )}

      <Panel title={`What is in it`} icon="convs" pad={false}
        action={<span className="mono text-[11px] text-ink3">{num(total)}</span>}>
        {members.loading && !members.data && <div className="px-4"><Loading label={`Gathering ${convs}`} /></div>}
        {members.error && <div className="p-4"><Err>Could not load what is in this group — {members.error}</Err></div>}
        {members.data && list.length === 0 && (
          <Empty
            headline={`Nothing in this group yet`}
            hint={`Until you add something, every answer asked inside it will come back empty.`}
            action={<Button kind="primary" icon="plus" onClick={() => setAdding(true)}>Add {convs}</Button>}
          />
        )}
        {list.length > 0 && (
          <ul className="m-0 list-none p-0">
            {list.map((s) => {
              const sid = String(s.id ?? "");
              return (
                <li key={sid} className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-ink3"><Icon name="convs" size={15} /></span>
                    <Link to={`/conversations/${encodeURIComponent(sid)}`} className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
                      <span className="block truncate text-[13.5px] font-medium">{convName(s)}</span>
                      <span className="block text-[12px] text-ink3">
                        {s.created_at ? `started ${ago(s.created_at)} ago` : "start time not recorded"}
                      </span>
                    </Link>
                    <Button kind="quiet" icon="trash" onClick={() => remove(sid)} disabled={busy}
                      title={`Take this ${one} out of the group`}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 0 && total > list.length && (
          <div className="border-t px-4 py-2.5" style={{ borderColor: "var(--line)" }}>
            <Note>Showing the first {num(list.length)} of {num(total)}.</Note>
          </div>
        )}
      </Panel>
    </Page>
  );
}

function AddPanel({
  workspace, already, noun, busy, onAdd,
}: {
  workspace: string;
  already: string[];
  noun: string;
  busy: boolean;
  onAdd: (ids: string[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const { data, error, loading } = useAsync(
    () => call<ApiPage<Session>>("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/list`, undefined, { query: { size: 100 } }),
    [workspace],
  );

  const held = new Set(already);
  const rows = asList<Session>(data)
    .filter((s) => s && s.id && !held.has(String(s.id)))
    .filter((s) => {
      const t = q.trim().toLowerCase();
      return !t || convName(s).toLowerCase().includes(t) || String(s.id).toLowerCase().includes(t);
    })
    .slice(0, 40);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Panel title={`Add ${noun}`} icon="plus">
      <div className="flex flex-col gap-3">
        <Field value={q} onChange={setQ} placeholder={`Search ${noun}`} icon="search" full />
        {loading && !data && <Loading label={`Loading ${noun}`} />}
        {error && <Err>Could not load {noun} — {error}</Err>}
        {data && rows.length === 0 && (
          <Note>{q.trim() ? "Nothing matches that." : `Every ${noun.replace(/s$/, "")} is already in this group.`}</Note>
        )}
        {rows.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto">
            {rows.map((s) => {
              const sid = String(s.id);
              const on = picked.includes(sid);
              return (
                <Row key={sid} onClick={() => toggle(sid)}>
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border"
                    style={{ borderColor: on ? "var(--a2)" : "var(--line2)", background: on ? "var(--a2)" : "transparent", color: "var(--bg)" }}>
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{convName(s)}</span>
                    <span className="block text-[12px] text-ink3">
                      {s.created_at ? `started ${ago(s.created_at)} ago` : "start time not recorded"}
                    </span>
                  </span>
                </Row>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button kind="primary" icon="check" disabled={!picked.length || busy} onClick={() => onAdd(picked)}>
            {busy ? "Adding…" : `Add ${picked.length || ""}`.trim()}
          </Button>
          <Note>Newly added {noun} take a moment to be read before answers can use them.</Note>
        </div>
      </div>
    </Panel>
  );
}

export default Groups;
