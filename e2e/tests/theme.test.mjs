// 11.4 — mavzu switch (oy ⇄ quyosh) + bosilgan nuqtadan "to'lqin" (View Transitions), saqlanish, klaviatura
import { launch, BASE, reset, makeCheck } from "../lib.mjs";
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await browser.close();
  process.exit(1);
});

await page.goto(`${BASE}/catalog`);
await page.waitForSelector("text=Test kitob");
const sw = page.locator('[data-testid="theme-toggle"]');
check("Switch: role=switch, boshida kunduzgi (aria-checked=false)", (await sw.getAttribute("role")) === "switch" && (await sw.getAttribute("aria-checked")) === "false");
check("Switch: chapda oy, o'ngda quyosh", await page.evaluate(() => {
  const m = document.querySelector(".theme-switch .ts-moon")?.getBoundingClientRect();
  const s = document.querySelector(".theme-switch .ts-sun")?.getBoundingClientRect();
  return !!m && !!s && m.left < s.left;
}));
const knobLight = await page.evaluate(() => document.querySelector(".theme-switch .ts-knob")?.getBoundingClientRect().left);
const supportsVT = await page.evaluate(() => typeof document.startViewTransition === "function");

// Sichqoncha bilan bosish → dark; to'lqin (VT bo'lsa) — data-theme-wave vaqtincha
const box = await sw.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
if (supportsVT) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme-wave"), null, { timeout: 2000 }).then(() => check("To'lqin boshlandi (data-theme-wave)", true)).catch(() => check("To'lqin boshlandi (data-theme-wave)", false));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-wave"), null, { timeout: 4000 }).then(() => check("To'lqin tugadi (atribut olib tashlandi)", true)).catch(() => check("To'lqin tugadi (atribut olib tashlandi)", false));
} else {
  console.log("ℹ️  Brauzer View Transitions'ni qo'llamaydi — oddiy almashish tekshiriladi");
}
check("Dark: html.dark + aria-checked=true", (await page.evaluate(() => document.documentElement.classList.contains("dark"))) && (await sw.getAttribute("aria-checked")) === "true");
await page.waitForTimeout(600); // tugmacha animatsiyasi
const knobDark = await page.evaluate(() => document.querySelector(".theme-switch .ts-knob")?.getBoundingClientRect().left);
check("Tugmacha chapga (oy tomonga) surildi", knobDark < knobLight - 15, `${knobLight}→${knobDark}`);
check("Tugmachada oy ko'rinadi, quyosh yashirin", await page.evaluate(() => {
  const moon = getComputedStyle(document.querySelector(".theme-switch .k-moon")).opacity;
  const sun = getComputedStyle(document.querySelector(".theme-switch .k-sun")).opacity;
  return Number(moon) > 0.9 && Number(sun) < 0.1;
}));
check("localStorage a365.theme=dark", (await page.evaluate(() => localStorage.getItem("a365.theme"))) === "dark");
await page.reload();
await page.waitForSelector("text=Test kitob");
check("Reload'dan keyin dark saqlandi", (await page.evaluate(() => document.documentElement.classList.contains("dark"))) && (await sw.getAttribute("aria-checked")) === "true");

// Klaviatura: fokus + Space → light (koordinatasiz ham ishlaydi)
await sw.focus();
await page.keyboard.press("Space");
await page.waitForFunction(() => !document.documentElement.classList.contains("dark"), null, { timeout: 3000 });
check("Klaviatura (Space) → kunduzgi", (await sw.getAttribute("aria-checked")) === "false");

// Admin topbar'da ham switch
await page.goto(`${BASE}/login`);
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/admin`);
await page.waitForSelector("text=Boshqaruv paneli", { timeout: 10000 });
check("Admin topbar: switch bor", (await page.locator('.topbar [data-testid="theme-toggle"][role="switch"]').count()) === 1);
await page.locator('.topbar [data-testid="theme-toggle"]').click();
await page.waitForFunction(() => document.documentElement.classList.contains("dark"), null, { timeout: 3000 });
check("Admin: dark ga o'tdi", true);

check("Sahifa xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await done(browser);
