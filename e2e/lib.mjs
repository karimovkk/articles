/**
 * e2e yordamchilari: brauzerni topish (Chrome/Chromium/Firefox/WebKit), umumiy sozlamalar.
 *  E2E_BASE     — frontend (default http://localhost:3100)
 *  E2E_API      — mock backend (default http://localhost:8001)
 *  E2E_BROWSER  — chrome | chromium | firefox | webkit (default chrome)
 *  CHROME_PATH  — Chrome/Chromium bajariladigan fayl yo'li (aniqlanmasa)
 */
import { existsSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright-core";

export const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
export const API_HOST = process.env.E2E_API ?? "http://localhost:8001";
export const API = `${API_HOST}/api/v1`;
export const BROWSER = process.env.E2E_BROWSER ?? "chrome";
/** Chromium-only imkoniyatlar (CDP, isMobile, performance.memory) uchun */
export const IS_CHROMIUM = BROWSER !== "firefox" && BROWSER !== "webkit";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

/** Tizimdagi Chrome (yuklab olishsiz) yoki Playwright build'lari (`npx playwright-core install firefox|webkit`). */
export async function launch(extra = {}) {
  if (BROWSER === "firefox") return firefox.launch({ headless: true, ...extra });
  // WEBKIT_PATH — tizim kutubxonalari yetishmasa, o'z o'ramingiz orqali (masalan, LD_LIBRARY_PATH qo'shib) ishga tushirish
  if (BROWSER === "webkit") return webkit.launch({ headless: true, ...(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}), ...extra });
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (executablePath) return chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"], ...extra });
  // Tizimda Chrome topilmasa — Playwright'ning Chromium build'i (`npx playwright-core install chromium`)
  return chromium.launch({ headless: true, args: ["--no-sandbox"], ...extra });
}

export function makeCheck() {
  let failures = 0;
  const check = (name, ok, extra = "") => {
    console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
    if (!ok) failures++;
  };
  const done = async (browser) => {
    await browser?.close();
    console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
    process.exit(failures ? 1 : 0);
  };
  return { check, done, get failures() { return failures; } };
}

/** Mock holatini tiklash (`/__reset`). */
/**
 * Brauzer shovqini — ilova xatosi emas: WebKit (Safari) sahifadan ketilganda yoki Next oldindan yuklashni bekor
 * qilganda uzilgan so'rovlarni "Fetch API cannot load … due to access control checks" deb `pageerror`ga yozadi.
 */
export const ignorablePageError = (msg = "") => /due to access control checks|Load request cancelled/i.test(msg);

export const reset = (query = "") => fetch(`${API_HOST}/__reset${query}`);
export const mockGet = async (path) => (await fetch(`${API_HOST}${path}`)).json();

/* ---------- Qo'lbola boshqaruv elementlari (10.2) ---------- */

/** Qo'lbola Select: trigger'ni ochib, `role=option` dan qiymat (`data-value`) yoki yorliq bo'yicha tanlaydi. */
export async function selectPick(page, trigger, opt) {
  const trig = typeof trigger === "string" ? page.locator(trigger) : trigger;
  await trig.click();
  const list = page.locator('[role="listbox"]');
  await list.waitFor({ timeout: 5000 });
  const target = typeof opt === "string" ? list.locator(`[role="option"][data-value="${opt}"]`) : list.locator('[role="option"]', { hasText: opt.label });
  await target.first().click();
  await list.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
}

/** Qo'lbola Select variantlari soni (panel ochib-yopiladi). */
export async function selectOptionCount(page, trigger) {
  const trig = typeof trigger === "string" ? page.locator(trigger) : trigger;
  await trig.click();
  const list = page.locator('[role="listbox"]');
  await list.waitFor({ timeout: 5000 });
  const n = await list.locator('[role="option"]').count();
  await page.keyboard.press("Escape");
  await list.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
  return n;
}

/** Qo'lbola tasdiqlash oynasi (`useConfirm`): ochilishini kutib, OK/Bekor bosadi. */
export async function confirmDialog(page, ok = true) {
  const btn = page.locator(`[data-testid="${ok ? "confirm-ok" : "confirm-cancel"}"]`);
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.locator('[data-testid="confirm-dialog"]').waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
}

/** Qo'lbola DatePicker: trigger'ni ochib, `data-date="YYYY-MM-DD"` katakni bosadi (joriy oyda bo'lishi kerak). */
export async function datePick(page, trigger, iso) {
  const trig = typeof trigger === "string" ? page.locator(trigger) : trigger;
  await trig.click();
  const pop = page.locator(".cal-pop");
  await pop.waitFor({ timeout: 5000 });
  await pop.locator(`[data-date="${iso}"]`).click();
  await pop.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
}
