/**
 * Ask — one question in plain English, optionally anchored to one person,
 * with the answer arriving word by word.
 *
 * Layout and visual treatment come from the design's ASK slice: a narrow
 * centred column, a single composer card with its controls on a hairline
 * below the text, dashed suggestion pills underneath, and the answer in a
 * card of its own with a blinking caret while it is still arriving and a
 * "what this rests on" footer once it has finished.
 *
 * Everything in it is real: the person picker lists the workspace's actual
 * people, the answer streams from the live chat endpoint, and the footer
 * states the true size of what the answer was drawn from.
 */
import * as React from "react";
import { usePeerNames } from "@/hooks/use-peer-names";
import { Markdown } from "@/design/markdown";
import { useSearchParams } from "react-router-dom";
import { ApiError, call, stream, type Peer } from "@/lib/api";
import { asList } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useAsync } from "@/hooks/use-async";
import { Avatar, Button, Err, Field, Loading, Page } from "@/design/ui";
import { num } from "@/lib/format";

type Source = { text: string; color: string };

/** Ids are how Honcho names a person; a sentence is how a reader wants one.
 *  "cust-ada_okonkwo" reads as "Cust Ada Okonkwo" rather than as a key. */
export default function Ask() {
  const { nameFor, humanize } = usePeerNames();
  const { workspace, vocab } = useApp();
  const ws = encodeURIComponent(workspace);
  const [params, setParams] = useSearchParams();
  const about = params.get("about");

  const [draft, setDraft] = React.useState("");
  const [asked, setAsked] = React.useState("");
  const [out, setOut] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerQ, setPickerQ] = React.useState("");

  // Every run carries a ticket. A reply from an abandoned question — the user
  // re-asked, changed who it is about, or left the screen — is dropped rather
  // than interleaved into the one on screen.
  const runId = React.useRef(0);
  React.useEffect(() => () => void (runId.current += 1), []);

  const people = useAsync(
    () =>
      call<unknown>("POST", `/v3/workspaces/${ws}/peers/list`, {}, { query: { size: 100, reverse: true } }),
    [ws],
  );
  const peers = asList<Peer>(people.data).filter((p) => p && typeof p.id === "string");

  const lowerConvs = vocab.conversations.toLowerCase();
  const lowerPeople = vocab.people.toLowerCase();

  /** What the answer was drawn from, stated as true counts rather than as a
   *  claim of citation the API does not give us. */
  async function loadSources(target: string | null): Promise<Source[]> {
    try {
      if (target) {
        const res = await call<{ total?: number }>(
          "POST",
          `/v3/workspaces/${ws}/peers/${encodeURIComponent(target)}/sessions`,
          {},
          { query: { size: 1 } },
        );
        const n = typeof res?.total === "number" ? res.total : null;
        return [
          { text: nameFor(target), color: "var(--a3)" },
          {
            text: n === null ? `Their ${lowerConvs}` : `${num(n)} ${n === 1 ? vocab.conversation.toLowerCase() : lowerConvs}`,
            color: "var(--a2)",
          },
        ];
      }
      const [pp, ss] = await Promise.all([
        call<{ total?: number }>("POST", `/v3/workspaces/${ws}/peers/list`, {}, { query: { size: 1 } }),
        call<{ total?: number }>("POST", `/v3/workspaces/${ws}/sessions/list`, {}, { query: { size: 1 } }),
      ]);
      const list: Source[] = [];
      if (typeof pp?.total === "number") list.push({ text: `${num(pp.total)} ${lowerPeople}`, color: "var(--a3)" });
      if (typeof ss?.total === "number") list.push({ text: `${num(ss.total)} ${lowerConvs}`, color: "var(--a2)" });
      return list;
    } catch {
      // The answer is the thing that matters; a missing footer is not an error.
      return [];
    }
  }

  async function run(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const id = (runId.current += 1);
    setAsked(q);
    setDraft(q);
    setOut("");
    setError(null);
    setDone(false);
    setSources([]);
    setBusy(true);
    const path = about
      ? `/v3/workspaces/${ws}/peers/${encodeURIComponent(about)}/chat`
      : `/v3/workspaces/${ws}/chat`;
    try {
      await stream(path, { query: q, stream: true }, (chunk) => {
        if (runId.current === id) setOut((o) => o + chunk);
      });
      if (runId.current !== id) return;
      setBusy(false);
      setDone(true);
      const s = await loadSources(about);
      if (runId.current === id) setSources(s);
    } catch (e) {
      if (runId.current !== id) return;
      setBusy(false);
      setError(e instanceof ApiError ? e.detail : String(e));
    }
  }

  function setAbout(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("about", id);
    else next.delete("about");
    setParams(next, { replace: true });
    setPickerOpen(false);
    setPickerQ("");
  }

  const anchoredName = about ? nameFor(about) : null;
  const suggestions = anchoredName
    ? [`What does ${anchoredName} need from us?`, `Is ${anchoredName} unhappy?`, `What have we learned about ${anchoredName} lately?`]
    : ["Who is about to leave?", "What changed today?", "Who has raised a complaint about charges?"];

  const hasAnswer = busy || done || !!out || !!error;
  const matches = peers.filter((p) => !pickerQ || p.id.toLowerCase().includes(pickerQ.toLowerCase()));

  return (
    <Page>
      <div className="mx-auto w-full max-w-[820px]">
        <div className="mb-[22px] text-center">
          <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-[-0.025em]">Ask</h1>
          <p className="m-0 text-[15px] text-ink2" style={{ textWrap: "pretty" }}>
            A question in plain English. Amòye answers from everything it has read.
          </p>
        </div>

        {/* Composer */}
        <div
          className="rounded-[14px] border p-4"
          style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
        >
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void run(draft);
              }
            }}
            placeholder={
              anchoredName
                ? `What should I know about ${anchoredName}?`
                : `Which ${lowerPeople} are unhappy about charges?`
            }
            aria-label="Your question"
            className="w-full resize-none border-0 bg-transparent text-[17px] leading-[1.5] outline-none"
          />

          <div
            className="mt-2 flex flex-wrap items-center justify-between gap-2.5 border-t pt-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex flex-wrap items-center gap-[7px]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  aria-expanded={pickerOpen}
                  className="cursor-pointer rounded-[7px] border px-[11px] py-[5px] text-[12.5px] transition-colors hover:text-ink"
                  style={{
                    borderColor: about ? "var(--a2)" : "var(--line)",
                    background: "transparent",
                    color: about ? "var(--a2)" : "var(--ink2)",
                  }}
                >
                  {anchoredName ? `About ${anchoredName} ▾` : "About anyone ▾"}
                </button>

                {pickerOpen && (
                  <div
                    className="absolute left-0 z-20 mt-1.5 w-[280px] rounded-[10px] border p-2"
                    style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
                  >
                    <Field
                      value={pickerQ}
                      onChange={setPickerQ}
                      placeholder={`Find someone among your ${lowerPeople}`}
                      icon="search"
                      full
                    />
                    <button
                      type="button"
                      onClick={() => setAbout(null)}
                      className="mt-1.5 w-full cursor-pointer rounded-[7px] px-2 py-2 text-left text-[13px] text-ink2 hover:text-ink"
                    >
                      Anyone — answer from the whole workspace
                    </button>
                    <div className="max-h-[260px] overflow-y-auto">
                      {people.loading && <Loading label={`Fetching ${lowerPeople}`} />}
                      {people.error && !people.loading && (
                        <div className="p-1">
                          <Err>Could not load {lowerPeople}: {people.error}</Err>
                        </div>
                      )}
                      {!people.loading && !people.error && matches.length === 0 && (
                        <p className="m-0 px-2 py-3 text-[12.5px] text-ink3">
                          {peers.length === 0 ? `No ${lowerPeople} here yet.` : "Nobody by that name."}
                        </p>
                      )}
                      {matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAbout(p.id)}
                          className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left hover:brightness-110"
                          style={p.id === about ? { background: "var(--panel2)" } : undefined}
                        >
                          <Avatar id={p.id} size={24} />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{nameFor(p.id)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span
                className="rounded-[7px] border px-[11px] py-[5px] text-[12.5px] text-ink2"
                style={{ borderColor: "var(--line)" }}
                title={
                  anchoredName
                    ? `Only what ${anchoredName} has said is read.`
                    : `Every ${vocab.conversation.toLowerCase()} in this workspace is read.`
                }
              >
                {anchoredName ? `${anchoredName}'s ${lowerConvs}` : `All ${lowerConvs}`}
              </span>
            </div>

            <Button kind="primary" icon="send" onClick={() => void run(draft)} disabled={busy || !draft.trim()}>
              {busy ? "Asking…" : "Ask"}
            </Button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-3.5 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void run(s)}
              disabled={busy}
              // Dashed and transparent read as a caption rather than a
              // control, so nobody tried clicking them. Solid edge, a real
              // surface, and a hover that moves.
              className="cursor-pointer rounded-[20px] border px-3.5 py-1.5 text-[12.5px] text-ink2 transition-colors hover:border-[var(--line2)] hover:bg-[var(--panel2)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: "var(--line)", background: "var(--panel)" }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Answer */}
        {hasAnswer && (
          <div
            className="mt-[18px] rounded-[14px] border px-[22px] py-5"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
          >
            {asked && (
              <p className="m-0 mb-3 text-[13px] text-ink3" style={{ textWrap: "pretty" }}>
                You asked: {asked}
              </p>
            )}

            {error ? (
              <Err>Could not answer that: {error}</Err>
            ) : (
              <div className="text-[16.5px] leading-[1.7]" style={{ textWrap: "pretty" }}>
                {out ? (
                  // The answer arrives as Markdown with peer ids in it. Render
                  // the marks, and swap the ids for names — an id in prose is
                  // unreadable and the reader cannot act on it.
                  <Markdown text={humanize(out)} />
                ) : busy ? null : (
                  "Nothing came back for that one. Try asking it a different way."
                )}
                {busy && (
                  <span
                    className="hx-blink ml-0.5 inline-block h-[17px] w-[8px] align-[-3px]"
                    style={{ background: "var(--a1)" }}
                    aria-hidden
                  />
                )}
              </div>
            )}

            {done && !error && sources.length > 0 && (
              <div className="mt-[18px] border-t pt-[15px]" style={{ borderColor: "var(--line)" }}>
                <div className="mono mb-2.5 text-[10.5px] uppercase tracking-[0.09em] text-ink3">
                  Answered from
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <span
                      key={s.text}
                      className="flex items-center gap-[7px] rounded-[8px] border px-2.5 py-[5px] text-[12.5px] text-ink2"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <span className="size-[6px] rounded-full" style={{ background: s.color }} />
                      {s.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
