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
