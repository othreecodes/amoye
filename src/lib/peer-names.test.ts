import { describe, expect, it } from "vitest";
import { displayName, firstName, humanizeIds, prettifyId } from "./peer-names";

describe("displayName", () => {
  it("prefers what the person said their name is over the CRM record", () => {
    expect(displayName({ id: "wa-8f21", metadata: { learnedName: "Hassan Adeleke", name: "Jane" } }))
      .toBe("Hassan Adeleke");
  });

  it("falls back to the CRM name, then to the id", () => {
    expect(displayName({ id: "wa-8f21", metadata: { name: "Jane" } })).toBe("Jane");
    expect(displayName({ id: "ada-okonkwo", metadata: {} })).toBe("Ada Okonkwo");
  });

  it("ignores a blank name rather than showing an empty header", () => {
    expect(displayName({ id: "ada-okonkwo", metadata: { name: "   " } })).toBe("Ada Okonkwo");
  });

  it("says so when there is nothing to go on", () => {
    expect(prettifyId("")).toBe("Someone with no name yet");
  });
});

describe("humanizeIds", () => {
  const names = new Map([["wa-8f21a4", "Amara Nwosu"]]);
  const nameFor = (id: string) => names.get(id);

  it("swaps the peer id inside a conclusion for the name", () => {
    expect(humanizeIds("wa-8f21a4 upgraded to the Team plan.", nameFor))
      .toBe("Amara Nwosu upgraded to the Team plan.");
  });

  it("leaves an unknown id alone rather than mangling it", () => {
    expect(humanizeIds("wa-000000 asked about pricing.", nameFor))
      .toBe("wa-000000 asked about pricing.");
  });

  it("does not match an id buried inside a longer token", () => {
    // A naive replace would corrupt a url or a compound id.
    expect(humanizeIds("see wa-8f21a4x for detail", nameFor)).toBe("see wa-8f21a4x for detail");
  });
});

describe("firstName", () => {
  it("is what you call someone in a sentence", () => {
    expect(firstName("Amara Nwosu")).toBe("Amara");
    expect(firstName("Ada")).toBe("Ada");
  });
});

describe("agent pattern from the environment", () => {
  // A dotenv value is literal, so `\b` typed as `\\b` arrives as two
  // characters and compiles to "backslash, then b" — matching nothing, and
  // silently disabling every agent check in the app.
  const collapse = (s: string) => s.replace(/\\\\/g, "\\");

  it("a doubled escape matches nothing until it is collapsed", () => {
    const doubled = String.raw`^(sisi|agent|bot)\\b`;
    expect(new RegExp(doubled, "i").test("agent-main")).toBe(false);
    expect(new RegExp(collapse(doubled), "i").test("agent-main")).toBe(true);
  });

  it("a correctly written pattern is left alone", () => {
    const fine = String.raw`^(sisi|agent|bot)\b`;
    expect(collapse(fine)).toBe(fine);
    expect(new RegExp(collapse(fine), "i").test("agent-main")).toBe(true);
    expect(new RegExp(collapse(fine), "i").test("intercom-6ab04917")).toBe(false);
  });
});
