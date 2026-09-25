# Lug'at (Vocabulary) — backend uchun texnik topshiriq

> **Holat:** frontend to'liq tayyor va ishlab turibdi (2026-09-25). Hozir u vaqtinchalik yechim bilan — mavjud
> annotatsiya API'si orqali — ishlaydi. Ushbu hujjat backend'da **alohida lug'at API'si** qurish uchun: nima,
> nima uchun, qanday va qaysi tartibda.
>
> **Frontend kontakti:** barcha lug'at so'rovlari bitta faylda — `src/lib/api/vocabulary.ts`. Backend tayyor bo'lgach
> faqat shu fayl almashadi; sahifalar va komponentlarga tegilmaydi.

---

## 1. Nima uchun qurilyapti (maqsad)

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

## 2. Hozir qanday ishlayapti (vaqtinchalik yechim) va muammolari

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

## 3. Taklif: alohida resurs `vocabulary`

### 3.1. Ma'lumot modeli — `vocabulary_entries` jadvali

| Ustun | Turi | Majburiy | Izoh |
|---|---|---|---|
| `id` | UUID | ha | PK |
| `user_id` | UUID → `users.id` | ha | egasi; `ON DELETE CASCADE` |
| `article_id` | UUID → `articles.id` | ha | so'z qaysi maqoladan olingan |
| `book_id` | UUID → `books.id` | ha | `article.book_id` dan yoziladi (filtr va join uchun) |
| `word` | varchar(120) | ha | so'z yoki ibora, foydalanuvchi yozganicha (katta-kichik harf saqlanadi) |
| `word_normalized` | varchar(120) | ha | dublikat va qidiruv uchun: kichik harf, chetdagi tinish belgilari va ortiqcha bo'shliqlar olib tashlangan (§3.5) |
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

### 3.2. Endpointlar

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
`null` (yozuv o'chirilmaydi, §3.4).

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

### 3.3. Validatsiya (`422 VALIDATION_ERROR`)

| Maydon | Qoida |
|---|---|
| `word` | trim'dan keyin 1–120 belgi |
| `translation` | ≤ 500 belgi |
| `context` | ≤ 500 belgi |
| `page` | ≥ 1; maqolaning `page_count` idan oshmasin |
| `rects` | ≤ 200 element; har biri 4 ta son, 0 ≤ qiymat ≤ 1 |
| `learned` | boolean |

### 3.4. Ruxsatlar va biznes qoidalari

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

### 3.5. `word_normalized` qoidasi (frontend bilan bir xil bo'lishi kerak)

```
1. Kichik harfga (locale-aware lowercase)
2. ʻ ʼ ‘ ’ ` → '   (o'zbek apostroflari bir xil bo'lsin)
3. Chetdagi bo'shliq va tinish belgilarini olib tashlash:  " ' « » “ ” . , ; : ! ? ( ) [ ] { } — – -
4. Ichkaridagi ketma-ket bo'shliqlarni bittaga
```

Frontend'dagi amaliyot: `normalizeWord()` — `src/lib/api/vocabulary.ts`.

### 3.6. Xato kodlari

| HTTP | `code` | Qachon |
|---|---|---|
| 401 | `AUTHENTICATION_REQUIRED` | token yo'q/eskirgan |
| 403 | `BOOK_ACCESS_DENIED` | maqola kitobiga ruxsat yo'q (POST, `/articles/{id}/vocabulary`) |
| 404 | `VOCAB_NOT_FOUND` | yozuv yo'q yoki boshqa foydalanuvchiniki |
| 404 | `ARTICLE_NOT_FOUND` | `article_id` noto'g'ri |
| 409 | `VOCAB_DUPLICATE` | shu maqoladan bu so'z bor; `details.entry_id` |
| 409 | `VOCAB_LIMIT_REACHED` | limit tugagan |
| 422 | `VALIDATION_ERROR` | §3.3 |
| 429 | `RATE_LIMIT_EXCEEDED` | juda tez qo'shish |

---

## 4. Mavjud ma'lumotni ko'chirish (migratsiya) — MUHIM

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
  normalize_word(a.selected_text),        -- §3.5 dagi funksiya
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
2. Frontend: `src/lib/api/vocabulary.ts` yangi endpointlarga o'tkaziladi (mock va e2e testlar tayyor — §6).
3. Bir vaqtda deploy: avval backend (migratsiya bilan), keyin frontend. Oraliqda eski frontend annotatsiyalar bilan
   ishlashda davom etadi — migratsiya `ON CONFLICT DO NOTHING` bilan qayta ishga tushirilsa oraliqda qo'shilganlar
   ham ko'chadi.

---

## 5. Minimal alternativa (agar to'liq API hozir qimmat bo'lsa)

Faqat bitta endpoint: **`GET /api/v1/me/annotations`** — foydalanuvchining barcha maqolalar bo'yicha
annotatsiyalari, filtrlar: `type`, `label`, `page`, `page_size`; har elementda `article_title`, `book_id`,
`book_title`. Bu frontend'dagi ~60 ta so'rovni bittaga tushiradi (asosiy muammo №1). Qidiruv/filtr/statistika
brauzerda qoladi. Lekin uzoq muddatda §3 tavsiya etiladi.

---

## 6. Frontend tomonda nima tayyor (ma'lumot uchun)

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

## 7. Qabul qilish mezonlari (backend tayyor deb hisoblanishi uchun)

- [ ] `vocabulary_entries` jadvali, unique va indekslar (§3.1).
- [ ] 7 ta endpoint (§3.2) OpenAPI'da (`/openapi.json`) sxemalari bilan.
- [ ] Validatsiya va xato kodlari (§3.3, §3.6) — `VOCAB_DUPLICATE` da `details.entry_id`.
- [ ] Ruxsat qoidalari (§3.4): boshqa foydalanuvchi yozuvi → 404; ruxsatsiz kitob → POST 403; ruxsat bekor
      qilinsa ham o'z so'zlari ro'yxatda qoladi.
- [ ] `word_normalized` §3.5 bo'yicha (o'zbek apostroflari bilan).
- [ ] Migratsiya skripti (§4) staging'da sinalgan: annotatsiya → lug'at, `id` saqlangan.
- [ ] Unit/integration testlar: CRUD, dublikat, filtr (`search`, `book_id`, `learned`), saralash, sahifalash,
      statistika, ruxsatlar.
- [ ] Javob vaqti: `GET /me/vocabulary` 1 000 ta so'zda < 200 ms (indekslar bilan).
- [ ] `API.md` ga bo'lim qo'shilgan.

Savollar bo'lsa — frontend jamoasi: `FRONTEND_PLAN.md` 33-bo'lim va B30 eslatmasi.
