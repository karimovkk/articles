/**
 * Yer shari quruqlik niqobi — nuqtali globus (login sahifasi) uchun.
 * Fibonacci sferasidagi `LAND_N` ta nuqtaning qaysi biri quruqlikda ekanini bildiruvchi bitset (base64, LSB-first).
 * Manba: Natural Earth 1:110m land (public domain, world-atlas@2/land-110m.json) — bir martalik oflayn rasterlash.
 * Nuqta i: sin(kenglik) = 1 − 2(i + 0.5)/N, uzunlik = (i · oltin burchak) mod 2π − π.
 */
export const LAND_N = 7000;
export const LAND_MASK_B64 =
  "AABACAgJIQslJAQElIABMDRABszIkZk5ErN25ltee4t/f+Xt7/2Vv7/3dv7/ztt9eyt79+2s/L2VsfN3Ul7Oysu5OSkzZ+T03JyQnzNzemZOyO25OTk/p+b23Jyc23Nzem5Oz8m5OT03p+bmnJyak1Nze25Ozcm5OTUnp2bk3JyakxMzak5OzMgZGTmnp2bUjIyYU3NyYk5OzakZOTGjJuTEjJiYUzNick5OyKkZMTUjJuT0jJiakRNiakZMyOgZMSWjJmTUjJiSURNiSkZNyagpMSWnpuTUlJqSU1JiSk5JySkpJSWnoMTUnJKSU1BqakpJiSgoJSWnoNQUnJKCU1BKCkpJySgpJQWmpNSUlJICU1JKCkhNoSApJQWmpNBQkJoCQ0JKCkhJoSAgNRWEpFQQkJrCQkBqCAhJoSAgNQWEoBQQEIpCQkBKCghFISEgBISFoJQQEIpCQkAKCghBISEgJASFgJRQEApKQkBKKAgBJaEgBBSFgJBQEALKQkFKKAgBJaEoBBSEgJJQEAAKQlEBKggABamgABQEggJQEAAKQlEBKghABaigABQEogJUFIAKQFEBKAhERaCoABSAogJUUIgKQEERKCBERaCoCBSQgiJUUAwKyEERKCAEBeCgGBSQgwJQQAwKSEERKiAEBaCgGBWQogJQRAgKSEEBKCAGBaCgEBSQggJQQAgKQEERKCAEBaCAABSBggJQQAgKQEEBKAIFBaCIAByFgiJQRAqKQBERKAoFBaCIABSBIiJQFAKKQBERKApFRKCIABSBIiJQFIKKQBERKgJFRKAoCBWBIiJQBIqIQBEQKgJFQKAoCBGBIiBQBIqAQBEQKgJFQKAIGBGBIiBUBIqAQBEQIgJFQKAIEAGBIiBEBIqAQAEwAgIFQIAAEAGBAiAEBAqAAAAgAAIEQAAAEAABAkAAAAiAAAAgAAAEgAAAEAgAAEAAAAgAAAAgEAAAgAAAEAABAEAAAAAAgAAgAAAAgAAAAAAAAUAAAAAAAQAAAAAAgAAAAAACAAAAAAAAAQAAAAAAAAAAAAACAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAASEgpASUlJDSUVpaS09r6S09ref3/Lyf1/P7fn/P7+/9//8=";

/** Quruqlikdagi nuqtalarning birlik vektorlari [x, y, z] (y — shimol). */
export function landPoints(): Float32Array {
  const bin = typeof atob === "function" ? atob(LAND_MASK_B64) : Buffer.from(LAND_MASK_B64, "base64").toString("binary");
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: number[] = [];
  for (let i = 0; i < LAND_N; i++) {
    if (!((bin.charCodeAt(i >> 3) >> (i & 7)) & 1)) continue;
    const y = 1 - (2 * (i + 0.5)) / LAND_N;
    const r = Math.sqrt(1 - y * y);
    const lon = ((golden * i) % (2 * Math.PI)) - Math.PI;
    out.push(r * Math.sin(lon), y, r * Math.cos(lon));
  }
  return new Float32Array(out);
}
