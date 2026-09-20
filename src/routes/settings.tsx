import * as React from "react";
import { toast } from "sonner";

import { Icon } from "@/design/icons";
import {
  Button, Empty, Err, Field, Loading, Note, Page, PageHead,
} from "@/design/ui";
import { call, type Page as ApiPage, type Workspace } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { ago, num, stamp } from "@/lib/format";
import { asList } from "@/lib/model";
import { VOCABULARIES } from "@/lib/vocabulary";
import { useAsync } from "@/hooks/use-async";

/* ────────────────────────────────────────────────────────────────────────
   Settings — the design's four stacked cards: wording, appearance and
   workspace side by side, keys and webhooks, then the danger zone that
   explains itself before it offers the button.
   ──────────────────────────────────────────────────────────────────────── */

type WebhookEndpoint = {
  id?: string | number;
  url?: string;
  endpoint?: string;
  created_at?: string;
  workspace_id?: string;
};

/** A key comes back once and is never listable again, in whatever shape the
 *  server chose. Everything else is dropped. */
function keyText(d: unknown): string {
  if (typeof d === "string") return d;
  const o = (d ?? {}) as Record<string, unknown>;
  for (const k of ["key", "api_key", "token", "value", "secret"]) {
    if (typeof o[k] === "string") return o[k] as string;
  }
  return "";
}

function mask(k: string): string {
  if (k.length <= 14) return k;
  return `${k.slice(0, 10)}${"•".repeat(12)}${k.slice(-4)}`;
}

function endpointUrl(w: WebhookEndpoint): string {
  return String(w.url ?? w.endpoint ?? "").trim();
}

