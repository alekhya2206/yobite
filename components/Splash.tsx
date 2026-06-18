"use client";

// The launch splash — YoBite's branded "open" moment. Full-bleed coral with the
// mark + wordmark, a calm rise-and-settle, then a fade that reveals the app.
// Mounted at the root so it shows once per app open (every full page load), not
// on in-app route changes. See DESIGN.md (Vivid / coral brand / calm motion).
import { useEffect, useState } from "react";
import s from "./Splash.module.css";

const HOLD_MS = 1100; // how long the brand holds before it fades away
const FADE_MS = 420; // medium, ease-in exit (DESIGN.md motion)

export default function Splash() {
  const [phase, setPhase] = useState<"hold" | "out" | "done">("hold");

  useEffect(() => {
    const t = setTimeout(() => setPhase("out"), HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div className={`${s.splash} ${phase === "out" ? s.out : ""}`} aria-hidden="true">
      <div className={s.lockup}>
        <span className={s.badge}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.png" alt="" className={s.mark} />
        </span>
        <span className={s.wordmark}>
          Yo<span className={s.bite}>Bite</span>
        </span>
        <span className={s.tagline}>Scan. Tell mood. Order this.</span>
      </div>
    </div>
  );
}
