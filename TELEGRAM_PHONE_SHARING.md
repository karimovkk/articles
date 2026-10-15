# Phone number sharing in the Telegram Mini App — backend logic

> Scope: the backend (FastAPI modular monolith, see `ARCHITECTURE.md`) for the
> **"Share your phone number"** feature of the Telegram Mini App (`FRONTEND_PLAN.md` §106.3,
> `src/components/telegram/telegram-mini-app.tsx`), and how the **website and the Mini App stay one account**
> (§6: handoff, pay deep link, "Connect Telegram", merge, sessions/devices).
> Conventions are the same as in `API.md`: prefix `/api/v1`, error envelope
> `{ "error": { "code", "message", "details" } }`, phones stored in **E.164** (`+998901234567`).

---

## 0. TL;DR

1. The Mini App **never sees the phone number** in `initData`. The only way to get it is
   `Telegram.WebApp.requestContact()`. The user sees a native Telegram dialog, and if they accept,
   **Telegram sends a `contact` message from the user to our bot**. The bot receives it as a webhook update.
2. The backend must accept the phone **only** if `contact.user_id == message.from.id`, meaning it is
   the sender's own number and not a contact card for someone else.
3. A phone is an **attribute** of an account, never a **login key**. Sharing a number must not
   automatically log anyone into, or merge, an existing account that has the same number. Phone numbers get recycled.
4. A conflict ("this number already belongs to another account") is the most important case. It is
   usually the **same person**: they registered on the website with phone + password, then opened the
   Mini App, which created a second, empty account. Resolve it with an **explicit link flow** (password of the old
   account), not automatically.
5. Everything goes through **one idempotent service method**
   (`PhoneService.attach_from_telegram`). It is fed by the webhook (path A, authoritative) and optionally by
   a signed client response (path B, synchronous, removes polling).
6. **The website and the Mini App are two doors into the same account** (§6). Telegram is joined to a website account by
   one-time tokens minted by an already-authenticated side: **handoff** (Mini App → website, exists), and the
   **pay deep link** / **"Connect Telegram"** link token (website → bot or Mini App, new). Telegram login
   then resolves to the same `user_id`, so the library, orders and phone are shared with nothing to sync.

---

## 1. The concept

### 1.1 What Telegram gives us

