import * as React from "react";

import { Button, Empty, Err, Field, Loading, Page, PageHead, Pill, Textarea } from "@/design/ui";
import { Icon, type IconName } from "@/design/icons";
import { ApiError, call, traffic, type TrafficEntry } from "@/lib/api";
import { OPERATIONS, type Op } from "@/lib/ops";
import { useApp } from "@/lib/app-state";
import { useAsync, usePoll, type AsyncState } from "@/hooks/use-async";
import { ago } from "@/lib/format";

/* ────────────────────────────────────────────────────────────────────────
   Developer — the one screen allowed to speak the API's own language. The
   whole catalog generated from the server's OpenAPI, a runnable console for
   any of it, the traffic this session actually made, and three checks that
   say whether the thing is up. Everywhere else translates; here we do not.
   ──────────────────────────────────────────────────────────────────────── */

type TabKey = "catalog" | "log" | "health";

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: "catalog", label: "Endpoints", icon: "dev" },
  { key: "log", label: "Requests", icon: "clock" },
  { key: "health", label: "Health", icon: "shield" },
];

/** The design's method colouring: reads green, deletes warn, writes amber. */
function methodColor(m: string): string {
  const s = m.toUpperCase();
  if (s === "GET") return "var(--a3)";
  if (s === "DELETE") return "var(--warn)";
  return "var(--a2)";
}

function statusColor(s: number | null): string {
  if (s === null) return "var(--warn)";
  if (s >= 500) return "var(--warn)";
  if (s >= 400) return "var(--a1)";
  return "var(--a3)";
}

function pretty(v: unknown): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function Card({
  title, hint, action, children, pad,
}: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-[14px] border"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      {title && (
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-[13px]"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold">{title}</div>
            {hint && <div className="mt-0.5 text-[12.5px] text-ink3">{hint}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={pad === false ? undefined : "p-4"}>{children}</div>
    </section>
  );
}

function MethodTag({ method, width }: { method: string; width?: number }) {
  return (
    <span
      className="mono shrink-0 text-[10px] font-semibold uppercase"
      style={{ color: methodColor(method), width: width ?? 46 }}
    >
      {method}
    </span>
  );
}

/* ── the traffic log, shared by the console and the Requests tab ───────── */

function useTraffic(): TrafficEntry[] {
  const [rows, setRows] = React.useState<TrafficEntry[]>(() => traffic.all());
  React.useEffect(() => traffic.subscribe(setRows), []);
  return rows;
}

/* ── health ─────────────────────────────────────────────────────────────── */

type CheckResult = { label: string; ok: boolean; ms: number; note: string };

type QueueShape = {
  pending_work_units?: number | null;
  in_progress_work_units?: number | null;
  total_work_units?: number | null;
};

async function timed(label: string, run: () => Promise<string>): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    const note = await run();
    return { label, ok: true, ms: Math.round(performance.now() - t0), note };
  } catch (e) {
    return {
      label,
      ok: false,
      ms: Math.round(performance.now() - t0),
      note: e instanceof ApiError ? e.detail : String(e),
    };
  }
}

/* ── the console ────────────────────────────────────────────────────────── */

