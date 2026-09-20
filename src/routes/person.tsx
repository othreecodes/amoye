import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Icon, type IconName } from "@/design/icons";
import { LEVELS, LEVEL_ORDER, UL_CLASS, type Level } from "@/design/levels";
import {
  Avatar, BeliefCard, Button, Empty, Err, Field, Loading, MixBar, Note, Panel,
  type Belief,
} from "@/design/ui";
import { useAsync } from "@/hooks/use-async";
import { ApiError, call, stream, type Conclusion, type Page, type Session } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { ago, num } from "@/lib/format";
import { asList, beliefsFromRepresentation, countLevels, dedupeBeliefs, toBelief } from "@/lib/model";
import { buildAttributor } from "@/lib/attribution";
import { usePeerNames } from "@/hooks/use-peer-names";
import { displayName, firstName } from "@/lib/peer-names";

/* ───────────────────────── untidy-data helpers ─────────────────────────
   Honcho returns prose in a different wrapper depending on the endpoint and
   the version. Rather than guess once and crash, dig for the first string. */

const TEXT_KEYS = [
  "peer_card", "card", "representation", "context", "content",
  "text", "summary", "profile", "message",
];

function textOf(d: unknown, depth = 0): string {
  if (typeof d === "string") return d.trim();
  if (depth > 3) return "";
  if (Array.isArray(d)) {
    return d.map((x) => textOf(x, depth + 1)).filter(Boolean).join("\n");
  }
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    for (const k of TEXT_KEYS) {
      if (k in o) {
        const v = textOf(o[k], depth + 1);
        if (v) return v;
      }
    }
  }
  return "";
}

function numberIn(d: unknown, keys: string[]): number | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  for (const k of keys) if (typeof o[k] === "number") return o[k] as number;
  return null;
}

function observedOf(c: Conclusion): string {
  return String(c.observed_id ?? c.observed ?? "").trim();
}

