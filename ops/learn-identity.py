#!/usr/bin/env python3
"""Ask each Honcho peer who they say they are, and record only first-person,
high-confidence answers alongside whatever your CRM already holds.

Why: when people reach you through a messaging app, the contact record your CRM
creates carries their self-chosen display name and often no email at all. What
they told you in the conversation is better, but only when they were talking
about themselves -- someone asking "is Mrs X on your staff?" is not Mrs X. This
writes `learnedName` / `learnedEmail` into peer metadata and never touches the
CRM fields, so a console can show the better name with the original behind it.

Standard library only: it runs from a timer on the Honcho host, and that
interpreter has no third-party packages installed.

  HONCHO_API_KEY=...  HONCHO_BASE_URL=https://honcho.example.com \
  HONCHO_WORKSPACE=my-workspace  python3 learn-identity.py --dry-run
"""

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.request

# Verbatim, measured against 7 real peers (1 correction, 1 partial, 1
# confirmation, 4 honest unknowns, 0 borrowed names). Do not reword: the
# "asking about someone" carve-out is what stops the resolver adopting the name
# of a third party the person merely mentioned.
IDENTITY_PROMPT = """Who is this person, in their own words?

Answer ONLY from statements the person made about THEMSELVES, in the first person — "I am…", "my name is…", "my email is…", or a profile screenshot of their own account.

Never take a name from someone they asked about, reported, complained about, or sent on behalf of. A person asking "is Mrs X your staff?" is NOT Mrs X. A person reporting a transfer to someone is NOT that someone.

If you cannot tell from a first-person statement, say unknown. Guessing is worse than unknown.

Reply with one line of JSON and nothing else:
{"name": "<their name or null>", "email": "<their email or null>", "confidence": "high|low"}"""

# Limit the sweep to peers whose id starts with this, so a workspace that also
# holds agents, scopes, or peers from another source is not billed for them.
# Empty means every peer.
PEER_PREFIX = os.environ.get("HONCHO_PEER_PREFIX", "")
PAGE_SIZE = 100          # server returns HTTP 422 above 100
CHAT_TIMEOUT = 120       # the dialectic call takes 10-90s
HTTP_TIMEOUT = 30

log = logging.getLogger("learn-identity")


class Honcho:
    def __init__(self, base_url, api_key, workspace):
        self.base = base_url.rstrip("/")
        self.key = api_key
        self.ws = workspace

    def _post(self, path, body, timeout=HTTP_TIMEOUT):
        req = urllib.request.Request(
            self.base + path,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": "Bearer " + self.key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")

    def _put(self, path, body, timeout=HTTP_TIMEOUT):
        req = urllib.request.Request(
            self.base + path,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": "Bearer " + self.key,
                "Content-Type": "application/json",
            },
            method="PUT",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")

    def list_peers(self):
        """Every peer in the workspace, page by page.

        Guards against a server that ignores `page` and keeps handing back the
        first page: once a whole page contains nothing new we stop, otherwise
        the generator would spin forever and re-ask the same peers.
        """
        page = 1
        seen = set()
        while True:
            data = self._post(
                "/v3/workspaces/%s/peers/list?size=%d&page=%d" % (self.ws, PAGE_SIZE, page),
                {},
            )
            items = data.get("items") or []
            fresh = 0
            for item in items:
                pid = item.get("id") or item.get("peer_id") or ""
                if pid:
                    if pid in seen:
                        continue
                    seen.add(pid)
                fresh += 1
                yield item
            if len(items) < PAGE_SIZE or fresh == 0:
                return
            page += 1

    def get_peer(self, peer_id):
        """Fetch one peer by id. Returns None if it does not exist.

        Deliberately uses peers/list rather than /chat or /representation:
        those two CREATE a peer as a side effect, which would fabricate rows.
        Note the filter key is the flat "id" — dotted paths are rejected.
        """
        data = self._post(
            "/v3/workspaces/%s/peers/list?size=1&page=1" % self.ws,
            {"filters": {"id": peer_id}},
        )
        items = data.get("items") or []
        return items[0] if items else None

    def conclusion_count(self, peer_id):
        # "filter" (singular) is silently ignored by the server and returns the
        # whole workspace, which would make every peer look eligible.
        data = self._post(
            "/v3/workspaces/%s/conclusions/list?size=1&page=1" % self.ws,
            {"filters": {"observed": peer_id}},
        )
        total = data.get("total")
        if total is None:
            total = len(data.get("items") or [])
        return int(total)

    def chat(self, peer_id, query):
        data = self._post(
            "/v3/workspaces/%s/peers/%s/chat" % (self.ws, peer_id),
            {"query": query, "stream": False},
            timeout=CHAT_TIMEOUT,
        )
        return data.get("content") or ""

    def put_metadata(self, peer_id, metadata):
        # PUT replaces metadata wholesale, so `metadata` must already be the
        # full merged document, never just the keys that changed.
        return self._put(
            "/v3/workspaces/%s/peers/%s" % (self.ws, peer_id),
            {"metadata": metadata},
        )


def extract_json(text):
    """Pull the first balanced {...} object out of a reply.

    The model sometimes wraps the JSON in prose or a ```json fence, so a plain
    json.loads of the whole body is not reliable.
    """
    start = text.find("{")
    while start != -1:
        depth = 0
        in_str = False
        escaped = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except ValueError:
                        break
        start = text.find("{", start + 1)
    return None


def clean(value):
    """Normalise a model field to a real string or None.

    The model returns the literal strings "null"/"unknown" often enough that
    treating them as names would poison the metadata.
    """
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or value.lower() in ("null", "none", "unknown", "n/a"):
        return None
    return value


