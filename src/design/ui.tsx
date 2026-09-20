import * as React from "react";
import { Icon, type IconName } from "./icons";
import { LEVELS, LEVEL_ORDER, type Level } from "./levels";
import { cn } from "@/lib/utils";
import { useGravatar } from "@/hooks/use-gravatar";

/* ────────────────────────────────────────────────────────────────────────
   Primitives ported from Amoye Console.dc.html. Every screen composes from
   here so the eleven of them stay one design rather than eleven.
   ──────────────────────────────────────────────────────────────────────── */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="hx-fade">{children}</div>;
}

export function PageHead({
  title, lede, actions,
}: { title: string; lede?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="m-0 mb-1.5 text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        {lede && <p className="m-0 max-w-[58ch] text-[14.5px] text-ink2" style={{ textWrap: "pretty" }}>{lede}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children, kind = "ghost", icon, onClick, disabled, type = "button", title, className, full,
}: {
  children?: React.ReactNode;
  kind?: "ghost" | "primary" | "danger" | "quiet";
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  className?: string;
  full?: boolean;
}) {
  const style: React.CSSProperties =
    kind === "primary"
      ? { background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)", fontWeight: 600 }
      : kind === "danger"
        ? { background: "var(--warnsoft)", borderColor: "var(--warn)", color: "var(--warn)" }
        : kind === "quiet"
          ? { background: "transparent", borderColor: "transparent", color: "var(--ink2)" }
          : { background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)" };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      style={style}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border px-[13px] py-2",
        "text-[13px] font-medium transition-[filter,border-color] hover:brightness-110",
        "disabled:cursor-not-allowed disabled:opacity-45",
        full && "w-full", className,
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

export function Panel({
  title, icon, action, children, pad = true, className,
}: {
  title?: string;
  icon?: IconName;
  action?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-[12px] border", className)}
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      {title && (
        <header
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--line)" }}
        >
          {icon && <span className="text-ink3"><Icon name={icon} size={15} /></span>}
          <h2 className="m-0 text-[13.5px] font-semibold">{title}</h2>
          {action && <div className="ml-auto">{action}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export function Stat({
  label, value, sub, tone, icon,
}: { label: string; value: React.ReactNode; sub?: string; tone?: string; icon?: IconName }) {
  return (
    <div
      className="min-w-0 flex-1 rounded-[12px] border p-4"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: tone ?? "var(--ink3)" }}><Icon name={icon} size={14} /></span>}
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">{label}</span>
      </div>
      <div className="tnum mt-2 text-[27px] font-semibold leading-none tracking-[-0.03em]" style={{ color: tone }}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] text-ink2">{sub}</div>}
    </div>
  );
}

export function Chip({
  children, tone = "var(--ink2)", soft = "transparent", mono, title,
}: { children: React.ReactNode; tone?: string; soft?: string; mono?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium", mono && "mono")}
      style={{ background: soft, color: tone }}
    >
      {children}
    </span>
  );
}

/** Names the level in plain words. The internal term lives in the tooltip. */
export function LevelChip({ level, who = "they" }: { level: Level; who?: string }) {
  const L = LEVELS[level];
  const icon: IconName =
    level === "explicit" ? "quote" : level === "deductive" ? "branch" : level === "inductive" ? "waves" : "split";
  return (
    <Chip tone={L.color} soft={L.soft} title={L.gloss(who)}>
      <Icon name={icon} size={12} />
      {L.word}
    </Chip>
  );
}

/** Three cells and a word. Never a percentage — false precision helps nobody
 *  who is about to repeat this to a customer. */
export function Sureness({ level }: { level: Level }) {
  const L = LEVELS[level];
  if (level === "contradiction") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--warn)" }}>
        <Icon name="split" size={13} />
        {L.sure}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`${L.sure} — ${L.gloss("they")}`}>
      <span className="flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[5px] w-[18px] rounded-[2px]"
            style={{ background: i < L.fills ? L.color : "var(--line2)" }} />
        ))}
      </span>
      <span className="text-[12.5px] text-ink2">{L.sure}</span>
    </span>
  );
}

