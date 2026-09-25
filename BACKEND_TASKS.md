# Backend uchun texnik topshiriqlar — Articles365

Bu faylda frontend tayyor bo'lgan, lekin backend'da hali yo'q bo'lgan ikki funksiya uchun to'liq topshiriq:

| Qism | Funksiya | Frontend holati | Backend kerak |
|---|---|---|---|
| [1-qism](#1-qism-lugat-vocabulary) | **Lug'at** — PDF'dan so'z qo'shish, tarjima, takrorlash | tayyor, **jonli saytda ishlaydi** (vaqtinchalik — annotatsiyalar orqali) | alohida `/me/vocabulary` API (tezlik, qidiruv, statistika) |
| [2-qism](#2-qism-savatcha-va-kop-kitobga-chegirma) | **Savatcha va ko'p kitobga chegirma** — 2 ta kitob donasi 39 000, 3+ — 30 000 | tayyor va testlangan (mock), **jonli saytda backend kutilmoqda** — `GET /pricing` paydo bo'lishi bilan o'zi yoqiladi | `pricing`, `orders/quote`, `orders/checkout`, `order_items` |

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

Kitoblarning deyarli hammasi **49 000 so'm**. Bitta buyurtmadagi **pullik** kitoblar soniga qarab:

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

