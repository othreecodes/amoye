import * as React from "react";

/* ────────────────────────────────────────────────────────────────────────
   The dialectic answers in Markdown — bold, backticked ids, dash lists.
   Printed as plain text it arrives as one wall with literal ** and ` in it.
   This renders the handful of marks the model actually emits. It is not a
   Markdown implementation and should not grow into one: anything it does not
   recognise is shown as written, which is the safe failure for a console.
   ──────────────────────────────────────────────────────────────────────── */

type Inline = { text: string; bold?: boolean; code?: boolean };

/** Split one line into bold / code / plain runs. Code wins over bold, so a
 *  backticked id containing asterisks survives intact. */
function inlines(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], code: true });
    else out.push({ text: m[2], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out.length ? out : [{ text: line }];
}

function Run({ run }: { run: Inline }) {
  // Bold and code nest: the model writes **`peer-id`** constantly. Parse the
  // inside of a bold run again, or the backticks show up as literal
  // characters wrapped in bold.
  if (run.bold && /`[^`]+`/.test(run.text)) {
    return (
      <strong className="font-semibold">
        <Line text={run.text} />
      </strong>
    );
  }
  if (run.code) {
    return (
      <code
        className="mono rounded-[5px] px-[5px] py-[1px] text-[0.86em]"
        style={{ background: "var(--panel2)", color: "var(--ink2)" }}
      >
        {run.text}
      </code>
    );
  }
  if (run.bold) return <strong className="font-semibold">{run.text}</strong>;
  return <>{run.text}</>;
}

function Line({ text }: { text: string }) {
  return (
    <>
      {inlines(text).map((r, i) => (
        <Run key={i} run={r} />
      ))}
    </>
  );
}

/**
 * Models often emit a whole answer on one line, with " - " standing in for
 * the line breaks a list would have. Split those out so the answer reads as
 * the list it was meant to be rather than a paragraph with hyphens in it.
 */
export function splitLooseList(text: string): string[] {
  return text
    .replace(/\s+-\s+(?=\*\*|[A-Z`])/g, "\n- ")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function Markdown({ text }: { text: string }) {
  const lines = splitLooseList(text);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`l${blocks.length}`} className="my-2 flex list-none flex-col gap-1.5 p-0">
        {list.map((item, i) => (
          <li key={i} className="relative pl-4">
            <span className="absolute left-0 top-[0.62em] size-[4px] rounded-full" style={{ background: "var(--ink3)" }} />
            <Line text={item} />
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <p key={`h${blocks.length}`} className="mb-1 mt-3 font-semibold first:mt-0">
          <Line text={heading[1]} />
        </p>,
      );
      continue;
    }
    blocks.push(
      <p key={`p${blocks.length}`} className="my-2 first:mt-0 last:mb-0">
        <Line text={line} />
      </p>,
    );
  }
  flush();
  return <>{blocks}</>;
}
