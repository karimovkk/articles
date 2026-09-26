import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Server HTML'da `false`, React sahifani jonlantirgach `true`. Forma maydonlari (`readOnly`) va tugmasi (`disabled`)
 * shu bilan kutadi: JS ishga tushmasdan yozilgan matnni React bo'sh holat bilan almashtirardi, bosilgan tugma esa
 * formani oddiy HTML sifatida yuborib, sahifani jim qayta yuklardi (sekin telefon / Safari).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
