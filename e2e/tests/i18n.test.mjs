// Task 4 tekshiruvi: uz/ru/en — almashtirgich, saqlanish, <html lang>, sahifalar, xato matnlari, reader, admin
import { launch, BASE, API, reset } from "../lib.mjs";
import { mkdirSync } from "node:fs";

const BOOK = "11111111-1111-4111-8111-111111111111";
const ART = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};
await reset("");

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" })).newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => m.type() === "error" && /hydrat|Warning/i.test(m.text()) && pageErrors.push(m.text()));
process.on("unhandledRejection", async (e) => {
  console.log("❌ XATO:", e.message.split("\n")[0]);
  await page.screenshot({ path: OUT + "99-i18n-failure.png" }).catch(() => {});
  await browser.close();
  process.exit(1);
});
const lang = () => page.evaluate(() => document.documentElement.lang);
const has = async (text) => (await page.locator(`text=${text}`).count()) > 0;
// async ma'lumotga bog'liq matnlar: kelguncha kutadi (8 s), kelmasa false
const appears = (text) => page.waitForSelector(`text=${text}`, { timeout: 8000 }).then(() => true).catch(() => false);

// ---- Login sahifasi: default uz (brauzer en-US bo'lsa ham)
await page.goto(`${BASE}/login`);
await page.waitForSelector("text=Himoyalangan elektron kutubxona");
check("Default til uz (brauzer en-US bo'lsa ham)", (await has("Kirish")) && (await lang()) === "uz", `lang=${await lang()}`);
check("Til almashtirgich (uz/ru/en) bor", (await page.locator('[role="group"] button').count()) === 3);

// ---- ru
await page.click('[role="group"] button:has-text("ru")');
await page.waitForSelector("text=Защищённая электронная библиотека");
check("ru: sarlavha, tugma, maydonlar", (await has("Войти")) && (await has("Email или телефон")) && (await has("Пароль")));
check("ru: <html lang>", (await lang()) === "ru");
await page.screenshot({ path: OUT + "20-login-ru.png" });

// ---- en + xato xabari
await page.click('[role="group"] button:has-text("en")');
await page.waitForSelector("text=Protected digital library");
check("en: <html lang>", (await lang()) === "en");
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "wrong");
await page.click('button[type="submit"]');
await page.waitForSelector("text=Incorrect login or password", { timeout: 5000 });
check("en: INVALID_CREDENTIALS xato matni inglizcha", true);

// ---- saqlanish (reload)
await page.reload();
await page.waitForSelector("text=Protected digital library");
check("Reload'dan keyin til (en) saqlandi", (await lang()) === "en");

// ---- Login → kutubxona (en) → header
await page.fill('input[autocomplete="username"]', "user@articles365.local");
await page.fill('input[type="password"]', "User12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.waitForSelector("text=My library");
check("en: kutubxona sahifasi + header (Library/Profile/Sign out)", (await has("Library")) && (await has("Profile")) && (await has("Sign out")));
check("en: kitob kartasi 'articles read' / 'Not started'", (await appears("0/3 articles read")) && (await has("Not started")));

// ---- header'dan ru ga o'tish → darhol yangilanadi
await page.click('header [role="group"] button:has-text("ru")');
await page.waitForSelector("text=Моя библиотека");
check("ru: header orqali almashtirish darhol qo'llanadi", (await has("Библиотека")) && (await has("Выйти")) && (await appears("прочитано статей: 0/3")));
await page.screenshot({ path: OUT + "21-library-ru.png" });

// ---- Profil (ru)
await page.click('header a[href="/profile"]');
await page.waitForSelector("text=Сессии и устройства");
check("ru: profil sahifasi", (await has("Личный кабинет")) && (await has("Сохранить")));

// ---- Reader (ru): toolbar, sidebar tablari, sahifa belgilari
await page.goto(`${BASE}/reader/${ART}`);
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 20000 });
check("ru: reader rejim tugmasi", await has("▤ Лента"));
await page.click('button[title="Панель"]');
await page.waitForSelector("text=Оглавление");
check("ru: sidebar tablari", (await has("Закладки")) && (await has("Выделения")) && (await has("Заметки")));
await page.click("text=Закладки");
check("ru: xatcho'p tugmasi interpolyatsiya", await has("Добавить закладку на стр. 1"));
await page.click("text=Добавить закладку на стр. 1");
await page.waitForSelector("text=Закладка на стр. 1 добавлена", { timeout: 5000 });
check("ru: toast interpolyatsiya", true);
await page.screenshot({ path: OUT + "22-reader-ru.png" });

// ---- uz ga qaytish → reader'da til o'zgaradi (localStorage → boshqa tab/sahifa)
await page.evaluate(() => localStorage.setItem("a365.locale", "uz"));
await page.reload();
await page.waitForFunction(() => document.querySelector('[data-page="1"] canvas')?.width > 0, null, { timeout: 20000 });
check("uz: reader qayta ochilganda o'zbekcha", (await has("▤ Scroll")) && (await lang()) === "uz");

// ---- Admin (en): logout → admin login → en
await page.goto(`${BASE}/library`);
await page.click("text=Chiqish");
await page.waitForURL((u) => u.pathname === "/login");
await page.click('[role="group"] button:has-text("en")');
await page.fill('input[autocomplete="username"]', "admin@articles365.local");
await page.fill('input[type="password"]', "Admin12345!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/library`);
await page.goto(`${BASE}/admin/books/${BOOK}`);
await page.waitForSelector("text=Articles (3)", { timeout: 8000 });
check("en: admin kitob sahifasi", (await has("Cover (JPEG/PNG/WebP) ≤ 5 MB")) && (await has("Upload cover")) && (await appears("Granted to (1)")));
await fetch(`${API.replace("/api/v1", "")}/__set500?on=1`);
await page.goto(`${BASE}/admin/audit-logs`);
await page.waitForSelector("text=A server error occurred", { timeout: 8000 });
check("en: 500 xatosi inglizcha", true);
await fetch(`${API.replace("/api/v1", "")}/__set500?on=0`);
await page.goto(`${BASE}/admin/access`);
await page.waitForSelector("text=Book access", { timeout: 8000 });
check("en: ruxsatlar sahifasi + jami", await appears("Total: 1"));
await page.screenshot({ path: OUT + "23-admin-en.png" });

// ---- Lug'at to'liqligi: barcha 3 tilda kalitlar soni teng (tsc ham tekshiradi) — runtime'da placeholder qolmaganini tekshirish
const untranslated = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && /^[a-z]+\.[a-zA-Z.]+$/.test(e.textContent.trim())).map((e) => e.textContent.trim()));
check("Ekranda xom lug'at kaliti yo'q", untranslated.length === 0, untranslated.join(","));

check("Sahifa/hidratsiya xatolari yo'q", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
await browser.close();
console.log(failures ? `\n${failures} ta tekshiruv muvaffaqiyatsiz` : "\nBarcha tekshiruvlar o'tdi");
process.exit(failures ? 1 : 0);
