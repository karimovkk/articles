/**
 * Prod smoke uchun API login — brauzer kabi qurilma kaliti bilan (backend DEVICE_IDENTITY_MODE).
 *  - qurilma: doimiy `X-Device-Id` + `device_secret` + server bergan cookie'lar (`e2e/out/.smoke-device-<nom>.json`);
 *    shunda har ishga tushirish YANGI qurilma bog'lamaydi (limit 2, logout/sessiya o'chirish joy bo'shatmaydi);
 *  - 428 DEVICE_IDENTITY_REQUIRED: javobdagi probe cookie bilan so'rov bir marta takrorlanadi.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../out/", import.meta.url).pathname;

function load(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { deviceId: `fe-smoke-${Math.random().toString(16).slice(2)}`, secret: null, cookies: {} };
  }
}

function keepCookies(state, res) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = line.split(";");
    const [name, ...rest] = pair.trim().split("=");
    const value = rest.join("=");
    const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a));
    if (expired || !value) delete state.cookies[name];
    else state.cookies[name] = value;
  }
}

export async function apiLogin(api, identifier, password, name = "smoke") {
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}.smoke-device-${name}.json`;
  const state = load(file);
  const send = () =>
    fetch(`${api}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": state.deviceId,
        ...(state.secret ? { "X-Device-Secret": state.secret } : {}),
        ...(Object.keys(state.cookies).length ? { Cookie: Object.entries(state.cookies).map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      body: JSON.stringify({ identifier, password, device_name: name }),
    });
  let res = await send();
  keepCookies(state, res);
  if (res.status === 428) {
    res = await send();
    keepCookies(state, res);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${res.status}: ${body?.error?.code ?? "?"}`);
  if (body.device_secret) state.secret = body.device_secret;
  writeFileSync(file, JSON.stringify(state, null, 2));
  return body;
}
