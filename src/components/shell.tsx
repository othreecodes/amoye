import * as React from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "@/design/icons";
import { call, type Page as ApiPage, type QueueStatus, type Workspace } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { usePoll } from "@/hooks/use-async";
import { asList } from "@/lib/model";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: IconName; end?: boolean; badge?: boolean };

/** Grouped by the job someone is doing. Plain words only — "peer" and
 *  "work unit" never reach the rail. */
const groups = (people: string, convs: string): Array<{ label: string; items: Item[] }> => [
  { label: "Overview", items: [{ to: "/", label: "Today", icon: "today", end: true }] },
  { label: people, items: [
    { to: "/people", label: people, icon: "people" },
    { to: "/conversations", label: convs, icon: "convs" },
  ] },
  { label: "Intelligence", items: [
    { to: "/knowledge", label: "What we know", icon: "know" },
    { to: "/ask", label: "Ask", icon: "ask" },
    { to: "/groups", label: "Groups", icon: "groups" },
  ] },
  { label: "System", items: [
    { to: "/backlog", label: "Backlog", icon: "backlog", badge: true },
    { to: "/settings", label: "Settings", icon: "settings" },
    { to: "/developer", label: "Developer", icon: "dev" },
  ] },
];

const CRUMB: Record<string, string> = {
  "/": "Today", "/people": "People", "/conversations": "Conversations",
  "/knowledge": "What we know", "/ask": "Ask", "/groups": "Groups",
  "/backlog": "Backlog", "/settings": "Settings", "/developer": "Developer",
};

function useBacklog() {
  const { workspace } = useApp();
  const [n, setN] = React.useState(0);
  const load = React.useCallback(() => {
    call<QueueStatus>("GET", `/v3/workspaces/${encodeURIComponent(workspace)}/queue/status`)
      .then((q) => setN((q.pending_work_units ?? 0) + (q.in_progress_work_units ?? 0)))
      .catch(() => setN(0));
  }, [workspace]);
  React.useEffect(load, [load]);
  usePoll(load, 10000);
  return n;
}

