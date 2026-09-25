/**
 * 35: ko'p kitobga chegirma — mahalliy hisob (savatcha darhol yangilanishi uchun). Qoida backend bilan bir xil
 * (`BACKEND_TASKS.md` §2.2): buyurtmadagi **pullik** kitoblar soni `q`; eng katta pog'ona `min_quantity ≤ q`;
 * har kitob narxi = `min(kitob narxi, pog'ona narxi)`; 1 ta — o'z narxi. Yakuniy summa baribir serverdan
 * (`POST /orders/quote`) olinadi.
 */
import type { OrderItem, OrderQuote, PricingConfig } from "@/lib/api";

export interface PricedBook {
  book_id: string;
  title?: string | null;
  price: string | number;
}

const num = (v: string | number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number) => n.toFixed(2);

/** `q` ta pullik kitob uchun pog'ona narxi (yo'q bo'lsa — `null`, ya'ni o'z narxi) */
export function tierPrice(cfg: PricingConfig, q: number): number | null {
  const tier = cfg.tiers.filter((t) => t.min_quantity <= q).sort((a, b) => b.min_quantity - a.min_quantity)[0];
  return tier ? num(tier.unit_price) : null;
}

export function quoteLocal(books: PricedBook[], cfg: PricingConfig): OrderQuote {
  const paid = books.filter((b) => num(b.price) > 0);
  const q = paid.length;
  const cap = tierPrice(cfg, q);
  const items: OrderItem[] = paid.map((b) => {
    const list = num(b.price);
    return { book_id: b.book_id, book_title: b.title ?? null, list_price: money(list), unit_price: money(cap == null ? list : Math.min(list, cap)) };
  });
  const subtotal = items.reduce((s, i) => s + num(i.list_price), 0);
  const total = items.reduce((s, i) => s + num(i.unit_price), 0);
  const next = cfg.tiers.filter((t) => t.min_quantity > q).sort((a, b) => a.min_quantity - b.min_quantity)[0];
  return {
    items,
    quantity: q,
    subtotal: money(subtotal),
    discount: money(subtotal - total),
    total: money(total),
    currency: cfg.currency,
    next_tier: next ? { min_quantity: next.min_quantity, unit_price: next.unit_price, add_count: next.min_quantity - q } : null,
  };
}

/** Katalog/kitob sahifasidagi aksiya matni uchun: 1 / 2 / 3+ narxlar (pog'onalar tartibida) */
export function tierLadder(cfg: PricingConfig): Array<{ min: number; price: number; plus: boolean }> {
  const tiers = cfg.tiers.slice().sort((a, b) => a.min_quantity - b.min_quantity);
  return tiers.map((t, i) => ({ min: t.min_quantity, price: num(t.unit_price), plus: i === tiers.length - 1 }));
}
