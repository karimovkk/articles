import { launchedInTelegram } from "@/lib/telegram";
import { useHydrated } from "@/lib/use-hydrated";

/** 111: sayt Telegram Mini App ichida ochilganmi (server HTML va birinchi chizishda — `false`) */
export function useInTelegram(): boolean {
  const hydrated = useHydrated();
  return hydrated && launchedInTelegram();
}