function Console({ op }: { op: Op }) {
  const { workspace } = useApp();

  const pathParams = React.useMemo(() => op.params.filter((p) => p.in === "path"), [op]);
  const queryParams = React.useMemo(() => op.params.filter((p) => p.in === "query"), [op]);

  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [body, setBody] = React.useState("{}");
  const [out, setOut] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // A new endpoint is a new form. Workspace is the one value we can guess.
  React.useEffect(() => {
    const seed: Record<string, string> = {};
    for (const p of op.params) if (p.name === "workspace_id") seed[p.name] = workspace;
    setVals(seed);
    setBody(op.hasBody ? "{}" : "");
    setOut(null);
    setFailed(false);
    setArmed(false);
  }, [op, workspace]);

  const missing = pathParams.filter((p) => !(vals[p.name] ?? "").trim()).map((p) => p.name);

  let bodyBroken = false;
  let parsedBody: unknown;
  if (op.hasBody) {
    const raw = body.trim();
    if (!raw) parsedBody = {};
    else {
      try {
        parsedBody = JSON.parse(raw);
      } catch {
        bodyBroken = true;
      }
    }
  }

  const resolvedPath = op.path.replace(/\{([^}]+)\}/g, (m, name: string) => {
    const v = (vals[name] ?? "").trim();
    return v ? encodeURIComponent(v) : m;
  });

  const query: Record<string, string> = {};
  for (const p of queryParams) {
    const v = (vals[p.name] ?? "").trim();
    if (v) query[p.name] = v;
  }

  const blocked = missing.length > 0 || bodyBroken || running;

  async function send() {
    if (blocked) return;
    if (op.destructive && !armed) {
      setArmed(true);
      return;
    }
    setRunning(true);
    setArmed(false);
    try {
      const data = await call<unknown>(
        op.method,
        resolvedPath,
        op.hasBody ? parsedBody : undefined,
        { query },
      );
      setFailed(false);
      setOut(data === null || data === undefined ? "(no content)" : pretty(data));
    } catch (e) {
      setFailed(true);
      setOut(
        e instanceof ApiError
          ? `${e.status} ${e.detail}\n\n${pretty(e.body)}`.trim()
          : String(e),
      );
    } finally {
      setRunning(false);
    }
  }

  function copy() {
    if (!out) return;
    void navigator.clipboard?.writeText(out).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      () => setCopied(false),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        className="min-w-0 overflow-hidden rounded-[14px] border"
        style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        <header
          className="flex flex-wrap items-center gap-2.5 border-b px-4 py-[13px]"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="mono rounded-[5px] border px-[7px] py-0.5 text-[11px] font-semibold"
            style={{ color: methodColor(op.method), borderColor: methodColor(op.method) }}
          >
            {op.method}
          </span>
          <span className="mono min-w-0 flex-1 truncate text-[12.5px]" title={op.path}>
            {op.path}
          </span>
          <Button
            kind={op.destructive && armed ? "danger" : "primary"}
            icon={running ? "refresh" : "play"}
            onClick={() => void send()}
            disabled={blocked}
            title={missing.length ? `Fill in ${missing.join(", ")} first` : undefined}
          >
            {running ? "Sending" : op.destructive && armed ? "Really delete" : "Send"}
          </Button>
        </header>

        <div className="border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <div className="text-[13px] text-ink2">{op.summary || "No summary given."}</div>
          {op.cli && (
            <div className="mono mt-1.5 text-[11.5px] text-ink3">$ {op.cli}</div>
          )}
        </div>

        {(pathParams.length > 0 || queryParams.length > 0 || op.hasBody) && (
          <div className="flex flex-col gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--line)" }}>
            {pathParams.length > 0 && (
              <div>
                <div className="mono mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink3">In the path</div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
                  {pathParams.map((p) => (
                    <label key={p.name} className="min-w-0">
                      <span className="mono mb-1 block text-[11px] text-ink2">
                        {p.name}
                        <span style={{ color: "var(--warn)" }}> *</span>
                      </span>
                      <Field
                        mono full value={vals[p.name] ?? ""}
                        placeholder={p.name}
                        onChange={(v) => setVals((s) => ({ ...s, [p.name]: v }))}
                        onSubmit={() => void send()}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {queryParams.length > 0 && (
              <div>
                <div className="mono mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink3">
                  After the question mark — leave blank to omit
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
                  {queryParams.map((p) => (
                    <label key={p.name} className="min-w-0">
                      <span className="mono mb-1 block text-[11px] text-ink2">
                        {p.name}
                        {p.required && <span style={{ color: "var(--warn)" }}> *</span>}
                      </span>
                      <Field
                        mono full value={vals[p.name] ?? ""}
                        placeholder="—"
                        onChange={(v) => setVals((s) => ({ ...s, [p.name]: v }))}
                        onSubmit={() => void send()}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {op.hasBody && (
              <div>
                <div className="mono mb-2 text-[10.5px] uppercase tracking-[0.08em] text-ink3">
                  Body{op.bodySchema ? ` · ${op.bodySchema}` : ""}
                </div>
                <Textarea mono rows={5} value={body} onChange={setBody} placeholder="{}" />
                {bodyBroken && <div className="mt-2"><Err>That body is not valid JSON yet.</Err></div>}
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink3">Response</span>
            <div className="flex items-center gap-2">
              {missing.length > 0 && (
                <span className="mono text-[11px]" style={{ color: "var(--a1)" }}>
                  needs {missing.join(", ")}
                </span>
              )}
              {out && (
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 text-[11.5px] text-ink3 hover:text-ink"
                >
                  <Icon name={copied ? "check" : "copy"} size={12} />
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
          <pre
            className="mono m-0 max-h-[290px] overflow-auto whitespace-pre-wrap break-words rounded-[9px] border p-[13px] text-[12px] leading-[1.6]"
            style={{
              background: "var(--panel2)",
              borderColor: failed ? "var(--warn)" : "var(--line)",
              color: failed ? "var(--warn)" : "var(--ink2)",
            }}
          >
            {out ?? "Send the request to see a response."}
          </pre>
          {op.destructive && (
            <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--warn)" }}>
              This one removes data. Send twice to confirm.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── tabs ───────────────────────────────────────────────────────────────── */

function Catalog() {
  const [q, setQ] = React.useState("");
  const [selId, setSelId] = React.useState(() => OPERATIONS[0]?.id ?? "");
  const rows = useTraffic();

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return OPERATIONS;
    return OPERATIONS.filter((o) =>
      `${o.method} ${o.path} ${o.summary} ${o.group} ${o.cli}`.toLowerCase().includes(needle),
    );
  }, [q]);

  const sel = OPERATIONS.find((o) => o.id === selId) ?? OPERATIONS[0];
  const recent = rows.slice(0, 6);

  return (
    <div
      className="grid items-start gap-4"
      style={{ gridTemplateColumns: "minmax(0,1fr)" }}
    >
      <div className="grid items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.5fr)]">
        <section
          className="min-w-0 overflow-hidden rounded-[14px] border"
          style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
        >
          <div className="border-b px-3.5 py-3" style={{ borderColor: "var(--line)" }}>
            <Field mono full icon="search" value={q} onChange={setQ} placeholder="Filter endpoints" />
          </div>
          <div className="max-h-[560px] overflow-auto">
            {shown.length === 0 ? (
              <Empty headline="Nothing matches that" hint="Try part of a path, a method, or a group." />
            ) : (
              shown.map((o) => {
                const on = o.id === sel?.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelId(o.id)}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-b px-3.5 py-2 text-left hover:brightness-110"
                    style={{
                      borderColor: "var(--line)",
                      background: on ? "var(--panel2)" : "transparent",
                    }}
                    title={`${o.method} ${o.path}`}
                  >
                    <MethodTag method={o.method} width={42} />
                    <span className="mono min-w-0 flex-1 truncate text-[11.5px]"
                      style={{ color: on ? "var(--ink)" : "var(--ink2)" }}>
                      {o.path}
                    </span>
                    {o.destructive && <Icon name="warn" size={12} style={{ color: "var(--warn)" }} />}
                  </button>
                );
              })
            )}
          </div>
          <div className="px-3.5 py-2.5 text-[11.5px] text-ink3">
            {shown.length} of {OPERATIONS.length} endpoints
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {sel ? <Console op={sel} /> : <Err>No endpoint catalog was compiled into this build.</Err>}

          <Card title="Requests this session" hint={rows.length ? undefined : "Nothing sent yet"} pad={false}>
            {recent.length === 0 ? (
              <Empty
                headline="No calls yet"
                hint="Send something above, or move around the app — every call lands here."
              />
            ) : (
              recent.map((r) => (
                <div
                  key={r.id}
                  className="mono flex items-center gap-2.5 border-b px-4 py-[9px] text-[11.5px] last:border-b-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <MethodTag method={r.method} width={42} />
                  <span className="min-w-0 flex-1 truncate text-ink2" title={r.path}>{r.path}</span>
                  <span style={{ color: statusColor(r.status) }}>{r.status ?? "—"}</span>
                  <span className="w-[54px] text-right text-ink3">{r.ms}ms</span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RequestLog() {
  const rows = useTraffic();
  const [open, setOpen] = React.useState<number | null>(null);
  const [only, setOnly] = React.useState<"all" | "bad">("all");

  const shown = only === "all" ? rows : rows.filter((r) => r.status === null || r.status >= 400);
  const bad = rows.filter((r) => r.status === null || r.status >= 400).length;
  const slowest = rows.reduce((m, r) => Math.max(m, r.ms), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill on={only === "all"} onClick={() => setOnly("all")}>Everything {rows.length}</Pill>
        <Pill on={only === "bad"} onClick={() => setOnly("bad")} tone="var(--warn)">
          Failed {bad}
        </Pill>
        <span className="ml-auto text-[12.5px] text-ink3">
          slowest {slowest ? `${slowest}ms` : "—"}
        </span>
        <Button icon="trash" onClick={() => { traffic.clear(); setOpen(null); }} disabled={rows.length === 0}>
          Clear
        </Button>
      </div>

      <Card
        title="Every call this tab has made"
        hint="Newest first, capped at the last 300. Cleared when you reload."
        pad={false}
      >
        {shown.length === 0 ? (
          <Empty
            headline={only === "bad" ? "Nothing has failed" : "No calls yet"}
            hint={
              only === "bad"
                ? "Every request this session came back clean."
                : "Open any screen and its calls will show up here."
            }
          />
        ) : (
          shown.map((r) => {
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="mono flex w-full cursor-pointer items-center gap-2.5 px-4 py-[9px] text-left text-[11.5px] hover:brightness-110"
                >
                  <Icon
                    name="chevron" size={12}
                    style={{ color: "var(--ink3)", transform: isOpen ? "rotate(90deg)" : undefined }}
                  />
                  <MethodTag method={r.method} width={42} />
                  <span className="min-w-0 flex-1 truncate text-ink2" title={r.path}>{r.path}</span>
                  <span style={{ color: statusColor(r.status) }}>{r.status ?? "failed"}</span>
                  <span className="w-[54px] text-right text-ink3">{r.ms}ms</span>
                  <span className="hidden w-[46px] text-right text-ink3 sm:inline">{ago(r.at)}</span>
                </button>
                {isOpen && (
                  <div className="grid gap-3 px-4 pb-3.5 lg:grid-cols-2">
                    <div className="min-w-0">
                      <div className="mono mb-1.5 text-[10.5px] uppercase tracking-[0.08em] text-ink3">Sent</div>
                      <pre
                        className="mono m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[9px] border p-3 text-[11.5px] leading-[1.6] text-ink2"
                        style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
                      >
                        {pretty(r.request) || "(no body)"}
                      </pre>
                    </div>
                    <div className="min-w-0">
                      <div className="mono mb-1.5 text-[10.5px] uppercase tracking-[0.08em] text-ink3">Came back</div>
                      <pre
                        className="mono m-0 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[9px] border p-3 text-[11.5px] leading-[1.6]"
                        style={{
                          background: "var(--panel2)",
                          borderColor: "var(--line)",
                          color: r.status !== null && r.status < 400 ? "var(--ink2)" : "var(--warn)",
                        }}
                      >
                        {r.error ?? (pretty(r.response) || "(empty)")}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function useChecks() {
  const { workspace } = useApp();
  return useAsync<CheckResult[]>(
    () =>
      Promise.all([
        timed("api", async () => {
          await call<unknown>("GET", "/health");
          return "answering";
        }),
        timed("workspace", async () => {
          const r = await call<{ total?: number }>("POST", "/v3/workspaces/list", {}, { query: { size: 1 } });
          return typeof r?.total === "number" ? `${r.total} in total` : "reachable";
        }),
        timed("backlog", async () => {
          const q = await call<QueueShape>("GET", `/v3/workspaces/${workspace}/queue/status`);
          const waiting = (q?.pending_work_units ?? 0) + (q?.in_progress_work_units ?? 0);
          return `${waiting} waiting`;
        }),
      ]),
    [workspace],
  );
}

function HealthChips({ checks }: { checks: CheckResult[] | null }) {
  if (!checks) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {checks.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-[7px] rounded-[8px] border px-2.5 py-1.5"
          style={{ background: "var(--panel)", borderColor: "var(--line)" }}
          title={c.note}
        >
          <span
            className="size-[7px] rounded-full"
            style={{ background: c.ok ? "var(--a3)" : "var(--warn)" }}
          />
          <span className="mono text-[11.5px] text-ink2">
            {c.label} {c.ok ? `${c.ms}ms` : "down"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Health({ checks }: { checks: AsyncState<CheckResult[]> }) {
  const { workspace } = useApp();

  const detail: Record<string, string> = {
    api: "GET /health — is the server answering at all",
    workspace: "POST /v3/workspaces/list — can we read past the front door",
    backlog: `GET /v3/workspaces/${workspace}/queue/status — how far behind the reading is`,
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Checks"
        hint="Re-run automatically every 30 seconds while this tab is in front."
        action={<Button icon="refresh" onClick={checks.reload}>Run now</Button>}
        pad={false}
      >
        {checks.loading && !checks.data ? (
          <div className="px-4"><Loading label="Checking" /></div>
        ) : checks.error ? (
          <div className="p-4"><Err>{checks.error}</Err></div>
        ) : !checks.data || checks.data.length === 0 ? (
          <Empty headline="Nothing to check" hint="No health endpoints are configured in this build." />
        ) : (
          checks.data.map((c) => (
            <div
              key={c.label}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-[7px]"
                style={{
                  background: c.ok ? "var(--a3soft)" : "var(--warnsoft)",
                  color: c.ok ? "var(--a3)" : "var(--warn)",
                }}
              >
                <Icon name={c.ok ? "check" : "warn"} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">
                  {c.label === "api" ? "Server" : c.label === "workspace" ? "Workspace" : "Reading backlog"}
                  <span className="ml-2 text-[12.5px] font-normal" style={{ color: c.ok ? "var(--ink2)" : "var(--warn)" }}>
                    {c.note}
                  </span>
                </div>
                <div className="mono mt-0.5 truncate text-[11px] text-ink3">{detail[c.label]}</div>
              </div>
              <span className="mono text-[11.5px]" style={{ color: c.ok ? "var(--a3)" : "var(--warn)" }}>
                {c.ms}ms
              </span>
            </div>
          ))
        )}
      </Card>

      <Card title="What this build talks to" hint="Read from the bundle, not from the server.">
        <dl className="m-0 grid gap-x-6 gap-y-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {[
            ["Base path", import.meta.env.VITE_API_BASE ?? "/dashboard-api"],
            ["Workspace", workspace],
            ["Endpoints known", String(OPERATIONS.length)],
            ["Mode", import.meta.env.MODE],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink3">{k}</dt>
              <dd className="mono m-0 mt-0.5 truncate text-[12.5px]" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

/* ── screen ─────────────────────────────────────────────────────────────── */

export default function Developer() {
  const [tab, setTab] = React.useState<TabKey>("catalog");
  const checks = useChecks();
  usePoll(checks.reload, 30000);

  return (
    <Page>
      <PageHead
        title="Developer"
        lede="Every endpoint this server exposes, runnable. Raw names and raw JSON live here and nowhere else."
        actions={<HealthChips checks={checks.data} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Pill key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name={t.icon} size={13} />
              {t.label}
            </span>
          </Pill>
        ))}
      </div>

      {tab === "catalog" && <Catalog />}
      {tab === "log" && <RequestLog />}
      {tab === "health" && <Health checks={checks} />}
    </Page>
  );
}