function metaString(m: Record<string, unknown> | undefined, ...keys: string[]): string {
  for (const k of keys) {
    const v = m?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

/* ── card shell, matching the design's 14px radius and 20px padding ─────── */

function Card({
  title, lede, action, children, danger,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className="rounded-[14px] border p-5"
      style={{
        background: danger ? "var(--warnsoft)" : "var(--panel)",
        borderColor: danger ? "var(--warn)" : "var(--line)",
        boxShadow: danger ? undefined : "var(--shadow)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[16px] font-semibold" style={danger ? { color: "var(--warn)" } : undefined}>
          {title}
        </div>
        {action}
      </div>
      {lede && (
        <p className="m-0 mb-3.5 text-[13.5px] leading-[1.55] text-ink2" style={{ textWrap: "pretty" }}>
          {lede}
        </p>
      )}
      {children}
    </section>
  );
}

/** The design's two button states: chosen (accent border + soft fill) and not. */
function Choice({
  on, onClick, title, sub,
}: { on: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="cursor-pointer rounded-[10px] px-[13px] py-3 text-left transition-colors"
      style={{
        border: on ? "1.5px solid var(--a1)" : "1px solid var(--line)",
        background: on ? "var(--a1soft)" : "transparent",
      }}
    >
      <span className="mb-[3px] block text-[13.5px] font-semibold">{title}</span>
      {sub && (
        <span className="block text-[12.5px]" style={{ color: on ? "var(--ink2)" : "var(--ink3)" }}>
          {sub}
        </span>
      )}
    </button>
  );
}

function DefRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-[7px] text-[13.5px]"
      style={last ? undefined : { borderBottom: "1px solid var(--line)" }}
    >
      <span className="shrink-0 text-ink2">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

/* ── the screen ─────────────────────────────────────────────────────────── */

export default function Settings() {
  const { workspace, vocab, setVocab, theme, setTheme, density, setDensity } = useApp();

  const ws = useAsync(
    () => call<ApiPage<Workspace>>("POST", "/v3/workspaces/list", {}, { query: { size: 100 } }),
    [],
  );
  const hooks = useAsync(
    () => call<ApiPage<WebhookEndpoint> | WebhookEndpoint[]>("GET", `/v3/workspaces/${encodeURIComponent(workspace)}/webhooks`),
    [workspace],
  );
  const convs = useAsync(
    () => call<ApiPage<unknown>>("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/list`, {}, { query: { size: 1 } }),
    [workspace],
  );

  const current = React.useMemo(() => {
    const all = asList<Workspace>(ws.data);
    return all.find((w) => w.id === workspace) ?? null;
  }, [ws.data, workspace]);

  const webhooks = React.useMemo(
    () => asList<WebhookEndpoint>(hooks.data).filter((w) => endpointUrl(w)),
    [hooks.data],
  );

  /* Workspace description lives in the workspace's own notes, saved with PUT. */
  const [label, setLabel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    const m = current?.metadata;
    setLabel(metaString(m, "label", "display_name", "name"));
    setNotes(metaString(m, "notes", "description", "purpose"));
  }, [current]);

  async function saveWorkspace() {
    setSaving(true);
    try {
      await call("PUT", `/v3/workspaces/${encodeURIComponent(workspace)}`, {
        metadata: { ...(current?.metadata ?? {}), label, notes },
      });
      toast.success("Workspace details saved.");
      setEditing(false);
      ws.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /* Webhooks */
  const [newHook, setNewHook] = React.useState("");
  const [hookBusy, setHookBusy] = React.useState(false);

  async function addHook() {
    const url = newHook.trim();
    if (!url) return;
    setHookBusy(true);
    try {
      await call("POST", `/v3/workspaces/${encodeURIComponent(workspace)}/webhooks`, { url });
      setNewHook("");
      toast.success("Address added. It will receive updates from now on.");
      hooks.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setHookBusy(false);
    }
  }

  async function removeHook(id: string) {
    setHookBusy(true);
    try {
      await call("DELETE", `/v3/workspaces/${encodeURIComponent(workspace)}/webhooks/${encodeURIComponent(id)}`);
      toast.success("Address removed.");
      hooks.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setHookBusy(false);
    }
  }

  async function testHooks() {
    setHookBusy(true);
    try {
      await call("GET", `/v3/workspaces/${encodeURIComponent(workspace)}/webhooks/test`);
      toast.success("Test sent. Check what arrived at your end.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setHookBusy(false);
    }
  }

  /* Keys. The server shows a key once, so this screen holds the ones it made
     this visit and says plainly that they will not be shown again. */
  const [fresh, setFresh] = React.useState<Array<{ id: string; value: string; at: number }>>([]);
  const [keyBusy, setKeyBusy] = React.useState(false);

  async function makeKey() {
    setKeyBusy(true);
    try {
      const d = await call<unknown>("POST", "/v3/keys", undefined, { query: { workspace_id: workspace } });
      const value = keyText(d);
      if (!value) {
        toast.error("The server made a key but did not return it.");
        return;
      }
      setFresh((f) => [{ id: `${Date.now()}`, value, at: Date.now() }, ...f]);
      toast.success("Key created. Copy it now — it is shown once.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setKeyBusy(false);
    }
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy — select the text instead.");
    }
  }

  /* Danger zone */
  const [confirm, setConfirm] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const blocking = convs.data?.total ?? null;

  async function deleteWorkspace() {
    setDeleting(true);
    try {
      await call("DELETE", `/v3/workspaces/${encodeURIComponent(workspace)}`);
      toast.success("Workspace deleted.");
      setConfirm(false);
      setTyped("");
      ws.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Refused: ${msg}`);
    } finally {
      setDeleting(false);
    }
  }

  const lower = vocab.conversations.toLowerCase();

  return (
    <Page>
      <div className="max-w-[860px]">
        <PageHead title="Settings" lede="Workspace, wording, and the keys that reach it." />

        {/* ── Vocabulary ───────────────────────────────────────────────── */}
        <div className="mb-4">
          <Card
            title="Wording"
            lede={`Amòye holds people and threads. What you call them is up to you — this relabels the whole console.`}
          >
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
              {VOCABULARIES.map((v) => (
                <Choice
                  key={v.key}
                  on={v.key === vocab.key}
                  onClick={() => setVocab(v.key)}
                  title={v.name}
                  sub={`${v.people} · ${v.conversations}`}
                />
              ))}
            </div>
            <div className="mt-3">
              <Note>{vocab.blurb}</Note>
            </div>
          </Card>
        </div>

        {/* ── Appearance + Workspace ───────────────────────────────────── */}
        <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          <Card title="Appearance">
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className="flex-1 cursor-pointer rounded-[9px] py-[9px] text-[13px] transition-colors"
                  style={
                    theme === t
                      ? { border: "1.5px solid var(--a1)", background: "var(--a1soft)", fontWeight: 600 }
                      : { border: "1px solid var(--line)", background: "transparent", color: "var(--ink2)", fontWeight: 500 }
                  }
                >
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              {(["compact", "comfortable"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  aria-pressed={density === d}
                  className="flex-1 cursor-pointer rounded-[9px] py-[9px] text-[13px] transition-colors"
                  style={
                    density === d
                      ? { border: "1.5px solid var(--a1)", background: "var(--a1soft)", fontWeight: 600 }
                      : { border: "1px solid var(--line)", background: "transparent", color: "var(--ink2)", fontWeight: 500 }
                  }
                >
                  {d === "compact" ? "Tight rows" : "Roomy rows"}
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Workspace"
            action={
              !ws.loading && !ws.error ? (
                <Button kind="quiet" onClick={() => setEditing((o) => !o)}>
                  {editing ? "Cancel" : "Edit"}
                </Button>
              ) : undefined
            }
          >
            {ws.loading && <Loading label="Reading the workspace" />}
            {ws.error && <Err>Could not read the workspace list — {ws.error}</Err>}
            {!ws.loading && !ws.error && !current && (
              <Note>
                This console is pointed at <span className="mono">{workspace}</span>, which the server has not
                listed yet. It will appear once something is written to it.
              </Note>
            )}
            {!ws.loading && !ws.error && current && !editing && (
              <div>
                <DefRow label="Name" value={label || current.id} />
                <DefRow label="Identifier" value={<span className="mono text-[12.5px]">{current.id}</span>} />
                <DefRow label="Started" value={stamp(current.created_at)} />
                <DefRow label={vocab.conversations} value={convs.loading ? "…" : num(blocking)} last={!notes} />
                {notes && <DefRow label="Notes" value={notes} last />}
              </div>
            )}
            {!ws.loading && !ws.error && current && editing && (
              <div className="flex flex-col gap-2.5">
                <Field value={label} onChange={setLabel} placeholder="A name people recognise" full />
                <Field value={notes} onChange={setNotes} placeholder="What this workspace is for" full />
                <div className="flex gap-2">
                  <Button kind="primary" icon="check" onClick={saveWorkspace} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
                <Note>The identifier cannot change — only what you call it here.</Note>
              </div>
            )}
          </Card>
        </div>

        {/* ── Keys and webhooks ────────────────────────────────────────── */}
        <div className="mb-4">
          <Card
            title="Keys and addresses we notify"
            lede="Keys let your own code reach this workspace. Addresses are where Amòye posts a note whenever it learns something new."
            action={
              <Button icon="plus" onClick={makeKey} disabled={keyBusy}>
                {keyBusy ? "Making…" : "New key"}
              </Button>
            }
          >
            {fresh.length === 0 ? (
              <Note>
                A key is shown once, at the moment it is made, and never again. Keys made earlier cannot be
                listed back — only replaced.
              </Note>
            ) : (
              <div>
                {fresh.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <span style={{ color: "var(--a3)" }}><Icon name="key" size={15} /></span>
                    <span className="mono min-w-0 flex-1 truncate text-[12.5px]">{mask(k.value)}</span>
                    <span className="shrink-0 text-[12px] text-ink3">made {ago(k.at)} ago · shown once</span>
                    <Button kind="quiet" icon="copy" onClick={() => copyKey(k.value)}>Copy</Button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold">Where we send updates</span>
                {webhooks.length > 0 && (
                  <Button kind="quiet" icon="send" onClick={testHooks} disabled={hookBusy}>
                    Send a test
                  </Button>
                )}
              </div>

              {hooks.loading && <Loading label="Reading the addresses" />}
              {hooks.error && <Err>Could not read the addresses — {hooks.error}</Err>}
              {!hooks.loading && !hooks.error && webhooks.length === 0 && (
                <Empty
                  headline="Nothing is being notified"
                  hint="Add an address and Amòye will post there each time it learns something."
                />
              )}
              {!hooks.loading && !hooks.error && webhooks.map((w, i) => {
                const id = w.id === undefined || w.id === null ? "" : String(w.id);
                return (
                  <div
                    key={id || `hook-${i}`}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <span className="text-ink3"><Icon name="hook" size={15} /></span>
                    <span className="mono min-w-0 flex-1 truncate text-[12.5px]">{endpointUrl(w)}</span>
                    {w.created_at && (
                      <span className="shrink-0 text-[12px] text-ink3">added {ago(w.created_at)} ago</span>
                    )}
                    <Button kind="quiet" icon="trash" onClick={() => id && removeHook(id)} disabled={hookBusy || !id}>
                      Remove
                    </Button>
                  </div>
                );
              })}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-[240px] flex-1">
                  <Field
                    value={newHook}
                    onChange={setNewHook}
                    onSubmit={addHook}
                    placeholder="https://your-app.example/updates"
                    icon="hook"
                    mono
                    full
                  />
                </div>
                <Button icon="plus" onClick={addHook} disabled={hookBusy || !newHook.trim()}>
                  Add address
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Danger zone ──────────────────────────────────────────────── */}
        <Card title="Deleting things" danger>
          <p className="m-0 mb-3.5 text-[13.5px] leading-[1.6] text-ink2" style={{ textWrap: "pretty" }}>
            Deleting a {vocab.person.toLowerCase()} removes everything Amòye worked out about them. It will be
            refused while a tidy-up is running for that {vocab.person.toLowerCase()}, or while their {lower} are
            still being read — otherwise Amòye would quietly rebuild half of what you just deleted. Wait until the
            backlog is clear and try again.
          </p>
          <p className="m-0 mb-3.5 text-[13.5px] leading-[1.6] text-ink2" style={{ textWrap: "pretty" }}>
            Deleting the whole workspace takes {convs.loading ? "everything in it" : `all ${num(blocking)} ${lower}`}
            {" "}with it, along with every person and everything known about them. There is no undo.
          </p>

          {!confirm ? (
            <Button kind="danger" icon="trash" onClick={() => setConfirm(true)}>
              Delete this workspace
            </Button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] text-ink2">
                Type <span className="mono font-semibold">{workspace}</span> to confirm.
              </span>
              <div className="max-w-[320px]">
                <Field value={typed} onChange={setTyped} placeholder={workspace} mono full />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  kind="danger"
                  icon="trash"
                  onClick={deleteWorkspace}
                  disabled={deleting || typed.trim() !== workspace}
                >
                  {deleting ? "Deleting…" : "Delete for good"}
                </Button>
                <Button kind="quiet" onClick={() => { setConfirm(false); setTyped(""); }}>
                  Keep it
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
