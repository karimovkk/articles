/**
 * Sahifalar keshi (sirpanuvchi oyna): oldingi, joriy va keyingi sahifa brauzer **xotirasida** tayyor chizilgan
 * canvas bo'lib turadi — varaqlanganda sahifa darhol ko'rinadi (bo'sh oq varaq va kutish yo'q).
 *
 *  - `focus(order)` — oynani belgilaydi; `order` — muhimlik tartibi (birinchisi — joriy sahifa). Oynadan chiqqan
 *    sahifalar xotiradan o'chiriladi, yetishmayotganlari shu tartibda yuklanadi.
 *  - Render navbati **ketma-ket** (bir vaqtda bitta sahifa): joriy sahifa qo'shnilar bilan tarmoq/worker uchun
 *    talashmaydi, birinchi bo'lib chiqadi.
 *  - `acquire`/`release` — sahifa hozir ekranda ishlatilyapti (scroll rejimida oynadan tashqaridagi sahifalar ham
 *    ko'rinadi): ishlatilayotgan canvas o'chirilmaydi, qo'yib yuborilgach oynada bo'lmasa — tozalanadi.
 *
 * Diskka (IndexedDB/Cache) hech narsa yozilmaydi: kontent `Cache-Control: no-store` (SECURITY.md §5) — himoyalangan
 * PDF qurilmada saqlanib qolmasligi kerak. Kesh vkladka yopilganda yoki maqola almashganda yo'qoladi.
 */

export type PaintPage = (page: number, canvas: HTMLCanvasElement) => Promise<void>;

interface Job {
  key: string;
  started: boolean;
  promise: Promise<HTMLCanvasElement>;
  resolve: (c: HTMLCanvasElement) => void;
  reject: (e: unknown) => void;
}

const abortError = () => Object.assign(new Error("page cache: cancelled"), { name: "AbortError" });

function freeCanvas(c: HTMLCanvasElement) {
  c.remove();
  // Canvas xotirasi darhol bo'shaydi (ayniqsa iOS — umumiy canvas xotirasi cheklangan)
  c.width = 0;
  c.height = 0;
}

export class PageCache {
  private entries = new Map<number, { key: string; canvas: HTMLCanvasElement }>();
  private jobs = new Map<number, Job>();
  private order: number[] = [];
  private keep = new Set<number>();
  private used = new Map<number, number>();
  private running = false;
  private destroyed = false;

  /**
   * @param paint — sahifani berilgan canvas'ga chizadi (o'lcham, suv belgisi ham)
   * @param key — joriy chizish parametrlari (masshtab, suv belgisi); o'zgarsa eski canvas'lar yaroqsiz
   */
  constructor(
    private paint: PaintPage,
    private key: () => string,
  ) {}

  /** Tayyor (joriy parametrlarda chizilgan) canvas — bo'lmasa `null` */
  peek(page: number): HTMLCanvasElement | null {
    const e = this.entries.get(page);
    return e && e.key === this.key() ? e.canvas : null;
  }

  /** Sahifa canvas'i: keshda bo'lsa — darhol, bo'lmasa navbatga qo'yiladi (ustuvorligi `focus` tartibidan) */
  ensure(page: number): Promise<HTMLCanvasElement> {
    if (this.destroyed) return Promise.reject(abortError());
    const k = this.key();
    const ready = this.entries.get(page);
    if (ready && ready.key === k) return Promise.resolve(ready.canvas);
    const job = this.jobs.get(page);
    if (job && job.key === k) return job.promise;
    if (job && !job.started) {
      // Eski parametrlardagi kutilayotgan ish — yangisiga almashtiriladi
      this.jobs.delete(page);
      job.reject(abortError());
    }
    let resolve!: Job["resolve"];
    let reject!: Job["reject"];
    const promise = new Promise<HTMLCanvasElement>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Kutuvchisi qolmagan ish rad etilsa — "unhandled rejection" bo'lmasin
    promise.catch(() => undefined);
    this.jobs.set(page, { key: k, started: false, promise, resolve, reject });
    void this.pump();
    return promise;
  }

