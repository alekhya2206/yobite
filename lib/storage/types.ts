// lib/storage/types.ts
import type { Goal, RankResult } from "@/lib/ranker/types";

/** The user's universal preferences. Goal defaults per-meal but lives here. */
export interface Profile {
  goal: Goal;
  dietary: string[];
}

/** One active dining session. Persists across app close/reopen. */
export interface ActiveSession {
  id: string;
  placeName: string;
  dishes: string[];
  /** Per-meal goal — seeded from the profile goal, overridden on the intent screen. */
  goal: Goal;
  /** The diner's raw mood text for THIS meal (free text / shortcut). Drives the AI ranking. */
  mood?: string;
  ateToday?: string;
  startedAt: number;
  /** Cached verdict so re-opening "Back to your picks" is instant. */
  verdict?: RankResult;
}

/** A restaurant the user has scanned — their own library (My Places, Plan 2B). */
export interface Place {
  name: string;
  dishes: string[];
  lastVisited: number;
  verified?: boolean;
}
