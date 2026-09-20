import { describe, expect, it } from "vitest";
import { countLevels, dedupeBeliefs } from "./model";
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