def process_peer(api, peer_id, facts, dry_run, listing_metadata=None):
    """Returns one of: 'learned', 'unchanged', 'failed'."""
    reply = api.chat(peer_id, IDENTITY_PROMPT)
    parsed = extract_json(reply)

    name = email = None
    if isinstance(parsed, dict):
        # Confidence gate: a low-confidence answer is treated exactly like no
        # answer. A wrong stored name is worse than an absent one, because
        # downstream agents present learnedName to the customer as fact.
        confidence = str(parsed.get("confidence", "")).strip().lower()
        if confidence == "high":
            name = clean(parsed.get("name"))
            email = clean(parsed.get("email"))
        else:
            log.info("%s: confidence=%r is not high, recording marker only",
                     peer_id, confidence)
    else:
        log.info("%s: unparseable reply, recording marker only", peer_id)

    # Re-read metadata immediately before writing: the /chat call above can take
    # 90 seconds, and the seeding job may have refreshed the CRM fields in
    # the meantime. Merging onto a stale copy would silently revert them.
    current = api.get_peer(peer_id)
    if current is None:
        log.warning("%s: disappeared before write, skipping", peer_id)
        return "failed"
    fresh = current.get("metadata")
    if not isinstance(fresh, dict):
        fresh = {}

    # put_metadata REPLACES the document, so whatever is not in `metadata` is
    # deleted. If the re-read came back thin -- listing shape changed, metadata
    # omitted from the projection, transient server blip -- writing `fresh`
    # alone would erase contactId/name/email/phone. Start from the copy the
    # listing gave us and let the fresher read win on any key it does carry.
    metadata = dict(listing_metadata or {})
    metadata.update(fresh)
    dropped = sorted(set(listing_metadata or {}) - set(fresh))
    if dropped:
        log.warning("%s: re-read omitted %s; keeping the listing's values",
                    peer_id, ",".join(dropped))

    # Change-detection marker: the fact count at the time we asked. Next run
    # compares it with the live count and only pays for another LLM call once
    # new conclusions have arrived.
    metadata["identityCheckedAtFacts"] = facts

    learned = False
    if name or email:
        if name:
            metadata["learnedName"] = name
        if email:
            metadata["learnedEmail"] = email
        metadata["identitySource"] = "self-stated"
        learned = True

    if dry_run:
        # Print the whole merged key set, not just the identity keys: a PUT
        # replaces the document, so the only way a dry run can prove it is
        # non-destructive is to show that the CRM keys survived the merge.
        log.info(
            "%s: DRY-RUN would set %s; full doc keeps %d key(s): %s",
            peer_id,
            json.dumps({k: metadata[k] for k in
                        ("identityCheckedAtFacts", "learnedName", "learnedEmail", "identitySource")
                        if k in metadata}),
            len(metadata),
            ",".join(sorted(metadata)) or "(none)",
        )
        return "learned" if learned else "unchanged"

    api.put_metadata(peer_id, metadata)
    if learned:
        log.info("%s: learned name=%r email=%r (facts=%d)", peer_id, name, email, facts)
        return "learned"
    log.info("%s: no high-confidence identity, marker set (facts=%d)", peer_id, facts)
    return "unchanged"


def main():
    parser = argparse.ArgumentParser(description="Learn self-stated identities for Honcho peers.")
    parser.add_argument("--dry-run", action="store_true", help="log intended writes, write nothing")
    # One /chat is 10-90s, so a tick is wall-clock bound more than token bound.
    # 50 keeps a run under roughly an hour even when every peer is slow.
    parser.add_argument("--limit", type=int, default=50,
                        help="max peers to ask this run (bounded cost per timer tick)")
    parser.add_argument("--min-facts", type=int, default=4,
                        help="minimum conclusions before a peer is worth an LLM call")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    api_key = os.environ.get("HONCHO_API_KEY")
    if not api_key:
        sys.stderr.write("HONCHO_API_KEY is not set; refusing to run.\n")
        return 2
    base_url = os.environ.get("HONCHO_BASE_URL", "").rstrip("/")
    workspace = os.environ.get("HONCHO_WORKSPACE", "")
    if not base_url or not workspace:
        log.error("set HONCHO_BASE_URL and HONCHO_WORKSPACE")
        return 2

    api = Honcho(base_url, api_key, workspace)

    examined = asked = learned = unchanged = failed = 0
    try:
        peers = list(api.list_peers())
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as exc:
        log.error("could not list peers: %s", exc)
        return 1

    for peer in peers:
        if asked >= args.limit:
            log.info("limit of %d reached, stopping", args.limit)
            break
        peer_id = peer.get("id") or peer.get("peer_id") or ""
        if not peer_id.startswith(PEER_PREFIX):
            continue
        examined += 1
        listing_metadata = peer.get("metadata")
        if not isinstance(listing_metadata, dict):
            listing_metadata = {}
        try:
            facts = api.conclusion_count(peer_id)
            if facts < args.min_facts:
                log.info("%s: skip, %d facts < %d", peer_id, facts, args.min_facts)
                unchanged += 1
                continue
            if listing_metadata.get("identityCheckedAtFacts") == facts:
                log.info("%s: skip, already checked at %d facts", peer_id, facts)
                unchanged += 1
                continue
            asked += 1
            result = process_peer(api, peer_id, facts, args.dry_run, listing_metadata)
            if result == "learned":
                learned += 1
            elif result == "unchanged":
                unchanged += 1
            else:
                failed += 1
        except Exception as exc:  # one bad peer must not end the run
            failed += 1
            log.error("%s: %s", peer_id, exc)

    log.info(
        "summary examined=%d asked=%d learned=%d unchanged=%d failed=%d%s",
        examined, asked, learned, unchanged, failed,
        " (dry-run)" if args.dry_run else "",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
