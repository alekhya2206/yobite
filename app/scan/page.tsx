"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { saveInput } from "@/lib/store";
import { readMenuImage } from "@/lib/ocr";
import { listenOnce, speechSupported } from "@/lib/voice";
import type { GoalId } from "@/lib/ranker/types";
import s from "./scan.module.css";

const GOALS: { id: GoalId; label: string }[] = [
  { id: "high-protein", label: "High protein" },
  { id: "fat-loss", label: "Fat loss" },
  { id: "balanced", label: "Balanced" },
  { id: "custom", label: "Custom…" },
];

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [menu, setMenu] = useState("");
  const [goalId, setGoalId] = useState<GoalId>("high-protein");
  const [custom, setCustom] = useState("");
  const [ate, setAte] = useState("");
  const [ocrState, setOcrState] = useState<"idle" | "reading">("idle");
  const [ocrPct, setOcrPct] = useState(0);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const canSubmit = menu.trim().length > 2;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError("");
    setOcrState("reading");
    setOcrPct(0);
    try {
      const text = await readMenuImage(file, setOcrPct);
      if (text.trim().length < 3) {
        setError("Couldn't read much from that photo. Try a clearer shot, or paste the menu below.");
      } else {
        // Append so a second scan adds to the first rather than wiping it.
        setMenu((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
      }
    } catch {
      setError("Scanning didn't work on this device. You can paste the menu below instead.");
    } finally {
      setOcrState("idle");
    }
  }

  function startVoice() {
    if (listening) return;
    setListening(true);
    const handle = listenOnce(
      (text) => setAte(text),
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  function submit() {
    if (!canSubmit) return;
    saveInput({
      menuText: menu,
      goal: goalId === "custom" ? { id: "custom", custom } : { id: goalId },
      ateToday: ate,
    });
    router.push("/order");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <Link href="/" className="icon-btn" aria-label="Back">‹</Link>
          <span className="tb-title">New meal</span>
          <LogoMark size={26} />
        </div>
      </header>

      <main className={s.main}>
        <h1 className={s.q}>What&rsquo;s on the menu?</h1>
        <p className={s.qSub}>Point your phone at it, or paste the text. Local spots welcome — no calorie info needed.</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button className={s.scan} onClick={() => fileRef.current?.click()} disabled={ocrState === "reading"}>
          <span className={s.cam} aria-hidden="true">
            {ocrState === "reading" ? <span className={s.spinner} /> : "📷"}
          </span>
          <span className={s.cap}>
            {ocrState === "reading" ? "Reading the menu…" : "Scan the menu"}
            <small>{ocrState === "reading" ? `${ocrPct}% — hang tight` : "Photo or screenshot"}</small>
          </span>
        </button>

        <div className={s.or}>or paste it</div>
        <label htmlFor="menu" className="sr-only">Paste the menu text</label>
        <textarea
          id="menu"
          className={s.textarea}
          value={menu}
          onChange={(e) => setMenu(e.target.value)}
          placeholder="Paste the menu here — dish names are enough."
        />
        {error && <p className={s.errnote}>{error}</p>}

        <p className={s.step}>Your goal</p>
        <div className={s.goals} role="group" aria-label="Pick your goal">
          {GOALS.map((g) => (
            <button
              key={g.id}
              className={`${s.goal}${goalId === g.id ? ` ${s.goalActive}` : ""}`}
              aria-pressed={goalId === g.id}
              onClick={() => setGoalId(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        {goalId === "custom" && (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="custom" className="sr-only">Describe your goal</label>
            <div className={s.field}>
              <input
                id="custom"
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. low carb, vegetarian, post-workout"
              />
            </div>
          </div>
        )}

        <p className={s.step}>
          Eaten anything today? <span className={s.optional}>(optional)</span>
        </p>
        <div className={s.field}>
          <label htmlFor="ate" className="sr-only">What you&rsquo;ve eaten today</label>
          <input
            id="ate"
            type="text"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            placeholder="e.g. rice and dal at lunch"
          />
          {speechSupported() && (
            <button
              type="button"
              className={`mic${listening ? " listening" : ""}`}
              aria-label={listening ? "Listening…" : "Say what you ate"}
              onClick={startVoice}
            >
              🎙
            </button>
          )}
        </div>
        <p className={s.hint}>Helps YoBite balance the rest of your day. Skip it if you&rsquo;d rather not.</p>
      </main>

      <div className={s.dock}>
        <button className={s.cta} onClick={submit} disabled={!canSubmit}>
          Get my order →
        </button>
      </div>
    </div>
  );
}
