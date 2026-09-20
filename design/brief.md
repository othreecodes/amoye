# Project Brief: Honcho Console

## What we're building
A self-hosted product UI for Honcho — the memory service that builds and keeps an
evolving picture of each customer from their support conversations. It replaces
Honcho's own platform dashboard for this team, and has to be the one they'd
rather open.

## Primary audience
- **CX agent (primary, non-technical).** Opens it mid-ticket to answer "who is
  this person and what have we already told them?" Does not know or care what a
  "peer", a "work unit" or a "dialectic" is. Will never read JSON.
- **CX lead.** Wants to see the shape of the day: volume, backlog, what the
  system is learning, whether anything is stuck.
- **Engineer (secondary).** Needs every endpoint reachable and request/response
  inspectable. Must be served without imposing their tools on the other two.

## Goals
1. A CX agent can answer "what do we know about this customer?" in one screen,
   with no training and no jargon.
2. A lead can see health and activity at a glance, visually, not as a number grid.
3. An engineer keeps full API coverage — but it lives in a Developer area, not
   the front door.

## Non-negotiables
- No raw JSON in any primary surface. JSON is a developer affordance, behind a
  toggle, never the default rendering of a customer fact.
- Plain language first, domain term second: "People", not "Peers".
- Icons and illustration carry meaning — empty states, states of knowledge,
  section identity. Not decoration for its own sake.
- Charts where there is a trend; a number alone is a last resort.
- Responsive to 400px. Accessible: WCAG AA contrast, visible focus, reduced motion.

## What it must cover
All 55 API operations remain reachable. The front door covers the ~20 a CX
person needs; the Developer area covers the rest.

## Explicit anti-goals
- Not a terminal. Not an operator console. Not dense-by-default.
- Not a clone of Honcho's platform dashboard — comprehensively better, and
  friendlier to people who do not write code.
