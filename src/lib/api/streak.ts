/**
 * 44.6: kunlik o'qish seriyasi (Duolingo kabi). Backend o'zi hisoblaydi: o'qish harakati (progress / heartbeat)
 * bo'lgan har kun (UTC) seriyani oshiradi, kun o'tkazib yuborilsa 1 ga tushadi. FE alohida "+1" yubormaydi.
 *   GET /me/streak · GET /streak/leaderboard?limit=20 (top + o'zingiz)
 */
import { api } from "./client";

export interface Streak {
  current_streak: number;
  longest_streak: number;
  total_days: number;
  last_activity_date: string | null;
  active_today: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  current_streak: number;
  longest_streak: number;
  is_me?: boolean;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export const streakApi = {
  me(): Promise<Streak> {
    return api<Streak>("/me/streak");
  },
  leaderboard(limit = 20): Promise<Leaderboard> {
    return api<Leaderboard>("/streak/leaderboard", { query: { limit } });
  },
};
