import * as React from "react";
import { usePeerNames } from "@/hooks/use-peer-names";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Avatar, BeliefCard, Button, Err, Empty, Field, Loading, Note, Page, Panel, isAgent,
} from "@/design/ui";
import { Icon } from "@/design/icons";
import { call, type Conclusion, type Message, type Peer } from "@/lib/api";
import { asList, toBelief } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useAsync } from "@/hooks/use-async";
import { ago } from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────────
   One thread. The transcript reads like a conversation — bubbles, per-person
   avatars, the agent on the opposite side — and everything beside it answers
   "who was here, what was it about, what did we take from it".
   Ported from the CONVERSATION screen of Amoye Console.dc.html.
   ──────────────────────────────────────────────────────────────────────── */

/** Summaries come back as a string, an object, or a list of them, depending on
 *  how much the server has written. Any of those shapes must not blank the panel. */
function summaryText(d: unknown): string {
  if (!d) return "";
  if (typeof d === "string") return d.trim();
  const o = d as Record<string, unknown>;
  for (const k of ["summary", "content", "text"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const inner = summaryText(v);
      if (inner) return inner;
    }
  }
  const list = (o.summaries ?? o.items) as unknown;
  if (Array.isArray(list) && list.length) {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = summaryText(list[i]);
      if (s) return s;
    }
  }
  return "";
}

/** Peer ids are machine-shaped ("cust-ada"). Nothing on screen should read
 *  like a database key, so they are softened into words. */
function clockTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Conversation() {
  const { nameFor } = usePeerNames();
  const params = useParams();
  const id = params.conversationId ?? params.id ?? "";
  const { workspace, vocab } = useApp();
  const navigate = useNavigate();

  const ws = encodeURIComponent(workspace);
  const sid = encodeURIComponent(id);

  const messages = useAsync(
    () => call<unknown>("POST", `/v3/workspaces/${ws}/sessions/${sid}/messages/list`, {}, { query: { size: 100 } }),
    [ws, sid],
  );
  const peers = useAsync(() => call<unknown>("GET", `/v3/workspaces/${ws}/sessions/${sid}/peers`), [ws, sid]);
  const summary = useAsync(() => call<unknown>("GET", `/v3/workspaces/${ws}/sessions/${sid}/summaries`), [ws, sid]);
  const learned = useAsync(
    () => call<unknown>("POST", `/v3/workspaces/${ws}/conclusions/list`, { session_id: id }, { query: { size: 50 } }),
    [ws, sid, id],
  );

  const msgs = asList<Message>(messages.data);
  const who = asList<Peer>(peers.data);
  const beliefs = asList<Conclusion>(learned.data).map(toBelief);
  const started = msgs.length ? msgs[0].created_at : undefined;

  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  async function duplicate() {
    setBusy("clone");
    setNotice(null);
    setProblem(null);
    try {
      const made = await call<{ id?: string }>("POST", `/v3/workspaces/${ws}/sessions/${sid}/clone`, {});
      setNotice(made?.id ? `Copied. The copy is called ${made.id}.` : "Copied.");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <Link
        to="/conversations"
        className="mb-3.5 inline-block text-[13px] text-ink3 hover:text-ink"
      >
        ← {vocab.conversations}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 mb-1.5 truncate text-[24px] font-semibold tracking-[-0.02em]">
            {nameFor(id) || vocab.conversation}
          </h1>
          <div className="mono text-[13px] text-ink3">
            {id}
            {started ? ` · started ${ago(started)} ago` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon="copy" onClick={duplicate} disabled={busy === "clone"}>
            {busy === "clone" ? "Duplicating…" : "Duplicate"}
          </Button>
          <Button kind="danger" icon="trash" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className="mb-4 rounded-[8px] px-3 py-2 text-[12.5px]"
          style={{ background: "var(--a2soft)", color: "var(--a2)" }}
        >
          {notice}
        </div>
      )}
      {problem && <div className="mb-4"><Err>{problem}</Err></div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Transcript
          messages={msgs}
          loading={messages.loading}
          error={messages.error}
          peers={who}
          ws={ws}
          sid={sid}
          onAdded={messages.reload}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="What this thread was about">
            {summary.loading ? (
              <Loading label="Reading it back" />
            ) : summary.error ? (
              <Err>{summary.error}</Err>
            ) : summaryText(summary.data) ? (
              <p className="m-0 text-[14px] leading-[1.6] text-ink2" style={{ textWrap: "pretty" }}>
                {summaryText(summary.data)}
              </p>
            ) : (
              <Note>
                Nothing written yet — a summary appears once there is enough here to sum up.
              </Note>
            )}
          </Panel>

          <Panel title="Who's in it" pad={false}>
            {peers.loading ? (
              <div className="px-4"><Loading /></div>
            ) : peers.error ? (
              <div className="p-4"><Err>{peers.error}</Err></div>
            ) : who.length === 0 ? (
              <div className="px-4 py-3"><Note>Nobody is attached to this one.</Note></div>
            ) : (
              <ul className="m-0 list-none p-0">
                {who.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border-b px-4 py-[11px] last:border-b-0"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <Avatar id={p.id} size={28} />
                    <Link
                      to={`/people/${encodeURIComponent(p.id)}`}
                      className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:underline"
                    >
                      {nameFor(p.id)}
                    </Link>
                    <span className="shrink-0 text-[11.5px] text-ink3">
                      {isAgent(p.id) ? "answers here" : vocab.person.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="What it took from this" pad={false}>
            {learned.loading ? (
              <div className="px-4"><Loading label="Checking" /></div>
            ) : learned.error ? (
              <div className="p-4"><Err>{learned.error}</Err></div>
            ) : beliefs.length === 0 ? (
              <div className="px-4 py-3">
                <Note>Nothing concluded from this one yet.</Note>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4">
                {beliefs.map((b) => <BeliefCard key={b.id} b={b} />)}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {confirming && (
        <ConfirmDelete
          id={id}
          kept={beliefs.length}
          onClose={() => setConfirming(false)}
          onGone={() => navigate("/conversations")}
          ws={ws}
          sid={sid}
        />
      )}
    </Page>
  );
}

function Transcript({
  messages, loading, error, peers, ws, sid, onAdded,
}: {
  messages: Message[];
  loading: boolean;
  error: string | null;
  peers: Peer[];
  ws: string;
  sid: string;
  onAdded: () => void;
}) {
  return (
    <Panel title="Transcript" pad={false}>
      <div className="px-4 pb-1 pt-2">
        {loading ? (
          <Loading label="Fetching the thread" />
        ) : error ? (
          <div className="py-3"><Err>{error}</Err></div>
        ) : messages.length === 0 ? (
          <Empty
            headline="Nothing said here yet."
            hint="Add the first message below and it will appear straight away."
            art={<span className="text-ink3"><Icon name="convs" size={26} /></span>}
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {messages.map((m) => <Bubble key={m.id} m={m} />)}
          </ul>
        )}
      </div>
      <Composer peers={peers} ws={ws} sid={sid} onAdded={onAdded} />
    </Panel>
  );
}

function Bubble({ m }: { m: Message }) {
  const { nameFor } = usePeerNames();
  const from = m.peer_id ?? "";
  const agent = isAgent(from);
  const time = clockTime(m.created_at);
  return (
    <li className={`flex gap-3 py-3 ${agent ? "flex-row-reverse" : ""}`}>
      <Avatar id={from} size={30} />
      <div className={`min-w-0 flex-1 ${agent ? "flex flex-col items-end" : ""}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">{nameFor(from)}</span>
          {agent && (
            <span
              className="mono rounded-[5px] border px-[5px] py-px text-[9.5px] uppercase tracking-[0.06em] text-ink3"
              style={{ borderColor: "var(--line2)", borderStyle: "dashed" }}
            >
              answers here
            </span>
          )}
          {time && <span className="mono text-[11px] text-ink3">{time}</span>}
        </div>
        <div
          className={`max-w-[85%] rounded-[11px] border px-3.5 py-2.5 text-[14.5px] leading-[1.6] ${agent ? "text-right" : ""}`}
          style={{
            background: agent ? "var(--panel2)" : "var(--panel)",
            borderColor: "var(--line)",
            whiteSpace: "pre-wrap",
            textWrap: "pretty",
          }}
        >
          {m.content?.trim() ? m.content : "(nothing was said in this one)"}
        </div>
      </div>
    </li>
  );
}

function Composer({
  peers, ws, sid, onAdded,
}: { peers: Peer[]; ws: string; sid: string; onAdded: () => void }) {
  const { nameFor } = usePeerNames();
  const [text, setText] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const speaker = from || peers[0]?.id || "";

  async function add() {
    if (!text.trim() || !speaker || sending) return;
    setSending(true);
    setFailed(null);
    try {
      await call("POST", `/v3/workspaces/${ws}/sessions/${sid}/messages`, {
        messages: [{ peer_id: speaker, content: text.trim() }],
      });
      setText("");
      onAdded();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {peers.length > 1 && (
          <select
            value={speaker}
            onChange={(e) => setFrom(e.target.value)}
            className="shrink-0 rounded-[8px] border px-2 py-[9px] text-[13px] outline-none"
            style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--ink)" }}
            aria-label="Who is saying it"
          >
            {peers.map((p) => (
              <option key={p.id} value={p.id}>{nameFor(p.id)}</option>
            ))}
          </select>
        )}
        <Field
          value={text}
          onChange={setText}
          onSubmit={add}
          placeholder="Add a message"
          className="min-w-[180px] flex-1"
        />
        <Button kind="primary" onClick={add} disabled={!text.trim() || !speaker || sending}>
          {sending ? "Adding…" : "Add"}
        </Button>
      </div>
      {!speaker && (
        <div className="px-4 pb-2">
          <Note>Nobody is attached to this thread yet, so there is no one to say it.</Note>
        </div>
      )}
      {failed && <div className="px-4 pb-2"><Err>{failed}</Err></div>}
      <div className="px-4 pb-3.5">
        <Note>
          Adding a message doesn't change what we know straight away — Amòye reads it in the
          background, usually within a minute.
        </Note>
      </div>
    </div>
  );
}

function ConfirmDelete({
  id, kept, ws, sid, onClose, onGone,
}: {
  id: string;
  kept: number;
  ws: string;
  sid: string;
  onClose: () => void;
  onGone: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [going, setGoing] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  async function remove() {
    setGoing(true);
    setFailed(null);
    try {
      await call("DELETE", `/v3/workspaces/${ws}/sessions/${sid}`);
      onGone();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
      setGoing(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,.5)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(430px,100%)] rounded-[14px] border p-[22px]"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        <div className="mb-2 text-[17px] font-semibold">Delete this thread?</div>
        <p className="m-0 mb-4 text-[14px] leading-[1.55] text-ink2">
          {kept > 0
            ? `${kept === 1 ? "One thing" : `${kept} things`} Amòye knows came from this thread. They'll be removed too, and anything that followed from them will be re-checked.`
            : "The messages go for good. Anything Amòye already worked out from them will be re-checked."}
        </p>
        <p className="m-0 mb-2 text-[13px] text-ink2">
          Type <strong className="text-ink">{id}</strong> to confirm.
        </p>
        <Field value={typed} onChange={setTyped} placeholder={id} mono full />
        {failed && <div className="mt-3"><Err>{failed}</Err></div>}
        <div className="mt-[18px] flex justify-end gap-2">
          <Button kind="quiet" onClick={onClose}>Keep it</Button>
          <Button kind="danger" onClick={remove} disabled={typed !== id || going}>
            {going ? "Deleting…" : "Delete anyway"}
          </Button>
        </div>
      </div>
    </div>
  );
}
