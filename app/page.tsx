// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Deck } from "@/components/Deck";
import { CheckIcon, CloseIcon, UserIcon } from "@/components/icons";
import {
  clearSession, getGoal, getSession, listPlaces, newSession, saveSession, upsertPlace,
} from "@/lib/storage";
import { goalLabel } from "@/lib/ranker";
import type { Goal } from "@/lib/ranker/types";
import type { ActiveSession, Place } from "@/lib/storage/types";
import s from "./page.module.css";

// Short descriptors under the goal name on the goal card (matches the mockup).
const GOAL_CHIPS: Record<string, string[]> = {
  "high-protein": ["lean", "grilled", "110g target"],
  "fat-loss": ["lighter", "lower-cal", "veg-forward"],
  balanced: ["a bit of everything", "in moderation"],
};

function goalChips(goal: Goal | null): string[] {
  if (!goal) return [];
  return GOAL_CHIPS[goal.id] ?? (goal.custom ? [goal.custom] : []);
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastPlace, setLastPlace] = useState<Place | null>(null);

  // Client-only: read persisted state after mount (avoids SSR/storage mismatch).
  useEffect(() => {
    setGoalState(getGoal());
    setSession(getSession());
    setLastPlace(listPlaces()[0] ?? null);
    setMounted(true);
  }, []);

  // OV-2: kill first-paint flash of default "Balanced" goal
  if (!mounted) return <div className="app" aria-busy="true" />;

  function endSession() {
    clearSession();
    setSession(null);
  }

  // Revisit a saved place WITHOUT re-scanning — start a session from its cached
  // menu and go straight to the per-meal intent.
  function revisit(p: Place) {
    // Refresh lastVisited so "Last you visited" reflects this revisit (listPlaces sorts by it).
    upsertPlace({ ...p, lastVisited: Date.now() });
    saveSession(newSession(p.name, p.dishes));
    router.push("/intent");
  }

  return (
    <div className="app">
      <main className={s.main}>
        <header className={s.head}>
          <div>
            <p className={s.brand}>YoBite</p>
            <h1 className={s.greet}>Hungry?</h1>
            <p className={s.sub}>Point me at the menu — I&rsquo;ll pick.</p>
          </div>
          <Link href="/profile" className={s.avatar} aria-label="Profile">
            <UserIcon size={20} />
          </Link>
        </header>

        <Link href="/scan" className={s.goalCard}>
          <span className={s.goalEyebrow}>Your goal</span>
          <span className={s.goalName}>{goal ? goalLabel(goal) : "Balanced"}</span>
          {goalChips(goal).length > 0 && (
            <div className={s.goalChips}>
              {goalChips(goal).map((c) => (
                <span key={c} className={s.goalChip}>{c}</span>
              ))}
            </div>
          )}
        </Link>

        {/* DR-3: warm first-run hint for empty state */}
        {mounted && !session && lastPlace === null && (
          <div className={s.firstRun}>
            <p className={s.firstRunTitle}>New here?</p>
            <p className={s.firstRunBody}>Tap <span className={s.firstRunScan}>Scan</span> below to read your first menu — I&rsquo;ll pick your order.</p>
          </div>
        )}

        {session && (
          <section className={s.sessionCard} aria-label="Active dining session">
            <div className={s.sessionTop}>
              <span className={s.diningNow}>● Dining now</span>
              <button className={s.endBtn} onClick={endSession} aria-label="End session">
                End <CloseIcon size={14} />
              </button>
            </div>
            <p className={s.sessionPlace}>You&rsquo;re at {session.placeName}</p>
            <p className={s.sessionMeta}>
              <span className="tnum">{session.dishes.length}</span> dishes · no need to re-scan
            </p>
            <Link href="/order" className={s.backToPicks}>
              Back to your picks →
            </Link>
          </section>
        )}

        {lastPlace && !session && (
          <button className={s.lastCard} onClick={() => revisit(lastPlace)}>
            <span className="eyebrow">Last you visited</span>
            <span className={s.lastName}>{lastPlace.name}</span>
            <span className={`${s.lastMeta} tnum`}>{lastPlace.dishes.length} dishes saved · tap to re-pick</span>
          </button>
        )}

        {/* "Restaurants near you" teaser — Browse library lands in a later plan. */}
        {!session && (
          <Link href="/browse" className={s.nearYou}>
            <CheckIcon size={16} />
            Restaurants near you — coming soon
          </Link>
        )}
      </main>

      <Deck />
    </div>
  );
}
