"use client";
// app/intent/page.tsx
// Per-meal intent screen: "What are you in the mood for — this meal?"
// Amendment 2: clears verdict cache on commit.
// Amendment 3: uses useVoiceInput hook (no direct speechSupported/listenOnce imports).
// OV-2: gates on `ready`; no-session branch returns null (clean redirect, no flash).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, MicIcon } from "@/components/icons";
import { getGoal, getSession, saveSession } from "@/lib/storage";
import { goalToMood } from "@/lib/preferences/goalToMood";
import { useVoiceInput } from "@/lib/useVoiceInput";
import s from "./intent.module.css";

const SHORTCUTS = ["High protein", "Something lighter", "Just the tastiest"];

export default function IntentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState("");
  const [ate, setAte] = useState("");
  const [dishCount, setDishCount] = useState(0);

  // Amendment 3: useVoiceInput hook replaces local state + recite() body.
  const { listening, supported: voiceSupported, start: startVoice } = useVoiceInput(
    (text) => setMood(text),
  );

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      // OV-2: return null cleanly — don't set ready so we fall through to `if (!ready) return null`
      return;
    }
    setDishCount(session.dishes.length);
    setReady(true);
  }, [router]);

  // Store the raw mood for THIS meal. The AI does the ranking at /order — no intent call here.
  // Empty (skip) → use the universal profile goal phrased as a mood.
  function commit(text: string) {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    const moodText = text.trim() || goalToMood(getGoal());
    // Clear any cached verdict whenever the mood/ate changes.
    saveSession({ ...session, mood: moodText, ateToday: ate.trim() || undefined, verdict: undefined });
    router.push("/order");
  }

  // OV-2: renders null until session is confirmed (no blank shell flash).
  if (!ready) return null;

  return (
    <div className="app">
      <header className={s.bar}>
        <button className={s.back} onClick={() => router.back()} aria-label="Back">
          <BackIcon size={20} />
        </button>
        <span className="tnum">{dishCount} dishes read</span>
      </header>

      <main className={s.main}>
        <h1 className={s.q}>What are you in the mood for — this meal?</h1>

        <label htmlFor="mood" className="sr-only">Your mood this meal</label>
        <div className={s.field}>
          <input
            id="mood"
            className={s.input}
            placeholder="e.g. high protein but not too heavy"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
          {voiceSupported && (
            <button
              className={`${s.mic}${listening ? ` ${s.listening}` : ""}`}
              onClick={startVoice}
              aria-label={listening ? "Listening…" : "Say it"}
            >
              <MicIcon size={18} />
            </button>
          )}
        </div>

        <div className={s.shortcuts}>
          <span className={s.orPick}>or pick one</span>
          {SHORTCUTS.map((sc) => (
            <button key={sc} className={s.chip} onClick={() => setMood(sc)}>
              {sc}
            </button>
          ))}
        </div>

        <label htmlFor="ate" className={s.ateLabel}>
          Eaten anything earlier? <span className={s.optional}>optional</span>
        </label>
        <input
          id="ate"
          className={s.input}
          placeholder="e.g. 2 eggs & a banana"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
      </main>

      <div className={s.dock}>
        <button className={s.cta} onClick={() => commit(mood)}>
          Find my pick →
        </button>
        <button className={s.skip} onClick={() => commit("")}>
          Skip — just use my usual goal
        </button>
      </div>
    </div>
  );
}
