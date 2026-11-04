# Backend vazifasi: o'qish musiqasi

> Alohida hujjat — `BACKEND_TASKS.md` 5-qismi bilan bir xil mazmun (backend jamoasiga yuborish uchun).
> Frontend kontrakti: `src/lib/api/music.ts`; mock: `e2e/mock/server.mjs` (`/music/*`, `/admin/music/*`).

> **Holat (2026-11-02):** ✅ backend prodga chiqarildi (backend commit `f560b73`, alembic `f2b9d4e7a3c1`).
> Frontend kontrakti — `src/lib/api/music.ts`, prod bilan tekshirildi: `GET /music/tracks` tokensiz `200`,
> `/admin/music/tracks` tokensiz `401`, yo'q trek stream'i `404 TRACK_NOT_FOUND`, CORS `articles365.uz` ga ochiq
> (`Content-Range`/`Accept-Ranges` expose qilingan), nginx 19 MB yuklashni o'tkazadi.
> Reader faqat admin yuklagan treklarni o'ynatadi — o'rnatilgan (standart) tovushlar yo'q. Faol trek bo'lmasa
> (bo'sh ro'yxat, endpoint 404 yoki tarmoq xatosi) reader'da musiqa tugmasi ko'rsatilmaydi.

## 1. Nima uchun

O'quvchi maqolani o'qiyotganda admin yuklagan fon musiqasini (sokin, diqqat uchun, tabiat) shu yerda yoqa olsin —
boshqa ilovaga o'tmasdan. Musiqani administrator yuklaydi va boshqaradi.

## 2. Biznes qoidalari

- Trekni faqat ADMIN yuklaydi, nomini/kayfiyatini o'zgartiradi, yoqadi/o'chiradi, o'chiradi.
- O'quvchilarga (mehmon ham — tekin kitob reader'i) faqat `is_active = true` treklar ko'rinadi, `order_index` bo'yicha.
- Formatlar: **MP3, OGG (Vorbis/Opus), M4A (AAC)**. Hajm: ≤ **20 MB** (env `MAX_MUSIC_MB`, standart 20).
- Format **magic-bayt** bo'yicha tekshiriladi (kengaytma va Content-Type'ga ishonilmaydi):
  MP3 — `ID3` yoki kadr sinxroni `FF Ex/Fx`; OGG — `OggS`; M4A — 4-baytdan `ftyp`.
- Davomiylik (`duration_seconds`) — backend o'zi aniqlaydi (masalan, `ffprobe`/`mutagen`). Frontend yuklashda
  brauzer aniqlagan qiymatni ham yuboradi (`duration_seconds` forma maydoni) — backend aniqlay olmasa shuni oladi.
- Musiqa maxfiy kontent emas: stream endpointi **tokensiz** ishlaydi (`<audio src>` Authorization yubora olmaydi).

## 3. Ma'lumot modeli

```sql
CREATE TABLE music_tracks (
  id               UUID PRIMARY KEY,
  title            VARCHAR(160) NOT NULL,            -- bo'sh bo'lsa fayl nomidan (kengaytmasiz)
  mood             VARCHAR(16)  NOT NULL DEFAULT 'CALM',  -- CALM | FOCUS | NATURE | CLASSICAL | LOFI
  mime_type        VARCHAR(40)  NOT NULL,            -- audio/mpeg | audio/ogg | audio/mp4
  file_size        BIGINT       NOT NULL,
  duration_seconds INTEGER,                          -- NULL — aniqlanmagan
  storage_key      TEXT         NOT NULL,            -- STORAGE.md dagi kitob fayllari kabi
  file_version     INTEGER      NOT NULL DEFAULT 1,  -- URL'da ?v= — kesh yangilanadi
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  order_index      INTEGER      NOT NULL DEFAULT 0,
  created_by_admin_id UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

## 4. Public endpointlar (tokensiz ham)

`GET /music/tracks` → `200`, faqat faollar, `order_index, created_at` bo'yicha (sahifalashsiz — treklar kam):

```jsonc
[
  { "id": "uuid", "title": "Tonggi sokinlik", "mood": "CALM", "duration_seconds": 184,
    "mime_type": "audio/mpeg", "file_size": 2949120, "file_version": 1, "updated_at": "2026-11-02T08:00:00Z" }
]
```

`GET /music/tracks/{id}/stream` → audio baytlari:
- `Content-Type` — `mime_type`; **`Accept-Ranges: bytes`**, `Range` → `206` + `Content-Range` (Safari/iOS Range'siz
  ijro etmaydi va oldinga o'tkazib bo'lmaydi);
- `Cache-Control: public, max-age=86400` (URL'da `?v=file_version` bor);
- nofaol yoki yo'q trek → `404 TRACK_NOT_FOUND`;
- frontend backend'ga boshqa domendan murojaat qilsa (`NEXT_PUBLIC_API_URL`) — `Access-Control-Allow-Origin` kerak.

## 5. Admin endpointlari (ADMIN roli)

| Metod | Yo'l | Tana | Javob |
|---|---|---|---|
| `GET` | `/admin/music/tracks` | — | `200` barcha treklar (nofaollar ham), yuqoridagi shakl + `is_active`, `order_index`, `created_at` |
| `POST` | `/admin/music/tracks` | `multipart/form-data`: `file` (majburiy), `title?`, `mood?`, `duration_seconds?` | `201` yangi trek |
| `PATCH` | `/admin/music/tracks/{id}` | `{ "title?", "mood?", "is_active?", "order_index?" }` | `200` yangilangan trek |
| `DELETE` | `/admin/music/tracks/{id}` | — | `200 { "message": "deleted" }` — fayl ham o'chiriladi |

Xatolar (umumiy konvert):

| Holat | Javob |
|---|---|
| Format MP3/OGG/M4A emas (magic-bayt) | `415 UNSUPPORTED_MEDIA_TYPE` |
| Hajm > limit | `413 FILE_TOO_LARGE` (`details.max_mb`) |
| Bo'sh fayl | `422 EMPTY_FILE` |
| `mood` ro'yxatda yo'q | `422 VALIDATION_ERROR` |
| Trek topilmadi | `404 TRACK_NOT_FOUND` |

Audit log: `MUSIC_TRACK_UPLOADED`, `MUSIC_TRACK_UPDATED` (o'zgargan maydonlar), `MUSIC_TRACK_DELETED`.

## 6. Frontend'da nima tayyor (ma'lumot uchun)

- Admin → **Musiqa** (`/admin/music`): fayllarni sudrab tashlash (bir nechta), progress, format/hajm tekshiruvi,
  ro'yxatda tinglab ko'rish, nomini o'zgartirish, kayfiyat, yoqish/o'chirish, tasdiq bilan o'chirish.
- Reader: toolbar'da musiqa tugmasi — **bir bosishda** yoqiladi/to'xtaydi (oxirgi trek); panelda trek/kayfiyat,
  ovoz, takrorlash, uyqu taymeri. Faol trek bo'lmasa — musiqa tugmasi umuman ko'rinmaydi (o'rnatilgan tovushlar yo'q).

## 7. Qabul qilish mezonlari

1. MP3/OGG/M4A yuklanadi, PDF yoki `.mp3` deb nomlangan rasm — `415`.
2. 25 MB fayl — `413`.
3. Nofaol trek `GET /music/tracks` da yo'q, stream'i `404`.
4. `Range: bytes=0-1023` → `206`, `Content-Range: bytes 0-1023/<size>`.
5. Tokensiz `GET /music/tracks` va stream ishlaydi; admin endpointlari tokensiz — `401`, USER bilan — `403`.

