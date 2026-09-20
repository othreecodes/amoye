import * as React from "react";

/**
 * A Gravatar url for an email, or null.
 *
 * Gravatar keys on a hash of the address, so nothing legible leaves the
 * browser — but a request does, to a third party, revealing that someone is
 * being looked at. Only ever called with an address we already hold.
 *
 * `d=404` is the point of the whole thing: without it Gravatar serves a
 * generated placeholder for every address, and the initials tile — which
 * carries the person's own colour and is the design's avatar — would never
 * be seen again. With it, a miss fails the image load and the caller falls
 * back.
 */
const CACHE = new Map<string, string | null>();

async function sha256Hex(text: string): Promise<string | null> {
  // Needs a secure context. On http://localhost it is present; behind plain
  // http on a LAN address it is not, and the avatar simply stays as initials.
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useGravatar(email: string | undefined, size = 96): string | null {
  const key = email?.trim().toLowerCase() ?? "";
  const [url, setUrl] = React.useState<string | null>(() => CACHE.get(key) ?? null);

  React.useEffect(() => {
    if (!key || !key.includes("@")) {
      setUrl(null);
      return;
    }
    const cached = CACHE.get(key);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }
    let live = true;
    void sha256Hex(key).then((hash) => {
      const next = hash ? `https://gravatar.com/avatar/${hash}?d=404&s=${size}` : null;
      CACHE.set(key, next);
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [key, size]);

  return url;
}
