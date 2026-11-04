"use client";

import { useEffect } from "react";
import { stopAll } from "@/lib/music/engine";

/** 124: reader layout'idan chiqilganda (kitob sahifasi, katalog…) musiqa to'xtaydi; maqolalar orasida — davom etadi */
export function MusicScope() {
  useEffect(() => () => stopAll(), []);
  return null;
}
