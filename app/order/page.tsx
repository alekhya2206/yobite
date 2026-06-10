"use client";
// app/order/page.tsx
// The verdict poster — the heart of YoBite. Reads the active session, ranks it
// (or shows the cached verdict instantly), and renders one confident "Order this".
// Amendment 2: cache fast-path + verdict caching; retry copy "…Tap to retry."
// DR-1: AA-safe "Heavier — go easy" (terracotta lives in the left border, not text).
// DR-2: signature calm reveal — breathing pulse loader + poster rise (no spin).
// OV-2: no-session branch returns null (no blank shell flash).
// OV-4: tests unstub fetch between cases.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { clearSession, getSession, saveSession } from "@/lib/storage";
import { planFullMeal, type FullMeal } from "@/lib/meal/planFullMeal";
import type { RankResult, RankedDish } from "@/lib/ranker/types";
import s from "./order.module.css";

export default function OrderPage() {
  const router = useRouter();
  // Hold the router in a ref so `load` stays referentially stable. The mocked
  // useRouter returns a fresh object each render; depending on it would make the
  // load effect re-fire on every state update → an infinite fetch loop.
  const routerRef = useRef(router);
  routerRef.current = router;

  const [result, setResult] = useState<RankResult | null>(null);
  const [place, setPlace] = useState("");
  // null = no session yet (redirecting); true = ranking; false = settled.
  const [loading, setLoading] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [meal, setMeal] = useState<FullMeal | null>(null);

  // Close the "Plan a full meal" dialog on Escape (a11y for the aria-modal sheet).
  useEffect(() => {
    if (!meal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMeal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [meal]);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      routerRef.current.replace("/");
      return; // OV-2: leave loading null → render null, no blank shell.
    }
    setPlace(session.placeName);
    // Amendment 2: cached verdict → instant ("Back to your picks" re-open), no fetch.
    if (session.verdict) {
      setResult(session.verdict);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishes: session.dishes,
          // The diner's raw mood drives the AI ranking (Architecture B).
          mood: session.mood ?? "",
          ateToday: session.ateToday,
        }),
      });
      if (!res.ok) throw new Error("rank failed");
      const data = (await res.json()) as RankResult;
      setResult(data);
      saveSession({ ...session, verdict: data });
    } catch {
      setError("Couldn't rank the menu just now. Tap to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function end() {
    clearSession();
    router.push("/");
  }

  // OV-2: no active session → render nothing while the redirect lands.
  if (loading === null) return null;

  // DR-2: the signature calm reveal — a breathing pulse, never a spinner.
  if (loading) {
    return (
      <div className="app">
        <div className={s.thinking}>
          <span className={s.breath} aria-hidden="true" />
          <p>Finding your pick…</p>
        </div>
      </div>
    );
  }

  if (error || !result || !result.best) {
    return (
      <div className="app">
        <div className={s.thinking}>
          <p>{error || "Nothing rankable on this menu."}</p>
          <button className={s.retry} onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const best = result.best;

  return (
    <div className="app">
      <header className={s.bar}>
        <button className={s.back} onClick={() => router.back()} aria-label="Back">
          <BackIcon size={20} />
        </button>
        <span className={s.place}>{place}</span>
        <span className={s.goalPill}>{result.goalLabel}</span>
        <span className={s.barSpacer} />
        <button className={s.end} onClick={end} aria-label="End session">
          End <CloseIcon size={14} />
        </button>
      </header>

      <main className={s.poster}>
        <section className={s.hero}>
          <span className={s.heroEyebrow}>Order this · {result.goalLabel}</span>
          <h1 className={s.heroName}>{best.name}</h1>
          <div className={s.chips}>
            {best.chips.map((c) => (
              <span key={c} className={s.chip}>
                {c}
              </span>
            ))}
          </div>
          <p className={s.why}>{result.bestWhy}</p>
        </section>

        {result.alsoGood.length > 0 && (
          <section className={s.block}>
            <h2 className={s.blockTitle}>Also good</h2>
            {result.alsoGood.map((d) => (
              <AlsoRow key={d.name} dish={d} />
            ))}
          </section>
        )}

        {result.heavier.length > 0 && (
          <section className={`${s.block} ${s.heavyBlock}`}>
            <h2 className={s.blockTitle}>Heavier — go easy</h2>
            {result.heavier.map((d) => (
              <div key={d.name} className={s.heavyRow}>
                <span className={s.heavyName}>{d.name}</span>
                <span className={s.heavyReason}>{d.reason}</span>
              </div>
            ))}
          </section>
        )}
      </main>

      <div className={s.planBarWrap}>
        <button className={s.planBar} onClick={() => setMeal(planFullMeal(result))}>
          Plan a full meal
        </button>
      </div>

      {meal && (
        <div className={s.sheetWrap} role="dialog" aria-label="Plan a full meal" aria-modal="true">
          <div className={s.sheetScrim} onClick={() => setMeal(null)} />
          <div className={s.sheet}>
            <div className={s.sheetHead}>
              <h2 className={s.sheetTitle}>A full meal</h2>
              <button className={s.sheetClose} onClick={() => setMeal(null)} aria-label="Close">
                <CloseIcon size={18} />
              </button>
            </div>
            <Course label="Starter" dish={meal.starter} />
            <Course label="Main" dish={meal.main} />
            <Course label="Dessert" dish={meal.dessert} />
          </div>
        </div>
      )}
    </div>
  );
}

function AlsoRow({ dish }: { dish: RankedDish }) {
  return (
    <div className={s.alsoRow}>
      <div>
        <span className={s.alsoName}>{dish.name}</span>
        <span className={s.alsoReason}>{dish.reason}</span>
      </div>
      <span className={s.alsoCheck} aria-hidden="true">
        <CheckIcon size={20} />
      </span>
    </div>
  );
}

function Course({ label, dish }: { label: string; dish: RankedDish | null }) {
  return (
    <div className={s.course}>
      <span className={s.courseLabel}>{label}</span>
      <span className={s.courseDish}>{dish ? dish.name : "—"}</span>
    </div>
  );
}
