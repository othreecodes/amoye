import { describe, expect, it } from "vitest";
import { buildAttributor, stems } from "./attribution";

// Shaped like a real person's file: several claims that circle the same
// incident in slightly different words, plus a couple of derived ones.
const BELIEFS = [
  { text: "Amara Nwosu received a prompt to complete liveness verification.", level: "explicit" as const },
  { text: "Amara Nwosu could not finish the liveness verification check.", level: "explicit" as const },
  { text: "Amara Nwosu was attempting to withdraw funds to their bank account.", level: "explicit" as const },
  { text: "Amara Nwosu said the withdrawal was blocked before it completed.", level: "explicit" as const },
  { text: "Amara Nwosu is the administrator of her team's workspace.", level: "deductive" as const },
  { text: "Amara Nwosu reports problems precisely, with dates and counts.", level: "inductive" as const },
];

describe("stems", () => {
  it("ties a word to its inflections, which is the whole point", () => {
    expect(stems("withdrawal")).toEqual(stems("withdraw"));
    expect(stems("blocked")).toEqual(stems("blocks"));
  });

  it("drops filler that would match everything", () => {
    expect(stems("that which would have been")).toEqual([]);
  });
});

describe("buildAttributor", () => {
  const attribute = buildAttributor(BELIEFS);

  it("matches a paraphrase through its distinctive words", () => {
    // Plain word overlap scores this below any usable threshold. "liveness"
    // and "withdrawal" are what a reader recognises, and rarity is what
    // finds them.
    expect(attribute("Her withdrawal is blocked by a liveness check.")?.level).toBe("explicit");
  });

  it("will not attribute on a single shared word", () => {
    // "workspace" alone, against a file this size, is a coincidence rather
    // than a citation. Drawing a confident underline under it would be a lie.
    expect(attribute("The workspace was created in 2019.")).toBeNull();
  });

  it("attributes a sentence to the level it actually came from", () => {
    expect(attribute("She administers the workspace for her team.")?.level).toBe("deductive");
  });

  it("returns nothing for a sentence about something else entirely", () => {
    expect(attribute("The weather in Lagos is hot today.")).toBeNull();
    expect(attribute("Our office closes at five on Fridays.")).toBeNull();
  });

  it("returns nothing when there is nothing to match against", () => {
    expect(buildAttributor([])("Anything at all here.")).toBeNull();
  });

  it("ignores a sentence too short to be evidence of anything", () => {
    expect(attribute("Yes.")).toBeNull();
  });
});
