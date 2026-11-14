/**
 * Login/ro'yxat foni: qiyshaytirilgan 3D "muqovalar devori". Har bir ustun to'xtovsiz (cheksiz) suzadi — juft
 * ustunlar yuqoriga, toq ustunlar pastga, har biri o'z tezligida; butun devor esa sekin "nafas oladi"
 * (burchagi biroz o'zgaradi). Bitta muqova — "bugungi son" — oltin hoshiya bilan ajralib turadi.
 * Faqat CSS animatsiya (JS kadr sikli yo'q); `prefers-reduced-motion` — devor harakatsiz.
 */
import type { CSSProperties } from "react";

const COVERS = Array.from({ length: 7 }, (_, i) => `/covers/mag-${i + 1}.webp`);
/** Ustunlar soni va har bir ustundagi muqovalar (cheksiz aylanish uchun trek ikki marta takrorlanadi) */
const COLS = 9;
const PER_COL = 5;
/** Ustun bir siklni necha soniyada o'tadi — har xil, devor "jonli" ko'rinsin */
const SPEEDS = [44, 34, 50, 38, 46, 36, 52, 40, 45];
/** "Bugungi son" — markaziy ustunning birinchi muqovasi */
const HOT_COL = 4;

function column(c: number): string[] {
  // Qo'shni ustunlarda bir xil muqova yonma-yon tushmasin — har ustun boshqa qadam bilan siljiydi
  return Array.from({ length: PER_COL }, (_, i) => COVERS[(c * 3 + i * 2) % COVERS.length]);
}

export function CoverWall() {
  return (
    <div className="cover-wall" aria-hidden data-testid="cover-wall">
      <div className="cw-plane">
        {Array.from({ length: COLS }, (_, c) => {
          const items = column(c);
          const style = { "--cw-dur": `${SPEEDS[c]}s`, "--cw-delay": `${-SPEEDS[c] * ((c * 0.37) % 1)}s` } as CSSProperties;
          return (
            <div key={c} className={`cw-col${c % 2 ? " down" : ""}`} style={style}>
              <div className="cw-track">
                {[...items, ...items].map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- dekorativ fon; kichik WebP, 7 ta fayl kesh'dan qayta ishlatiladi
                  <img
                    key={i}
                    src={src}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className={`cw-cover${c === HOT_COL && i % PER_COL === 0 ? " hot" : ""}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
