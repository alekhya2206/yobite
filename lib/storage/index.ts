// lib/storage/index.ts
// Typed, SSR-safe localStorage layer. The single client source of truth for the
// universal goal/profile, the one active session, and My Places. Every reader
// guards `window` so it is import-safe in server components; every writer is a
// no-op without storage (private mode, SSR). Plan 3 swaps these bodies for
// Supabase without changing a single signature.
import type { Goal } from "@/lib/ranker/types";
import type { ActiveSession, Place, Profile } from "./types";

const K_PROFILE = "yobite:profile";
const K_SESSION = "yobite:session";
const K_PLACES = "yobite:places";

const DEFAULT_PROFILE: Profile = { goal: { id: "balanced" }, dietary: [] };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — degrade silently */
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/* ---- profile + goal ---- */
export function getProfile(): Profile {
  const p = read<Partial<Profile>>(K_PROFILE, DEFAULT_PROFILE);
  return { goal: p.goal ?? DEFAULT_PROFILE.goal, dietary: p.dietary ?? [], onboarded: p.onboarded === true };
}
export function saveProfile(p: Profile): void {
  write(K_PROFILE, p);
}

/* ---- first-run onboarding ---- */
export function hasOnboarded(): boolean {
  return getProfile().onboarded === true;
}
/** Finish first-run setup: persist dietary choices and mark the user onboarded. */
export function completeOnboarding(dietary: string[]): void {
  saveProfile({ ...getProfile(), dietary, onboarded: true });
}
export function getGoal(): Goal {
  return getProfile().goal;
}
export function saveGoal(goal: Goal): void {
  saveProfile({ ...getProfile(), goal });
}

/* ---- active session (exactly one) ---- */
export function newSession(placeName: string, dishes: string[]): ActiveSession {
  return { id: uid(), placeName, dishes, goal: getGoal(), startedAt: Date.now() };
}
export function getSession(): ActiveSession | null {
  return read<ActiveSession | null>(K_SESSION, null);
}
export function saveSession(s: ActiveSession): void {
  write(K_SESSION, s);
}
export function clearSession(): void {
  remove(K_SESSION);
}

/* ---- my places (user library — screens land in Plan 2B) ---- */
export function listPlaces(): Place[] {
  return read<Place[]>(K_PLACES, []).slice().sort((a, b) => b.lastVisited - a.lastVisited);
}
export function getPlace(name: string): Place | null {
  const key = name.trim().toLowerCase();
  return listPlaces().find((p) => p.name.trim().toLowerCase() === key) ?? null;
}
export function upsertPlace(place: Place): void {
  const key = place.name.trim().toLowerCase();
  const all = read<Place[]>(K_PLACES, []);
  const existing = all.find((p) => p.name.trim().toLowerCase() === key);
  const others = all.filter((p) => p.name.trim().toLowerCase() !== key);
  // Preserve original name casing (first-write wins for the name field)
  const merged: Place = { ...place, name: existing?.name ?? place.name };
  write(K_PLACES, [...others, merged]);
}
