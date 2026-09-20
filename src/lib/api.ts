/**
 * Two ways to reach Honcho, and they differ in who holds the token.
 *
 * Behind a proxy (the default, VITE_API_BASE is a path like /dashboard-api):
 * the proxy attaches the token server-side. The browser never holds one, so a
 * stolen session cannot be replayed against the raw API from anywhere else.
 *
 * Direct (VITE_API_BASE is an absolute url): there is no proxy to attach it,
 * so the console asks for a key and keeps it in this browser only. Never sent
 * anywhere but the configured host.
 */
const BASE = import.meta.env.VITE_API_BASE ?? "/dashboard-api";

/** A path means something in front of us is adding the credentials. */
export const usesProxy = !/^https?:\/\//i.test(BASE);

const KEY_STORAGE = "honcho.apiKey";

function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    // Private window, or storage blocked. The key simply will not persist.
    return "";
  }
}

let apiKey = readKey();
const keyListeners = new Set<(key: string) => void>();

export function getApiKey(): string {
  return apiKey;
}

/** True when a direct connection still needs a key before anything will work. */
export function needsApiKey(): boolean {
  return !usesProxy && !apiKey;
}

export function setApiKey(next: string): void {
  apiKey = next.trim();
  try {
    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* not persisted; it still works for this tab */
  }
  keyListeners.forEach((l) => l(apiKey));
}

export function onApiKeyChange(l: (key: string) => void): () => void {
  keyListeners.add(l);
  return () => void keyListeners.delete(l);
}

/**
 * `reverse` does not mean the same thing on every list endpoint. On
 * peers/list and sessions/list, true is newest-first. On conclusions/list it
 * is the opposite. Measured against the server, and the kind of difference
 * that silently freezes a screen on its oldest rows — so the direction is
 * decided here rather than at each call site.
 */
export function reverseFor(
  endpoint: "peers" | "sessions" | "conclusions",
  newestFirst: boolean,
): boolean {
  return endpoint === "conclusions" ? !newestFirst : newestFirst;
}

export type TrafficEntry = {
  id: number;
  at: number;
  method: string;
  path: string;
  status: number | null;
  ms: number;
  request: unknown;
  response: unknown;
  error?: string;
};

type Listener = (t: TrafficEntry[]) => void;

/** Every call this session made — the engineer's half of the product, and the
 *  artefact you paste into an incident thread. Capped so a long shift cannot
 *  grow it without bound. */
class TrafficLog {
  private entries: TrafficEntry[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;
  private cap = 300;

  add(e: Omit<TrafficEntry, "id">) {
    this.entries = [{ ...e, id: ++this.seq }, ...this.entries].slice(0, this.cap);
    this.listeners.forEach((l) => l(this.entries));
  }
  all() {
    return this.entries;
  }
  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }
  clear() {
    this.entries = [];
    this.listeners.forEach((l) => l(this.entries));
  }
}

export const traffic = new TrafficLog();

export class ApiError extends Error {
  status: number;
  detail: string;
  body: unknown;
  constructor(status: number, detail: string, body: unknown) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

export async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts: { query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const qs = opts.query
    ? Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const started = performance.now();
  let status: number | null = null;
  let parsed: unknown = null;

  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    // Only on a direct connection. Behind a proxy an Authorization header from
    // the browser would either be ignored or override the proxy's own.
    if (!usesProxy && apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const text = await res.text();
    parsed = text ? safeJson(text) : null;

    if (!res.ok) {
      throw new ApiError(res.status, readableDetail(parsed, res), parsed);
    }
    return parsed as T;
  } catch (err) {
    if (!(err instanceof ApiError)) parsed = { error: String(err) };
    throw err;
  } finally {
    traffic.add({
      at: Date.now(),
      method,
      path: `${path}${qs ? `?${qs}` : ""}`,
      status,
      ms: Math.round(performance.now() - started),
      request: body ?? null,
      response: parsed,
    });
  }
}

/**
 * A 422 from FastAPI carries `detail` as an ARRAY of validation objects, so
 * String()-ing it yields "[object Object]" and the user learns nothing. Turn
 * whatever shape arrives into one readable line.
 */
function readableDetail(parsed: unknown, res: Response): string {
  const d = (parsed as { detail?: unknown } | null)?.detail;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(d)) {
    const lines = d
      .map((v) => {
        const o = v as { msg?: string; loc?: unknown[] };
        if (!o || typeof o !== "object") return String(v);
        const where = Array.isArray(o.loc) ? o.loc.filter((x) => x !== "body" && x !== "query").join(".") : "";
        return where ? `${where}: ${o.msg ?? "invalid"}` : (o.msg ?? "invalid");
      })
      .filter(Boolean);
    if (lines.length) return lines.join("; ");
  }
  if (d && typeof d === "object") {
    const o = d as { message?: string; error?: string };
    if (o.message) return o.message;
    if (o.error) return o.error;
  }
  return `${res.status} ${res.statusText || "request failed"}`;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** Server-Sent Events for streaming dialectic replies. */
export async function stream(
  path: string,
  body: unknown,
  onDelta: (chunk: string) => void,
): Promise<void> {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  traffic.add({
    at: Date.now(),
    method: "POST",
    path: `${path} (stream)`,
    status: res.status,
    ms: Math.round(performance.now() - started),
    request: body,
    response: "<stream>",
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, `stream failed ${res.status}`, null);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
      if (!t) continue;
      try {
        const j = JSON.parse(t);
        if (j?.delta?.content) onDelta(j.delta.content);
      } catch {
        /* keep-alive or partial frame */
      }
    }
  }
}

export type Page<T> = { items: T[]; total: number; page: number; size: number; pages: number };
export type Workspace = { id: string; metadata?: Record<string, unknown>; configuration?: Record<string, unknown>; created_at: string };
export type Peer = { id: string; workspace_id?: string; metadata?: Record<string, unknown>; created_at: string };
export type Session = { id: string; workspace_id?: string; is_active?: boolean; metadata?: Record<string, unknown>; configuration?: Record<string, unknown>; created_at: string };
export type Message = { id: string; content: string; peer_id: string; session_id: string; metadata?: Record<string, unknown>; token_count?: number; created_at: string };
export type Conclusion = { id: string; content?: string; conclusion?: string; level?: string; observer?: string; observed?: string; created_at?: string; [k: string]: unknown };
export type Scope = { id?: string; name?: string; created_at?: string; [k: string]: unknown };
export type QueueStatus = {
  total_work_units: number;
  completed_work_units: number;
  in_progress_work_units: number;
  pending_work_units: number;
  sessions?: Record<string, { session_id: string; total_work_units: number; completed_work_units: number; in_progress_work_units: number; pending_work_units: number }>;
};
