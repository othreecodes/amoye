/**
 * Screenshot one or more dashboard pages, for reviewing a change without
 * clicking through it.
 *
 *   BASE_URL=https://example.com AUTH_USER=me AUTH_PASS=… \
 *     node ops/shot.mjs /dashboard/people /dashboard/people/some-peer-id
 *
 * Paths are written to shots/<slug>.png. Console errors are reported at the
 * end, because a page that renders can still be broken underneath.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: node ops/shot.mjs <path> [path…]");
  process.exit(2);
}

// Data arrives over several requests and the summary is generated on demand,
// so networkidle alone lands on a half-drawn page.
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 10_000);

await mkdir("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(process.env.WIDTH ?? 1440), height: Number(process.env.HEIGHT ?? 1000) },
  httpCredentials:
    process.env.AUTH_USER && process.env.AUTH_PASS
      ? { username: process.env.AUTH_USER, password: process.env.AUTH_PASS }
      : undefined,
});

const errors = [];
// A console message for a failed request does not carry the url, so the only
// way to tell a real failure from an expected Gravatar miss is to watch the
// responses themselves and remember which urls 404'd on purpose.
const expected404 = new Set();
page.on("response", (r) => {
  if (r.status() === 404 && /gravatar\.com/.test(r.url())) expected404.add(r.url());
});
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const text = m.text();
  if (/status of 404/.test(text) && expected404.size > 0) return;
  errors.push(text.slice(0, 160));
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

for (const path of paths) {
  await page.goto(new URL(path, BASE).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);
  const slug = path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "root";
  await page.screenshot({ path: `shots/${slug}.png`, fullPage: process.env.FULL_PAGE === "1" });
  console.log(`shots/${slug}.png`);
}

await browser.close();
console.log(errors.length ? `console errors:\n  ${errors.join("\n  ")}` : "console errors: none");
if (expected404.size) console.log(`(${expected404.size} Gravatar misses — expected, that is the initials fallback)`);
