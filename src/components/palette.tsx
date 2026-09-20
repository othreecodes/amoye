import * as React from "react";
import { usePeerNames } from "@/hooks/use-peer-names";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/design/icons";
import { Avatar } from "@/design/ui";
import { call, type Message, type Page, type Peer, type Session } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { asList } from "@/lib/model";
import { cn } from "@/lib/utils";

type Hit = { id: string; label: string; sub?: string; icon?: IconName; avatar?: string; go: () => void };

/** One box for everything: jump somewhere, find a person or a thread, or
 *  search what people actually said. */
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { nameFor } = usePeerNames();
  const nav = useNavigate();
  const { workspace, vocab } = useApp();
  const ws = encodeURIComponent(workspace);
  const [q, setQ] = React.useState("");
  const [people, setPeople] = React.useState<Peer[]>([]);
  const [convs, setConvs] = React.useState<Session[]>([]);
  const [said, setSaid] = React.useState<Message[]>([]);
  const [byEmail, setByEmail] = React.useState<Peer[]>([]);
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setQ(""); setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 10);
    call<Page<Peer>>("POST", `/v3/workspaces/${ws}/peers/list`, {}, { query: { size: 40, reverse: true } })
      .then((r) => setPeople(asList<Peer>(r))).catch(() => setPeople([]));
    call<Page<Session>>("POST", `/v3/workspaces/${ws}/sessions/list`, {}, { query: { size: 40, reverse: true } })
      .then((r) => setConvs(asList<Session>(r))).catch(() => setConvs([]));
  }, [open, ws]);

  // Look a customer up by email. Only 40 peers are held locally, and the
  // address is not in the id, so this one has to go to the server. Exact
  // match — a support address is typed or pasted whole, never guessed at.
  React.useEffect(() => {
    const email = q.trim().toLowerCase();
    if (!open || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setByEmail([]); return; }
    let live = true;
    const t = setTimeout(() => {
      call<Page<Peer>>(
        "POST",
        `/v3/workspaces/${ws}/peers/list`,
        { filters: { metadata: { email } } },
        { query: { size: 5 } },
      )
        .then((r) => { if (live) setByEmail(asList<Peer>(r)); })
        .catch(() => { if (live) setByEmail([]); });
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, ws]);

  React.useEffect(() => {
    if (!open || q.trim().length < 3) { setSaid([]); return; }
    const t = setTimeout(() => {
      call<Message[]>("POST", `/v3/workspaces/${ws}/search`, { query: q, limit: 6 })
        .then((r) => setSaid(Array.isArray(r) ? r : [])).catch(() => setSaid([]));
    }, 280);
    return () => clearTimeout(t);
  }, [q, open, ws]);

  const go = React.useCallback((to: string) => { onClose(); nav(to); }, [nav, onClose]);

  const places: Hit[] = [
    { id: "p/", label: "Today", icon: "today", go: () => go("/") },
    { id: "p/people", label: vocab.people, icon: "people", go: () => go("/people") },
    { id: "p/conv", label: vocab.conversations, icon: "convs", go: () => go("/conversations") },
    { id: "p/know", label: "What we know", icon: "know", go: () => go("/knowledge") },
    { id: "p/ask", label: "Ask", icon: "ask", go: () => go("/ask") },
    { id: "p/groups", label: "Groups", icon: "groups", go: () => go("/groups") },
    { id: "p/backlog", label: "Backlog", icon: "backlog", go: () => go("/backlog") },
    { id: "p/settings", label: "Settings", icon: "settings", go: () => go("/settings") },
    { id: "p/dev", label: "Developer", icon: "dev", go: () => go("/developer") },
  ];

  const needle = q.trim().toLowerCase();
  const match = (s: string) => !needle || s.toLowerCase().includes(needle);

  const sections: Array<{ title: string; hits: Hit[] }> = [
    { title: "Go to", hits: places.filter((p) => match(p.label)) },
    { title: "Found by email", hits: byEmail.map((p) => ({
        id: `e/${p.id}`, label: nameFor(p.id), sub: String(p.metadata?.email ?? ""), avatar: p.id,
        go: () => go(`/people/${encodeURIComponent(p.id)}`),
      })) },
    // Search the name as well as the id: nobody types wa-66168b295ead…
    { title: vocab.people, hits: people
        .filter((p) => match(p.id) || match(nameFor(p.id)))
        .slice(0, 6)
        .map((p) => ({
          id: `u/${p.id}`, label: nameFor(p.id), avatar: p.id,
          go: () => go(`/people/${encodeURIComponent(p.id)}`),
        })) },
    { title: vocab.conversations, hits: convs.filter((c) => match(c.id)).slice(0, 6).map((c) => ({
        id: `c/${c.id}`, label: c.id, icon: "convs" as IconName,
        go: () => go(`/conversations/${encodeURIComponent(c.id)}`),
      })) },
    { title: "Things people said", hits: said.map((m) => ({
        id: `m/${m.id}`, label: m.content.slice(0, 80), sub: nameFor(m.peer_id), avatar: m.peer_id,
        go: () => go(`/conversations/${encodeURIComponent(m.session_id)}`),
      })) },
  ].filter((s) => s.hits.length);

  const flat = sections.flatMap((s) => s.hits);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); flat[cursor]?.go(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, cursor, onClose]);

  if (!open) return null;
  let running = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose}
        style={{ background: "rgba(0,0,0,.55)" }} />
      <div className="relative w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-[14px] border"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}>
        <div className="flex items-center gap-2.5 border-b px-4" style={{ borderColor: "var(--line)" }}>
          <span className="text-ink3"><Icon name="search" size={15} /></span>
          <input
            ref={inputRef} value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            placeholder="Search anything"
            className="h-12 w-full border-0 bg-transparent text-[14.5px] outline-none"
          />
          <span className="mono rounded-[4px] border px-1 text-[10px] text-ink3" style={{ borderColor: "var(--line)" }}>esc</span>
        </div>
        <div className="max-h-[52vh] overflow-auto p-1.5">
          {sections.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-ink3">Nothing matches “{q}”.</p>
          )}
          {sections.map((s) => (
            <div key={s.title}>
              <p className="m-0 px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">
                {s.title}
              </p>
              {s.hits.map((h) => {
                running += 1;
                const on = running === cursor;
                return (
                  <button key={h.id} onMouseEnter={() => setCursor(flat.indexOf(h))} onClick={h.go}
                    className={cn("flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px]")}
                    style={on ? { background: "var(--panel2)", color: "var(--ink)" } : { color: "var(--ink2)" }}>
                    {h.avatar ? <Avatar id={h.avatar} size={22} /> : h.icon ? <Icon name={h.icon} size={15} /> : null}
                    <span className="min-w-0 flex-1 truncate">{h.label}</span>
                    {h.sub && <span className="mono shrink-0 text-[11px] text-ink3">{h.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
