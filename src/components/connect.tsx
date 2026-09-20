import * as React from "react";
import { getApiKey, needsApiKey, onApiKeyChange, setApiKey } from "@/lib/api";
import { Icon } from "@/design/icons";

/**
 * First run, direct connection only.
 *
 * Behind a reverse proxy this never appears — the proxy holds the token and
 * the browser holds nothing. It is shown when the console talks to Honcho
 * directly, because then there is nowhere else for a key to come from, and an
 * app that simply 401s on every panel is a worse answer than asking.
 */
export function ConnectGate({ children }: { children: React.ReactNode }) {
  const [missing, setMissing] = React.useState(needsApiKey);
  React.useEffect(() => onApiKeyChange(() => setMissing(needsApiKey())), []);
  if (!missing) return <>{children}</>;
  return <AskForKey />;
}

function AskForKey() {
  const [value, setValue] = React.useState(getApiKey);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) setApiKey(value);
  };
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[420px] rounded-[14px] p-6"
        style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "var(--a1)", color: "var(--bg)",
            }}
          >
            <Icon name="key" size={16} />
          </span>
          <h1 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">Connect to Honcho</h1>
        </div>

        <p className="m-0 mb-4 text-[13.5px] leading-[1.6]" style={{ color: "var(--ink3)" }}>
          Paste an API key for the workspace you want to read. It is kept in this browser
          and sent only to your Honcho.
        </p>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="password"
          autoFocus
          spellCheck={false}
          placeholder="Honcho API key"
          aria-label="Honcho API key"
          className="mono w-full rounded-[9px] px-3 py-2.5 text-[13px] outline-none"
          style={{
            background: "var(--panel2)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        />

        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-3 w-full cursor-pointer rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--ink)", color: "var(--bg)", border: "none" }}
        >
          Connect
        </button>

        <p className="mb-0 mt-4 text-[12.5px] leading-[1.6]" style={{ color: "var(--ink3)" }}>
          Scope the key to one workspace:
          <br />
          <code className="mono" style={{ color: "var(--ink2)" }}>
            POST /v3/keys?workspace_id=…
          </code>
        </p>
      </form>
    </div>
  );
}
