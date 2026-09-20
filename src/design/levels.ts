/** Ported from the design's LEVELS map. Colour is the primary channel here,
 *  the underline style the secondary one, and the word is always present so
 *  neither has to carry the meaning alone. */
export type Level = "explicit" | "deductive" | "inductive" | "contradiction";

export type LevelSpec = {
  word: string;
  filterWord: string;
  sure: string;
  color: string;
  soft: string;
  fills: number;
  ul: "solid" | "dashed" | "dotted" | "double";
  gloss: (who: string) => string;
};

export const LEVELS: Record<Level, LevelSpec> = {
  explicit: {
    word: "They said this", filterWord: "They said it", sure: "Certain",
    color: "var(--a3)", soft: "var(--a3soft)", fills: 3, ul: "solid",
    gloss: (who) => `${who} said this outright.`,
  },
  deductive: {
    word: "Worked out", filterWord: "Worked out", sure: "Almost certain",
    color: "var(--a2)", soft: "var(--a2soft)", fills: 2, ul: "dashed",
    gloss: (who) => `Follows from what ${who} said.`,
  },
  inductive: {
    word: "Best guess", filterWord: "Best guesses", sure: "Fairly sure",
    color: "var(--a1)", soft: "var(--a1soft)", fills: 1, ul: "dotted",
    gloss: (who) => `Nobody said this — Amòye worked it out from how ${who} talks.`,
  },
  contradiction: {
    word: "Doesn't add up", filterWord: "Doesn't add up", sure: "Contested",
    color: "var(--warn)", soft: "var(--warnsoft)", fills: 0, ul: "double",
    gloss: () => "Two things we believe here disagree.",
  },
};

export const UL_CLASS: Record<Level, string> = {
  explicit: "u-explicit", deductive: "u-deductive",
  inductive: "u-inductive", contradiction: "u-contradiction",
};

/** Real conclusions arrive with the level missing, abbreviated or oddly cased. */
export function toLevel(raw?: unknown): Level {
  const s = String(raw ?? "").toLowerCase();
  if (s.startsWith("ded")) return "deductive";
  if (s.startsWith("ind")) return "inductive";
  if (s.startsWith("contra") || s.startsWith("conflict")) return "contradiction";
  return "explicit";
}

export const LEVEL_ORDER: Level[] = ["explicit", "deductive", "inductive", "contradiction"];
