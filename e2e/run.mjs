#!/usr/bin/env node
/**
 * e2e runner: mock backend + Next (dev yoki production build) ni ko'taradi, to'plamlarni ketma-ket ishga tushiradi.
 *   npm run e2e                 — dev server (turbopack) bilan
 *   npm run e2e -- --prod       — `next build` + `next start` bilan
 *   npm run e2e -- reader book  — faqat berilgan to'plamlar
 *   E2E_BROWSER=firefox npm run e2e
 */
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const prod = args.includes("--prod");
const only = args.filter((a) => !a.startsWith("--"));
const PORT = process.env.E2E_PORT ?? "3100";
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? "8001";
const env = { ...process.env, BACKEND_URL: `http://localhost:${MOCK_PORT}`, E2E_BASE: `http://localhost:${PORT}`, E2E_API: `http://localhost:${MOCK_PORT}` };

const procs = [];
const start = (cmd, cmdArgs, opts = {}) => {
  const p = spawn(cmd, cmdArgs, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: true, ...opts });
  p.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(d));
  p.stderr.on("data", (d) => process.env.E2E_VERBOSE && process.stderr.write(d));
  procs.push(p);
  return p;
};
const stopAll = () => {
  for (const p of procs) {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {
      /* allaqachon to'xtagan */
    }
  }
};
process.on("exit", stopAll);
process.on("SIGINT", () => { stopAll(); process.exit(130); });

async function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* hali tayyor emas */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Tayyor bo'lmadi: ${url}`);
}

start("node", ["e2e/mock/server.mjs"], { env: { ...env, PORT: MOCK_PORT } });
await waitFor(`http://localhost:${MOCK_PORT}/__log`);

if (prod) {
  const b = spawnSync("npx", ["next", "build"], { cwd: root, env, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
  start("npx", ["next", "start", "-p", PORT]);
} else {
  start("npx", ["next", "dev", "-p", PORT]);
}
await waitFor(`http://localhost:${PORT}/login`, 120000);
// isitish (dev: birinchi kompilyatsiya)
for (const p of ["/login", "/catalog", "/library"]) await fetch(`http://localhost:${PORT}${p}`).catch(() => undefined);

const suites = readdirSync(resolve(root, "e2e/tests"))
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => f.replace(".test.mjs", ""))
  .filter((n) => !only.length || only.includes(n));

let failed = 0;
for (const name of suites) {
  console.log(`\n══════ ${name} ══════`);
  const r = spawnSync("node", [`e2e/tests/${name}.test.mjs`], { cwd: root, env, stdio: "inherit", timeout: 300000 });
  if (r.status !== 0) failed++;
}
console.log(`\n${suites.length - failed}/${suites.length} to'plam o'tdi${failed ? ` — ${failed} ta muvaffaqiyatsiz` : ""}`);
stopAll();
process.exit(failed ? 1 : 0);
