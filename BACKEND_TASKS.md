# Backend uchun texnik topshiriqlar — Articles365

> ✅ **2026-09-26: 4 qismning hammasi backend'da bajarildi va prod'da jonli** (hisobot:
> `Articles365_BACKEND_TASKS2_Hisobot_v1.0.md`). Frontend haqiqiy endpointlarga o'tdi — `FRONTEND_PLAN.md` §38.
> Quyidagi matn tarix va kontrakt ma'lumoti sifatida qoldirildi.

Bu faylda frontend tayyor bo'lgan, lekin backend'da hali yo'q bo'lgan funksiyalar uchun to'liq topshiriq:

| Qism | Funksiya | Frontend holati | Backend kerak |
|---|---|---|---|
| [1-qism](#1-qism-lugat-vocabulary) | **Lug'at** — PDF'dan so'z qo'shish, tarjima, takrorlash | tayyor, **jonli saytda ishlaydi** (vaqtinchalik — annotatsiyalar orqali) | alohida `/me/vocabulary` API (tezlik, qidiruv, statistika) |
| [2-qism](#2-qism-savatcha-va-kop-kitobga-chegirma) | **Savatcha va ko'p kitobga chegirma** — 2 ta kitob donasi 39 000, 3+ — 30 000 | tayyor va testlangan (mock), **jonli saytda backend kutilmoqda** — `GET /pricing` paydo bo'lishi bilan o'zi yoqiladi | `pricing`, `orders/quote`, `orders/checkout`, `order_items` |
| [3-qism](#3-qism-akkauntni-2-ta-qurilmaga-boglash) | **Akkaunt faqat 2 ta qurilmada** — chiqib-kirish bilan 3-qurilma kira olmaydi, almashtirish faqat admin orqali | backend tayyor bo'lgach: xabarlar, "Qurilmalarim", admin sahifasi (§3.10) | `user_devices`, login algoritmi, admin endpointlari |
| [4-qism](#4-qism-tekin-kitoblar--royxatdan-otmasdan-oqish) | **Tekin kitoblar** — admin "Tekin kitob"ni yoqsa narx yozilmaydi; ro'yxatdan o'tmagan mehmon ham o'qiy oladi | tayyor va testlangan (mock); jonli saytda `is_free` va mehmon uchun ochiq reader endpointlari kutilmoqda | `books.is_free`, anonim reader endpointlari, buyurtmani rad etish |

Umumiy konvensiyalar `API.md` dagidek: prefiks `/api/v1`, `Authorization: Bearer`, sahifalash konverti
`{ items, page, page_size, total, pages }`, xato konverti `{ "error": { "code", "message", "details" } }`, narxlar —
satr (`"49000.00"`), valyuta — UZS.

---

# 1-qism. Lug'at (Vocabulary)

> **Holat:** frontend to'liq tayyor va ishlab turibdi (2026-09-25). Hozir u vaqtinchalik yechim bilan — mavjud
> annotatsiya API'si orqali — ishlaydi. Ushbu qism backend'da **alohida lug'at API'si** qurish uchun: nima,
> nima uchun, qanday va qaysi tartibda.
>
> **Frontend kontakti:** barcha lug'at so'rovlari bitta faylda — `src/lib/api/vocabulary.ts`. Backend tayyor bo'lgach
> faqat shu fayl almashadi; sahifalar va komponentlarga tegilmaydi.

---

## 1.1. Nima uchun qurilyapti (maqsad)

Articles365 foydalanuvchilari kitob va maqolalarni (ko'pincha ingliz yoki rus tilida) himoyalangan PDF reader'da
o'qiydi. O'qish paytida notanish so'zlar uchraydi. Maqsad — **o'qishni til o'rganishga aylantirish**:

1. Foydalanuvchi PDF ichida so'z yoki iborani belgilaydi va **"Lug'atga"** tugmasini bosadi.
2. So'z uning **shaxsiy lug'atiga** tushadi: so'z, **tarjima** (ixtiyoriy — o'zi yozadi), so'z uchragan **gap
   (kontekst)** va **manba** (qaysi kitob, qaysi maqola, qaysi bet).
3. **`/vocabulary` sahifasi**da barcha so'zlarini ko'radi: qidiradi, kitob/holat bo'yicha filtrlaydi, tarjimani
   tahrirlaydi, "o'rgandim" deb belgilaydi, talaffuzini tinglaydi, CSV'ga eksport qiladi.
4. **"PDF'da ochish"** tugmasi so'zni o'sha maqolaning o'sha betida ochadi va so'zni vaqtincha bo'rttiradi —
   foydalanuvchi so'zni asl kontekstida qayta ko'radi.
5. **"Takrorlash"** (flashcards): kartada so'z → aylantirilsa tarjima; "Bilaman" — so'z o'rganilgan deb belgilanadi.
6. Reader'da lug'atdagi so'zlar PDF ustida **nuqtali chiziq** bilan belgilanadi; bosilsa tarjima ko'rinadi.

**Biznes qiymati:** foydalanuvchi platformaga qaytib keladi (o'z lug'ati shu yerda), sotib olingan kitoblar qiymati
oshadi, keyinchalik takrorlash eslatmalari, statistika, "kunlik so'z" kabi funksiyalar uchun asos bo'ladi.

---

## 1.2. Hozir qanday ishlayapti (vaqtinchalik yechim) va muammolari

Backend'da lug'at API'si yo'q (OpenAPI 1.0.0 tekshirildi), shuning uchun frontend so'zlarni **mavjud annotatsiya
endpointlari** orqali saqlaydi:

| Annotatsiya maydoni | Lug'atdagi ma'nosi |
|---|---|
| `type` | har doim `"NOTE"` |
| `label` | har doim `"vocab"` (oddiy eslatmalardan ajratish uchun) |
| `selected_text` | so'z / ibora |
| `note_text` | tarjima (bo'sh bo'lishi mumkin) |
| `page` | bet raqami (1 dan) |
| `location_data` | `{ "kind": "vocab", "v": 1, "book_id", "book_title", "article_title", "context", "rects", "learned", "learned_at" }` |

Ishlatilayotgan endpointlar: `GET/POST /api/v1/articles/{article_id}/annotations`,
`PATCH/DELETE /api/v1/articles/{article_id}/annotations/{annotation_id}`.

**Muammolar (nega alohida API kerak):**

1. **Hamma so'zlarni bitta so'rovda olib bo'lmaydi.** Annotatsiyalar faqat maqola bo'yicha olinadi. Lug'at sahifasi
   uchun frontend: `GET /library` (barcha kitoblar) → har kitob uchun `GET /reader/books/{id}/articles` → har
   maqola uchun `GET /articles/{id}/annotations?type=NOTE`. 10 ta kitob × 5 maqola = **~60 ta so'rov**. Buni
   yumshatish uchun brauzerda "so'z bor maqolalar" indeksi saqlanadi (12 soat), lekin yangi qurilmada yoki boshqa
   qurilmada qo'shilgan so'zlar uchun baribir to'liq skan kerak.
2. **Qidiruv, filtr, saralash, sahifalash — hammasi brauzerda.** So'zlar ko'paysa (yuzlab/minglab) sekinlashadi.
3. **Statistika** (jami, o'rganilgan, bu hafta) ham brauzerda hisoblanadi.
4. **Dublikat nazorati** faqat frontend'da (bir maqola ichida). Server darajasida kafolat yo'q.
5. **Ma'no aralashuvi:** lug'at so'zlari `NOTE` sifatida saqlanadi — boshqa klientlar (masalan, kelajakdagi mobil
   ilova, admin statistikasi) ularni oddiy eslatma deb hisoblashi mumkin.
6. **Kitob/maqola nomi so'zga nusxa sifatida yozilgan** — kitob nomi o'zgarsa, lug'atda eski nom qoladi.

---

## 1.3. Taklif: alohida resurs `vocabulary`

### 1.3.1. Ma'lumot modeli — `vocabulary_entries` jadvali

| Ustun | Turi | Majburiy | Izoh |
|---|---|---|---|
| `id` | UUID | ha | PK |
| `user_id` | UUID → `users.id` | ha | egasi; `ON DELETE CASCADE` |
| `article_id` | UUID → `articles.id` | ha | so'z qaysi maqoladan olingan |
| `book_id` | UUID → `books.id` | ha | `article.book_id` dan yoziladi (filtr va join uchun) |
| `word` | varchar(120) | ha | so'z yoki ibora, foydalanuvchi yozganicha (katta-kichik harf saqlanadi) |
| `word_normalized` | varchar(120) | ha | dublikat va qidiruv uchun: kichik harf, chetdagi tinish belgilari va ortiqcha bo'shliqlar olib tashlangan (§1.3.5) |
| `translation` | varchar(500) | yo'q | tarjima |
| `context` | varchar(500) | yo'q | so'z uchragan gap (PDF matn qatlamidan, frontend oladi) |
| `page` | int ≥ 1 | yo'q | bet raqami |
| `rects` | JSONB | yo'q | PDF'dagi joylashuv: `[[x, y, w, h], ...]` — sahifaga nisbatan 0–1 ulushlar (highlight'lardagi bilan bir xil format), ≤ 200 element |
| `learned` | boolean | ha | default `false` |
| `learned_at` | timestamptz | yo'q | `learned` true bo'lgan payt; false bo'lsa `null` |
| `created_at` | timestamptz | ha | |
| `updated_at` | timestamptz | ha | |

**Cheklov va indekslar:**

- `UNIQUE (user_id, article_id, word_normalized)` — bir maqoladan bir so'z bir marta.
  (Turli maqolalardan bir xil so'z — ruxsat: konteksti boshqa.)
- `INDEX (user_id, created_at DESC)` — asosiy ro'yxat.
- `INDEX (user_id, article_id)` — reader: maqoladagi so'zlar.
- `INDEX (user_id, book_id)` — kitob filtri.
- `INDEX (user_id, learned)` — holat filtri.
- Qidiruv uchun (ixtiyoriy, so'zlar ko'p bo'lsa): `pg_trgm` GIN indeksi `word_normalized` va `lower(translation)` bo'yicha.

### 1.3.2. Endpointlar

Hammasi `Authorization: Bearer` talab qiladi, faqat **o'z** yozuvlari bilan ishlaydi. Konvensiyalar `API.md` dagi
bilan bir xil (pagination konverti, xato konverti).

| Method | Path | Maqsad |
|---|---|---|
| GET | `/api/v1/me/vocabulary` | Lug'at ro'yxati (qidiruv, filtr, saralash, sahifalash) |
| GET | `/api/v1/me/vocabulary/stats` | Statistika: jami, o'rganilgan, oxirgi 7 kunda qo'shilgan, kitoblar ro'yxati |
| POST | `/api/v1/me/vocabulary` | So'z qo'shish |
| GET | `/api/v1/me/vocabulary/{entry_id}` | Bitta so'z |
| PATCH | `/api/v1/me/vocabulary/{entry_id}` | So'z / tarjima / kontekst / `learned` ni o'zgartirish |
| DELETE | `/api/v1/me/vocabulary/{entry_id}` | O'chirish |
| GET | `/api/v1/articles/{article_id}/vocabulary` | Reader uchun: shu maqoladagi o'z so'zlari (sahifalashsiz, `page` bo'yicha) |

#### `GET /api/v1/me/vocabulary`

Query parametrlari (hammasi ixtiyoriy):

| Parametr | Turi | Izoh |
|---|---|---|
| `search` | string | `word` yoki `translation` ichida (katta-kichik harfsiz) |
| `book_id` | UUID | kitob filtri |
| `article_id` | UUID | maqola filtri |
| `learned` | boolean | `true` — o'rganilgan, `false` — o'rganilmoqda; berilmasa — hammasi |
| `sort` | `newest` \| `oldest` \| `alpha` | default `newest` (`created_at DESC`); `alpha` — `word_normalized ASC` |
| `page`, `page_size` | int | standart sahifalash (page_size ≤ 100) |

Javob `200`:

```json
{
  "items": [
    {
      "id": "7c0e…",
      "word": "quick",
      "translation": "tez, chaqqon",
      "context": "Page 1: The quick brown fox jumps over the lazy dog.",
      "page": 1,
      "rects": [[0.1834, 0.1069, 0.0721, 0.0274]],
      "learned": false,
      "learned_at": null,
      "article_id": "aaaaaaaa-…",
      "article_title": "Birinchi maqola",
      "book_id": "11111111-…",
      "book_title": "Test kitob",
      "created_at": "2026-09-25T10:12:00Z",
      "updated_at": "2026-09-25T10:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 24,
  "total": 1,
  "pages": 1
}
```

`article_title` va `book_title` — **join orqali joriy nom** (nusxa emas). Maqola yoki kitob o'chirilgan bo'lsa —
`null` (yozuv o'chirilmaydi, §1.3.4).

#### `GET /api/v1/me/vocabulary/stats`

```json
{
  "total": 42,
  "learned": 17,
  "added_last_7_days": 6,
  "books": [
    { "book_id": "11111111-…", "title": "Test kitob", "count": 30 },
    { "book_id": "22222222-…", "title": "Boshqa kitob", "count": 12 }
  ]
}
```

`books` — frontend'dagi "Barcha kitoblar" filtri uchun (faqat so'zi bor kitoblar).

#### `POST /api/v1/me/vocabulary`

So'rov:

```json
{
  "article_id": "aaaaaaaa-…",
  "word": "quick",
  "translation": "tez",
  "context": "Page 1: The quick brown fox jumps over the lazy dog.",
  "page": 1,
  "rects": [[0.1834, 0.1069, 0.0721, 0.0274]]
}
```

- Majburiy: `article_id`, `word`. Qolganlari ixtiyoriy.
- `book_id` so'rovda **yuborilmaydi** — server `article.book_id` dan oladi.
- Javob: `201` + to'liq yozuv (GET dagi shakl).
- Dublikat (`user_id, article_id, word_normalized` mavjud): **`409 VOCAB_DUPLICATE`**,
  `details: { "entry_id": "<mavjud yozuv id>" }` — frontend foydalanuvchiga "allaqachon bor" deydi va mavjudining
  tarjimasini `PATCH` bilan yangilaydi. (Muqobil: `?upsert=true` bilan mavjudini yangilab `200` qaytarish — qaysi biri
  qulay bo'lsa, lekin OpenAPI'da aniq yozilsin.)

#### `PATCH /api/v1/me/vocabulary/{entry_id}`

Yuborilgan maydonlargina o'zgaradi: `word`, `translation`, `context`, `learned`.

- `learned: true` → server `learned_at = now()` qo'yadi; `learned: false` → `learned_at = null`.
- `translation: null` yoki `""` → tarjima tozalanadi.
- `word` o'zgarsa `word_normalized` qayta hisoblanadi va unique tekshiriladi (`409 VOCAB_DUPLICATE`).
- `article_id`, `page`, `rects` — o'zgarmaydi (so'z joyi o'zgarmas).

Javob: `200` + to'liq yozuv.

#### `DELETE /api/v1/me/vocabulary/{entry_id}`

Javob: `200 { "message": "Vocabulary entry deleted" }` (yoki `204` — boshqa DELETE'lar bilan bir xil bo'lsin).

#### `GET /api/v1/articles/{article_id}/vocabulary`

Reader maqolani ochganda PDF ustiga belgilarni chizish va sidebar'dagi "Lug'at" tabi uchun. Javob — massiv (sahifalashsiz,
`page ASC, word_normalized ASC`), elementlar GET ro'yxatdagi shaklda. Maqolaga ruxsat talab qilinadi (reader bilan
bir xil: `BOOK_ACCESS_DENIED` 403).

### 1.3.3. Validatsiya (`422 VALIDATION_ERROR`)

| Maydon | Qoida |
|---|---|
| `word` | trim'dan keyin 1–120 belgi |
| `translation` | ≤ 500 belgi |
| `context` | ≤ 500 belgi |
| `page` | ≥ 1; maqolaning `page_count` idan oshmasin |
| `rects` | ≤ 200 element; har biri 4 ta son, 0 ≤ qiymat ≤ 1 |
| `learned` | boolean |

### 1.3.4. Ruxsatlar va biznes qoidalari

1. **Yaratish** (`POST`): foydalanuvchida shu maqola kitobiga **faol ruxsat** bo'lishi shart (annotatsiyalar bilan
   bir xil tekshiruv) — aks holda `403 BOOK_ACCESS_DENIED`. Maqola `READY` bo'lishi kerak.
2. **O'qish/tahrirlash/o'chirish** (`GET/PATCH/DELETE /me/vocabulary`): faqat egasi (`404 VOCAB_NOT_FOUND` —
   boshqaning yozuvi haqida ma'lumot oshkor qilinmasin). Ruxsat keyinchalik bekor qilinsa ham foydalanuvchi o'z
   so'zlarini **ko'ra, tahrirlay va o'chira oladi** (bu uning o'z ma'lumoti); faqat "PDF'da ochish" ishlamaydi —
   reader o'zi 403 qaytaradi, frontend buni ko'rsatadi.
3. Maqola yoki kitob **o'chirilsa**: yozuvlar o'chirilmaydi; `article_title`/`book_title` → `null`
   (FK `ON DELETE SET NULL` yoki soft-delete — backend qanday qilgan bo'lsa). Frontend "—" ko'rsatadi.
4. **Foydalanuvchi o'chirilsa** — yozuvlari ham o'chadi (`CASCADE`).
5. **Limit** (tavsiya): foydalanuvchiga 10 000 ta so'z; oshsa `409 VOCAB_LIMIT_REACHED`. Rate-limit: `POST` —
   daqiqasiga 60 ta.
6. **Kontent himoyasi:** `context` — kitob matnidan parcha. Uzunligi 500 belgi bilan cheklangan va faqat egasiga
   ko'rinadi (highlight'lardagi `selected_text` bilan bir xil tamoyil, u yerda cheklov 20 000). Admin
   statistikasi/eksportida `context` chiqarilmasin.

### 1.3.5. `word_normalized` qoidasi (frontend bilan bir xil bo'lishi kerak)

```
1. Kichik harfga (locale-aware lowercase)
2. ʻ ʼ ‘ ’ ` → '   (o'zbek apostroflari bir xil bo'lsin)
3. Chetdagi bo'shliq va tinish belgilarini olib tashlash:  " ' « » “ ” . , ; : ! ? ( ) [ ] { } — – -
4. Ichkaridagi ketma-ket bo'shliqlarni bittaga
```

Frontend'dagi amaliyot: `normalizeWord()` — `src/lib/api/vocabulary.ts`.

### 1.3.6. Xato kodlari

| HTTP | `code` | Qachon |
|---|---|---|
| 401 | `AUTHENTICATION_REQUIRED` | token yo'q/eskirgan |
| 403 | `BOOK_ACCESS_DENIED` | maqola kitobiga ruxsat yo'q (POST, `/articles/{id}/vocabulary`) |
| 404 | `VOCAB_NOT_FOUND` | yozuv yo'q yoki boshqa foydalanuvchiniki |
| 404 | `ARTICLE_NOT_FOUND` | `article_id` noto'g'ri |
| 409 | `VOCAB_DUPLICATE` | shu maqoladan bu so'z bor; `details.entry_id` |
| 409 | `VOCAB_LIMIT_REACHED` | limit tugagan |
| 422 | `VALIDATION_ERROR` | §1.3.3 |
| 429 | `RATE_LIMIT_EXCEEDED` | juda tez qo'shish |

---

## 1.4. Mavjud ma'lumotni ko'chirish (migratsiya) — MUHIM

Frontend 2026-09-25 dan beri so'zlarni annotatsiya sifatida saqlayapti. Yangi API ishga tushganda **bu so'zlar
yo'qolmasligi kerak**. Migratsiya (bir martalik skript, deploy bilan birga). SQL — namuna: jadval/ustun nomlari
(`annotations.user_id` va h.k.) backend'dagi haqiqiy sxemaga moslashtirilsin:

```sql
INSERT INTO vocabulary_entries
  (id, user_id, article_id, book_id, word, word_normalized, translation, context, page, rects,
   learned, learned_at, created_at, updated_at)
SELECT
  a.id,                                   -- id saqlanadi (frontend'dagi havolalar buzilmaydi)
  a.user_id,
  a.article_id,
  ar.book_id,
  left(trim(a.selected_text), 120),
  normalize_word(a.selected_text),        -- §1.3.5 dagi funksiya
  nullif(left(a.note_text, 500), ''),
  nullif(left(a.location_data->>'context', 500), ''),
  a.page,
  a.location_data->'rects',
  coalesce((a.location_data->>'learned')::boolean, false),
  (a.location_data->>'learned_at')::timestamptz,
  a.created_at,
  a.updated_at
FROM annotations a
JOIN articles ar ON ar.id = a.article_id
WHERE a.type = 'NOTE' AND a.label = 'vocab' AND a.selected_text IS NOT NULL
ON CONFLICT (user_id, article_id, word_normalized) DO NOTHING;
```

Keyin shu annotatsiyalar **o'chiriladi** (yoki `label` → `vocab_migrated` qilib qoldiriladi va keyinroq o'chiriladi).

**Tartib:**

1. Backend: jadval + endpointlar + migratsiya skripti — staging'da.
2. Frontend: `src/lib/api/vocabulary.ts` yangi endpointlarga o'tkaziladi (mock va e2e testlar tayyor — §1.6).
3. Bir vaqtda deploy: avval backend (migratsiya bilan), keyin frontend. Oraliqda eski frontend annotatsiyalar bilan
   ishlashda davom etadi — migratsiya `ON CONFLICT DO NOTHING` bilan qayta ishga tushirilsa oraliqda qo'shilganlar
   ham ko'chadi.

---

## 1.5. Minimal alternativa (agar to'liq API hozir qimmat bo'lsa)

Faqat bitta endpoint: **`GET /api/v1/me/annotations`** — foydalanuvchining barcha maqolalar bo'yicha
annotatsiyalari, filtrlar: `type`, `label`, `page`, `page_size`; har elementda `article_title`, `book_id`,
`book_title`. Bu frontend'dagi ~60 ta so'rovni bittaga tushiradi (asosiy muammo №1). Qidiruv/filtr/statistika
brauzerda qoladi. Lekin uzoq muddatda §1.3 tavsiya etiladi.

---

## 1.6. Frontend tomonda nima tayyor (ma'lumot uchun)

- **Reader:** tanlov panelida "Lug'atga" → oyna (so'z, tarjima, kontekst avtomatik); dublikat ogohlantirishi;
  PDF'da nuqtali belgi va tarjima oynasi; sidebar'da "Lug'at" tabi; `/reader/{article_id}?page=N&word=…` — o'sha
  bet va so'z bo'rttirilishi.
- **`/vocabulary` sahifasi:** statistika, qidiruv, kitob/holat filtri, saralash, tarjima qo'shish/tahrirlash,
  o'rgandim, o'chirish, talaffuz (brauzer TTS), CSV eksport, takrorlash (flashcards), telefon/planshet/TV.
- **Kod:** `src/lib/api/vocabulary.ts` (ma'lumot qatlami — **yagona almashtiriladigan fayl**),
  `src/app/(app)/vocabulary/page.tsx`, `src/components/vocabulary/*`, reader'da `reader-view.tsx`, `pdf-viewer.tsx`.
- **Testlar:** `e2e/tests/vocabulary.test.mjs` (28 tekshiruv). Mock backend `e2e/mock/server.mjs` — yangi endpointlar
  shu faylga qo'shiladi, testlar o'zgarmay qoladi (ular UI'ni tekshiradi).

Frontend'dagi maydonlar ↔ yangi API:

| Frontend (`VocabEntry`) | Yangi API |
|---|---|
| `id` | `id` |
| `articleId` | `article_id` |
| `bookId` / `bookTitle` / `articleTitle` | `book_id` / `book_title` / `article_title` |
| `word` / `translation` / `context` | `word` / `translation` / `context` |
| `page` / `rects` | `page` / `rects` |
| `learned` / `learnedAt` | `learned` / `learned_at` |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` |

---

## 1.7. Qabul qilish mezonlari (backend tayyor deb hisoblanishi uchun)

- [ ] `vocabulary_entries` jadvali, unique va indekslar (§1.3.1).
- [ ] 7 ta endpoint (§1.3.2) OpenAPI'da (`/openapi.json`) sxemalari bilan.
- [ ] Validatsiya va xato kodlari (§1.3.3, §1.3.6) — `VOCAB_DUPLICATE` da `details.entry_id`.
- [ ] Ruxsat qoidalari (§1.3.4): boshqa foydalanuvchi yozuvi → 404; ruxsatsiz kitob → POST 403; ruxsat bekor
      qilinsa ham o'z so'zlari ro'yxatda qoladi.
- [ ] `word_normalized` §1.3.5 bo'yicha (o'zbek apostroflari bilan).
- [ ] Migratsiya skripti (§1.4) staging'da sinalgan: annotatsiya → lug'at, `id` saqlangan.
- [ ] Unit/integration testlar: CRUD, dublikat, filtr (`search`, `book_id`, `learned`), saralash, sahifalash,
      statistika, ruxsatlar.
- [ ] Javob vaqti: `GET /me/vocabulary` 1 000 ta so'zda < 200 ms (indekslar bilan).
- [ ] `API.md` ga bo'lim qo'shilgan.

Savollar bo'lsa — frontend jamoasi: `FRONTEND_PLAN.md` 33-bo'lim va B30 eslatmasi.

---

# 2-qism. Savatcha va ko'p kitobga chegirma

> **Holat (2026-09-26):** frontend to'liq tayyor va e2e testlardan o'tgan (mock backend bilan). Jonli saytda savatcha
> **hozircha ko'rinmaydi**: frontend `GET /api/v1/pricing` ni so'raydi, u 404 qaytargani uchun savatcha, "Savatga"
> tugmalari va aksiya banneri yashiriladi — eski "Sotib olish" (bitta kitob) oqimi o'zgarmay ishlayveradi.
> Backend quyidagi endpointlarni chiqarishi bilan savatcha **frontend'ni qayta deploy qilmasdan** yoqiladi.
>
> **Namuna implementatsiya:** `e2e/mock/server.mjs` (`quoteFor`, `/pricing`, `/orders/quote`, `/orders/checkout`) —
> xuddi shu qoidalar bilan ishlaydi, frontend testlari (`e2e/tests/cart.test.mjs`, 22 tekshiruv) unga qarshi o'tadi.

## 2.1. Nima uchun (maqsad)

Hozir har bir kitob alohida sotib olinadi: bitta buyurtma = bitta kitob = alohida to'lov va chek. Maqsad:

1. **O'rtacha chek summasini oshirish** — foydalanuvchi bir nechta kitobni birga oladi, har biri arzonroq tushadi.
2. **Qulaylik** — bir marta to'lov, bitta chek, admin bitta buyurtmani tasdiqlaydi (hamma kitoblarga ruxsat birdan).
3. **Tanish tajriba** — "savatga qo'shish" (add to cart) internet-do'konlardagidek: katalogda "Savatga", header'da
   savatcha soni, `/cart` sahifasi, "Buyurtma berish".

## 2.2. Narx qoidasi (biznes qoidasi)

> ⚠️ **Kitob narxi — admin kiritgan narx.** Har bir kitobning narxi (`books.price`) admin yaratish/tahrirlash
> formasida qanday yozsa, katalogda, kitob sahifasida, savatchada va buyurtmada **aynan shunday** ko'rinadi.
> 49 000 — faqat misol (hozir ko'p kitoblar shu narxda). Backend hech qayerda standart narx (49 000 yoki boshqa)
> qo'ymaydi, narxni almashtirmaydi va yaxlitlamaydi. Pog'ona narxlari (39 000 / 30 000) faqat **savatchada 2 ta va
> undan ko'p kitob** olinganda, faqat yuqori chegara sifatida ishlaydi (quyidagi jadval).

Misol uchun hamma kitob 49 000 bo'lsa. Bitta buyurtmadagi **pullik** kitoblar soniga qarab:

| Buyurtmada kitoblar | Har kitob narxi | Misol: 49 000 lik kitoblar | Tejash |
|---|---|---|---|
| 1 ta | kitobning o'z narxi | 49 000 | — |
| 2 ta | **39 000** dan oshmaydi | 2 × 39 000 = **78 000** | 20 000 (−20%) |
| 3 va undan ko'p | **30 000** dan oshmaydi | 3 × 30 000 = **90 000**; 5 × 30 000 = 150 000 | 3 ta: 57 000 (−39%) |

**Formal ta'rif:**

```
q          = buyurtmadagi PULLIK kitoblar soni (narxi > 0; takrorlar olib tashlangan)
tier       = pricing_tiers ichidan min_quantity ≤ q bo'lgan ENG KATTA pog'ona (yo'q bo'lsa — chegirma yo'q)
unit_price = tier bo'lsa  min(kitob.narxi, tier.unit_price),  aks holda  kitob.narxi
subtotal   = Σ kitob.narxi            (asl narxlar)
total      = Σ unit_price             (buyurtma summasi — orders.amount)
discount   = subtotal − total
```

- Pog'ona narxi — **yuqori chegara**: kitob o'zi arzonroq bo'lsa (masalan, 25 000), o'z narxida qoladi.
- **Bepul kitoblar** (narx 0) savatga qo'shilmaydi va sonda hisoblanmaydi (frontend ham ularni savatga qo'ymaydi).
- Narxlar butun so'm; qiymatlar satr sifatida (`"39000.00"`) — mavjud `price`/`amount` kabi.
- **Nega 2 ta uchun 39 000?** Zinapoya bir tekis: 49 000 → 39 000 → 30 000; "…9 000" narx uslubi. 2 ta (78 000)
  dan 3 taga (90 000) o'tish **atigi +12 000** — uchinchi kitobni olishga kuchli turtki; eng foydali taklif 3+ bo'lib
  qoladi. Qiymatlar **sozlamada** turadi (§2.4), marketing o'zgartirsa kod o'zgarmaydi.

## 2.3. Frontend'da nima tayyor (backend nimani qo'llab-quvvatlashi kerak)

- **Katalog:** aksiya banneri (1 / 2 / 3+ narxlar), har kartada "Savatga" (savatdagi — "Savatda ✓").
- **Kitob sahifasi:** "Savatga qo'shish" + narx zinapoyasi; kitob ko'p kitobli ochiq buyurtmada bo'lsa —
  "bu kitob N ta kitobli buyurtmada".
- **Header / yon menyu:** savatcha ikonkasi va soni.
- **`/cart`:** kitoblar (asl narx ustidan chizilgan + chegirmali narx), narx zinapoyasi va "yana 1 ta qo'shsangiz —
  har biri 30 000" maslahati, xulosa (asl narx, chegirma, jami, "siz X tejaysiz"), tavsiya kitoblar, "Buyurtma berish".
  Kutubxonadagi yoki ochiq buyurtmadagi kitoblar savatdan avtomatik chiqariladi.
- **Buyurtma berilgach:** o'sha sahifada to'lov rekvizitlari, "To'ladim — chek yuborish" (mavjud
  `POST /orders/{id}/receipt`), bekor qilish, holat kuzatuvi.
- **Profil → Buyurtmalarim** va **admin → Buyurtmalar:** ko'p kitobli buyurtma — kitoblar ro'yxati, chegirma.
- Savatchaning o'zi hozir brauzerda (localStorage); mehmon ham qo'sha oladi, buyurtma uchun kirish so'raladi.

## 2.4. Ma'lumot modeli

**Yangi jadval `order_items`:**

| Ustun | Turi | Izoh |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID → `orders.id` | `ON DELETE CASCADE` |
| `book_id` | UUID → `books.id` | |
| `list_price` | numeric(12,2) | buyurtma paytidagi kitob narxi (snapshot) |
| `unit_price` | numeric(12,2) | chegirmadan keyingi narx (snapshot) |
| `created_at` | timestamptz | |

`UNIQUE (order_id, book_id)`; `INDEX (book_id)`.

**`orders` jadvaliga qo'shiladi:** `subtotal numeric(12,2)`, `discount numeric(12,2) DEFAULT 0`.
`amount` — o'zgarmaydi (= total). `book_id` — **saqlanadi** (birinchi kitob) — eski klientlar va Telegram oqimi
buzilmasin; keyinchalik nullable qilinishi mumkin.

**Chegirma sozlamasi — `pricing_tiers`** (yoki settings/config; admin paneldan o'zgartirish keyingi bosqich):

| Ustun | Turi | Izoh |
|---|---|---|
| `id` | UUID | |
| `min_quantity` | int ≥ 2 | pog'ona shu sondan boshlanadi |
| `unit_price` | numeric(12,2) | har kitob narxining yuqori chegarasi |
| `is_active` | boolean | |

Boshlang'ich qiymatlar: `(2, 39000.00)`, `(3, 30000.00)`.

## 2.5. Endpointlar

| Method | Path | Auth | Maqsad |
|---|---|---|---|
| GET | `/api/v1/pricing` | — (public) | Faol pog'onalar. **Frontend savatchani faqat shu 200 qaytarsa ko'rsatadi** |
| POST | `/api/v1/orders/quote` | ixtiyoriy (mehmon ham) | Savatcha narxi — server hisobi (frontend yakuniy summani shundan oladi) |
| POST | `/api/v1/orders/checkout` | Bearer | Savatchadan **bitta** buyurtma yaratish |
| GET | `/api/v1/orders`, `/api/v1/orders/{id}` | Bearer | mavjud — javobga `items`, `subtotal`, `discount` qo'shiladi |
| POST | `/api/v1/orders/{id}/receipt`, `/api/v1/orders/{id}/cancel` | Bearer | mavjud — o'zgarishsiz |
| GET | `/api/v1/admin/orders` | admin | mavjud — `items` (kitob nomlari bilan), `subtotal`, `discount` |
| POST | `/api/v1/admin/orders/{id}/approve` | admin | mavjud — **buyurtmadagi barcha kitoblarga** ruxsat (bitta tranzaksiyada) |
| POST | `/api/v1/admin/orders/{id}/reject` | admin | mavjud — hech bir kitobga ruxsat berilmaydi |

#### `GET /api/v1/pricing`

```json
{
  "currency": "UZS",
  "tiers": [
    { "min_quantity": 2, "unit_price": "39000.00" },
    { "min_quantity": 3, "unit_price": "30000.00" }
  ]
}
```

Chegirma o'chirilgan bo'lsa — `tiers: []` (frontend savatchani ko'rsatadi, lekin chegirmasiz) yoki 404 (savatcha umuman
yashiriladi). Keshlash mumkin: `Cache-Control: public, max-age=300`.

#### `POST /api/v1/orders/quote`

So'rov: `{ "book_ids": ["<uuid>", "<uuid>", "<uuid>"] }` (tartib saqlanadi, takrorlar e'tiborsiz).

Javob `200`:

```json
{
  "items": [
    { "book_id": "…a1", "book_title": "Ruxsatsiz kitob", "list_price": "70000.00", "unit_price": "30000.00" },
    { "book_id": "…b2", "book_title": "Kitob 2", "list_price": "49000.00", "unit_price": "30000.00" },
    { "book_id": "…c3", "book_title": "Kitob 3", "list_price": "49000.00", "unit_price": "30000.00" }
  ],
  "quantity": 3,
  "subtotal": "168000.00",
  "discount": "78000.00",
  "total": "90000.00",
  "currency": "UZS",
  "next_tier": null
}
```

`next_tier` — keyingi pog'ona (masalan, 2 ta kitobda `{ "min_quantity": 3, "unit_price": "30000.00", "add_count": 1 }`),
eng yuqori pog'onada `null`. Bepul kitoblar `items` ga kirmaydi. Quote hech narsa yaratmaydi va bloklamaydi.
Kirgan foydalanuvchi uchun (ixtiyoriy yaxshilash) — kutubxonadagi kitoblarni `details` da qaytarish.

#### `POST /api/v1/orders/checkout`

So'rov: `{ "book_ids": ["…b2", "…c3"] }`. Server **narxni o'zi qayta hisoblaydi** (klient narxiga ishonilmaydi) va
bitta buyurtma yaratadi. Javob `201` — `OrderResponse`:

```json
{
  "id": "…o1",
  "user_id": "…u1",
  "book_id": "…b2",
  "items": [
    { "book_id": "…b2", "book_title": "Kitob 2", "list_price": "49000.00", "unit_price": "39000.00" },
    { "book_id": "…c3", "book_title": "Kitob 3", "list_price": "49000.00", "unit_price": "39000.00" }
  ],
  "subtotal": "98000.00",
  "discount": "20000.00",
  "amount": "78000.00",
  "status": "PENDING",
  "receipt_note": null,
  "has_receipt_file": false,
  "reviewed_by_admin_id": null,
  "reviewed_at": null,
  "reject_reason": null,
  "created_at": "2026-09-26T09:30:00Z",
  "updated_at": "2026-09-26T09:30:00Z"
}
```

Keyingi qadamlar mavjud oqim bo'yicha: `POST /orders/{id}/receipt` → AWAITING_REVIEW → admin approve/reject →
bildirishnoma. Bitta kitobli `POST /orders {book_id}` **saqlanadi** (u uchun ham `items` 1 ta element bilan qaytsa
yaxshi — frontend ikkalasini ham tushunadi).

## 2.6. Validatsiya va xato kodlari

| HTTP | `code` | Qachon | `details` |
|---|---|---|---|
| 422 | `CART_EMPTY` | `book_ids` bo'sh yoki faqat bepul kitoblar | — |
| 422 | `CART_TOO_LARGE` | 20 tadan ko'p kitob | `{ "max": 20 }` |
| 404 | `BOOK_NOT_FOUND` | kitob yo'q yoki faol emas (INACTIVE) | `{ "book_ids": [...] }` |
| 409 | `ALREADY_HAS_ACCESS` | kutubxonada bor kitob(lar) | `{ "book_ids": [...] }` |
| 409 | `ORDER_ALREADY_PENDING` | kitob(lar) boshqa ochiq buyurtmada | `{ "book_ids": [...], "order_id": "…" }` |
| 422 | `VALIDATION_ERROR` | noto'g'ri UUID va h.k. | standart |

**`details.book_ids` muhim:** frontend shu kitoblarni savatdan avtomatik olib tashlaydi va foydalanuvchiga tushuntiradi;
keyin foydalanuvchi qayta "Buyurtma berish" ni bosadi.

## 2.7. Biznes qoidalari

1. **Narx snapshot'i:** buyurtma yaratilgan paytdagi `list_price`/`unit_price` `order_items` da qotadi — keyin kitob
   narxi yoki pog'onalar o'zgarsa ham buyurtma summasi o'zgarmaydi (admin chekni `amount` bilan solishtiradi).
2. **Ochiq buyurtma kitoblarni band qiladi:** kitob PENDING/AWAITING_REVIEW buyurtmada bo'lsa, u bilan yangi buyurtma
   (bitta yoki savatcha) — `409 ORDER_ALREADY_PENDING`. Bekor qilinsa/rad etilsa — bo'shaydi.
3. **Tasdiqlash atomar:** approve — buyurtmadagi **barcha** kitoblarga `book_access` bitta tranzaksiyada (kimdadir
   allaqachon bo'lsa — o'tkazib yuboriladi). Qisman tasdiqlash yo'q: summa mos kelmasa — reject (sabab bilan).
4. **Bildirishnoma:** `ORDER_APPROVED` — `meta.book_ids` (hamma kitoblar) bilan; frontend kutubxonaga havola beradi.
5. **Telegram admin xabari:** kitoblar ro'yxati, asl narx, chegirma, **to'lanishi kerak bo'lgan summa** (amount) —
   admin chekdagi summani shu bilan solishtiradi.
6. **Audit log:** `ORDER_CREATED` (items bilan), `ORDER_APPROVED` (ruxsat berilgan kitoblar).
7. **Rate-limit:** `checkout` — daqiqasiga 10 ta; `quote` — daqiqasiga 60 ta.

## 2.8. Keyingi bosqich (ixtiyoriy): server savatchasi

Hozir savatcha brauzerda — boshqa qurilmada ko'rinmaydi. Kerak bo'lsa: `GET /api/v1/me/cart`,
`PUT /api/v1/me/cart { "book_ids": [...] }` (to'liq almashtirish), `DELETE /api/v1/me/cart`. Frontend'da o'zgarish —
faqat `src/lib/cart.ts` (mehmon savatchasi kirgandan keyin serverga qo'shiladi).

## 2.9. Migratsiya

```sql
-- 1) Yangi ustunlar
ALTER TABLE orders ADD COLUMN subtotal numeric(12,2), ADD COLUMN discount numeric(12,2) NOT NULL DEFAULT 0;
UPDATE orders SET subtotal = amount WHERE subtotal IS NULL;
-- 2) Mavjud buyurtmalar — bittadan element (tarix bir xil ko'rinsin)
INSERT INTO order_items (id, order_id, book_id, list_price, unit_price, created_at)
SELECT gen_random_uuid(), o.id, o.book_id, o.amount, o.amount, o.created_at FROM orders o
ON CONFLICT (order_id, book_id) DO NOTHING;
-- 3) Boshlang'ich pog'onalar
INSERT INTO pricing_tiers (id, min_quantity, unit_price, is_active) VALUES
  (gen_random_uuid(), 2, 39000.00, true), (gen_random_uuid(), 3, 30000.00, true);
```

(SQL — namuna; jadval/ustun nomlari backend sxemasiga moslashtirilsin.)

**Deploy tartibi:** backend (migratsiya + endpointlar) → `GET /pricing` 200 qaytaradi → frontend savatchani o'zi
ko'rsata boshlaydi. Frontend'ni qayta deploy qilish shart emas.

## 2.10. Frontend ↔ backend moslik

| Frontend | Backend |
|---|---|
| `pricingApi.get()` — `src/lib/api/orders.ts` | `GET /pricing` (404 → savatcha yashirin) |
| `ordersApi.quote(bookIds)` | `POST /orders/quote` |
| `ordersApi.checkout(bookIds)` | `POST /orders/checkout` |
| `Order.items[]`, `subtotal`, `discount` — `src/lib/api/types.ts` | `OrderResponse` ga qo'shiladigan maydonlar |
| `quoteLocal()` — `src/lib/pricing.ts` (tezkor ko'rinish uchun) | §2.2 qoidasi bilan **bir xil** bo'lishi kerak |

## 2.11. Qabul qilish mezonlari

- [ ] `order_items`, `orders.subtotal/discount`, `pricing_tiers` (+ boshlang'ich qiymatlar), migratsiya (§2.9).
- [ ] `GET /pricing`, `POST /orders/quote`, `POST /orders/checkout` — OpenAPI'da sxemalari bilan.
- [ ] Narx §2.2 bo'yicha: 1 ta — o'z narxi; 2 ta — ≤ 39 000; 3+ — ≤ 30 000; bepul kitoblar hisobga olinmaydi;
      arzon kitob o'z narxida qoladi. Unit testlar: 1/2/3/5 kitob, aralash narxlar (70 000 + 49 000 + 25 000), bepul.
- [ ] Checkout serverda qayta hisoblaydi; `amount` = total; snapshot `order_items` da.
- [ ] Xato kodlari §2.6 — `details.book_ids` bilan.
- [ ] Approve — barcha kitoblarga ruxsat (bitta tranzaksiya); reject — hech biriga; bildirishnoma `meta.book_ids`.
- [ ] `GET /orders`, `GET /orders/{id}`, `GET /admin/orders` — `items` (kitob nomlari bilan), `subtotal`, `discount`.
- [ ] Telegram admin xabarida kitoblar ro'yxati va to'lanadigan summa.
- [ ] `API.md` ga bo'lim qo'shilgan.
- [ ] Frontend e2e (`npm run e2e -- cart`) haqiqiy backend'ga qarshi ham o'tadi (staging).

Savollar bo'lsa — frontend jamoasi: `FRONTEND_PLAN.md` 35-bo'lim.

---

# 3-qism. Akkauntni 2 ta qurilmaga bog'lash

> **Mahsulot egasining talabi (2026-09-26):** "device limit 2 ta. Hozir bittasi logout qilsa 3-qurilma orqali kirish
> mumkin. Lekin foydalanuvchi faqat 2 ta qurilma orqali kira olishi kerak." Qurilmani almashtirish — **faqat admin
> orqali**. Qurilmani qanday aniqlash — **backend o'zi hal qiladi** (§3.4 da talablar va variantlar).

## 3.1. Hozirgi holat va muammo

Hozir cheklov — **bir vaqtdagi faol sessiyalar** soni (`MAX_ACTIVE_SESSIONS_PER_USER = 2`, login'da
`403 DEVICE_LIMIT_REACHED`). Bu **qurilmalar sonini cheklamaydi**, faqat bir vaqtda nechta joyda kirib turishni:

| Qadam | Kim | Nima bo'ladi hozir |
|---|---|---|
| 1 | Ali o'z noutbukida kiradi | ✅ sessiya 1 |
| 2 | Ali telefonida kiradi | ✅ sessiya 2 |
| 3 | Do'sti Vali o'z kompyuterida Ali login/paroli bilan kiradi | ❌ `DEVICE_LIMIT_REACHED` |
| 4 | Ali telefonda "Chiqish" bosadi (yoki profilda sessiyani o'chiradi — `DELETE /sessions/{id}`) | sessiya 2 yopildi |
| 5 | Vali qayta urinadi | ✅ **kiradi** — 3-qurilma |
| 6 | Keyin 4-, 5-, … qurilma — navbatma-navbat chiqib-kirish bilan | ✅ cheksiz |

Natija: bitta sotib olingan kitob/akkaunt navbatma-navbat istalgancha odam o'rtasida ishlatiladi (account sharing).
Kontent pullik va himoyalangan — bu to'g'ridan-to'g'ri daromad yo'qotish.

## 3.2. Talab (yangi qoida)

1. Har bir foydalanuvchi akkaunti **ko'pi bilan 2 ta "bog'langan qurilma"** ga ega.
2. Qurilma akkauntga **birinchi muvaffaqiyatli kirishda avtomatik bog'lanadi** (joy bo'lsa).
3. **Chiqish (logout) yoki sessiyani o'chirish qurilmani bo'shatmaydi.** Bog'langan qurilma ro'yxatda qoladi va shu
   qurilmadan istalgan payt qayta kirish mumkin.
4. 2 ta bog'langan qurilma bo'lsa, **3-qurilmadan kirish har doim rad etiladi** — chiqish/kirish soni, vaqt,
   parol almashtirish farq qilmaydi.
5. Bog'langan qurilmani **faqat administrator** olib tashlaydi (sabab bilan). Foydalanuvchi o'zi olib tashlay olmaydi,
   ro'yxatni faqat ko'radi. Olib tashlangandan keyin bo'shagan joyni keyingi yangi qurilma egallaydi.
6. Bitta bog'langan qurilmada bir vaqtda **bitta faol sessiya** (shu qurilmadan qayta kirilsa — eskisi yopiladi).
   Shunda "bitta qurilma ID'si bilan ikki joydan" ishlash ham to'xtaydi (§3.4 dagi soxtalashtirishga qarshi ham).
7. Limit sozlamada: `MAX_DEVICES_PER_USER = 2` (hozirgi `MAX_ACTIVE_SESSIONS_PER_USER` o'rniga yoki yonida).
   **Administratorlar** (`role = ADMIN`) bu cheklovdan ozod qilinishi tavsiya etiladi (ular ko'p joydan ishlaydi) —
   sozlama bilan: `DEVICE_LIMIT_EXEMPT_ROLES = ADMIN`.

**Atamalar:** *sessiya* — bitta kirish (access/refresh token juftligi), logout bilan yopiladi; *bog'langan qurilma*
— akkauntga ruxsat berilgan qurilma, faqat admin olib tashlaydi. Bitta qurilmada vaqt o'tishi bilan ko'p sessiya
bo'lishi mumkin (lekin bir vaqtda bittasi faol).

## 3.3. Kutilgan xatti-harakat (yuqoridagi misol yangi qoida bilan)

| Qadam | Kim | Yangi qoida bilan |
|---|---|---|
| 1 | Ali noutbukda kiradi | ✅ noutbuk **bog'landi** (1/2) |
| 2 | Ali telefonda kiradi | ✅ telefon **bog'landi** (2/2) |
| 3 | Vali o'z kompyuterida kiradi | ❌ `DEVICE_NOT_ALLOWED` |
| 4 | Ali telefonda chiqadi | sessiya yopildi, telefon **bog'langan qoladi** (2/2) |
| 5 | Vali qayta urinadi | ❌ `DEVICE_NOT_ALLOWED` — joy bo'shamagan |
| 6 | Ali telefonda qayta kiradi | ✅ (bog'langan qurilma) |
| 7 | Ali telefonini yo'qotdi → admin'ga yozadi → admin "telefon"ni olib tashlaydi | telefon sessiyalari yopiladi (1/2) |
| 8 | Ali yangi telefonida kiradi | ✅ yangi telefon bog'landi (2/2) |

## 3.4. Qurilmani aniqlash — backend hal qiladi (talablar va variantlar)

**Frontend (veb) hozir har so'rovda yuboradi:**

| Nima | Qayerda | Qiymat | Xususiyati |
|---|---|---|---|
| `X-Device-Id` | HTTP sarlavha (har so'rovda) | tasodifiy UUID v4, brauzerning `localStorage` ida (`a365.device`), birinchi ochilishda yaratiladi | brauzerga xos; inkognito, boshqa brauzer yoki "sayt ma'lumotlarini tozalash" — **yangi ID** |
| `device_name` | `POST /auth/login` tanasi | masalan `"Chrome · Linux"` | faqat ko'rsatish uchun |
| `User-Agent` | standart sarlavha | brauzer/OT | o'zgarishi mumkin (yangilanish) |
| IP | ulanish | | mobil tarmoqda o'zgaradi |

**Veb-platformaning cheklovi (qaror qabul qilishda hisobga olinsin):** brauzer ichida "jismoniy qurilmani" ishonchli
aniqlashning standart yo'li yo'q. Amalda **"qurilma" = brauzer profili**: bitta kompyuterdagi Chrome va Firefox —
2 ta qurilma; brauzer ma'lumotlari tozalansa — yangi qurilma. Bunday foydalanuvchi admin'ga murojaat qiladi (§3.2 p.5).

**Backend tanlagan usul quyidagilarni ta'minlashi shart:**

1. **Nusxalab bo'lmasligi (eng muhim).** Faqat `X-Device-Id` sarlavhasiga ishonish yetarli emas: foydalanuvchi o'z
   brauzeridagi ID'ni do'stiga berib yuborsa (localStorage'dan nusxa), do'sti "o'sha qurilma" bo'lib kiradi. Himoya
   usullari (bittasi yoki bir nechtasi):
   - **server beradigan qurilma kaliti** (tavsiya): qurilma bog'langanda server tasodifiy maxfiy kalit
     (`device_secret`, ≥ 128 bit) yaratadi, javobda qaytaradi, bazada **faqat xeshi** saqlanadi; klient keyingi
     loginlarda uni yuboradi; kalit o'g'irlanishiga qarshi — §3.2 p.6 (qurilmada bir vaqtda bitta sessiya) va p.3;
   - **bir vaqtda ikki joy aniqlanishi:** bitta qurilmaning sessiyasi ikki xil IP/tarmoqdan parallel ishlatilsa —
     shubhali deb belgilash, sessiyani yopish, admin'ga signal;
   - brauzer izi (fingerprint: UA, ekran, til, vaqt zonasi, …) — faqat **qo'shimcha signal** sifatida (100% aniq
     emas, yangilanishda o'zgaradi, maxfiylik talablari).
2. **Faqat to'g'ri paroldan keyin tekshirish** — noto'g'ri parolda qurilma haqida ma'lumot qaytmasin.
3. **Poyga holati (race):** 1 ta joy bo'shligida ikki yangi qurilma bir vaqtda kirsa — faqat bittasi bog'lansin
   (tranzaksiya + `SELECT … FOR UPDATE` foydalanuvchi qatori bo'yicha yoki unique cheklov).
4. **Refresh'da ham tekshirish:** admin qurilmani olib tashlagan bo'lsa, o'sha qurilmaning refresh tokeni ishlamasin.

**Frontend tayyor:** backend qaysi kalitni tanlasa (masalan, login javobida `device_secret`, keyin sarlavha
`X-Device-Secret` yoki login tanasida) — frontend uni saqlab yuboradi; o'zgarish kichik (`src/lib/api/token-store.ts`,
`auth.ts`). Kalit nomi va joyi OpenAPI'da yozilsin.

## 3.5. Login algoritmi

```
POST /auth/login {identifier, password, device_name, totp_code?}  (+ qurilma belgisi: §3.4)
 1. Parol va (bo'lsa) 2FA tekshiriladi — xato bo'lsa hozirgidek 401 / TWO_FACTOR_REQUIRED
 2. Foydalanuvchi ADMIN va ozod bo'lsa → hozirgidek sessiya yaratiladi (cheklovsiz)
 3. Qurilma D aniqlanadi (§3.4)
 4. BEGIN; foydalanuvchi qatorini bloklash (FOR UPDATE)
 5.   D foydalanuvchining bog'langan (removed_at IS NULL) qurilmalari ichida bo'lsa:
          D ning boshqa faol sessiyalarini yopish (p.6), yangi sessiya yaratish, last_seen_at yangilash → 200
 6.   aks holda bog'langanlar soni < MAX_DEVICES_PER_USER bo'lsa:
          D ni bog'lash (user_devices ga yozish), sessiya yaratish → 200 (+ kerak bo'lsa device_secret)
 7.   aks holda:
          sessiya YARATILMAYDI → 403 DEVICE_NOT_ALLOWED (§3.8), audit log, (ixtiyoriy) foydalanuvchiga va
          admin'ga xabar "yangi qurilmadan kirishga urinish"
    COMMIT
```

`POST /auth/refresh`: sessiya qurilmasi `removed_at IS NOT NULL` bo'lsa → `401 DEVICE_REMOVED` (sessiya yopiladi).
`POST /auth/logout`, `DELETE /sessions/{id}`: faqat sessiyani yopadi, **qurilmani bo'shatmaydi**.

## 3.6. Ma'lumot modeli

**Yangi jadval `user_devices`:**

| Ustun | Turi | Izoh |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID → `users.id` | `ON DELETE CASCADE` |
| `device_key` | varchar | qurilma identifikatori yoki kalitining **xeshi** (§3.4 — backend tanlagan usulga qarab) |
| `name` | varchar(120) | `device_name` (masalan "Chrome · Linux") — ko'rsatish uchun |
| `user_agent` | text | birinchi kirishdagi |
| `first_ip`, `last_ip` | inet | |
| `bound_at` | timestamptz | bog'langan payt |
| `last_seen_at` | timestamptz | oxirgi kirish/refresh |
| `removed_at` | timestamptz null | admin olib tashlagan payt |
| `removed_by_admin_id` | UUID null | |
| `remove_reason` | varchar(500) null | masalan "telefon yo'qolgan" |

Cheklov: `UNIQUE (user_id, device_key) WHERE removed_at IS NULL`. `sessions` jadvaliga `device_id → user_devices.id`.

## 3.7. Endpointlar

| Method | Path | Kim | Maqsad |
|---|---|---|---|
| GET | `/api/v1/me/devices` | foydalanuvchi | O'z bog'langan qurilmalari (faqat ko'rish): `id, name, bound_at, last_seen_at, is_current` + `limit` |
| GET | `/api/v1/admin/users/{user_id}/devices` | admin | Foydalanuvchi qurilmalari (olib tashlanganlari ham, `removed_*` bilan) |
| DELETE | `/api/v1/admin/users/{user_id}/devices/{device_id}` | admin | Qurilmani olib tashlash: tana `{ "reason": "…" }` (majburiy); o'sha qurilmaning barcha sessiyalari yopiladi; audit log; foydalanuvchiga bildirishnoma |
| DELETE | `/api/v1/admin/users/{user_id}/devices` | admin | Barcha qurilmalarni olib tashlash (masalan, akkaunt o'g'irlanganda) — `{ "reason" }` |
| PATCH | `/api/v1/admin/users/{user_id}` | admin | (ixtiyoriy) shaxsiy limit: `{ "max_devices": 3 }` — alohida holatlar uchun |

Mavjudlari o'zgarishsiz qoladi: `GET /sessions`, `DELETE /sessions/{id}` (sessiyani yopadi, qurilmani emas),
admin sessiya endpointlari.

`GET /api/v1/me/devices` javobi:

```json
{
  "limit": 2,
  "items": [
    { "id": "…d1", "name": "Chrome · Windows", "bound_at": "2026-09-20T08:00:00Z", "last_seen_at": "2026-09-26T07:40:00Z", "is_current": true },
    { "id": "…d2", "name": "Safari · iOS", "bound_at": "2026-09-21T19:12:00Z", "last_seen_at": "2026-09-25T21:03:00Z", "is_current": false }
  ]
}
```

## 3.8. Xato kodlari

| HTTP | `code` | Qachon | `details` |
|---|---|---|---|
| 403 | `DEVICE_NOT_ALLOWED` | 2 ta qurilma bog'langan, login yangi (3-) qurilmadan | `{ "limit": 2, "devices": [{ "name", "bound_at", "last_seen_at" }] }` — ID'siz, faqat nom/sana |
| 401 | `DEVICE_REMOVED` | refresh/so'rov — admin qurilmani olib tashlagan | — |
| 422 | `VALIDATION_ERROR` | admin olib tashlashda `reason` bo'sh | standart |

Hozirgi `DEVICE_LIMIT_REACHED` (bir vaqtdagi sessiyalar) **olib tashlanadi** yoki yangi ma'noda qolmasin — ikkita
o'xshash kod frontend va foydalanuvchini chalkashtiradi. Frontend o'tish davrida ikkalasini ham tushunadi.

## 3.9. Mavjud foydalanuvchilarni o'tkazish (migratsiya)

Deploy paytida hech kim kutilmaganda "qulflanib" qolmasligi uchun:

1. Har foydalanuvchi uchun hozirgi **faol sessiyalardan** (`last_active_at` bo'yicha eng so'nggi) **2 tagacha**
   qurilma `user_devices` ga yoziladi (`device_key` — sessiyadagi qurilma belgisidan; yo'q bo'lsa — keyingi kirishda
   bog'lanadi).
2. Faol sessiyasi yo'q foydalanuvchilarda ro'yxat bo'sh — keyingi 2 ta turli qurilma avtomatik bog'lanadi.
3. 2 tadan ortiq faol sessiyasi borlarning ortiqchalari yopiladi (ular 3-qoidaga to'g'ri kelmaydi).
4. Deploy'dan oldin foydalanuvchilarga xabar (bildirishnoma): "Akkauntingiz 2 ta qurilmaga bog'lanadi; qurilmani
   almashtirish uchun qo'llab-quvvatlashga yozing."

## 3.10. Frontend tomonda nima qilinadi (backend tayyor bo'lgach)

- **Login:** `DEVICE_NOT_ALLOWED` — aniq xabar: "Bu akkaunt allaqachon 2 ta qurilmaga bog'langan: Chrome · Windows,
  Safari · iOS. Yangi qurilmadan kirish uchun administratorga murojaat qiling" + Telegram/qo'llab-quvvatlash havolasi.
  (Hozirgi `DEVICE_LIMIT_REACHED` xabari "boshqa qurilmada chiqing" deydi — yangi qoidada bu noto'g'ri bo'ladi.)
- **Profil → "Qurilmalarim":** bog'langan qurilmalar (`GET /me/devices`), "joriy" belgisi, "almashtirish — admin
  orqali" izohi; o'chirish tugmasi **yo'q**. Sessiyalar ro'yxati ("chiqish") alohida qoladi.
- **Admin → foydalanuvchi sahifasi:** "Bog'langan qurilmalar" jadvali, "Olib tashlash" (sabab majburiy, tasdiq
  oynasi), olib tashlanganlar tarixi.
- **`DEVICE_REMOVED`** (refresh'da): kirish sahifasiga "Bu qurilma akkauntdan olib tashlangan" xabari bilan.
- Backend `device_secret` tanlasa — saqlash va yuborish (§3.4).

## 3.11. Qabul qilish mezonlari (sinov ssenariylari)

- [ ] §3.3 jadvalidagi 8 qadam avtomatik test sifatida: 3-qurilma logout'dan keyin ham kira olmaydi.
- [ ] Bog'langan qurilmadan chiqib-kirish cheksiz ishlaydi; parol almashtirish qurilmalarni bo'shatmaydi.
- [ ] Foydalanuvchi `DELETE /sessions/{id}` bilan qurilmani **bo'shata olmaydi**.
- [ ] Admin qurilmani olib tashlasa: o'sha qurilmaning sessiyalari va refresh tokenlari darhol ishlamaydi
      (`DEVICE_REMOVED`), bo'shagan joyni yangi qurilma oladi; audit log va bildirishnoma bor.
- [ ] Bitta qurilmada bir vaqtda bitta faol sessiya; ikki joydan parallel ishlatish aniqlanadi.
- [ ] Nusxalangan qurilma belgisi bilan (§3.4 p.1) begona kompyuterdan kirib bo'lmaydi.
- [ ] Poyga: 1 ta bo'sh joyga bir vaqtda 2 ta yangi qurilma — faqat bittasi bog'lanadi.
- [ ] Noto'g'ri parolda qurilma haqida ma'lumot qaytmaydi.
- [ ] ADMIN roli ozod (sozlama bo'yicha).
- [ ] Migratsiya §3.9: deploy'dan keyin faol foydalanuvchilar qulflanmaydi.
- [ ] OpenAPI va `API.md` yangilangan (yangi kodlar, endpointlar, qurilma kaliti).

Savollar bo'lsa — frontend jamoasi: `FRONTEND_PLAN.md` 36-bo'lim.

---

# 4-qism. Tekin kitoblar — ro'yxatdan o'tmasdan o'qish

> **Qisqasi:** admin kitob yaratayotganda (yoki tahrirlashda) **"Tekin kitob"** kalitini yoqadi — narx maydoni
> yo'qoladi, kitob `is_free = true`, `price = 0` bo'ladi. Tekin kitobni **hech kim sotib olmaydi**: ro'yxatdan
> o'tmagan mehmon ham, kirgan foydalanuvchi ham darhol o'qiydi. Pullik kitoblar uchun hech narsa o'zgarmaydi.

## 4.1. Nima uchun (maqsad)

- **Yangi o'quvchini jalb qilish.** Odam ro'yxatdan o'tmasdan saytning asosiy qiymatini — o'quvchini (reader) —
  ko'radi. Tekin kitob "sinov darsi" vazifasini bajaradi: yoqsa, ro'yxatdan o'tadi va pullik kitob oladi.
- **Marketing.** Tekin kitob havolasini ijtimoiy tarmoqqa tashlash mumkin — havola login talab qilmasdan ochiladi.
- **Adminga qulaylik.** Hozir "tekin" tushunchasi yo'q: narxni `0` yozish mumkin, lekin kitob baribir buyurtma
  va admin tasdig'ini talab qiladi. Bundan tashqari, ilgari admin narxni yozishni unutsa, bo'sh narx `0` bo'lib
  ketardi — endi pullik kitobda narx **majburiy**, tekinligi esa alohida, ongli tanlov.

## 4.2. Biznes qoidalari

1. `is_free = true` bo'lgan kitob:
   - narxi har doim `0` (`"0.00"`); admin narx yubormaydi, yuborsa ham e'tiborsiz qoldiriladi yoki `0` ga tenglanadi;
   - **faqat `status = ACTIVE` bo'lsa** ochiq (INACTIVE tekin kitob mehmonga ham, foydalanuvchiga ham ko'rinmaydi —
     pullik kitoblardagi kabi);
   - buyurtma, savatcha, chegirma hisobiga **kirmaydi**;
   - o'qish uchun `book_access` (ruxsat) **kerak emas**.
2. `is_free = false` bo'lgan kitobda `price > 0` **majburiy** (hozir `0` ga ruxsat bor — endi yo'q, §4.4).
3. Tekin → pullik o'tkazilsa: kitob darhol yopiladi (mehmon va ruxsatsiz foydalanuvchi o'qiy olmaydi); tekin
   paytida o'qigan foydalanuvchilarga **avtomatik ruxsat berilmaydi** (xohlasa admin qo'lda beradi). Progress va
   annotatsiyalar o'chirilmaydi — ruxsat olsa, joyidan davom etadi.
4. Pullik → tekin o'tkazilsa: ochiq buyurtmalar (PENDING / AWAITING_REVIEW) bo'lsa — admin ularni bekor qiladi
   yoki backend avtomatik `CANCELLED` qiladi (sabab: "Kitob tekin bo'ldi") va foydalanuvchiga bildirishnoma
   yuboradi. Tasdiqlangan (APPROVED) buyurtmalar tarix uchun qoladi.

## 4.3. Ma'lumot modeli

```sql
ALTER TABLE books ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT FALSE;
-- ixtiyoriy mustahkamlik: tekin ⇔ narx 0, pullik ⇔ narx > 0
ALTER TABLE books ADD CONSTRAINT books_free_price_chk
  CHECK ((is_free AND price = 0) OR (NOT is_free AND price > 0));
CREATE INDEX books_is_free_idx ON books (is_free) WHERE status = 'ACTIVE';
```

`is_free` quyidagi javoblarning **hammasida** qaytishi kerak (frontend shu bilan qaror qiladi):

| Endpoint | Maydon |
|---|---|
| `GET /catalog`, `GET /catalog/{book_id}` | `is_free: boolean` |
| `GET /library`, `GET /books/{id}` (foydalanuvchi) | `is_free: boolean` |
| `GET /admin/books`, `GET /admin/books/{id}`, `POST`/`PATCH` javoblari | `is_free: boolean` |

> Frontend vaqtinchalik moslik uchun `is_free === true` **yoki** `price == 0` bo'lsa kitobni tekin deb ko'rsatadi
> (`src/lib/free-books.ts`). Backend `is_free` ni qaytara boshlagach ham bu mantiq to'g'ri ishlayveradi.

## 4.4. Admin endpointlari

`POST /admin/books` va `PATCH /admin/books/{id}` — yangi maydon `is_free`:

```jsonc
// Tekin kitob yaratish — frontend aynan shunday yuboradi
{ "title": "Kitob", "author": null, "description": null, "category_id": null, "price": 0, "is_free": true }
// Pullik kitob
{ "title": "Kitob", "price": "49000", "is_free": false }
```

Narx admin yuborgan qiymatda saqlanadi (masalan, `"65000"` → `"65000.00"`); standart narx yo'q.

Validatsiya:

| Holat | Javob |
|---|---|
| `is_free: true` (+ har qanday `price`) | `201/200`, saqlanadi `price = 0` |
| `is_free: false` va `price` yo'q / `0` / manfiy | `422 PRICE_REQUIRED` — "Pullik kitob uchun narx kiriting" |
| `PATCH` da faqat `price: 0` (is_free yo'q) | `422 PRICE_REQUIRED` (tekin qilish faqat `is_free: true` orqali — tasodifan tekin bo'lib qolmasin) |
| `PATCH` da `is_free: false`, `price` yo'q, eski narx `0` | `422 PRICE_REQUIRED` |

Audit log: `BOOK_FREE_ENABLED` / `BOOK_FREE_DISABLED` (kim, qachon, eski narx).

Ixtiyoriy: `GET /admin/books?is_free=true|false` filtri.

## 4.5. Katalog

- `GET /catalog` va `GET /catalog/{id}` — `is_free` maydoni (yuqorida).
- Ixtiyoriy filtr: `GET /catalog?is_free=true` ("Tekin kitoblar" bo'limi uchun keyinchalik).
- Muqova (`/catalog/{id}/cover`) allaqachon anonim — o'zgarish yo'q.

## 4.6. Mehmon (tokensiz) o'qish — eng muhim qism

Hozir reader endpointlari faqat `Authorization: Bearer` bilan ishlaydi. Tekin kitob uchun ular **tokensiz ham**
ishlashi kerak. Token kelsa — oddiy foydalanuvchi sifatida ishlaydi (hozirgidek).

| Endpoint | Tokensiz, tekin kitob | Tokensiz, pullik kitob |
|---|---|---|
| `GET /reader/books/{book_id}/articles` | `200` — READY maqolalar ro'yxati | `401 AUTHENTICATION_REQUIRED` |
| `GET /reader/articles/{article_id}` (meta) | `200`; `reading_percentage: 0`, `current_page: null` | `401` |
| `GET /reader/articles/{article_id}/content` (PDF, `Range` bilan) | `200/206` | `401` |
| `GET /reader/articles/{article_id}/watermark` | `200` — mehmon suv belgisi (§4.7) | `401` |
| `GET /articles/{article_id}/toc` | `200` | `401` |
| `GET /articles/{article_id}/search?q=` | `200` (qattiqroq limit, §4.8) | `401` |
| `GET /reader/books/{book_id}/cover` | `200` (yoki frontend `/catalog/{id}/cover` ni ishlatadi) | `401` |

Mehmon uchun **yopiq qoladi** (tokensiz → `401`), chunki ular foydalanuvchiga bog'langan:
`/articles/{id}/progress`, `/reading-heartbeat`, `/mark-read`, `/annotations*`, lug'at (`/me/vocabulary*`).
Frontend mehmon rejimida bularni umuman chaqirmaydi (e2e test tekshiradi) — lekin backend ham himoya qilsin.

**Muhim — status kodlari:** tokensiz so'rovda pullik kitob uchun `403` emas, **`401`** qaytaring. Frontend
mehmonni `401/403` da `/login?next=/reader/{id}` ga yuboradi — ikkalasi ham ishlaydi, lekin `401` semantik
to'g'ri. Noto'g'ri/muddati o'tgan token kelsa — hozirgidek `401 TOKEN_EXPIRED` (mehmon deb qabul **qilmang**,
aks holda sessiya tugaganini frontend bilmay qoladi).

**Kirgan foydalanuvchi + tekin kitob:** `book_access` tekshiruvi o'rniga `has_access || book.is_free`. Progress,
heartbeat, belgilash, annotatsiya, lug'at — hammasi odatdagidek ishlaydi (ruxsatsiz, lekin tekin kitobda).
Ixtiyoriy: `GET /library` da foydalanuvchi o'qishni boshlagan tekin kitoblarni ham qaytarish (`source: "FREE"`) —
frontend hozircha tekin kitobni katalogdan ochadi, bu majburiy emas.

## 4.7. Mehmon suv belgisi

Pullik kitoblardagi kabi har bir sahifada suv belgisi bo'lishi kerak, lekin foydalanuvchi yo'q:

```json
{ "watermark_text": "Articles365 • mehmon • 213.230.x.x", "trace_id": "…", "user_ref": "GUEST",
  "issued_at": 1790000000, "signature": "…" }
```

- IP oxirgi oktetlari yashirilgan (shaxsiy ma'lumot to'liq chiqmasin); `trace_id` — so'rovni log'dan topish uchun.
- Frontend `watermark` olinmasa ham ishlaydi (zaxira: `Articles365 · guest · sana`), lekin backend bersin.

## 4.8. Himoya (anonim endpointlar ochilgani uchun)

- **Rate limit (IP bo'yicha):** content — masalan, 60 so'rov/daqiqa, search — 20/daqiqa, qolganlari — 120/daqiqa;
  oshsa `429 RATE_LIMITED` (+ `Retry-After`). Kirgan foydalanuvchilar uchun limitlar o'zgarmaydi.
- **Scraping:** bir IP qisqa vaqtda juda ko'p tekin maqolani to'liq yuklasa — log/alert. PDF `Range` bilan
  bo'laklab beriladi (hozirgidek), `Cache-Control: private, no-store` saqlanadi.
- **Sessiya/qurilma limiti (3-qism)** mehmonga taalluqli emas — mehmon qurilma sifatida sanalmaydi.
- `is_free` faqat **server** ma'lumoti bo'yicha tekshiriladi (klient yuborgan narsaga ishonilmaydi).
- Ixtiyoriy: `X-Robots-Tag: noindex` content javobida (PDF qidiruv tizimlariga tushmasin); katalog sahifasi esa
  indekslanadi.

## 4.9. Buyurtma va savatcha

- `POST /orders` tekin kitobga → `422 BOOK_IS_FREE` ("Tekin kitobga buyurtma kerak emas").
- `POST /orders/quote` va `POST /orders/checkout` (2-qism) — tekin kitob `book_ids` ichida bo'lsa: uni
  **tashlab yuborish** va javobda `skipped: [{ book_id, reason: "BOOK_IS_FREE" }]` qaytarish; faqat tekin
  kitoblar bo'lsa → `422 BOOK_IS_FREE`. Chegirma pog'onasi faqat pullik kitoblar soni bo'yicha hisoblanadi.
- Frontend tekin kitobni savatga qo'shmaydi (tugma yo'q) — bu faqat himoya.

## 4.10. Migratsiya

1. Ustun qo'shish (`DEFAULT FALSE`).
2. Hozir `price = 0` bo'lgan kitoblarni ko'rib chiqish: ular admin tomonidan ataylab tekin qilinganmi yoki narx
   yozilmay qolganmi? Tavsiya: `UPDATE books SET is_free = TRUE WHERE price = 0;` — keyin admin ro'yxatini
   ko'rib, pullik bo'lishi kerak bo'lganlariga narx qo'yadi (frontend admin ro'yxatida ular "Tekin" belgisi bilan
   ko'rinadi). `CHECK` cheklovini shu tozalashdan **keyin** qo'shing.
3. Narxi `0` bo'lgan kitoblarga ilgari berilgan `book_access` yozuvlari — o'z holicha qoladi.

## 4.11. Frontend'da nima tayyor (ma'lumot uchun)

- Admin: yaratish va tahrirlash formasida "Tekin kitob" kaliti; yoqilsa narx maydoni yo'qoladi va
  `price: 0, is_free: true` yuboriladi; pullik kitobda narx majburiy. Ro'yxat va kitob sahifasida "Tekin" belgisi.
- Katalog: kartada "Tekin" belgisi, narx o'rnida "Tekin", tugma — "O'qish" (savatcha/buyurtma yo'q).
- Kitob sahifasi: "Bu kitob tekin" paneli — maqolalar ro'yxati va "O'qishni boshlash". Backend hali mehmonga
  ochmagan bo'lsa (`401`), mehmonga "O'qish uchun tizimga kiring" tugmasi chiqadi.
- Reader mehmon rejimi: `/reader/*` endi login talab qilmaydi (sahifa darajasida); mehmonga banner
  ("Ro'yxatdan o'ting — belgilash, lug'at, eslatmalar va o'qish joyi saqlanadi"), panelda faqat Mundarija va
  Qidiruv, matn tanlanganda ranglar o'rniga ro'yxatdan o'tish taklifi; progress/annotatsiya so'rovlari yuborilmaydi.
  Pullik kitob maqolasi mehmonga `401/403` qaytsa — `/login?next=/reader/{id}`.
- Tokeni yo'q mehmonning `401` javobi "sessiya tugadi" deb qabul qilinmaydi (faqat token bo'lganda).
- e2e: `e2e/tests/free-books.test.mjs` (mock: `e2e/mock/server.mjs`).

## 4.12. Qabul qilish mezonlari

- [ ] `POST /admin/books` `{ is_free: true }` → `is_free: true, price: "0.00"`; `{ is_free: false }` narxsiz →
      `422 PRICE_REQUIRED`.
- [ ] `PATCH` tekin → pullik (narx bilan) va pullik → tekin ishlaydi; audit log yoziladi.
- [ ] `GET /catalog`, `/catalog/{id}`, `/library`, admin javoblarida `is_free` bor.
- [ ] Tokensiz: tekin ACTIVE kitobning maqolalar ro'yxati, meta, content (Range), watermark, toc, search — `200`.
- [ ] Tokensiz: pullik kitob yoki INACTIVE tekin kitob — `401`; progress/annotations — `401`.
- [ ] Muddati o'tgan token bilan tekin kitob — `401 TOKEN_EXPIRED` (mehmonga tushib qolmaydi).
- [ ] Kirgan, ruxsati yo'q foydalanuvchi tekin kitobni o'qiydi, progress va annotatsiya saqlanadi.
- [ ] `POST /orders` tekin kitobga — `422 BOOK_IS_FREE`; quote/checkout tekin kitobni hisobga olmaydi.
- [ ] Tekin → pullik: mehmon va ruxsatsiz foydalanuvchi darhol `401/403` oladi.
- [ ] Rate limit: anonim content/search limitdan oshsa `429`.
- [ ] Migratsiya: `price = 0` kitoblar `is_free = true`; `CHECK` cheklovi qo'shilgan.
- [ ] OpenAPI va `API.md` yangilangan.

Savollar bo'lsa — frontend jamoasi: `FRONTEND_PLAN.md` 37-bo'lim.
