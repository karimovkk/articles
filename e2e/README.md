# e2e testlar

Mock backend (`mock/server.mjs`, OpenAPI 2026-09-21 shakllari) + headless brauzer (`playwright-core`, tizimdagi Chrome).

```bash
npm run e2e                       # mock + next dev, barcha to'plamlar
npm run e2e -- --prod             # mock + next build/start (production)
npm run e2e -- reader catalog     # faqat tanlanganlar
E2E_BROWSER=firefox npm run e2e   # Playwright Firefox build'i kerak: npx playwright-core install firefox
E2E_BROWSER=webkit  npm run e2e   # Safari dvigateli:                npx playwright-core install webkit
```

Chrome topilmasa `CHROME_PATH=/path/to/chrome`. Skrinshotlar `e2e/out/` ga tushadi (git'ga kirmaydi).

## Prod smoke (`prod/`)

Haqiqiy backend'ga ulangan frontend'ga qarshi (masalan `BACKEND_URL=https://... next dev -p 3200`):

```bash
A365_EMAIL=... A365_PASS=... E2E_BASE=http://localhost:3200 node e2e/prod/smoke-readonly.test.mjs   # faqat o'qish
A365_EMAIL=... A365_PASS=... E2E_BASE=http://localhost:3200 node e2e/prod/smoke-features.test.mjs   # faqat o'qish
A365_EMAIL=... A365_PASS=... E2E_BASE=http://localhost:3200 node e2e/prod/smoke-reader.test.mjs     # admin'ga vaqtinchalik
                                                                                                   # ruxsat beradi, oxirida bekor qiladi
```

Parolni env orqali bering — faylga yozmang.
