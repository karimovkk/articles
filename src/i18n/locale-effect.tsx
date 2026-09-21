"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

/** `<html lang>` ni saqlangan tilga moslaydi (server default `uz` bilan render qiladi). */
export function LocaleEffect() {
  const { locale } = useT();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
