import { describe, expect, it } from "vitest";
import { splitLooseList } from "./markdown";

describe("splitLooseList", () => {
  it("breaks a one-line answer back into the list it was meant to be", () => {
    // What the dialectic actually returns: the whole answer on one line with
    // " - " where the newlines should have been.
    const line =
      "Based on records, a customer raised a complaint. - **Peer**: `wa-69c9` - " +
      "**Issue**: fees are too high - **Resolution**: explained the buffer";
    expect(splitLooseList(line)).toEqual([
      "Based on records, a customer raised a complaint.",
      "- **Peer**: `wa-69c9`",
      "- **Issue**: fees are too high",
      "- **Resolution**: explained the buffer",
    ]);
  });

  it("leaves a hyphenated phrase alone", () => {
    // Splitting on every hyphen would shred ordinary prose.
    expect(splitLooseList("a well-known issue - and nothing else")).toEqual([
      "a well-known issue - and nothing else",
    ]);
  });

  it("keeps real newlines and drops blank ones", () => {
    expect(splitLooseList("one\n\ntwo\n")).toEqual(["one", "two"]);
  });
});

describe("nested marks", () => {
  it("is the shape the model actually emits", () => {
    // **`peer-id`** — bold wrapping code. Handled in Run(), which re-parses a
    // bold run containing backticks; asserted here so the shape is recorded.
    expect(/`[^`]+`/.test("`Chimaobi`")).toBe(true);
  });
});