  /**
   * Oynani yangilash: `order` — saqlanadigan sahifalar, muhimlik tartibida (birinchisi — joriy).
   * Oynadan tashqaridagi (va ekranda ishlatilmayotgan) sahifalar o'chiriladi, qolganlari oldindan yuklanadi.
   */
  focus(order: number[]): void {
    if (this.destroyed) return;
    this.order = order;
    this.keep = new Set(order);
    for (const [page, e] of this.entries) {
      if (!this.keep.has(page) && !this.used.get(page)) {
        this.entries.delete(page);
        freeCanvas(e.canvas);
      }
    }
    for (const [page, job] of this.jobs) {
      if (!job.started && !this.keep.has(page) && !this.used.get(page)) {
        this.jobs.delete(page);
        job.reject(abortError());
      }
    }
    for (const page of order) this.ensure(page).catch(() => undefined);
  }

  /** Sahifa ekranda ishlatila boshladi (canvas DOM'da) */
  acquire(page: number): void {
    this.used.set(page, (this.used.get(page) ?? 0) + 1);
  }

  /** Sahifa ekrandan ketdi — oynada bo'lmasa canvas ham, kutilayotgan ish ham bekor */
  release(page: number): void {
    const n = (this.used.get(page) ?? 0) - 1;
    if (n > 0) {
      this.used.set(page, n);
      return;
    }
    this.used.delete(page);
    if (this.keep.has(page)) return;
    const e = this.entries.get(page);
    if (e) {
      this.entries.delete(page);
      freeCanvas(e.canvas);
    }
    const job = this.jobs.get(page);
    if (job && !job.started) {
      this.jobs.delete(page);
      job.reject(abortError());
    }
  }

  destroy(): void {
    this.destroyed = true;
    for (const e of this.entries.values()) freeCanvas(e.canvas);
    this.entries.clear();
    for (const job of this.jobs.values()) job.reject(abortError());
    this.jobs.clear();
    this.used.clear();
  }

  /** Oynadagi sahifalar — `order` bo'yicha; qolganlari (scroll rejimida ko'rinayotganlar) joriy sahifaga yaqinligi bo'yicha */
  private rank(page: number): number {
    const i = this.order.indexOf(page);
    if (i >= 0) return i;
    return 100 + Math.abs(page - (this.order[0] ?? 1));
  }

  private next(): [number, Job] | null {
    let best: [number, Job] | null = null;
    for (const entry of this.jobs) {
      if (entry[1].started) continue;
      if (!best || this.rank(entry[0]) < this.rank(best[0])) best = entry;
    }
    return best;
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let item = this.next(); item && !this.destroyed; item = this.next()) {
        const [page, job] = item;
        job.started = true;
        const canvas = document.createElement("canvas");
        try {
          await this.paint(page, canvas);
        } catch (e) {
          if (this.jobs.get(page) === job) this.jobs.delete(page);
          freeCanvas(canvas);
          job.reject(e);
          continue;
        }
        if (this.jobs.get(page) === job) this.jobs.delete(page);
        if (this.destroyed) {
          freeCanvas(canvas);
          job.reject(abortError());
          break;
        }
        const stale = this.key() !== job.key;
        const wanted = this.keep.has(page) || !!this.used.get(page);
        if (!stale && wanted) {
          const old = this.entries.get(page);
          this.entries.set(page, { key: job.key, canvas });
          // Eski canvas hali ekranda bo'lishi mumkin — yangisi qo'yilgach (keyingi vazifada) tozalanadi
          if (old) setTimeout(() => freeCanvas(old.canvas), 0);
          job.resolve(canvas);
        } else {
          // Parametrlar o'zgardi yoki sahifa endi kerak emas — natija saqlanmaydi
          freeCanvas(canvas);
          job.reject(abortError());
        }
      }
    } finally {
      this.running = false;
    }
  }
}
