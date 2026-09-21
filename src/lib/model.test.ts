import { describe, expect, it } from "vitest";
import { countLevels, dedupeBeliefs, onePerspective } from "./model";
import type { Belief } from "@/design/ui";

const b = (text: string, level: Belief["level"], person = "wa-1"): Belief =>
  ({ id: Math.random().toString(36), text, level, person });

describe("dedupeBeliefs", () => {
  it("folds the agent-observed and self-observed copies into one fact", () => {
    // Honcho stores every fact twice. Undeduped, a person we know 9 things
    // about reads as 18, and each row appears twice in a row.
    const rows = [b("Amara upgraded on 14 March.", "explicit"), b("Amara upgraded on 14 March.", "explicit")];
    expect(dedupeBeliefs(rows)).toHaveLength(1);
  });

  it("ignores trailing punctuation and spacing differences", () => {
    expect(dedupeBeliefs([
      b("Amara  upgraded on 14 March", "explicit"),
      b("Amara upgraded on 14 March.", "explicit"),
    ])).toHaveLength(1);
  });

  it("keeps the same sentence when it is about a different person", () => {
    expect(dedupeBeliefs([
      b("Asked about pricing.", "explicit", "wa-1"),
      b("Asked about pricing.", "explicit", "wa-2"),
    ])).toHaveLength(2);
  });

  it("keeps the same sentence when it is held at a different level", () => {
    expect(dedupeBeliefs([
      b("She runs the team workspace.", "explicit"),
      b("She runs the team workspace.", "deductive"),
    ])).toHaveLength(2);
  });

  it("keeps the first copy, which is the newest phrasing", () => {
    const [kept] = dedupeBeliefs([b("Newest wording.", "explicit"), b("Newest wording.", "explicit")]);
    expect(kept.text).toBe("Newest wording.");
  });
});

describe("countLevels", () => {
  it("counts what the filter pills promise", () => {
    const counts = countLevels([
      b("a", "explicit"), b("b", "explicit"), b("c", "deductive"), b("d", "inductive"),
    ]);
    expect(counts).toMatchObject({ explicit: 2, deductive: 1, inductive: 1, contradiction: 0 });
  });
});

describe("onePerspective", () => {
  const row = (observer: string, observed: string, content: string) =>
    ({ observer_id: observer, observed_id: observed, content });

  it("keeps the agent's view and drops the person's view of themselves", () => {
    // The same fact is stored under both, so merged it reads as two facts.
    const kept = onePerspective([
      row("agent", "ada", "Ada banks with Kuda."),
      row("ada", "ada", "Ada banks with Kuda."),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].observer_id).toBe("agent");
  });

  it("drops the self-observed copy even when it is worded differently", () => {
    // Which is the case that matters: the two dreams do not agree on wording,
    // so text dedupe cannot catch these.
    const kept = onePerspective([
      row("agent", "ada", "Ada prefers low-risk products."),
      row("ada", "ada", "Ada demonstrates a preference for capital-preserving instruments."),
    ]);
    expect(kept).toHaveLength(1);
  });

  it("keeps the self-observed view when it is the only one there is", () => {
    // An agent's own page, where nobody else is observing.
    const kept = onePerspective([row("sisi", "sisi", "Sisi introduced herself.")]);
    expect(kept).toHaveLength(1);
  });

  it("decides per person, not for the whole list at once", () => {
    const kept = onePerspective([
      row("agent", "ada", "seen by the agent"),
      row("ada", "ada", "seen by herself"),
      row("sisi", "sisi", "only self-observed"),
    ]);
    expect(kept.map((r) => r.content)).toEqual(["seen by the agent", "only self-observed"]);
  });
});
