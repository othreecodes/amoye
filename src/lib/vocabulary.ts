/**
 * Honcho models "peers" and "sessions". What those *are* depends entirely on
 * what you built: a support desk has customers and tickets, a companion app has
 * characters and chats, a tutor has students and lessons.
 *
 * Rather than hardcode one domain's words, the console carries a vocabulary an
 * operator picks in Settings. Everything user-facing reads from here, so a
 * deployment reads as if it were written for that product.
 */
export type Vocabulary = {
  key: string;
  name: string;
  blurb: string;
  person: string;
  people: string;
  conversation: string;
  conversations: string;
  /** Used in ledes, e.g. "what Amòye has learned about your customers". */
  audience: string;
};

export const VOCABULARIES: Vocabulary[] = [
  {
    key: "support",
    name: "Customer support",
    blurb: "A help desk. People are customers, conversations are tickets.",
    person: "Person", people: "People",
    conversation: "Conversation", conversations: "Conversations",
    audience: "customers",
  },
  {
    key: "companion",
    name: "Companion / character AI",
    blurb: "An app where users talk to a persistent character.",
    person: "User", people: "Users",
    conversation: "Chat", conversations: "Chats",
    audience: "users",
  },
  {
    key: "education",
    name: "Tutoring / education",
    blurb: "A learning product that remembers each learner.",
    person: "Student", people: "Students",
    conversation: "Lesson", conversations: "Lessons",
    audience: "students",
  },
  {
    key: "sales",
    name: "Sales / CRM",
    blurb: "Deals and the people behind them.",
    person: "Contact", people: "Contacts",
    conversation: "Thread", conversations: "Threads",
    audience: "contacts",
  },
  {
    key: "community",
    name: "Community",
    blurb: "A forum, server or group with recurring members.",
    person: "Member", people: "Members",
    conversation: "Thread", conversations: "Threads",
    audience: "members",
  },
  {
    key: "neutral",
    name: "Generic",
    blurb: "Honcho's own words, for mixed or unusual use.",
    person: "Peer", people: "Peers",
    conversation: "Session", conversations: "Sessions",
    audience: "peers",
  },
];

export const DEFAULT_VOCABULARY = VOCABULARIES[0];

export function vocabularyFor(key: string): Vocabulary {
  return VOCABULARIES.find((v) => v.key === key) ?? DEFAULT_VOCABULARY;
}
