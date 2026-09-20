# Honcho Console — design brief

A self-hosted web console for **Honcho**, an open-source memory service for AI
agents. This document describes what the product is, who uses it, what each
screen has to accomplish, and the one problem that makes it unusual.

**There is deliberately no visual direction in this brief.** No palette, no
typefaces, no components, no layout. Those are yours to invent. What follows is
the product, the people, the content and the constraints.

Built with React + Tailwind + shadcn/ui + lucide + recharts, so anything
expressible in those is fair game.

---

## 1. What Honcho is

Honcho ingests conversations and **builds an evolving model of each person in
them**. You send it messages; asynchronously it derives *conclusions* about the
people talking, maintains a standing profile for each, and lets you ask
natural-language questions about them.

It is not a CRM, a ticketing system or an analytics tool. It holds exactly one
kind of thing: **beliefs about people, derived from what they said.**

### Domain objects

| Honcho calls it | It is | Shown to users as |
|---|---|---|
| peer | a participant — a customer, or an AI agent | Person |
| session | a conversation thread | Conversation |
| message | one thing someone said | Message |
| conclusion | one derived belief about a person | "something we know" |
| representation | everything derived about a person | "what we know" |
| peer card | a short standing profile, written during consolidation | "in a nutshell" |
| context | the brief an AI agent is handed before replying | "what an agent sees" |
| scope | a named set of conversations that bounds recall | Group |
| dream | a background consolidation job | "tidy up" |
| queue | the derivation backlog | Backlog |
| dialectic | ask a question, get a reasoned answer | Ask |

**The left-hand column must never reach a user.** Words like *peer*, *work
unit*, *dialectic*, *dream*, *inductive* belong only in the Developer area.

---

## 2. Who uses it

**1. CX agent — primary, non-technical.** Mid-ticket, customer waiting in
another window. Needs to answer *"who is this person, what do we already know,
what have we told them?"* in one screen. Will never read JSON. Does not know
what a "peer" is and should not have to.

**2. CX lead.** Wants the shape of the day: volume, what the system is
learning, whether anything is stuck.

**3. Engineer — secondary.** Needs every endpoint reachable and
request/response inspectable — but served without imposing their tools on the
other two. Everything technical lives behind one door.

---

## 3. The hard problem: how do we know this?

This is the thing that makes the product unusual, and the design has to solve
it. Treat it as the central brief.

**Honcho's conclusions can be wrong.** Every conclusion carries a level saying
how it was arrived at:

| Level | Meaning |
|---|---|
| explicit | the person said it outright |
| deductive | follows necessarily from what they said |
| inductive | nobody said it — inferred from how they talk |
| contradiction | two things we believe disagree with each other |

A CX agent is about to **repeat one of these to a customer**. Before they do,
they must be able to feel — in about half a second, without consulting a
legend — whether it is solid ground or a guess. Getting it wrong means telling
a customer something the system invented.

Constraints on whatever you design for this:

- It must work **without a legend**, and must not rely on colour alone —
  greyscale and colour-blindness are real tests, not nice-to-haves.
- Confidence must **never** be shown as a percentage. `0.82` means nothing to
  an agent and invites false precision. Words, not numbers.
- A contradiction has no confidence to report — it needs different treatment
  from the other three, not a lower score.
- A claim should read as **an English sentence** — "Banks with Kuda." — not
  as a field and a value, and never as raw data.
- Provenance matters: how many messages support this, and when were they said.

---

## 4. Screens, and what each must accomplish

Eleven. Grouping and navigation are open; this is the functional inventory.

**Today** — the shape of the day. How many people, conversations, things known;
how far behind the system is; what it learned recently; whether anything
contradicts.

**People** — find a person among hundreds or thousands. Search, and enough per
row to recognise someone without opening them.

**Person detail** — *the most important screen.* Everything known about one
human: the standing profile as written prose; every conclusion with its
epistemic level; which conversations they appear in; the ability to ask a
question about them and get a streamed answer; and a way to see the exact
brief an AI agent would be handed about them.

**Conversations** — browse threads.

**Conversation** — the transcript, who is in it, the system's summary of it,
and what it concluded from it. Add a message; duplicate; delete with
confirmation.

**What we know** — every conclusion across everyone, filterable by epistemic
level, searchable semantically. Contradictions surfaced, not buried.

**Ask** — one question in plain English, optionally anchored to a person, with
the answer streaming in. Should feel like asking a colleague, not querying a
database.

**Groups** — a named set of conversations that bounds an answer. Must warn
while indexing is incomplete: an empty group returns *nothing*, not everything,
which is a trap worth stating in the interface.

**Backlog** — how far behind derivation is, over time and per conversation, and
a way to trigger consolidation for one person. When it is empty, everything
else in the product is current — that is worth saying.

**Settings** — vocabulary (see §6), appearance, workspace, webhooks, API keys,
and a destructive zone that explains *why* deletion may be refused.

**Developer** — all 55 API endpoints with a runnable console, a log of every
request this session made, and health checks.

---

## 5. Content and data realities

- **A person has no photo.** Identity has to be conveyed some other way, and
  an AI agent must never be mistakable for a customer.
- **Data is untidy.** Conclusions arrive with no level, no timestamp and no
  evidence count. Every element needs a real empty and partial state.
- **Async by nature.** Writing a message does not immediately change what is
  known — derivation is queued. The interface must never imply otherwise.
- **Volume varies wildly.** A person may have 4 conclusions or 400. A
  workspace may have 2 people or 20,000.
- **Nothing currently shows change over time**, which is the most interesting
  thing a memory product knows. Worth solving.

---

## 6. It is being open-sourced

Not only customer support. Honcho's "peers" and "sessions" mean something
different in every product built on it, so the console carries a vocabulary
setting that relabels everything:

| Preset | People → | Conversations → |
|---|---|---|
| Customer support | People | Conversations |
| Companion / character AI | Users | Chats |
| Tutoring / education | Students | Lessons |
| Sales / CRM | Contacts | Threads |
| Community | Members | Threads |
| Generic | Peers | Sessions |

So: **no brand, no industry imagery, nothing that assumes a help desk.** The
design has to sit equally well behind a character-AI app and a tutoring
product.

---

## 7. Non-negotiables

- No JSON, no key–value pairs, no raw identifiers on any screen a
  non-developer uses.
- Plain language first. If a word only makes sense to someone who has read the
  API docs, it is the wrong word.
- Light and dark both real.
- Responsive to 400px.
- Accessible: WCAG AA contrast, visible keyboard focus, real interactive
  elements, `prefers-reduced-motion` respected.

---

## 8. Open questions worth answering in the design

1. How should a contradiction be presented — one merged element showing both
   sides, or two that reference each other?
2. Should "what we know" be browsable by **topic** (money, goals, complaints,
   preferences) as well as by how sure we are?
3. What does a person's file look like after two years and 400 conclusions?
4. Is there a view of **what changed today** that would serve a CX lead better
   than a conventional overview?
5. What does this product look like when it knows almost nothing yet — day one,
   first customer, no conclusions? That state will be seen more than any other.
