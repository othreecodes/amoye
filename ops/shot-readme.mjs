/**
 * Screenshots for the README, taken against a demo workspace of invented
 * people. Never point this at a workspace holding real conversations.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL;
const WS = process.env.DEMO_WORKSPACE ?? "amoye-demo";
if (!BASE) { console.error("set BASE_URL"); process.exit(2); }

await mkdir("docs/img", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  httpCredentials: process.env.AUTH_USER
    ? { username: process.env.AUTH_USER, password: process.env.AUTH_PASS ?? "" }
    : undefined,
});
// The workspace and theme live in localStorage, so they have to be planted
// before the app's first render or it opens on the default workspace.
await ctx.addInitScript(([ws, theme]) => {
  try {
    localStorage.setItem("honcho.ws", ws);
    localStorage.setItem("honcho.theme", theme);
  } catch { /* private window */ }
}, [WS, process.env.THEME ?? "dark"]);

const page = await ctx.newPage();
const shots = [
  ["today", "/dashboard/"],
  ["people", "/dashboard/people"],
  ["person", "/dashboard/people/wa-8f21a4"],
  ["knowledge", "/dashboard/knowledge"],
];
for (const [name, path] of shots) {
  await page.goto(new URL(path, BASE).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 9000));
  await page.screenshot({ path: `docs/img/${name}.png` });
  console.log(`docs/img/${name}.png`);
}
await browser.close();