/** Supporting messages, one dot each, on a rule tinted by the level. */
export function Evidence({ level, count = 0, width = 96 }: { level: Level; count?: number; width?: number }) {
  const L = LEVELS[level];
  const n = Math.min(count, 6);
  return (
    <span className="inline-flex items-center gap-[5px]" aria-hidden>
      <span className="h-[2px] rounded-full" style={{ width, background: L.color, opacity: 0.55 }} />
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="size-[5px] rounded-full" style={{ background: L.color }} />
      ))}
    </span>
  );
}

export type Belief = {
  id: string;
  text: string;
  level: Level;
  meta?: string;
  /** Display name shown in the meta line. */
  person?: string;
  /** The id to navigate to, when it differs from the display name. */
  personId?: string;
  evidence?: number;
  isNew?: boolean;
  onOpen?: () => void;
  /** Extra content under the meta line — the contradiction resolver uses this. */
  children?: React.ReactNode;
};

/**
 * A conclusion, exactly as the design draws it: three fill cells for how sure
 * we are, then the claim as a sentence whose OWN underline carries the
 * epistemic level. No card — these stack as rows, because a wall of cards
 * hides the one thing that matters, which is how the claims compare.
 */
export function BeliefCard({
  b, onOpen, onPerson,
}: {
  b: Belief;
  onOpen?: () => void;
  /** The person's name is the way into their file, so it is a link, not text. */
  onPerson?: (id: string) => void;
}) {
  const L = LEVELS[b.level];
  const contested = b.level === "contradiction";
  return (
    <div className="flex items-start gap-3.5 border-b px-[18px] py-3.5 last:border-b-0"
      style={{ borderColor: "var(--line)" }}>
      <div className="flex shrink-0 items-center gap-[2px] pt-[3px]">
        {contested ? (
          <span
            className="ml-[2px] size-[15px] rotate-45"
            style={{ border: "1.5px solid var(--warn)", background: "linear-gradient(90deg,transparent 47%,var(--warn) 47%)" }}
            title="Two things we believe here disagree"
          />
        ) : (
          [0, 1, 2].map((i) => (
            <span key={i} className="h-[15px] w-[6px] rounded-[1px]"
              style={i < L.fills
                ? { background: L.color }
                : { border: "1px solid var(--line2)" }} />
          ))
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="inline pb-[2px] text-[15px] leading-[1.45]"
          style={{ borderBottom: `1.5px ${L.ul} ${L.color}`, textWrap: "pretty" }}>
          {b.text}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {b.person && (
            onPerson
              ? <button onClick={() => onPerson(b.personId ?? b.person!)}
                  className="cursor-pointer text-[12.5px] text-ink hover:underline">{b.person}</button>
              : <span className="text-[12.5px] text-ink">{b.person}</span>
          )}
          {b.meta && <span className="text-[12px] text-ink3">{b.meta}</span>}
          <span className="rounded-full px-[9px] py-[2px] text-[11.5px] font-semibold"
            style={{ color: L.color, background: L.soft }}>{L.word}</span>
          <span className="text-[11.5px] text-ink3">{L.sure}</span>
          {b.isNew && <span className="text-[11.5px] font-medium" style={{ color: "var(--a2)" }}>new</span>}
        </div>
        {b.children}
      </div>

      {onOpen && (
        <button onClick={onOpen}
          className="shrink-0 cursor-pointer rounded-[7px] border bg-transparent px-2.5 py-[5px] text-[12px] text-ink2 hover:brightness-125"
          style={{ borderColor: "var(--line)" }}>
          Open
        </button>
      )}
    </div>
  );
}

/** Conclusion rows share one bordered frame rather than each carrying its own. */
export function BeliefList({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[12px] border"
      style={{ background: "var(--panel)", borderColor: "var(--line)", boxShadow: "var(--shadow)" }}>
      {children}
    </div>
  );
}

/** How solid a whole file is, in one bar and one sentence. */
export function MixBar({
  counts, who, onPick,
}: { counts: Record<Level, number>; who: string; onPick?: (l: Level | null) => void }) {
  const total = LEVEL_ORDER.reduce((a, l) => a + (counts[l] ?? 0), 0);
  if (!total) return null;
  const words: Record<Level, string> = {
    explicit: "they told us", deductive: "follow from that",
    inductive: "are best guesses", contradiction: "disagree",
  };
  const parts = LEVEL_ORDER.filter((l) => counts[l]).map((l) => `${counts[l]} ${words[l]}`);
  return (
    <div>
      <div className="flex h-[9px] overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
        {LEVEL_ORDER.filter((l) => counts[l]).map((l) => (
          <button
            key={l}
            onClick={() => onPick?.(l)}
            title={`${counts[l]} ${LEVELS[l].word.toLowerCase()}`}
            aria-label={`${counts[l]} ${LEVELS[l].word}`}
            style={{ width: `${(counts[l] / total) * 100}%`, background: LEVELS[l].color }}
          />
        ))}
      </div>
      <p className="tnum m-0 mt-2 text-[12.5px] text-ink2">
        Of {total} things we know about {who}: {parts.join(", ")}.
        {onPick && (
          <button onClick={() => onPick(null)} className="ml-2 underline decoration-dotted hover:text-ink">
            show all
          </button>
        )}
      </p>
    </div>
  );
}

/** Stacked daily bars — what was learned, split by how we know it. */
export function LearningChart({
  series, height = 120,
}: {
  series: Array<{ label: string; explicit: number; deductive: number; inductive: number }>;
  height?: number;
}) {
  const max = Math.max(1, ...series.map((d) => d.explicit + d.deductive + d.inductive));
  const unit = (height - 18) / max;
  return (
    <div>
      <div className="flex items-end gap-[6px]" style={{ height }}>
        {series.map((d) => {
          const total = d.explicit + d.deductive + d.inductive;
          return (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${d.label} · ${total} learned`}>
              <span className="flex w-full flex-col-reverse overflow-hidden rounded-[3px]">
                <span style={{ height: d.explicit * unit, background: "var(--a3)" }} />
                <span style={{ height: d.deductive * unit, background: "var(--a2)" }} />
                <span style={{ height: d.inductive * unit, background: "var(--a1)" }} />
              </span>
              <span className="mono text-[9.5px] text-ink3">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        {LEVEL_ORDER.slice(0, 3).map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-[11.5px] text-ink2">
            <span className="size-[8px] rounded-[2px]" style={{ background: LEVELS[l].color }} />
            {LEVELS[l].word}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A person's trajectory: are we learning more about them, or less? */
export function Spark({ points, tone = "var(--a2)", w = 100, h = 24 }: {
  points: number[]; tone?: string; w?: number; h?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - (p / max) * (h - 3) - 1.5}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden className="shrink-0">
      <polyline points={d} stroke={tone} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const AV_HUES = ["var(--a1)", "var(--a2)", "var(--a3)"];
const AV_SOFT = ["var(--a1soft)", "var(--a2soft)", "var(--a3soft)"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(id: string) {
  const clean = id.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "??";
}

const AGENT_RE = new RegExp(import.meta.env.VITE_AGENT_PATTERN ?? "^(assistant|agent|bot|ai)\\b", "i");
export const isAgent = (id: string) => AGENT_RE.test(id);

export function Avatar({
  id,
  size = 34,
  email,
}: {
  id: string;
  size?: number;
  /** When the person has one, their photo is tried before the initials. */
  email?: string;
}) {
  const agent = isAgent(id);
  const hue = agent ? "var(--a3)" : AV_HUES[hash(id) % AV_HUES.length];
  const softFor = agent ? "var(--a3soft)" : AV_SOFT[hash(id) % AV_SOFT.length];
  // A rounded square, not a circle — the design keeps circles for status dots
  // only, so a person never reads as a state indicator.
  const radius = size >= 48 ? 14 : size >= 32 ? 10 : 8;

  // Gravatar is a miss for most people, and a miss arrives as a failed image
  // load rather than an error we can await. So the tile below always renders
  // and the photo sits on top of it, removing itself if it never loads --
  // no flash of empty square, no layout shift.
  const photo = useGravatar(agent ? undefined : email, Math.max(96, size * 2));
  const [photoFailed, setPhotoFailed] = React.useState(false);
  React.useEffect(() => setPhotoFailed(false), [photo]);

  return (
    <span
      className="mono inline-flex shrink-0 items-center justify-center font-semibold"
      style={{
        position: "relative", overflow: "hidden",
        width: size, height: size, borderRadius: radius,
        background: softFor, border: `1px solid ${hue}`, color: hue,
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
      aria-hidden
    >
      {agent ? <Icon name="spark" size={Math.round(size * 0.46)} /> : initials(id)}
      {photo && !photoFailed && (
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setPhotoFailed(true)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            borderRadius: radius, objectFit: "cover",
          }}
        />
      )}
    </span>
  );
}

export function Field({
  value, onChange, placeholder, icon, mono, type = "text", full, className, onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: IconName;
  mono?: boolean;
  type?: string;
  full?: boolean;
  className?: string;
  onSubmit?: () => void;
}) {
  return (
    <div
      className={cn("flex items-center gap-2 rounded-[8px] border px-2.5 py-[7px]", full && "w-full", className)}
      style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
    >
      {icon && <span className="text-ink3"><Icon name={icon} size={14} /></span>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) { e.preventDefault(); onSubmit(); } }}
        className={cn("w-full min-w-0 border-0 bg-transparent text-[13px] outline-none", mono && "mono")}
      />
    </div>
  );
}

export function Textarea({
  value, onChange, rows = 3, placeholder, mono,
}: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; mono?: boolean }) {
  return (
    <textarea
      rows={rows} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn("w-full resize-y rounded-[8px] border px-2.5 py-2 text-[13px] outline-none", mono && "mono")}
      style={{ background: "var(--panel2)", borderColor: "var(--line)" }}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-ink3">
      {children}
    </label>
  );
}

export function Pill({
  children, on, onClick, tone,
}: { children: React.ReactNode; on?: boolean; onClick?: () => void; tone?: string }) {
  const c = tone ?? "var(--ink)";
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-full border px-[13px] py-[7px] text-[12.5px] font-medium transition-colors"
      style={
        on
          ? { background: "var(--panel2)", borderColor: c, color: c }
          : { background: "transparent", borderColor: "var(--line)", color: "var(--ink2)" }
      }
    >
      {children}
    </button>
  );
}

export function Empty({
  headline, hint, action, art,
}: { headline: string; hint?: string; action?: React.ReactNode; art?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 px-6 py-10 text-center">
      {art}
      <p className="m-0 text-[15.5px] font-medium">{headline}</p>
      {hint && <p className="m-0 text-[13px] text-ink2">{hint}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-[13px] text-ink3">
      <span className="hx-pulse size-[6px] rounded-full" style={{ background: "var(--a2)" }} />
      {label}…
    </div>
  );
}

export function Err({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] px-3 py-2 text-[12.5px]"
      style={{ background: "var(--warnsoft)", color: "var(--warn)" }}>
      {children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[12px] text-ink3">{children}</p>;
}

export function Row({
  children, onClick, className,
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      className={cn("flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:brightness-110", className)}>
      {children}
    </Tag>
  );
}