function firstStamp(items: Array<{ created_at?: string | null }>): string | null {
  const times = items
    .map((i) => (i.created_at ? Date.parse(i.created_at) : NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

/* The card is written prose with no per-clause provenance. Rather than invent
   one, each sentence is matched against the conclusions we do have levels for,
   and only a confident match earns an underline. */
function splitSentences(s: string): string[] {
  return s
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

/** Cumulative "things known" over time, as the design's single soft line. */
function growthPoints(stamps: string[], w = 260, h = 90): string {
  const ts = stamps.map((s) => Date.parse(s)).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  if (ts.length < 2) return "";
  const t0 = ts[0];
  const t1 = ts[ts.length - 1];
  const span = Math.max(1, t1 - t0);
  return ts
    .map((t, i) => {
      const x = ((t - t0) / span) * w;
      const y = h - 6 - ((i + 1) / ts.length) * (h - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ───────────────────────────── the screen ───────────────────────────── */

type Know = { beliefs: Belief[]; stamps: string[]; fromCard: boolean };


/**
 * The nutshell is written by the model, so regenerating it on every visit
 * produces slightly different prose each time — which reads as instability in
 * something the agent is meant to trust, and spends a call per page view.
 * Cache it against the number of things known: new knowledge invalidates it,
 * revisiting does not.
 */
const NUTSHELL_KEY = "amoye.nutshell";

function readNutshell(key: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(NUTSHELL_KEY) ?? "{}") as Record<string, string>;
    return all[key] ?? null;
  } catch {
    return null;
  }
}

function writeNutshell(key: string, prose: string) {
  try {
    const all = JSON.parse(localStorage.getItem(NUTSHELL_KEY) ?? "{}") as Record<string, string>;
    // Keep the map small: one entry per person, newest 60 wins.
    const next = { ...all, [key]: prose };
    const keys = Object.keys(next);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete next[k];
    localStorage.setItem(NUTSHELL_KEY, JSON.stringify(next));
  } catch {
    /* private window — the summary just regenerates next time */
  }
}

export default function Person() {
  const params = useParams();
  const nav = useNavigate();
  const { workspace, vocab } = useApp();
  const { nameFor, knownName, humanize } = usePeerNames();
  const personId = decodeURIComponent(params.personId ?? "");
  const ws = encodeURIComponent(workspace);
  const pid = encodeURIComponent(personId);

  const [filter, setFilter] = React.useState<Level | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  // The contact details live on the peer, not in the conclusions. Support
  // needs them at hand: the email or the number is how they look someone up
  // in every other tool they have open.
  // Also the existence check. Several calls below (chat, representation)
  // create the peer they are asked about, so a mistyped or stale id used to
  // mint a brand new person rather than 404.
  const profile = useAsync(async () => {
    const r = await call<{ items?: Array<{ id?: string; metadata?: Record<string, unknown> }> }>(
      "POST",
      `/v3/workspaces/${ws}/peers/list`,
      { filters: { id: personId } },
      { query: { size: 1 } },
    );
    const hit = r?.items?.[0];
    // A server that ignores `filters` hands back the first peer in the
    // workspace instead -- whose name, email and phone belong to someone
    // else. Only read the metadata when the row really is this person.
    const mine = hit && (hit.id === undefined || hit.id === personId) ? hit : null;
    return { found: !!hit, meta: mine?.metadata ?? {} };
  }, [ws, personId]);
  const missing = profile.data ? !profile.data.found : false;

  /* ── everything we know, with the representation as the fallback source ── */
  const know = useAsync<Know>(async () => {
    let items: Conclusion[] = [];
    try {
      // `filters`, not `filter`. The server silently ignores an unknown key
      // and hands back the whole workspace, which then looks like "this
      // person has no conclusions" and falls through to the representation
      // below -- where every claim is flattened to explicit and the
      // deductive and inductive levels disappear.
      for (let page = 1; page <= 3; page += 1) {
        const r = await call<{ items?: Conclusion[]; total?: number }>(
          "POST",
          `/v3/workspaces/${ws}/conclusions/list`,
          { filters: { observed: personId } },
          { query: { size: 100, page, reverse: false } },
        );
        const batch = asList<Conclusion>(r);
        items = items.concat(batch);
        if (batch.length < 100 || items.length >= (r?.total ?? items.length)) break;
      }
    } catch {
      items = [];
    }
    // A server that ignores the filter hands back the whole workspace.
    const mine = items.filter((c) => observedOf(c) === personId);
    const scoped = mine.length ? mine : items.filter((c) => !observedOf(c));

    const rawStamp = new Map<string, string>(
      scoped.map((c, i) => [String(c.id ?? i), String(c.created_at ?? "")]),
    );
    if (scoped.length) {
      return {
        beliefs: dedupeBeliefs(scoped.map(toBelief)),
        // Stamps drive the "over time" line and the oldest-known label, so they
        // have to follow the same deduped set, not the raw rows.
        stamps: dedupeBeliefs(scoped.map(toBelief))
          .map((b) => rawStamp.get(b.id) ?? "")
          .filter(Boolean),
        fromCard: false,
      };
    }

    const rep = await call<unknown>("POST", `/v3/workspaces/${ws}/peers/${pid}/representation`, {});
    return { beliefs: beliefsFromRepresentation(textOf(rep)), stamps: [], fromCard: true };
  }, [ws, pid, personId]);

  /* ── where they turn up ── */
  const convs = useAsync(
    async () => {
      if (!profile.data?.found) return [];
      const r = await call<Page<Session>>(
        "POST",
        `/v3/workspaces/${ws}/peers/${pid}/sessions`,
        {},
        { query: { size: 50, reverse: true } },
      );
      return asList<Session>(r);
    },
    [ws, pid, profile.data?.found],
  );

  /* ── the brief an agent is handed, fetched only when asked for ── */
  const [brief, setBrief] = React.useState<{ text: string; tokens: number | null } | null>(null);
  const [briefErr, setBriefErr] = React.useState<string | null>(null);
  const [briefLoading, setBriefLoading] = React.useState(false);

  React.useEffect(() => {
    if (!briefOpen || brief || briefLoading) return;
    setBriefLoading(true);
    setBriefErr(null);
    call<unknown>("GET", `/v3/workspaces/${ws}/peers/${pid}/context`)
      .then((d) => setBrief({ text: textOf(d), tokens: numberIn(d, ["token_count", "tokens", "total_tokens"]) }))
      .catch((e) => setBriefErr(e instanceof ApiError ? e.detail : String(e)))
      .finally(() => setBriefLoading(false));
  }, [briefOpen, brief, briefLoading, ws, pid]);

  React.useEffect(() => {
    if (!briefOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBriefOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefOpen]);

  /* ── quick question ── */
  const [ask, setAsk] = React.useState("");
  const [out, setOut] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [askErr, setAskErr] = React.useState<string | null>(null);
  const got = React.useRef(false);

  const run = React.useCallback(
    async (q: string) => {
      const query = q.trim();
      if (!query || asking) return;
      setAsking(true);
      setOut("");
      setAskErr(null);
      got.current = false;
      const path = `/v3/workspaces/${ws}/peers/${pid}/chat`;
      try {
        await stream(path, { query, stream: true }, (d) => {
          got.current = true;
          setOut((o) => o + d);
        });
        if (!got.current) {
          // Some deployments answer in one shot rather than in frames.
          const once = await call<unknown>("POST", path, { query });
          setOut(textOf(once) || "No answer came back.");
        }
      } catch (e) {
        setAskErr(e instanceof ApiError ? e.detail : String(e));
      } finally {
        setAsking(false);
      }
    },
    [asking, ws, pid],
  );

  /* ── derived ── */
  /* ── the standing profile ──
     Honcho's peer card is a list of labelled fragments ("RELATIONSHIP: Bank:
     <name>"), which reads as a database row, not a summary. The dialectic
     endpoint reasons over everything known and can write it as prose, so the
     nutshell is generated there and the card is only the fallback. */
  const [regen, setRegen] = React.useState(0);
  const knownCount = know.data?.beliefs.length ?? null;

  const card = useAsync(async () => {
    // Wait until we know how much there is to summarise, so the cache key is
    // stable and we do not generate against a half-loaded page. Never ask
    // about a peer that does not exist -- the chat endpoint would create it.
    if (knownCount === null || !profile.data?.found) return null;
    const key = `${ws}:${pid}:${knownCount}`;
    if (regen === 0) {
      const cached = readNutshell(key);
      if (cached) return cached;
    }
    try {
      const r = await call<unknown>(
        "POST",
        `/v3/workspaces/${ws}/peers/${pid}/chat`,
        {
          query:
            "Summarise who this person is and what matters about them right now, for a " +
            "colleague about to speak to them.\n\n" +
            "Rules:\n" +
            "- Two to four sentences, third person, flowing prose.\n" +
            "- Keep every sentence under 15 words. Short sentences, plainly written.\n" +
            "- One fact per sentence. Do not chain clauses with 'which', 'despite' or 'that will likely'.\n" +
            "- Everyday words. Say 'has not paid yet', not 'has an outstanding balance'.\n" +
            "- No lists, labels, headings or field names. Do not mention that you are summarising.\n" +
            "- Start with a fact, never with a hedge. Do not open with how much is known.\n" +
            "- Only if you genuinely know nothing at all, say that in one short sentence.",
          stream: false,
        },
      );
      const prose = textOf(r).trim();
      if (prose && !/^\s*(no |nothing |i (don'?t|do not) )/i.test(prose)) {
        writeNutshell(key, prose);
        return prose;
      }
    } catch {
      /* fall through to the stored card */
    }
    return call<unknown>("GET", `/v3/workspaces/${ws}/peers/${pid}/card`).then(textOf);
  }, [ws, pid, knownCount, regen, profile.data?.found]);

  // Honcho writes its conclusions with the peer id in them. Swap in the name
  // here, once, so every row and count below reads the same way.
  const beliefs = React.useMemo(
    () =>
      (know.data?.beliefs ?? []).map((b) => ({
        ...b,
        text: humanize(b.text),
        // `person` is the peer id out of the API. Keep it as the link target
        // and show the name, or clicking the name would navigate to a name.
        person: b.person ? nameFor(b.person) : b.person,
        personId: b.personId ?? b.person,
      })),
    [know.data, humanize, nameFor],
  );
  const counts = countLevels(beliefs);
  const attribute = React.useMemo(() => buildAttributor(beliefs), [beliefs]);
  const shown = filter ? beliefs.filter((b) => b.level === filter) : beliefs;
  const visible = expanded ? shown : shown.slice(0, 8);
  const hidden = shown.length - visible.length;

  const sessions = convs.data ?? [];
  const oldest = firstStamp(
    know.data?.stamps.map((s) => ({ created_at: s })) ?? [],
  ) ?? firstStamp(sessions);

  const meta = profile.data?.meta ?? {};
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string).trim() : "");
  // The CRM name behind the learned one. For a messaging-app lead the CRM
  // contact is only their display handle, so when the two disagree the reader
  // needs to see both — otherwise the console silently overwrites the record
  // they are looking up in every other tool. The CRM record does not always
  // arrive under `name`, so read the same fallback chain the list does.
  const crmName = str("name") || str("display_name") || str("full_name") || str("label");
  const learnedName = str("learnedName");
  const crmEmail = str("email");
  const learnedEmail = str("learnedEmail");

  // The id stays the key; the name is only ever what a person reads. The
  // shared map answers instantly, but it stops at MAX_PEERS and can fail, so
  // fall back to this peer's own metadata before falling back to the id --
  // otherwise the header reads as an id while the line under it discloses a
  // learned name that is nowhere on screen.
  const display = personId
    ? (knownName(personId) ?? displayName({ id: personId, metadata: meta }))
    : "Unknown";
  const first = firstName(display);
  const points = growthPoints(know.data?.stamps ?? []);

  const filters: Array<{ key: Level | null; label: string; n: number }> = [
    { key: null, label: "Everything", n: beliefs.length },
    ...LEVEL_ORDER.map((l) => ({ key: l as Level | null, label: LEVELS[l].word, n: counts[l] })),
  ];

  type Contact = { kind: string; label: string; icon: IconName; note?: string };
  const contacts: Contact[] = [
    learnedEmail && learnedEmail !== crmEmail
      ? { kind: "email", label: learnedEmail, icon: "mail" as IconName, note: "they gave this" }
      : null,
    crmEmail ? { kind: "email", label: crmEmail, icon: "mail" as IconName } : null,
    str("phone") ? { kind: "phone number", label: str("phone"), icon: "phone" as IconName } : null,
    str("channel") ? { kind: "channel", label: str("channel"), icon: "people" as IconName } : null,
  ].filter(Boolean) as Contact[];

  const subline = [
    oldest ? `known for ${ago(oldest)}` : null,
    convs.loading ? null : `${num(sessions.length)} ${sessions.length === 1 ? vocab.conversation.toLowerCase() : vocab.conversations.toLowerCase()}`,
    know.loading ? null : `${num(beliefs.length)} things known`,
  ].filter(Boolean).join(" · ");

  if (missing) {
    return (
      <div className="hx-fade">
        <button
          onClick={() => nav("/people")}
          className="mb-3.5 cursor-pointer border-0 bg-transparent p-0 text-[13px] text-ink3 hover:text-ink"
        >
          ← {vocab.people}
        </button>
        <Empty
          headline={`No ${vocab.person.toLowerCase()} with the id ${personId}`}
          hint={`Ids are not names. Open someone from ${vocab.people} so the link carries their id.`}
        />
      </div>
    );
  }

  return (
    <div className="hx-fade">
      <button
        onClick={() => nav("/people")}
        className="mb-3.5 cursor-pointer border-0 bg-transparent p-0 text-[13px] text-ink3 hover:text-ink"
      >
        ← {vocab.people}
      </button>

      {/* ── header ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <Avatar id={display} size={52} email={learnedEmail || crmEmail || undefined} />
          <div className="min-w-0">
            <h1 className="m-0 mb-1 truncate text-[25px] font-semibold tracking-[-0.02em]">{display}</h1>
            <div className="text-[13.5px] text-ink3">{subline || "reading their file…"}</div>
            {learnedName && crmName && learnedName !== crmName && (
              <div className="mt-0.5 text-[12.5px] text-ink3">
                {str("channel") || "CRM"} profile: {crmName}
              </div>
            )}
            {contacts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {contacts.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    title={`Copy ${c.kind}`}
                    onClick={() => void navigator.clipboard?.writeText(c.label).then(
                      () => setCopied(c.label),
                      () => undefined,
                    )}
                    className="mono flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] text-ink3 hover:text-ink"
                  >
                    <Icon name={c.icon} size={13} />
                    {c.label}
                    {c.note && <span className="text-[11px] text-ink3">{c.note}</span>}
                    {copied === c.label && <span className="text-[11px] text-ink3">copied</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="ask" onClick={() => setBriefOpen(true)}>What an agent sees</Button>
          <Button
            kind="primary"
            icon="send"
            onClick={() => {
              const q = `What does ${first} need right now?`;
              setAsk(q);
              void run(q);
            }}
          >
            Ask about {first}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ══ left column ══ */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* In a nutshell */}
          <section
            className="rounded-[14px] border px-[22px] py-5"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="mono text-[10.5px] uppercase tracking-[0.09em] text-ink3">In a nutshell</span>
              <button
                onClick={() => setRegen((n) => n + 1)}
                disabled={card.loading}
                title="Write this summary again"
                className="ml-auto cursor-pointer text-[11.5px] text-ink3 hover:text-ink disabled:opacity-40"
              >
                {card.loading ? "writing…" : "rewrite"}
              </button>
            </div>

            {card.loading && <Loading label="Reading their profile" />}
            {card.error && <Err>Their profile could not be loaded — {card.error}</Err>}
            {!card.loading && !card.error && !card.data && (
              <Empty
                headline="Nothing has been written about them yet."
                hint={`A standing profile appears once enough ${vocab.conversations.toLowerCase()} have been read.`}
              />
            )}

            {card.data && (
              <>
                <p className="m-0 text-[17px] leading-[1.7]" style={{ textWrap: "pretty" }}>
                  {splitSentences(humanize(card.data)).map((s, i) => {
                    const lvl = attribute(s)?.level ?? null;
                    // The separator sits OUTSIDE the underlined span, and each
                    // span carries its own right margin — otherwise two
                    // adjacent sentences of the same level run together into
                    // one continuous rule instead of reading as two claims.
                    return (
                      <React.Fragment key={i}>
                        <span
                          className={lvl ? UL_CLASS[lvl] : undefined}
                          style={{ marginRight: "0.42em" }}
                        >
                          {s}
                        </span>{" "}
                      </React.Fragment>
                    );
                  })}
                </p>
                <div
                  className="mt-4 flex flex-wrap gap-4 border-t pt-3.5"
                  style={{ borderColor: "var(--line)" }}
                >
                  {([
                    ["explicit", "they said it"],
                    ["deductive", "follows from it"],
                    ["inductive", "we guessed"],
                  ] as Array<[Level, string]>).map(([l, label]) => (
                    <span key={l} className="flex items-center gap-[7px] text-[12px] text-ink2">
                      <span
                        className="inline-block w-[22px]"
                        style={{ borderBottom: `1.5px ${LEVELS[l].ul} ${LEVELS[l].color}` }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* What we know */}
          <section
            className="overflow-hidden rounded-[14px] border"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            <header className="border-b px-[18px] py-[15px]" style={{ borderColor: "var(--line)" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[15px] font-semibold">What we know</div>
                <div className="mono text-[11.5px] text-ink3">
                  {know.loading
                    ? "counting…"
                    : `${num(beliefs.length)} things${oldest ? `, oldest ${ago(oldest)} ago` : ""}`}
                </div>
              </div>

              {beliefs.length > 0 && (
                <>
                  <div className="mb-3">
                    <MixBar counts={counts} who={first} onPick={(l) => { setFilter(l); setExpanded(false); }} />
                  </div>
                  <div className="flex flex-wrap gap-[7px]">
                    {filters.filter((f) => f.key === null || f.n > 0).map((f) => {
                      const on = filter === f.key;
                      return (
                        <button
                          key={f.label}
                          onClick={() => { setFilter(f.key); setExpanded(false); }}
                          className="cursor-pointer rounded-[7px] border px-[11px] py-[5px] text-[12.5px] font-medium transition-colors"
                          style={
                            on
                              ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }
                              : { background: "transparent", borderColor: "var(--line)", color: "var(--ink2)" }
                          }
                        >
                          {f.label} {f.n}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </header>

            <div className="p-[18px]">
              {know.loading && <Loading label="Gathering what we know" />}
              {know.error && (
                <div className="flex flex-col items-start gap-3">
                  <Err>We could not read their file — {know.error}</Err>
                  <Button icon="refresh" onClick={know.reload}>Try again</Button>
                </div>
              )}
              {!know.loading && !know.error && beliefs.length === 0 && (
                <Empty
                  headline="Nothing has been concluded about them yet."
                  hint={`Things appear here once their ${vocab.conversations.toLowerCase()} have been read.`}
                  action={<Button icon="refresh" onClick={know.reload}>Check again</Button>}
                />
              )}
              {!know.loading && !know.error && beliefs.length > 0 && shown.length === 0 && (
                <Empty
                  headline="Nothing of that kind about them."
                  action={<Button onClick={() => setFilter(null)}>Show everything</Button>}
                />
              )}

              {visible.length > 0 && (
                <div className="flex flex-col gap-3">
                  {visible.map((b) => <BeliefCard key={b.id} b={b} />)}
                </div>
              )}

              {hidden > 0 && (
                <div className="pt-3 text-center">
                  <Button onClick={() => setExpanded(true)}>Show {hidden} older things</Button>
                </div>
              )}

              {know.data?.fromCard && beliefs.length > 0 && (
                <div className="pt-3">
                  <Note>Dates are missing for some of these, so they are shown in the order they were written.</Note>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ══ right column ══ */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Quick question */}
          <section
            className="rounded-[14px] border px-[17px] py-4"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            <div className="mb-[3px] text-[15px] font-semibold">Quick question</div>
            <div className="mb-3 text-[12.5px] text-ink3">Answered from everything known about them.</div>
            <div className="mb-3 flex gap-2">
              <Field
                value={ask}
                onChange={setAsk}
                placeholder={`What does ${first} need?`}
                onSubmit={() => void run(ask)}
                full
              />
              <Button kind="primary" onClick={() => void run(ask)} disabled={asking || !ask.trim()}>
                Ask
              </Button>
            </div>
            <div
              className="min-h-[74px] rounded-[10px] border px-3.5 py-3 text-[14px] leading-[1.6]"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
              aria-live="polite"
            >
              {askErr ? (
                <Err>The answer failed — {askErr}</Err>
              ) : out || asking ? (
                <span style={{ textWrap: "pretty" }}>
                  {out}
                  {asking && (
                    <span
                      className="hx-blink ml-[1px] inline-block h-[15px] w-[7px] align-[-2px]"
                      style={{ background: "var(--a1)" }}
                    />
                  )}
                </span>
              ) : (
                <span className="text-ink3">
                  Ask anything — what they want, what they have been told, what to say next.
                </span>
              )}
            </div>
          </section>

          {/* Learned over time */}
          <section
            className="rounded-[14px] border px-[17px] py-4"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            <div className="mb-3 text-[15px] font-semibold">What we&rsquo;ve learned, over time</div>
            {points ? (
              <>
                <svg viewBox="0 0 260 90" preserveAspectRatio="none" className="h-[90px] w-full" aria-hidden>
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--a2)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="mono mt-1.5 flex justify-between text-[10.5px] text-ink3">
                  <span>{oldest ? `${ago(oldest)} ago` : "the start"}</span>
                  <span>today · {num(beliefs.length)}</span>
                </div>
              </>
            ) : (
              <Note>
                Not enough dated things yet to draw a line. It appears once a few more have been learned.
              </Note>
            )}
          </section>

          {/* Where they turn up */}
          <Panel title={`Where ${first} turns up`} icon="convs" pad={false}>
            {convs.loading && <div className="px-4"><Loading label={`Finding their ${vocab.conversations.toLowerCase()}`} /></div>}
            {convs.error && <div className="p-4"><Err>{convs.error}</Err></div>}
            {!convs.loading && !convs.error && sessions.length === 0 && (
              <Empty headline={`No ${vocab.conversations.toLowerCase()} with them yet.`} />
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => nav(`/conversations/${encodeURIComponent(s.id)}`)}
                className="flex w-full cursor-pointer items-center gap-3 border-b px-[17px] py-[11px] text-left transition-colors last:border-b-0 hover:brightness-110"
                style={{ background: "transparent", borderColor: "var(--line)" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {String(s.metadata?.title ?? s.metadata?.subject ?? s.id)}
                  </span>
                  <span className="mono mt-0.5 block truncate text-[12px] text-ink3">{s.id}</span>
                </span>
                <span className="mono shrink-0 text-[11px] text-ink3">{ago(s.created_at)}</span>
              </button>
            ))}
          </Panel>
        </div>
      </div>

      {/* ══ what an agent sees ══ */}
      {briefOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end" style={{ background: "rgba(0,0,0,.45)" }}>
          <button className="absolute inset-0" aria-label="Close" onClick={() => setBriefOpen(false)} />
          <aside
            className="hx-fade relative h-full w-[min(540px,100%)] overflow-auto border-l"
            style={{ background: "var(--panel)", borderColor: "var(--line)" }}
          >
            <header
              className="sticky top-0 flex items-center justify-between gap-3 border-b px-5 py-4"
              style={{ background: "var(--panel)", borderColor: "var(--line)" }}
            >
              <div>
                <div className="text-[16px] font-semibold">What an agent sees</div>
                <div className="mt-0.5 text-[12.5px] text-ink3">
                  The exact brief handed to an AI agent before it replies to them.
                </div>
              </div>
              <button
                onClick={() => setBriefOpen(false)}
                aria-label="Close"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border text-ink2"
                style={{ background: "transparent", borderColor: "var(--line)" }}
              >
                <Icon name="close" size={14} />
              </button>
            </header>

            <div className="p-5">
              {briefLoading && <Loading label="Assembling the brief" />}
              {briefErr && <Err>The brief could not be assembled — {briefErr}</Err>}
              {!briefLoading && !briefErr && brief && !brief.text && (
                <Empty
                  headline="An agent would be handed nothing about them."
                  hint="Nothing has been learned yet, so there is no brief to pass on."
                />
              )}
              {brief?.text && (
                <>
                  <div
                    className="rounded-[10px] border px-[18px] py-4 text-[14.5px] leading-[1.7]"
                    style={{ background: "var(--panel2)", borderColor: "var(--line)", textWrap: "pretty", whiteSpace: "pre-wrap" }}
                  >
                    {brief.text}
                  </div>
                  <div className="mt-4 text-[12px] text-ink3">
                    Assembled from {num(beliefs.length)} things known, {num(sessions.length)}{" "}
                    {vocab.conversations.toLowerCase()}
                    {brief.tokens !== null ? ` · about ${num(brief.tokens)} words of context` : ""}
                  </div>
                  {counts.inductive > 0 && (
                    <div className="mt-[18px] border-t pt-4" style={{ borderColor: "var(--line)" }}>
                      <div className="mb-2 text-[13.5px] font-semibold">Worth knowing</div>
                      <div className="text-[13.5px] leading-[1.6] text-ink2">
                        {num(counts.inductive)} of these are guesses rather than things{" "}
                        {first} actually said. Check one before repeating it back.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
