// 123: barcha tugmalar bir xil radiusda (--radius-btn); sahifa almashishida kontent silliq paydo bo'ladi (template —
// menyu joyida, kontent qayta yaratiladi); prefers-reduced-motion — animatsiya yo'q; brauzer belgisi (icon, apple-icon,
// favicon.ico).
import { launch, BASE, reset, ignorablePageError, makeCheck } from "../lib.mjs";
const OUT = new URL("../out/", import.meta.url).pathname;
const { check, done } = makeCheck();
await reset("");
const browser = await launch();
const errors = [];

async function signedIn(token, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, ...opts });
  await ctx.addCookies([{ name: "a365_auth", value: "1", url: BASE }]);
  await ctx.addInitScript((tok) => {
    localStorage.setItem("a365.access", tok);
    localStorage.setItem("a365.refresh", "refresh-x");
  }, token);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !ignorablePageError(e.message) && errors.push(e.message));
  return { ctx, page };
}

/** Ko'rinib turgan tugmalarning radiuslari (o'lchami 0 bo'lmaganlar) */
const radii = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll(".btn, .icon-btn, .contact-fab, .sidebar-toggle, .cal-nav, .quiz-cta")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const v = getComputedStyle(el).borderTopLeftRadius;
      (out[v] ??= []).push((el.className.baseVal ?? el.className).toString().slice(0, 40));
    }
    return out;
  });

// ---- 1) Mijoz: katalog — tugmalar bir xil radiusda; sahifa almashishi animatsiyasi
{
  const { ctx, page } = await signedIn("access-token-1");
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="book-card"]', { timeout: 30000 });
  const r = await radii(page);
  // Bir route group ichida o'tish (kutubxona → lug'at): layout (sidebar) saqlanadi, template qayta yaratiladi
  await page.goto(`${BASE}/library`);
  await page.waitForSelector('[data-testid="page-enter"]', { timeout: 30000 });
  check("Mijoz: barcha tugmalar bir xil radius (10px, --radius-btn)", Object.keys(r).length === 1 && Object.keys(r)[0] === "10px", JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.slice(0, 4)]))));
  const enter = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="page-enter"]')).animationName);
  check("Sahifa kontenti 'page-enter' animatsiyasi bilan", enter === "page-enter", enter);
  // Menyu havolasi bilan o'tish: kontent qayta yaratiladi (animatsiya qayta o'ynaydi), sidebar esa o'sha element
  await page.evaluate(() => {
    document.querySelector('[data-testid="page-enter"]').dataset.old = "1";
    document.querySelector(".client-sidebar")?.setAttribute("data-keep", "1");
  });
  await page.click('.client-side-nav a[href="/vocabulary"]');
  await page.waitForURL(`${BASE}/vocabulary`, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="page-enter"]')?.dataset.old, null, { timeout: 10000 });
  const after = await page.evaluate(() => ({
    anim: getComputedStyle(document.querySelector('[data-testid="page-enter"]')).animationName,
    sidebarKept: document.querySelector(".client-sidebar")?.getAttribute("data-keep") === "1",
    indicator: getComputedStyle(document.querySelector(".side-link.active"), "::before").animationName,
  }));
  check("Menyu havolasi → yangi kontent animatsiya bilan, sidebar joyida (qayta yaratilmadi), faol belgi o'sadi", after.anim === "page-enter" && after.sidebarKept && after.indicator === "side-indicator", JSON.stringify(after));
  const press = await page.evaluate(() => {
    // design.css `@import … layer(components)` — qoidalar @layer ichida: rekursiv yig'iladi
    const flat = (rules) => [...rules].flatMap((r) => (r.cssRules ? [r, ...flat(r.cssRules)] : [r]));
    const css = [...document.styleSheets].flatMap((s) => { try { return flat(s.cssRules); } catch { return []; } });
    return css.some((rule) => rule.selectorText === ".btn:active:not(:disabled)" && rule.style.transform === "scale(0.97)");
  });
  check("Tugma bosilganda yengil siqilish (scale 0.97)", press);
  await page.screenshot({ path: OUT + "123-library.png" });
  await ctx.close();
}

// ---- 2) Admin — tugmalar bir xil radiusda
{
  const { ctx, page } = await signedIn("access-token-admin");
  await page.goto(`${BASE}/admin/orders`);
  await page.waitForSelector("tbody tr", { timeout: 30000 });
  const r = await radii(page);
  check("Admin: barcha tugmalar bir xil radius (10px, --radius-btn)", Object.keys(r).length === 1 && Object.keys(r)[0] === "10px", JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.slice(0, 4)]))));
  await page.screenshot({ path: OUT + "123-admin-orders.png" });
  await ctx.close();
}

// ---- 3) prefers-reduced-motion — animatsiya yo'q
{
  const { ctx, page } = await signedIn("access-token-1", { reducedMotion: "reduce" });
  await page.goto(`${BASE}/catalog`);
  await page.waitForSelector('[data-testid="page-enter"]', { timeout: 30000 });
  const a = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="page-enter"]')).animationName);
  check("prefers-reduced-motion: sahifa animatsiyasi yo'q", a === "none", a);
  await ctx.close();
}

// ---- 4) Brauzer belgisi
{
  const html = await (await fetch(`${BASE}/catalog`)).text();
  // atributlar tartibi Next versiyasiga bog'liq — har tegni alohida tekshiramiz
  const tags = html.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g) ?? [];
  const icon = tags.find((x) => /rel="icon"/.test(x) && /href="\/icon\.png/.test(x) && /sizes="192x192"/.test(x) && /type="image\/png"/.test(x))?.match(/href="([^"]+)"/)?.[1];
  const apple = tags.find((x) => /rel="apple-touch-icon"/.test(x) && /href="\/apple-icon\.png/.test(x) && /sizes="180x180"/.test(x))?.match(/href="([^"]+)"/)?.[1];
  const fav = await fetch(`${BASE}/favicon.ico`);
  const iconRes = icon ? await fetch(BASE + icon) : null;
  check("Belgi: <link rel=icon> /icon.png (192), apple-touch-icon (180), /favicon.ico — rasmlar", !!icon && !!apple && iconRes?.status === 200 && iconRes.headers.get("content-type") === "image/png" && fav.status === 200 && /icon/.test(fav.headers.get("content-type") ?? ""), `${icon} | ${apple} | ${fav.status} ${fav.headers.get("content-type")}`);
}

check("Sahifa xatolari yo'q", errors.length === 0, errors.join(" | ").slice(0, 300));
await done(browser);