function WorkspacePill() {
  const { workspace, setWorkspace } = useApp();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newId, setNewId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [list, setList] = React.useState<Workspace[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  const create = async () => {
    const id = newId.trim();
    if (!id) return;
    setBusy(true); setErr(null);
    try {
      // Get-or-create: an id that already exists simply opens.
      await call("POST", "/v3/workspaces", { id });
      setWorkspace(id);
      setCreating(false); setNewId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    call<ApiPage<Workspace>>("POST", "/v3/workspaces/list", {}, { query: { size: 100 } })
      .then((r) => setList(asList<Workspace>(r))).catch(() => setList([]));
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative px-3 pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-left"
        style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
        aria-haspopup="listbox" aria-expanded={open}
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--a3)" }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{workspace}</span>
        <span className="text-ink3"><Icon name="updown" size={12} /></span>
      </button>
      {open && (
        <div className="absolute inset-x-3 top-[calc(100%-4px)] z-50 rounded-[10px] border p-1.5"
          style={{ background: "var(--panel2)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}>
          {list.length === 0 && <p className="px-2 py-2 text-[12.5px] text-ink3">Only this one is visible to your key.</p>}
          {list.map((w) => (
            <button key={w.id} onClick={() => { setWorkspace(w.id); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] hover:brightness-110">
              <span className="min-w-0 flex-1 truncate">{w.id}</span>
              {w.id === workspace && <span style={{ color: "var(--a3)" }}><Icon name="check" size={13} /></span>}
            </button>
          ))}
          <div className="mt-1 border-t pt-1" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={() => { setCreating(true); setOpen(false); setErr(null); }}
              className="flex w-full items-center gap-2 rounded-[7px] px-2 py-2 text-left text-[13px] text-ink2 hover:brightness-125"
            >
              <Icon name="plus" size={13} />
              New workspace
            </button>
          </div>
        </div>
      )}

      {creating && createPortal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[16vh]">
          <button className="absolute inset-0" aria-label="Cancel"
            onClick={() => setCreating(false)} style={{ background: "rgba(0,0,0,.55)" }} />
          <div className="relative w-[min(440px,calc(100vw-32px))] rounded-[14px] border p-5"
            style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}>
            <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em]">New workspace</h2>
            <p className="m-0 mt-1.5 text-[13px] text-ink2">
              A workspace keeps one set of people and conversations separate from another — a staging
              environment, or a second product.
            </p>
            <label htmlFor="new-ws"
              className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">
              Name
            </label>
            <input
              id="new-ws" autoFocus value={newId}
              onChange={(e) => setNewId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "-"))}
              onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setCreating(false); }}
              placeholder="staging"
              className="mono mt-1.5 w-full rounded-[8px] border px-2.5 py-2 text-[13px] outline-none"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
            />
            <p className="m-0 mt-1.5 text-[11.5px] text-ink3">Letters, numbers, dashes and underscores.</p>
            {err && (
              <p className="m-0 mt-2.5 rounded-[8px] px-2.5 py-2 text-[12.5px]"
                style={{ background: "var(--warnsoft)", color: "var(--warn)" }}>{err}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)}
                className="cursor-pointer rounded-[8px] border px-[13px] py-2 text-[13px] font-medium"
                style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
                Cancel
              </button>
              <button onClick={create} disabled={!newId.trim() || busy}
                className="cursor-pointer rounded-[8px] border px-[13px] py-2 text-[13px] font-semibold disabled:opacity-45"
                style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }}>
                {busy ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Nav({ compact }: { compact?: boolean }) {
  const { vocab } = useApp();
  const backlog = useBacklog();
  return (
    <nav className={cn("flex-1 overflow-auto", compact ? "px-2 pb-4" : "px-3 pb-4")}>
      {groups(vocab.people, vocab.conversations).map((g) => (
        <div key={g.label} className="mb-4">
          {!compact && (
            <p className="m-0 px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink3">
              {g.label}
            </p>
          )}
          {g.items.map((it) => (
            <NavLink
              key={it.to} to={it.to} end={it.end} title={compact ? it.label : undefined}
              className={({ isActive }) => cn(
                "mb-0.5 flex items-center rounded-[9px] text-[13.5px] transition-colors",
                compact ? "justify-center p-2" : "gap-2.5 px-2.5 py-[7px]",
                isActive ? "font-medium" : "hover:brightness-125",
              )}
              style={({ isActive }) => isActive
                ? { background: "var(--panel2)", boxShadow: "inset 0 0 0 1px var(--line)", color: "var(--ink)" }
                : { color: "var(--ink2)" }}
            >
              <Icon name={it.icon} size={17} />
              {!compact && it.label}
              {!compact && it.badge && backlog > 0 && (
                <span className="mono tnum ml-auto rounded-full px-1.5 text-[10.5px] font-medium"
                  style={{ background: "var(--a2soft)", color: "var(--a2)" }}>{backlog}</span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Live() {
  const [ok, setOk] = React.useState<boolean | null>(null);
  const check = React.useCallback(() => {
    call("GET", "/health").then(() => setOk(true)).catch(() => setOk(false));
  }, []);
  React.useEffect(check, [check]);
  usePoll(check, 20000);
  return (
    <button onClick={check} title="Connection to Amòye. Click to re-check."
      className="flex shrink-0 items-center gap-[7px] pl-0.5">
      <span className={cn("size-[7px] rounded-full", ok && "hx-pulse")}
        style={{ background: ok === false ? "var(--warn)" : ok ? "var(--a3)" : "var(--ink3)" }} />
      <span className="mono text-[11px] text-ink2">{ok === false ? "offline" : ok ? "live" : "…"}</span>
    </button>
  );
}

export function Shell({ children, onSearch }: { children: React.ReactNode; onSearch: () => void }) {
  const { theme, setTheme } = useApp();
  const loc = useLocation();
  const [railed, setRailed] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const crumb = CRUMB[loc.pathname] ?? loc.pathname.split("/").filter(Boolean).slice(-1)[0] ?? "";

  React.useEffect(() => setMenu(false), [loc.pathname]);

  const side = (
    <>
      <div className="flex items-center gap-2.5 px-[18px] pb-3.5 pt-4">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px]"
          style={{ background: "var(--a1)" }} aria-hidden>
          <span className="size-[9px] rounded-[2px]" style={{ background: "var(--panel)" }} />
        </span>
        <span className="flex-1 text-[15.5px] font-semibold tracking-[-0.01em]">Amòye</span>
        <button onClick={() => setRailed(true)} title="Collapse sidebar"
          className="hidden size-[26px] cursor-pointer items-center justify-center gap-[2px] rounded-[7px] border md:flex"
          style={{ borderColor: "var(--line)" }}>
          <span className="h-3 w-[2px] rounded-[1px]" style={{ background: "var(--ink3)" }} />
          <span className="h-3 w-[6px] rounded-[1px] border" style={{ borderColor: "var(--ink3)" }} />
        </button>
      </div>
      <WorkspacePill />
      <Nav />
    </>
  );

  return (
    <div className="flex min-h-dvh items-stretch" style={{ background: "var(--bg)" }}>
      {!railed && (
        <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r md:flex"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          {side}
        </aside>
      )}

      {railed && (
        <aside className="sticky top-0 hidden h-dvh w-[60px] shrink-0 flex-col items-center border-r py-4 md:flex"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <button onClick={() => setRailed(false)} title="Expand sidebar"
            className="mb-4 flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[7px]"
            style={{ background: "var(--a1)" }}>
            <span className="size-[9px] rounded-[2px]" style={{ background: "var(--panel)" }} />
          </button>
          <Nav compact />
        </aside>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)" }}
            onClick={() => setMenu(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r"
            style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
            {side}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex flex-col border-b"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
          <div className="flex min-h-[56px] flex-wrap items-center gap-3 px-4 py-2">
            <button onClick={() => setMenu(true)} title="Menu"
              className="flex size-8 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[8px] border md:hidden"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-[1.5px] w-[13px]" style={{ background: "var(--ink2)" }} />
              ))}
            </button>
            <span className="text-[15px] font-semibold tracking-[-0.01em] md:hidden">Amòye</span>
            <span className="hidden shrink-0 truncate text-[13px] text-ink3 md:inline">{crumb}</span>
            <div className="flex-1" />
            <button onClick={onSearch}
              className="flex max-w-[280px] flex-1 cursor-pointer items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-left"
              style={{ background: "var(--panel2)", borderColor: "var(--line)", minWidth: 160 }}>
              <span className="text-ink3"><Icon name="search" size={14} /></span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink3">Search anything</span>
              <span className="mono rounded-[4px] border px-1 text-[10px] text-ink3" style={{ borderColor: "var(--line)" }}>⌘K</span>
            </button>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Appearance"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border"
              style={{ background: "var(--panel2)", borderColor: "var(--line)" }}>
              <span className="size-3 rounded-full border-2"
                style={{ borderColor: "var(--ink2)", background: "linear-gradient(90deg,var(--ink2) 50%,transparent 50%)" }} />
            </button>
            <Live />
          </div>
        </header>

        <main key={loc.pathname} className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-[72px] pt-7">
          {children}
        </main>
      </div>
    </div>
  );
}