| Source | Contains phone? | Trust |
|---|---|---|
| `initData` (Mini App launch) | ❌ no: only `user.id`, names, `username`, `language_code`, `photo_url`, `auth_date`, `hash` | signed by Telegram (HMAC with bot token) |
| `WebApp.requestContact(cb)` | ✅ after user consent | the phone goes to the **bot** as a message; `cb(true/false)` in the page |
| Bot chat: `KeyboardButton{request_contact:true}` | ✅ after user taps | same `message.contact` update |
| User manually attaches a contact card in the bot chat | ⚠️ **any** number (a friend's, or a fake one) | `contact.user_id` is missing or ≠ `from.id` → **reject** |

Telegram's phone is **Telegram-verified**: Telegram confirmed the SIM by SMS when the account was created or the number was changed.
It proves "this Telegram account is registered to this number". It does **not** prove that the person controls the SIM
*today*. Numbers get recycled by carriers, and an old Telegram account can outlive the SIM.

### 1.2 Phone sources in our system

| `phone_source` | How | Verified? |
|---|---|---|
| `self_declared` | `POST /auth/register {phone, password}` on the website (no OTP today) | ❌ claimed only |
| `admin` | admin creates or edits a user | ❌ (trusted operator, but not proof of ownership) |
| `telegram` | contact shared from the Mini App or bot | ✅ Telegram-verified |
| `sms_otp` *(future, `integrations.otp`)* | OTP confirmed | ✅ strongest (proves *current* control) |

Rule: **verified beats unverified**, but it never silently takes away an account that has value (purchases, library).

### 1.3 End-to-end flow (today's frontend)

```
Mini App                      Telegram                  Backend
   │ initData ───────────────────────────────────────▶ POST /auth/telegram/webapp
   │ ◀─────────────────────── tokens, phone_required=true
   │ requestContact() ──────▶ native dialog
   │                          user taps "Share"
   │ ◀── cb(true) ──────────  sends message{contact} ─▶ POST /telegram/webhook   (path A)
   │                                                     PhoneService.attach_from_telegram
   │ GET /auth/me (poll ≤6×1.5s) ──────────────────────▶ user.phone filled
```

Path B (recommended addition): on Bot API ≥ 6.9 the `requestContact` callback also gets
`{status, response, responseUnsafe}`. `response` is a **raw signed string**
(`contact=…&auth_date=…&hash=…`) that can be verified with the same HMAC scheme as `initData`.
The client posts it to `POST /auth/telegram/contact`, and the phone is attached synchronously, with no polling.
*Verify the exact field format against current Telegram docs before relying on it. Path A alone is
sufficient, and path B is an optimization.*

---

## 2. Data model

### 2.1 `users` (existing, extended)

| Column | Type | Notes |
|---|---|---|
| `phone` | varchar(16) null | E.164. **Partial unique index** `UNIQUE (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL` |
| `phone_verified_at` | timestamptz null | set when source is `telegram` / `sms_otp` |
| `phone_source` | enum(`self_declared`,`admin`,`telegram`,`sms_otp`) null | |
| `phone_prompt_dismissed_at` | timestamptz null | user tapped "Later". Stop asking across devices for N days |
| `password_hash` | null for Telegram-only accounts | already the case for accounts created by `/auth/telegram/webapp` |
| `status` | + `MERGED` | tombstone after §5 / §6.5 merge |
| `merged_into` | uuid null fk → users | where a merged account's logins resolve (§6.4) |

### 2.2 `telegram_identities` (existing or new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk → users | `UNIQUE` (one TG account ↔ one user) |
| `tg_user_id` | bigint | `UNIQUE`. **The identity key** for Telegram login |
| `username`, `first_name`, `last_name`, `language_code` | | refreshed from every `initData` |
| `contact_phone` | varchar(16) null | last phone Telegram gave us for this TG id (even if not applied to `users`) |
| `contact_received_at` | timestamptz null | |
| `bot_blocked_at` | timestamptz null | bot replies got 403 |
| `linked_via` | enum(`miniapp_created`,`pay_token`,`link_token`,`password_link`,`widget`,`admin`) | how website ⇄ Telegram got joined (§6.3) |
| `linked_at` | timestamptz | |

### 2.3 `telegram_updates` (idempotency)

`update_id bigint PK, received_at`. Insert first, and on conflict stop. Telegram retries webhooks.
Retention is 7 days (cron).

### 2.4 `pending_telegram_contacts`

For contacts that arrive **before** we know the TG user (they shared from the bot chat and never opened the Mini App, or there is a race):
`tg_user_id bigint PK, phone, received_at, expires_at (= +7d)`. Consumed on the first `/auth/telegram/webapp`.

### 2.5 `phone_history` (audit + support)

`id, user_id, old_phone, new_phone, source, reason, actor (user|system|admin:<id>), created_at`.
Stores the **full** numbers (access restricted to admins). Logs never contain the full number.

### 2.6 `phone_conflicts`

| Column | Notes |
|---|---|
| `id`, `created_at`, `resolved_at`, `resolution` (`linked`,`moved`,`kept`,`rejected`,`expired`) | |
| `phone` | |
| `requester_user_id` | the account linked to the TG id that shared the number |
| `holder_user_id` | the account that currently has `users.phone = phone` |
| `holder_verified` | snapshot |
| `resolved_by` | `user` (link flow) / `admin:<id>` |

### 2.7 `telegram_link_tokens` (website → Telegram, §6.3 J3)

`token_hash (sha256) PK, user_id, want_contact bool, created_at, expires_at (+10 min), used_at, used_by_tg_user_id`.
128-bit random, single use, stored hashed. The existing order pay token (J2) is its own table but is consumed by the
same `bind()` (§6.5). Max 5 active link tokens per user. Issuing a new one invalidates the older ones.

---

## 3. Ingestion

### 3.1 Path A: webhook `POST /telegram/webhook`

```python
async def handle_update(update: dict, secret_header: str | None):
    if not hmac.compare_digest(secret_header or "", settings.TELEGRAM_WEBHOOK_SECRET):
        raise PermissionDenied()                       # 403, no body detail
    if not await updates_repo.try_insert(update["update_id"]):
        return                                          # duplicate delivery → no-op (still 200)

    msg = update.get("message")
    if not msg or "contact" not in msg:
        return await other_handlers(update)            # orders/payments, etc.

    if msg["chat"]["type"] != "private":
        return                                          # ignore groups/channels

    contact, sender_id = msg["contact"], msg["from"]["id"]
    if contact.get("user_id") != sender_id:            # foreign/forwarded/manual card
        await bot.reply(msg, t("bot.contact.not_own"))  # "Please use the button to share YOUR number"
        audit("phone.contact_rejected_not_own", tg_user_id=sender_id)
        return

    phone = normalize_e164(contact["phone_number"])    # TG sends "998901234567" or "+998901234567"
    if phone is None or not phone_policy.allowed(phone):
        await bot.reply(msg, t("bot.contact.invalid"))
        return

    result = await phone_service.attach_from_telegram(
        tg_user_id=sender_id, phone=phone, source_ref=f"update:{update['update_id']}"
    )
    await bot.reply(msg, bot_text_for(result))         # best effort; 403 → mark bot_blocked_at
```

Always answer **200** to Telegram (except for a bad secret). Otherwise Telegram retries forever.
Do the heavy work in a background task if processing could exceed a few seconds.

### 3.2 Path B: `POST /auth/telegram/contact` (Bearer, called from the Mini App)

```
Body: { "contact_response": "<raw signed string from requestContact callback>" }
```

1. Verify the HMAC exactly like `initData`:
   `secret = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)`;
   `data_check_string = "\n".join(sorted(f"{k}={v}" for k,v in params if k != "hash"))`;
   `hmac.compare_digest(hex(HMAC_SHA256(secret, data_check_string)), params["hash"])`.
2. `auth_date` is not older than **5 min**, to block replays.
3. `contact.user_id` == the `tg_user_id` linked to the **current session's user**.
   Otherwise `403 CONTACT_NOT_OWN`. This stops replaying someone else's signed contact into your own account.
4. Call the same `attach_from_telegram(...)` and return its result synchronously.
5. Never trust `responseUnsafe`: it is unsigned.

Paths A and B usually **both** fire for one share. Idempotency (§4, case 2) makes the second call a no-op.

### 3.3 Normalization (must match frontend `normalizePhone`)

- strip spaces, `-`, `(`, `)`, `.`; drop a leading `+` or `00`;
- 9 digits → prefix `998` (local Uzbek format);
- `998…` must be exactly 12 digits; any number must be 10–15 digits;
- result is `+<digits>`. Optionally validate with `phonenumbers` (`is_valid_number`).
- `phone_policy.allowed`: configurable allow-list of country codes (default: all). Reject premium or short numbers.

---

## 4. Decision matrix: every possibility

Notation: **T** = TG user id that shared, **U** = account linked to T (`telegram_identities`),
**P** = shared phone (normalized), **O** = another account with `users.phone = P`.

All of this runs inside **one transaction** with `SELECT … FOR UPDATE` on U and on the row with `phone = P`.
On a unique violation (race), re-run the decision once.

| # | Situation | Action | Result code | Bot / UI message |
|---|---|---|---|---|
| 1 | U exists, `U.phone` null, no O | set `phone=P`, `verified_at=now`, `source=telegram`; history | `attached` | "Number saved ✅" |
| 2 | U exists, `U.phone == P` and already verified | nothing (idempotent; this also absorbs the A+B double delivery) | `unchanged` | "Number already saved" |
| 3 | U exists, `U.phone == P` but `self_declared`/`admin` | upgrade: `verified_at=now`, `source=telegram` | `verified` | "Number confirmed ✅" |
| 4 | U exists, `U.phone = P' ≠ P`, no O (user changed their number in Telegram) | replace with P; history `reason=telegram_number_changed`; notify. If U logs in on the website **by phone**, their login identifier changes, so say so in the message | `updated` | "Number updated to +998 •• ••• •• 67. Use the new number to log in on the website" |
| 5 | **O exists and is the same person** (registered on website with P+password, then Mini App auto-created empty U) — *most common conflict* | **don't** move or merge automatically. Create `phone_conflicts`, set `telegram_identities.contact_phone=P`, return conflict with `can_link=true`. The UI offers "**You already have an account with this number — log in to link it**" → §5 link flow | `conflict_linkable` | "This number already has an account. Log in with its password to connect it to Telegram" |
| 6 | O exists, O is linked to **another** TG id T2 (number moved between Telegram accounts: recycled SIM, or the user's second TG account) | don't move. Conflict → admin queue. U keeps no phone | `conflict_admin` | "This number is linked to another Telegram account. Contact support" |
| 7 | O exists, **unverified**, **no value** (no orders, no library items, no sessions in `PHONE_SQUAT_DAYS`=30, never logged in) — likely a typo or a squatter | configurable `PHONE_RELEASE_UNUSED=true`: clear `O.phone` (history `reason=released_to_verified_owner`), O → `status=INACTIVE` if phone was its only identifier; then case 1 for U. Else → case 5 | `attached` / `conflict_linkable` | as 1 / 5 |
| 8 | O exists, **unverified**, **has value** | case 5 (link via O's password). If the user can't log in as O → admin conflict (support checks payment receipts) | `conflict_linkable` | as 5 |
| 9 | O exists and is **verified** (`telegram`/`sms_otp`) and not linked to T | case 6 (admin). Two verified claims mean recycling; a human decides | `conflict_admin` | as 6 |
| 10 | **No U** (contact sent from the bot chat before ever opening the Mini App, or the webhook raced ahead of the first login commit) | upsert `pending_telegram_contacts(T, P)`; applied in `/auth/telegram/webapp` right after the account is found or created (then run this matrix) | `pending` | "Saved. Open the app with the button below" (+ `web_app` button) |
| 11 | U is `BLOCKED`/`INACTIVE`/deleted | ignore, audit only; don't reveal account status | `ignored` | generic "Thanks" |
| 12 | U is `ADMIN` | apply normally, but **always** audit + notify the other admins (phone may be a 2FA/recovery channel later) | per 1–4 | per 1–4 |
| 13 | Contact not the sender's own (`user_id` missing or ≠ `from.id`) | reject (§3.1) | `rejected_not_own` | "Please use the 'Share my number' button" |
| 14 | Invalid or disallowed number | reject | `rejected_invalid` | "This number can't be used" |
| 15 | Duplicate webhook (same `update_id`) | no-op | — | — |
| 16 | User denied the dialog (`cb(false)`) | nothing reaches the backend. Optional `POST /me/phone/prompt-dismiss` → `phone_prompt_dismissed_at` | — | — |
| 17 | `requestContact` unavailable (old client) | frontend hides the card. Optional fallback: `openTelegramLink(t.me/<bot>?start=share_phone)` → bot shows a `request_contact` keyboard → path A | — | — |
| 18 | User **removes** phone (`DELETE /me/phone`) | allowed only if the account still has another way in: a TG identity, or an email+password. Otherwise `409 LAST_IDENTIFIER` | — | — |
| 19 | User deleted their Telegram account | nothing arrives. Phone stays on U. TG login no longer possible. Website login with phone needs a password (§6.2, §7) | — | — |
| 20 | Same number shared again later, after admin resolved a conflict as `kept` (holder kept it) | don't re-open the conflict for 30 days. Reply with the previous resolution | `conflict_admin` | as 6 |

`phone_required` in the `/auth/telegram/webapp` response =
`U.phone is null AND no open conflict AND (phone_prompt_dismissed_at is null OR older than 30d)`.
Add `phone_status: "none" | "verified" | "unverified" | "conflict_linkable" | "conflict_admin" | "pending"`
so the UI can show the right card instead of asking again.

### 4.1 Service sketch

```python
class PhoneService:
    async def attach_from_telegram(self, tg_user_id: int, phone: str, source_ref: str) -> AttachResult:
        async with self.uow() as tx:
            ident = await tx.tg_identities.get_by_tg_id(tg_user_id, for_update=True)
            await tx.tg_identities.remember_contact(tg_user_id, phone)       # even if not applied
            if ident is None:
                await tx.pending_contacts.upsert(tg_user_id, phone, ttl=timedelta(days=7))
                return AttachResult.PENDING

            user = await tx.users.get(ident.user_id, for_update=True)
            if user.status != UserStatus.ACTIVE:
                audit("phone.ignored_inactive", user_id=user.id); return AttachResult.IGNORED

            if user.phone == phone:
                if user.phone_verified_at is None:
                    self._set(user, phone, reason="verified_by_telegram"); return AttachResult.VERIFIED
                return AttachResult.UNCHANGED

            holder = await tx.users.get_by_phone(phone, for_update=True)
            if holder and holder.id != user.id:
                kind = await self._classify_conflict(tx, holder, tg_user_id)
                if kind is ConflictKind.RELEASABLE and settings.PHONE_RELEASE_UNUSED:
                    self._release(holder, reason="released_to_verified_owner")
                else:
                    await tx.conflicts.open_or_touch(phone, requester=user.id, holder=holder.id, kind=kind)
                    return AttachResult.conflict(kind, masked=mask(holder))

            reason = "telegram_number_changed" if user.phone else "attached_from_telegram"
            self._set(user, phone, reason=reason)                          # history + audit + notify
            return AttachResult.UPDATED if reason.endswith("changed") else AttachResult.ATTACHED

    def _set(self, user, phone, reason):
        phone_history.add(user.id, user.phone, phone, source="telegram", reason=reason)
        user.phone, user.phone_source, user.phone_verified_at = phone, "telegram", now()
```

`_classify_conflict`: `LINKED_OTHER_TG` (case 6) · `VERIFIED` (9) · `RELEASABLE` (7) · `LINKABLE` (5/8).
"Value" = any of: orders (any status but `CANCELLED` with no payment), `library_items`, annotations/vocabulary,
a session in the last 30 days.

---

## 5. Link flow (resolving case 5 / 8)

Goal: the person who has an old website account (O) and a fresh Telegram account (U) ends up with **one** account,
O, now reachable from Telegram.

```
POST /auth/telegram/link            (Bearer = U's session from the Mini App)
{ "identifier": "+998901234567", "password": "…", "totp_code": "123456"? }
```

1. Rate limit: 5 attempts / 15 min per U and per identifier (same as login). Lockout reuses the login counters.
2. Authenticate O by `identifier` + `password` (+ TOTP if O has 2FA) **using the normal login checks**
   (status, password hash). Errors: `INVALID_CREDENTIALS`, `TOTP_REQUIRED`, `INVALID_TOTP`, `ACCOUNT_INACTIVE`.
3. O must not already have a TG identity (`409 TELEGRAM_ALREADY_LINKED`).
4. **Merge U → O** in one transaction:
   - move `telegram_identities.user_id` U → O;
   - move U's data if any: `library_items` (dedupe by `book_id`), orders, annotations, vocabulary (dedupe by
     `word_normalized`), reading progress (keep the greater), streaks (keep the max), notifications;
   - `users.phone` of O: set `verified_at=now`, `source=telegram` (the TG holder just proved they own O);
   - devices: U's Mini App device moves to O **only if** O has a free slot (`MAX_DEVICES_PER_USER`). Otherwise
     → `403 DEVICE_NOT_ALLOWED` *before* merging (nothing is changed), with `details.devices` as on login;
   - revoke all U sessions; mark U `status=MERGED`, `merged_into=O.id` (keep the row for the audit and payment trail, no hard delete);
   - resolve `phone_conflicts` → `linked`.
5. Issue new tokens for O (same response shape as `/auth/telegram/webapp`). The frontend swaps tokens.

If U had **paid orders** of its own, the merge still works (orders move). The admin Telegram channel gets a
"accounts merged" message with both ids.

The merge step (4) is the one routine `AccountMergeService.merge(source, target)`. Every flow in §6 that joins
two accounts calls it. It always makes U's open Mini App session fail with `401 ACCOUNT_MERGED`, and the frontend
re-runs the Telegram login, which now resolves to O (§6.7).

---

## 6. Website ⇄ Mini App: one account everywhere

### 6.1 Principle

**One person = one `users` row.** The website (a browser, logging in with phone/email + password) and the Mini App
(Telegram, `initData`) are **two doors into the same account**. All data is keyed by `user_id`: library, orders,
reading progress, annotations, vocabulary, streak, devices, notifications, phone. So when both doors point to
the same user, everything is shared automatically and **nothing needs syncing**.

The backend has one job here: make sure both doors resolve to the same `user_id`. The single place that decides
this is `telegram_identities (tg_user_id → user_id)`.

| Door | What it proves | Resolves user by |
|---|---|---|
| Website login | password (+ TOTP) | phone or email |
| Mini App | Telegram's signature over `initData` | `tg_user_id` → `telegram_identities` |
| Handoff (Mini App → website, existing §106.4) | one-time token minted by an **authenticated Mini App session** | `user_id` in the token |
| Bot deep link `?start=` / Mini App `?startapp=` (website → Telegram) | one-time token minted by an **authenticated website session** | `user_id` in the token |
| *(optional)* "Log in with Telegram" widget on the website | Telegram's signature over the widget payload | `tg_user_id` |

The two token-based doors are mirror images. **Handoff** carries a Telegram-authenticated user to the website.
A **link token** carries a website-authenticated user into Telegram. Together they make the two doors meet.

### 6.2 Account shapes

| Shape | Password | Phone | TG identity | How it arises | Website | Mini App |
|---|---|---|---|---|---|---|
| **W**: website-only | ✓ | ✓ `self_declared` | – | registered on the site | normal login | ⚠️ opening the Mini App without a link token would create a **new** account (J4). Avoid by linking first (J2/J3) |
| **T**: Telegram-only | – | optional `telegram` | ✓ | opened the Mini App first | only via handoff, until a password is set (J1) | automatic login |
| **B**: both (target state) | ✓ | ✓ (ideally verified) | ✓ | linked | login **or** handoff | automatic login |
| **M**: merged (tombstone) | – | – | – | the empty side of a merge | refused: `401 ACCOUNT_MERGED` | resolves to `merged_into` |

Every journey below ends in **B**.

### 6.3 Journeys

```
            ┌───────────── J1: handoff (exists) ─────────────┐
            │                                                  ▼
   Mini App (T) ◀── J3: "Connect Telegram" link token ──  Website (W)
            ▲                                                  │
            └── J2: pay in bot (start=<order token>) ──────────┘
   J4: website user opens Mini App with no token → shadow T → reconciled by phone share (§4 case 5) / J2 / banner
   J5: (optional) Telegram Login Widget on the website → same identity table
```

**J1: Mini App first, then website** (T → B)
1. The user opens the Mini App → T account. They share their phone (§4) → T has a verified phone.
2. "Open on site" → `POST /auth/telegram/handoff` → `/auth/handoff?token=` → `…/handoff/exchange` → logged in on the website.
3. The website profile shows **"Set a password so you can log in with your phone"**:
   `POST /me/password {new_password}` with **no current password**. This is allowed only when `password_hash IS NULL`
   **and** the session is fresh (created ≤ 10 min ago by handoff/Telegram). Otherwise `403 PASSWORD_REAUTH_REQUIRED`.
4. If T has no phone or email, the website asks the user to add one first ("Confirm phone in Telegram" → J3 with `contact`),
   because a password without a login identifier is useless.
5. Now the account is B. The website login with phone + password and the Mini App both resolve to the same `user_id`.

**J2: Website first, pays through the bot** (W → B, mostly silent)
The website's existing pay button calls `POST /orders/{id}/telegram-link`, which gives `t.me/<bot>?start=<token>`. The bot already maps
that token to the user and the order. **Extend the `/start <token>` handler** to also link Telegram, using the binding rules
in §6.5, with `T = message.from.id` and `target = token.user_id`:
- Most of the time, T is unlinked and the target has no TG → **bind silently**. The bot says "Telegram is now connected
  to your Articles365 account. You can also open it here: [Open app]" (a `web_app` button).
- Payment **never depends** on linking. If binding is refused, the order still proceeds keyed by `user_id`.
- Afterwards, opening the Mini App logs straight into the W account: its books and orders are already there.

**J3: Website first, explicit "Connect Telegram"** (W → B)
1. Website profile → "Connect Telegram" → `POST /me/telegram/link-token {contact?: bool}` →
   `{ bot_link: "https://t.me/<bot>?start=link_<tok>", app_link: "https://t.me/<bot>/<app>?startapp=link_<tok>", expires_in: 600 }`.
2. Either door completes it:
   - **Bot**: `/start link_<tok>` → bind (§6.5). If `contact=true`, the bot then shows a `request_contact` keyboard
     ("Confirm your phone") → §4 with U = the website account → the phone becomes `telegram`-verified.
   - **Mini App**: `initData.start_param = "link_<tok>"`. It is inside the signed `initData`, so it can't be tampered with →
     `/auth/telegram/webapp` binds **before** resolving the user (§6.4) → the user lands in their website account,
     and no shadow account is ever created.
3. The website polls `GET /me/telegram` (every 2 s, up to the token's lifetime) → "Connected as @username ✅".

**J4: Website first, opens the Mini App directly** (W + shadow T → B)
`/auth/telegram/webapp` finds no identity → it creates a T account today (`created: true`). Three ways to reconcile it,
whichever comes first:
- the user shares their phone → §4 case 5 → `409 can_link` → §5 password link;
- the user pays from the website through the bot (J2) → the binding rule "T linked to an empty shadow" → **auto-merge** the shadow into W;
- the Mini App shows a banner when `created: true`: **"Already have an account on the website? Log in to connect it"** → §5.
Open question §14.2 proposes asking *before* creating the shadow.

**J5 (optional): "Log in with Telegram" on the website**
`POST /auth/telegram/widget {id, first_name, …, auth_date, hash}`. Note the different secret:
`secret = SHA256(bot_token)` (WebApp uses `HMAC("WebAppData", bot_token)`). It resolves through the same
`telegram_identities`: linked → log in as that user; unlinked → create T (same as the Mini App). This gives a third door
onto the same identity, so a T user never needs a password to use the website.

### 6.4 `/auth/telegram/webapp` resolution (updated)

```python
async def telegram_webapp_login(init_data: str, device_name: str, device_secret: str | None):
    data = verify_init_data(init_data, max_age=timedelta(hours=24))   # 401 TELEGRAM_AUTH_FAILED
    tg = data.user
    async with uow() as tx:
        if (sp := data.start_param or "").startswith("link_"):
            await link_service.consume(tx, token=sp[5:], tg_user_id=tg.id)   # §6.5; errors → soft (login continues)
        ident = await tx.tg_identities.get_by_tg_id(tg.id, for_update=True)
        if ident is None:
            user = await tx.users.create_telegram_only(full_name=tg.full_name)   # shape T
            ident = await tx.tg_identities.bind(tg.id, user.id); created = True
        else:
            user = await tx.users.resolve_merged(ident.user_id); created = False  # follows merged_into
        assert_active(user)                                                     # 403 ACCOUNT_INACTIVE
        await tx.tg_identities.refresh_profile(ident, tg)
        await phone_service.apply_pending(tx, tg.id)                            # §2.4 → §4 matrix
        session = await auth.open_session(tx, user, device=telegram_device(tg.id), ...)  # §6.7
    return TelegramLoginResponse(
        **session.tokens, user=user, created=created,
        phone_required=..., phone_status=..., phone_masked=mask(user.phone),
        has_password=user.password_hash is not None,         # Mini App can hint "set a password on the site"
        link_result=...,                                     # "linked" | "already_linked" | "refused:<code>" | null
    )
```

A failed link token (expired, used, refused) **does not block the login**. The response carries
`link_result: "refused:<code>"` and the Mini App explains it.

### 6.5 Binding rules: `bind(T, target, proof)`

The same rules apply to every way of linking: J2 pay token, J3 link token (bot or `startapp`), the §5 password link, J5 widget.

| T (Telegram account) | Target (website account) | Action | Result |
|---|---|---|---|
| unlinked | has no TG | bind T → target | `linked` |
| linked to target | — | nothing | `already_linked` |
| unlinked | linked to another T2 | refuse. The user must unlink T2 on the website first (§6.8) | `TELEGRAM_ALREADY_LINKED` |
| linked to X ≠ target, **X has no value** (§4.1 definition) | has no TG | `merge(X → target)`, then bind | `linked` (+ `merged`) |
| linked to X ≠ target, **X has value** | has no TG | ask for **explicit confirmation**: a bot inline button "Merge accounts" (callback carries a one-time id) or a Mini App dialog → `merge(X → target)` | `confirm_required` → `linked` |
| linked to X ≠ target | linked to another T2 | refuse → support | `TELEGRAM_ALREADY_LINKED` |
| any | target inactive or merged | refuse | `ACCOUNT_INACTIVE` |

- The **merge target is always the website account** (it holds the password and the login identifier). The Telegram-only side is merged into it.
- Proof is enough because **both sides are authenticated**: Telegram proves T, and the token or password proves the target.
  A phone number alone is never proof (§9).
- **Phone after a merge**: if the target has no phone, it takes X's. If both have phones and they differ, keep the target's and store X's
  in `phone_history` (`reason=merged`). If X's phone was `telegram`-verified and the target's was `self_declared`, the bot asks
  "Use +998 •• ••• •• 67 (from Telegram) as your login number?". The answer goes through §4.

### 6.6 Phone consistency across both doors

- There is one `users.phone`. The website profile shows it with a **"Confirmed via Telegram ✓"** badge when `phone_source=telegram`.
- A phone shared in the Mini App is **immediately** the website login identifier (once a password exists).
- A phone changed in Telegram (§4 case 4) **changes the website login identifier**. Notify the user via the bot, an in-app
  notification, and email if present: "Log in on the website with +998 •• ••• •• 67 from now on".
- Website registration with a phone that already belongs to a T account → `409 ALREADY_EXISTS`. The register page hint says:
  "Used Telegram before? Open the app in Telegram → Open on site".
- Website "Confirm phone" button (for `self_declared`) → J3 with `contact=true`.
- `PATCH /me` phone rules: §7.

### 6.7 Sessions, devices, logout

| Topic | Rule |
|---|---|
| Separate sessions | Website and Mini App sessions are independent rows. Logging out in one doesn't affect the other. "Log out everywhere" revokes both |
| **Device counting** ⚠️ | With `MAX_DEVICES_PER_USER = 2`, a user with a laptop browser, a phone browser **and** Telegram would be blocked. Telegram Desktop and Telegram mobile also have **separate** webview storage, so separate `device_secret`s. **Recommendation:** key the Mini App device by identity, not storage: `device_key = "telegram:" + tg_user_id`. Then all Telegram clients count as **one** device (`initData` already proves who it is). Product decision: §14 |
| Handoff | Creates a session on the **browser's** device. If the browser isn't bound and the limit is reached → `403 DEVICE_NOT_ALLOWED` on `/handoff/exchange` (existing behavior; the handoff page must show the devices message) |
| Merge | All of the source's sessions are revoked with reason `ACCOUNT_MERGED`. The Mini App receives `401 ACCOUNT_MERGED` → clears `a365.tg.login` → re-runs `/auth/telegram/webapp` → lands in the target. A website tab of the source gets the same 401 → login page with "Your accounts were merged, log in with your website credentials" |
| Admin blocks a user | both doors refuse (`ACCOUNT_INACTIVE`); sessions revoked |
| Password changed on the website | revoke the **other website** sessions (existing). Keep the Telegram session (its proof is Telegram, not the password) |

### 6.8 Unlink and switching Telegram accounts

- `DELETE /me/telegram` (website session, requires the current password, + TOTP if enabled). Allowed only if the account
  keeps a way in: a password **and** (phone or email). Otherwise `409 LAST_IDENTIFIER`.
  Effect: delete the identity; revoke Mini App sessions; free the `telegram:<T>` device; audit; bot message to T.
- After unlinking, opening the Mini App with T creates a new T account (J4) unless it arrives with a link token.
- Switching to a new Telegram account = unlink + J3 from the new Telegram.
- Admin: `DELETE /admin/users/{id}/telegram` (e.g. the user lost their Telegram account).

### 6.9 Notifications across doors

- Bot messages (order status, phone change, merge, unlink) go to the linked T. If there is no link, they go in-app only.
- Bot `403` (user blocked the bot) → set `bot_blocked_at`, fall back to in-app. Clear it on the next update from T.
- In-app notifications are per `user_id`, so the same list appears on the website and in the Mini App.

---

## 7. Interactions with existing features

| Feature | Rule |
|---|---|
| **Website login by phone** (`POST /auth/login {identifier: phone}`) for a Telegram-only account (no password) | return `401 INVALID_CREDENTIALS` (same as a wrong password, to avoid enumeration). The login page hint explains "Opened via Telegram? Use **Open on site** in the Mini App" (handoff, §106.4), or "Log in with Telegram" (J5). After handoff the user can set a first password (§6.3 J1) |
| **Website register** with a phone that already exists (any source) | existing `409 ALREADY_EXISTS`. Don't reveal whether it is Telegram-linked |
| **`PATCH /me` phone change** | if the current phone is verified, changing it via `PATCH` is **forbidden** (`403 PHONE_VERIFIED_CHANGE_VIA_TELEGRAM`); change only by re-sharing in Telegram (or OTP in future). If unverified → allowed, stays unverified |
| **Admin edit phone** | allowed, `source=admin`, clears `verified_at`, history `actor=admin:<id>`. If the phone is taken → 409 |
| **Device limit** (`BACKEND_TASKS.md` part 3) | sharing a phone never creates a device or session. Only login/link does |
| **Watermark** (`SECURITY.md`) | uses the masked phone, so the masked value changes when the phone changes. That's fine |
| **Orders via bot** | payment flow keys on `user_id`/`tg_user_id`, **never** on phone |
| **Admin user search** | search by phone uses the normalized E.164 input |

---

## 8. API summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` | path A (contact + other bot updates) |
| POST | `/api/v1/auth/telegram/webapp` | initData | **extended response**: `phone_required`, `phone_status`, `phone_masked` |
| POST | `/api/v1/auth/telegram/contact` | Bearer | path B: `{contact_response}` → `{status, user}` |
| GET | `/api/v1/me/phone` | Bearer | `{phone_masked, verified, source, status, conflict?: {can_link}}`. A cheap poll target if path B isn't used |
| POST | `/api/v1/me/phone/prompt-dismiss` | Bearer | "Later" across devices |
| DELETE | `/api/v1/me/phone` | Bearer | remove (case 18) |
| POST | `/api/v1/auth/telegram/link` | Bearer (TG session) | §5 link flow → new tokens |
| GET | `/api/v1/admin/phone-conflicts` | admin | paginated queue (filter `open`) |
| POST | `/api/v1/admin/phone-conflicts/{id}/resolve` | admin | `{action: "move_to_requester" \| "keep_holder" \| "merge", note}` |
| GET | `/api/v1/admin/users/{id}/phone-history` | admin | history |
| POST | `/api/v1/me/telegram/link-token` | Bearer (website) | §6.3 J3 → `{bot_link, app_link, expires_in}` |
| GET | `/api/v1/me/telegram` | Bearer | `{linked, username, linked_at, linked_via}`. The website polls it after J3 |
| DELETE | `/api/v1/me/telegram` | Bearer (website) + `{password, totp_code?}` | unlink (§6.8) |
| POST | `/api/v1/me/password` | Bearer | **extended**: first password without `current_password` if `password_hash IS NULL` and the session is fresh (§6.3 J1) |
| POST | `/api/v1/auth/telegram/widget` | widget payload | *(optional)* J5 "Log in with Telegram" on the website |
| — | bot `/start link_<tok>` and `/start <pay token>` | webhook | bind (§6.5); merge confirmation via inline-button callback |
| DELETE | `/api/v1/admin/users/{id}/telegram` | admin | admin unlink |

### 8.1 `POST /auth/telegram/contact` responses

| HTTP | Body / code | When |
|---|---|---|
| 200 | `{ "status": "attached" \| "verified" \| "updated" \| "unchanged", "user": User }` | cases 1–4 |
| 202 | `{ "status": "pending" }` | case 10 (should not happen with a session, but it is safe) |
| 409 | `PHONE_LINKED_TO_OTHER_ACCOUNT`, `details: { can_link: bool, holder_masked: "+998 •• ••• •• 67" }` | cases 5–9 |
| 403 | `CONTACT_NOT_OWN` | contact.user_id ≠ session's TG id |
| 401 | `TELEGRAM_AUTH_FAILED` | bad hash or stale `auth_date` |
| 422 | `PHONE_INVALID` | normalization / policy |
| 429 | `RATE_LIMIT_EXCEEDED` | > 10 / hour per user |

New error codes for `src/lib/api/error-codes.ts`: `PHONE_LINKED_TO_OTHER_ACCOUNT`, `CONTACT_NOT_OWN`,
`PHONE_INVALID` (already used client-side), `TELEGRAM_ALREADY_LINKED`, `LAST_IDENTIFIER`,
`PHONE_VERIFIED_CHANGE_VIA_TELEGRAM`, `INVALID_LINK_TOKEN`, `ACCOUNT_MERGED`, `PASSWORD_REAUTH_REQUIRED`,
`MERGE_CONFIRMATION_REQUIRED`.

---

## 9. Security

- **Webhook auth**: `setWebhook(secret_token=…)` and a constant-time compare of `X-Telegram-Bot-Api-Secret-Token`.
  Optionally allow-list Telegram's IP ranges at the proxy.
- **Own-number check** (`contact.user_id == from.id`) is the single most important line. Without it,
  anyone can attach anyone's number by sending a contact card.
- **No phone-based authentication.** A shared phone never issues tokens for an account other than U.
  Linking requires that account's password (+2FA). This defends against recycled numbers and against account
  takeover through a stolen or old Telegram account.
- **Replay** (path B): `auth_date` ≤ 5 min, and bind to the session's TG id.
- **Link tokens** (§2.7): single use, 10 min, hashed at rest, bound to the issuing user. They travel only inside `t.me` links,
  and `start_param` is covered by the `initData` signature. Never put a link or handoff token in logs or `Referer`.
- **Merge** is irreversible in practice: require both sides authenticated (§6.5), confirm explicitly when the source has
  value, keep the tombstone, notify the admin channel.
- **Enumeration**: conflict responses only show a **masked** holder identifier, and only to the verified owner of
  that number (Telegram already proved they own it). Register/login don't say "Telegram account".
- **Rate limits**: contact endpoint 10/h per user. Link endpoint same as login. Webhook contact handling 20/h per
  `tg_user_id` (drop the excess, don't reply).
- **Logging**: never log the full phone, `initData`, or `contact_response`. Use `mask_phone()` → `+99890•••••67`.
  Full numbers live only in `users`, `phone_history`, `phone_conflicts` and `pending_telegram_contacts`.
- **Bot token** rotation invalidates path-B signatures. Path A keeps working after `setWebhook` is re-run.

## 10. Privacy & compliance

- Consent: the native Telegram dialog *is* the consent. The UI text (`tg.phone.body`) states the purpose
  ("saved to your account, not required for buying"). Keep it true: **don't** use the phone for marketing without
  separate opt-in.
- Purpose: account recovery and support identification, plus the website login identifier.
- Retention: `pending_telegram_contacts` 7 days; `telegram_updates` 7 days; `phone_history` for the account's lifetime
  plus the legal retention period. Account deletion → null the phone and anonymize history.
- Uzbekistan's personal-data law (ZRU-547) has **data-localization** requirements for citizens' personal data.
  Confirm with legal where the DB is hosted.
- Export: include phone, source and verified_at in any "my data" export.

## 11. Observability

Audit events (structured, masked): `phone.attached`, `phone.verified`, `phone.updated`, `phone.unchanged`,
`phone.pending_stored`, `phone.pending_applied`, `phone.conflict_opened`, `phone.conflict_resolved`,
`phone.released`, `phone.contact_rejected_not_own`, `phone.contact_rejected_invalid`, `account.merged`.

Metrics: share-prompt shown vs. attached (conversion), conflicts opened per day by kind, median webhook-to-attach
latency, path B signature failures.

Admin Telegram notification on: `conflict_admin`, `account.merged`, admin phone change.

## 12. Frontend contract changes (small)

1. After `requestContact` → `ok`: if `response` exists, `POST /auth/telegram/contact`. Otherwise keep the current
   `/auth/me` polling (6 × 1.5 s), or better, poll `GET /me/phone`.
2. Handle `409 PHONE_LINKED_TO_OTHER_ACCOUNT`: if `can_link`, show "You already have an account with
   {holder_masked}. Log in to connect it" → password (+TOTP) form → `POST /auth/telegram/link` → swap tokens.
   If not, show "Contact support" (bot link).
3. "Later" → also `POST /me/phone/prompt-dismiss`, alongside the existing `localStorage` flag.
4. Use `phone_status` from `/auth/telegram/webapp` instead of only `phone_required`.

Website ⇄ Mini App (§6):

5. **Website profile → "Telegram" card**: not linked → "Connect Telegram" (`POST /me/telegram/link-token`, open
   `app_link` with `openTelegram`/`tgAppLink` like `telegram-pay.tsx`, offer `bot_link` as a fallback) → poll `GET /me/telegram`
   → "Connected as @username". Linked → "Disconnect" (password dialog → `DELETE /me/telegram`).
6. **Website profile → phone**: "Confirmed via Telegram ✓" badge; for `self_declared` show "Confirm in Telegram" (J3 with
   `contact=true`).
7. **Website profile → password**: when `has_password=false` (T account after handoff) → "Set a password to log in with
   your phone" (`POST /me/password` without the current password).
8. **Mini App**: pass `initData` unchanged (it already contains `start_param`); show `link_result`
   ("Connected to your website account ✅" / reason). When `created=true`, show the banner "Already have an account on the
   website? Log in to connect it" → §5 form.
9. **`401 ACCOUNT_MERGED`** anywhere: Mini App → clear `a365.tg.login` and re-run `telegramWebApp(initData)`. Website →
   `/login?reason=merged`.
10. **Handoff page**: handle `403 DEVICE_NOT_ALLOWED` with the same devices message as the login page.
11. **Login/register pages**: hint "Used Telegram before? Open the app in Telegram → Open on site" (+ the J5 widget button if
    enabled).

## 13. Acceptance tests

| # | Scenario | Expected |
|---|---|---|
| 1 | New TG user shares own number | phone set, `source=telegram`, verified; `/auth/me` shows it |
| 2 | Same share delivered by webhook twice + path B | one history row; all return success |
| 3 | User sends a friend's contact card in the bot chat | rejected, phone unchanged, bot explains |
| 4 | Website user (P + password + 1 purchased book) opens Mini App, shares P | 409 `can_link=true`; link with password → one account, the book visible in the Mini App, U marked `MERGED` |
| 5 | Same as 4 but wrong password ×5 | 429 / lockout; nothing merged |
| 6 | Same as 4 but O has 2 devices already | `DEVICE_NOT_ALLOWED`, nothing merged |
| 7 | P held by an unverified account with no activity for 30+ days | released; attached to U; history on both |
| 8 | P held by an account linked to another TG id | `conflict_admin`; admin resolves `move_to_requester` → O loses phone, U gets it, both audited |
| 9 | User changes number in Telegram and re-shares | phone updated; old one in history; website login works with the new number only |
| 10 | Contact arrives before the first Mini App login | stored pending; applied on login; `phone_required=false` |
| 11 | Blocked user shares | ignored; no state change; generic reply |
| 12 | Path B with tampered `contact_response` / 10-min-old `auth_date` / another user's response | 401 / 401 / 403 |
| 13 | Webhook without secret header | 403, nothing processed |
| 14 | Two concurrent shares of the same P by two different TG users | exactly one attached, the other gets a conflict (no 500) |
| 15 | `PATCH /me {phone}` on a verified phone | 403 `PHONE_VERIFIED_CHANGE_VIA_TELEGRAM` |
| 16 | Logs after all the above | no full phone number anywhere |
| 17 | **J1**: Mini App first → share phone → Open on site → set first password → log out → log in on the website with phone + password | same `user_id` as in the Mini App; same library |
| 18 | J1 step "set first password" with a session older than 10 min | 403 `PASSWORD_REAUTH_REQUIRED` |
| 19 | **J2**: website user (no TG) creates an order, opens bot via pay link | order flow works **and** TG is bound; opening the Mini App afterwards lands in the website account (no new account created) |
| 20 | J2 when T already has an **empty** shadow account | shadow merged into the website account automatically; Mini App session gets `ACCOUNT_MERGED` → re-login → website account |
| 21 | J2 when T's account has a purchase | bot asks "Merge accounts?"; on confirm → merged, the purchase is visible in both doors; on ignore → nothing changes, payment still works |
| 22 | **J3** via bot: Connect Telegram → `/start link_<tok>` → share contact | linked; phone `telegram`-verified; website card shows @username |
| 23 | J3 via Mini App `startapp=link_<tok>` on a fresh Telegram account | no shadow created; `created=false`; Mini App opens the website account |
| 24 | Link token reused / expired / tampered `start_param` | `INVALID_LINK_TOKEN` (`link_result` refused); with a tampered `initData` → 401 |
| 25 | J3 when the website account is already linked to T2 | `TELEGRAM_ALREADY_LINKED`; nothing changes |
| 26 | **J4**: website user opens the Mini App directly → banner → password link | one account (§5) |
| 27 | Buy a book on the website → open Mini App (linked) | book is in the Mini App library immediately; progress read in one door shows in the other |
| 28 | Phone changed via Telegram (case 4) | website login with the old phone fails, with the new one works; user notified in bot + in-app |
| 29 | Unlink on the website, then open the Mini App with the same T | new T account created; the old account is unaffected |
| 30 | Unlink on an account with no password | 409 `LAST_IDENTIFIER` |
| 31 | User with laptop + phone browser + Telegram Desktop + Telegram mobile (device key = `telegram:<T>`) | 3 devices counted, not 4. Behavior at limit 2 follows the §14 decision |
| 32 | Admin blocks the user | both website and Mini App logins refused; all sessions revoked |

## 14. Open questions for the product owner

1. Case 7 (auto-release an unused, unverified number): enable by default? What threshold (30 days)?
2. Should the Mini App **stop auto-creating** an account until the user either shares a phone or chooses
   "I'm new"? That would remove most case-5 conflicts at the source, at the cost of one more tap.
3. Should a verified phone become **required** for anything (e.g. paying), or stay optional as the UI says today?
4. Allowed countries: Uzbekistan only, or any?
5. When SMS OTP arrives (`integrations.otp`): should OTP-verified beat Telegram-verified in case 9 automatically?
6. **Device limit vs. Telegram (§6.7)**: count all Telegram clients as one device (`telegram:<tg_user_id>`)? Should the
   Telegram device count toward `MAX_DEVICES_PER_USER = 2` at all, or be exempt (it is bound to a verified Telegram account)?
7. J2 silent linking on payment: OK to link Telegram without asking (the bot just tells the user), or ask first?
8. Enable J5 ("Log in with Telegram" on the website)? It removes the need for passwords for Telegram-first users.
