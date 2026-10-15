# Telegram Mini App ⇄ Website: one account, one login: backend logic

> Scope: backend (FastAPI modular monolith, see `ARCHITECTURE.md`) and the small frontend contract for how users log in
> and buy in the **Telegram Mini App** compared with the **website**.
> Conventions as in `API.md`: prefix `/api/v1`, error envelope `{ "error": { "code", "message", "details" } }`,
> phones in **E.164** (`+998901234567`).
>
> **Product decision (2026-10-15):** there is **no phone-number sharing** (`requestContact`) and **no automatic
> Telegram login**. The Mini App is the same website opened inside Telegram. To buy, a user **registers or logs in
> exactly as on the website** (phone + password). Therefore the Mini App and the website share **one account and one
> login method**.
>
> This replaces the earlier draft `TELEGRAM_PHONE_SHARING.md` (see git history). §10 lists what was dropped and why.

---

## 0. TL;DR

1. **One identity:** `phone (or email) + password`. That is the only way to authenticate, everywhere.
2. The Mini App is just another browser (Telegram's webview). It uses the **same pages, endpoints, tokens, device rules**
   as the website. The backend does not need to know whether a request came from Telegram.
3. Guests can **browse** the catalog and read free books in both places. **Buying** (cart checkout, order, paid reading)
   requires login, using the existing `/login?next=…` / `/register?next=…` gate.
4. Telegram's `initData` is **not used for authentication**. No account is ever created automatically from a Telegram identity.
5. The bot is used only for **payment** (existing deep link `?start=<token>`, keyed by `user_id`) and **notifications**.
6. Because there is a single login method, there are **no duplicate accounts, no merges, no phone conflicts** to resolve.
7. There are **no Telegram users yet**, so the old passwordless login is simply deleted. No migration is needed (§8).

---

## 1. Concept

```
            ┌────────────── same Next.js app, same /api/v1 ──────────────┐
 Browser ───┤  /catalog (guest) → Buy → /login?next=/cart → pay via bot   ├── users (phone + password)
 Telegram ──┤  /tg → /catalog (guest) → Buy → /login?next=/cart → pay    │
 (webview)  └─────────────────────────────────────────────────────────────┘
```

| Question | Answer |
|---|---|
| How do I log in in the Mini App? | The same `/login` form: phone + password (+ TOTP if 2FA is on) |
| How do I register in the Mini App? | The same `/register` form: phone + password (+ name) |
| I registered on the website. Can I log in in the Mini App? | Yes, with the same phone and password. Same account, same library and orders |
| I registered in the Mini App. Can I log in on the website? | Yes, with the same phone and password |
| Do I need to share my phone with Telegram? | No. The phone is typed in the register form, as on the website |
| Is the Mini App account different from the website account? | No. There is only one kind of account |

---

## 2. Authentication model

### 2.1 Endpoints used by both surfaces (existing, unchanged)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | `{phone, password, full_name?}` → `UserResponse` (frontend logs in right after) |
| POST | `/auth/login` | `{identifier, password, device_name, totp_code?}` + `X-Device-Secret` → tokens, `device_secret` |
| POST | `/auth/refresh` | rotate refresh token |
| POST | `/auth/logout` | revoke session |
| GET | `/auth/me` | current user |

No Telegram-specific auth endpoint is needed.

### 2.2 Rules (same for both surfaces)

- **Identifier**: phone (E.164, normalized as frontend `normalizePhone`) or email. `UNIQUE` as today.
- **Registration with an existing phone** → `409 ALREADY_EXISTS`. That's the same person, so they should log in instead. The UI links to `/login`.
- **Password policy, lockout, rate limits, 2FA**: identical. The backend doesn't branch on surface.
- **Error codes**: identical (`INVALID_CREDENTIALS`, `DEVICE_NOT_ALLOWED`, `TOTP_REQUIRED`, …).

### 2.3 What the backend must *not* do

- Must **not** create or log in a user from Telegram `initData`, `tg_user_id`, bot `/start`, or a phone number.
- Must **not** trust any Telegram-supplied field (name, username, phone) as identity.
- `POST /auth/telegram/webapp` is **deleted** (§8).

---

## 3. Guest vs. logged-in: where the gate is

| Action | Guest | Logged in |
|---|---|---|
| Browse catalog, book pages, prices | ✅ | ✅ |
| Read free books (`is_free`) | ✅ (as today) | ✅ |
| Add to cart (local cart) | ✅ | ✅ |
| **Checkout / create order / pay** | ❌ → `/login?next=/cart` (or `/register?next=…`) | ✅ |
| Library, paid reading, annotations, vocabulary, streak | ❌ → login | ✅ |
| Profile, devices, sessions | ❌ → login | ✅ |

Backend enforcement is unchanged: every order, library or reader endpoint requires `Bearer`. `401 AUTHENTICATION_REQUIRED`
for guests. The frontend gate is only UX.

**After login, the cart survives**: the cart is local (`src/lib/cart.ts`), so `next=/cart` returns the user to the same
items. The backend recomputes prices on `POST /orders/quote` / `checkout` as today.

---

## 4. Sessions, tokens and devices in the Mini App

### 4.1 Token storage

The Mini App webview has its own `localStorage`, separate from the phone's browser. The frontend keeps tokens and
`device_secret` there exactly like the website (`token-store.ts`).

| Situation | Effect |
|---|---|
| User closes and reopens the Mini App | still logged in (refresh token in webview storage) |
| Telegram clears webview data / user reinstalls Telegram / logs in on another Telegram client | storage gone → must log in again. The `device_secret` is also gone → it counts as a **new device** (§4.2) |
| User logs out in the Mini App | only that session is revoked. The website stays logged in |

*(Optional hardening: Telegram's `SecureStorage` / `DeviceStorage` (Bot API 9.0+) could hold the refresh token and
`device_secret` so they survive webview cache clears. It is purely frontend. The backend contract doesn't change.)*

### 4.2 Device limit ⚠️ (needs a product decision)

With `MAX_DEVICES_PER_USER = 2` (`BACKEND_TASKS.md` part 3), **each surface is a separate device**:

| User has | Devices |
|---|---|
| Phone browser + Mini App on the same phone | **2** (different storage → different `device_secret`) |
| Laptop browser + phone browser + Mini App | **3** → the third gets `403 DEVICE_NOT_ALLOWED` |
| Telegram mobile + Telegram Desktop | 2 |

Options:
- **A (no change):** keep 2. Users who use both the browser and Telegram on one phone use up both slots. Support frees slots via admin.
- **B:** raise the limit to 3.
- **C:** don't count a Mini App device toward the limit. This weakens the anti-sharing rule: anyone can log in via Telegram.

Recommendation: **A or B**. **Don't pick C**: the device limit exists to stop account sharing, and Telegram doesn't change that.
`device_name` for the Mini App: `"Telegram · Android"` / `"Telegram · iOS"` / `"Telegram · Desktop"`, so the user and
admin can tell devices apart in "My devices".

### 4.3 "Open on site" (handoff)

The existing handoff (`POST /auth/telegram/handoff` → `/auth/handoff?token=` → `/handoff/exchange`) only moves an
**already authenticated** session from the Mini App to the phone's browser. It never creates accounts, so it is
compatible with this model. It's optional now: the user can simply log in on the website with the same credentials.
- Keep it: one-time, 120 s, requires `Bearer`. The exchange is subject to the device limit like a normal login.
- Or drop it to simplify. **Recommendation: keep**. It is small and saves typing the password on the phone browser.

---

## 5. Payment through the bot (unchanged, clarified)

1. Logged-in user → order → `POST /orders/{id}/telegram-link` → `{deep_link: t.me/<bot>?start=<token>}`.
2. Inside the Mini App: `openTelegramLink(deep_link)` then `WebApp.close()` (FRONTEND_PLAN §109). On the website the link opens Telegram.
3. Bot `/start <token>` → the token maps to `(user_id, order_id)` → card, receipt, admin approval in the bot.
4. **The order belongs to `token.user_id`**, never to whoever's Telegram is chatting. If someone forwards the link,
   the payment still goes to the right account's order.
5. The bot stores `orders.telegram_chat_id` (and optionally `users.telegram_chat_id`, the last chat that paid) **only to
   send messages** (receipt received, approved, rejected). It has **no authentication meaning**.

Token rules (existing): single use per payment flow, bound to the order, short TTL, only for open orders
(`PENDING`/`AWAITING_REVIEW`).

---

## 6. Telegram data we keep (non-auth)

| Field | Where | Why |
|---|---|---|
| `telegram_chat_id` | `orders` (+ optional `users`, updated on each `/start <token>`) | send payment status messages |
| `telegram_username` | same | admin convenience in the order view |

Nothing from `initData` is stored. If the Mini App frontend still loads the Telegram SDK (for `ready()`, `expand()`,
`MainButton`, `openTelegramLink`, `close()`), `initData` is simply not sent to the backend.

---

## 7. Edge cases

| # | Case | Behavior |
|---|---|---|
| 1 | Guest in Mini App taps "Buy" | `/login?next=/cart`. A link to `/register?next=/cart` is on the same page |
| 2 | User registers in the Mini App, then opens the website | logs in with the same phone + password → same library |
| 3 | User registers on the website, then opens the Mini App | logs in with the same credentials. No new account |
| 4 | User tries to register again in the Mini App with a phone already registered on the website | `409 ALREADY_EXISTS` → "This number is already registered. Log in" |
| 5 | User forgot their password | same as the website today (admin reset; future OTP via `integrations.otp`). There is no Telegram-specific reset |
| 6 | 2FA enabled | the TOTP step works the same in the webview |
| 7 | Device limit reached when logging in from the Mini App | `403 DEVICE_NOT_ALLOWED` + device list, same message as the website |
| 8 | Webview storage cleared | log in again. It may count as a new device (§4.1) |
| 9 | Session revoked on the website (or by admin) | the Mini App gets `401 SESSION_REVOKED` on refresh → login page |
| 10 | Admin blocks the user | `403 ACCOUNT_INACTIVE` on both surfaces |
| 11 | Paid in the bot from another person's Telegram (forwarded link) | order is still credited to the token's `user_id`; status messages go to the paying chat |
| 12 | User opens Mini App in Telegram Web (`web.telegram.org`, iframe) | works. The CSP `frame-ancestors https://web.telegram.org` stays (FRONTEND_PLAN §106.7). Note: some browsers partition iframe storage, so the user may need to log in again there |
| 13 | Same person, two Telegram accounts | irrelevant: the account is the phone + password, not the Telegram account |
| 14 | Password autofill in the webview | may not work (no password manager). The form must allow paste and show/hide password |

---

## 8. Removing the old passwordless Telegram login (no migration)

There are **no Telegram users** in production yet, so nothing has to be preserved. Delete outright:

| Backend item | Action |
|---|---|
| `POST /auth/telegram/webapp` (+ router, schema, `initData` HMAC verification) | delete. A request now gets the framework's `404` |
| `TelegramLoginResponse` fields `created`, `phone_required` | delete |
| Telegram-identity table / `users.telegram_id`-style column, if one was added for the webapp login | drop in a migration (empty) |
| Bot webhook handling of `message.contact` (if any was added) | delete |
| Settings only used for the webapp login (e.g. `initData` max age) | delete |

Keep: the bot webhook for payments, `/orders/{id}/telegram-link`, and `/auth/telegram/handoff` + `/exchange` (§4.3).

Safety check before dropping anything (it should return 0 rows):

```sql
SELECT count(*) FROM users WHERE password_hash IS NULL AND role <> 'ADMIN';
```

If it unexpectedly returns rows (test accounts), deactivate or delete them. They can't log in anymore anyway.

---

## 9. API changes summary

| Change | Endpoint |
|---|---|
| **Delete** | `POST /auth/telegram/webapp` (§8) |
| **Not built** (from the earlier draft) | `/auth/telegram/contact`, `/me/phone*`, `/auth/telegram/link`, `/me/telegram*`, link tokens, login-requests/QR, widget, phone-conflicts admin |
| **Keep** | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/orders/{id}/telegram-link`, bot webhook (payments), `/auth/telegram/handoff` + `/exchange` (optional, §4.3) |
| **Small addition** | store `telegram_chat_id` / `telegram_username` on `/start <token>` (§5–6) |

No new error codes. `TELEGRAM_AUTH_FAILED` is no longer used.

---

## 10. What was dropped and why

| Dropped | Why it isn't needed now |
|---|---|
| Phone sharing via `requestContact`, webhook `contact` handling, signed contact verification | phone is typed in the register form, the same as on the website |
| Automatic account creation from `initData` | it created a second account type with no password, which couldn't log in on the website (the problem raised earlier) |
| Phone conflicts, account merges, shadow accounts | with one login method, the same phone can't end up in two accounts |
| "Connect Telegram" link tokens, bot-confirmed QR login, Login Widget | Telegram no longer identifies the user. Phone + password works on both surfaces |
| Phone verification state (`phone_verified_at`, `phone_source`) | no verification source left (until SMS OTP is introduced) |

Trade-off accepted: one more step for Telegram users (type phone + password once, then stay logged in), in exchange for
**one account model, no duplicates, no merges**, and much less backend code.

---

## 11. Frontend changes: ✅ done (`FRONTEND_PLAN.md` §110)

| File | Change |
|---|---|
| `src/components/telegram/telegram-mini-app.tsx` | removed auto-login (`authApi.telegramWebApp`), the phone card (`requestContact`) and the auth-failed message. Kept: SDK `ready()`/`expand()`, MainButton "Open on site" (shown only when logged in) |
| `src/app/tg/page.tsx` | no longer waits for login. Goes straight to `/catalog` as a guest |
| `src/lib/api/auth.ts`, `types.ts`, `src/lib/telegram.ts` | removed `telegramWebApp`, `TelegramLoginResponse`, `requestContact`. `deviceName()` returns `"Telegram · <OS>"` inside Telegram |
| `src/i18n/dict/*` | removed `tg.loggingIn`, `tg.authFailed`, `tg.phone.*` |
| e2e mock + `telegram-miniapp` test | removed the `/auth/telegram/webapp` mock. The test now covers guest browse → Buy → login → back to the book → MainButton/handoff → order (`openTelegramLink` + `close()`), and asserts `/auth/telegram/webapp` is never called |

Login/register forms already use `PasswordInput` (show/hide, paste works), so no change was needed for the webview.

## 12. Acceptance tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Open Mini App as a new user | catalog visible as a guest. No account created. No phone prompt |
| 2 | Guest taps Buy in the Mini App | redirected to login. After register + login, back in the cart with the same items |
| 3 | Register in the Mini App → log in on the website with the same phone + password | same `user_id`, same library |
| 4 | Register on the website → log in in the Mini App | same `user_id`. No duplicate account |
| 5 | Register in the Mini App with a phone already registered | `409 ALREADY_EXISTS` |
| 6 | Pay via bot from the Mini App | order credited to the logged-in user. Mini App closes, bot chat shows payment steps. Status visible on both surfaces |
| 7 | Logout in the Mini App | website session unaffected |
| 8 | 3rd device (laptop + phone browser + Mini App) with limit 2 | `403 DEVICE_NOT_ALLOWED` (or allowed if the §4.2 decision is B) |
| 9 | `POST /auth/telegram/webapp` | `404` (endpoint deleted). No account created |
| 10 | Backend logs | no `initData`, passwords or full phone numbers |

## 13. Open questions

1. Device limit with the Mini App (§4.2): keep 2 or raise to 3?
2. Keep "Open on site" handoff (§4.3), or drop it for simplicity?
3. Password reset: still admin-only, or plan OTP (SMS) now that phone + password is the only login on both surfaces?
