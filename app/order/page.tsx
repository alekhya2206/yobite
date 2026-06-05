"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { DEMO_INPUT, loadInput } from "@/lib/store";
import { askYoBite, detectKnownChain, rank } from "@/lib/ranker";
import { listenOnce, speechSupported } from "@/lib/voice";
import type { RankInput, RankedDish, Tier } from "@/lib/ranker/types";
import s from "./order.module.css";

const dotClass: Record<Tier, string> = { best: s.dotG, good: s.dotG, okay: s.dotA, heavy: s.dotT };

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--green)" />
      <path d="M7 12.5 l3 3 l7 -7.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function OrderPage() {
  const router = useRouter();
  // null = still loading; set once on mount (sessionStorage is client-only).
  const [input, setInput] = useState<RankInput | null>(null);
  const [picked, setPicked] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setInput(loadInput() ?? DEMO_INPUT);
  }, []);

  const result = useMemo(() => (input ? rank(input) : null), [input]);
  const chain = useMemo(() => (input ? detectKnownChain(input.menuText) : null), [input]);

  if (!result) {
    return <div className="app" aria-busy="true" />;
  }

  if (!result.best) {
    return (
      <div className="app">
        <Header />
        <main className={s.main}>
          <div className={s.empty}>
            <h2>Hmm — I couldn&rsquo;t read any dishes.</h2>
            <p>The menu text came through empty. Scan a clearer photo or paste the dish names, and I&rsquo;ll give you a pick.</p>
            <Link href="/scan" className={s.rescan} style={{ maxWidth: 260, margin: "0 auto" }}>↻ Scan a menu</Link>
          </div>
        </main>
      </div>
    );
  }

  const best = result.best;

  function ask() {
    if (!question.trim() || !result) return;
    setAnswer(askYoBite(question, result));
  }

  function startVoice() {
    if (listening) return;
    setListening(true);
    const handle = listenOnce(
      (text, isFinal) => {
        setQuestion(text);
        if (isFinal && result) setAnswer(askYoBite(text, result));
      },
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  return (
    <div className="app">
      <Header />
      <main className={s.main}>
        {/* Verified pill: only for recognized chains; local spots stay clean. */}
        {chain && (
          <div className={s.verifiedRow}>
            <span className={s.verified}><CheckIcon /> {chain} · known chain</span>
          </div>
        )}

        <div className={s.eyebrowRow}>
          <p className={s.eyebrow}>Order this</p>
          <span className={s.goalTag}><span className={s.d2} />{result.goalLabel}</span>
        </div>

        {/* HERO PICK */}
        <div className={s.pickHero}>
          <span className={s.badge}><span className={s.d} /> Best for you</span>
          <h1 className={s.pickName}>{best.name}</h1>
          <p className={s.pickWhy}>{result.bestWhy}</p>
          <div className={s.chips}>
            {best.chips.map((c) => (
              <span key={c} className={s.chip}>{c}</span>
            ))}
          </div>
          <div className={s.heroFoot}>
            <span className={s.est}>
              <b>~{best.profile.proteinG}g</b> protein · est. <b>{best.profile.calories} cal</b>
            </span>
            <button className={`${s.btnPick}${picked ? ` ${s.picked}` : ""}`} onClick={() => setPicked(true)}>
              {picked ? "✓ Picked" : "Pick this"}
            </button>
          </div>
        </div>

        {/* ALSO GOOD */}
        {result.alsoGood.length > 0 && (
          <>
            <p className={s.eyebrow}>Also good</p>
            {result.alsoGood.map((d) => (
              <ListRow key={d.name} d={d} />
            ))}
          </>
        )}

        {/* HEAVIER */}
        {result.heavier.length > 0 && (
          <>
            <p className={s.eyebrow}>Heavier choices</p>
            <div className={s.heavier}>
              {result.heavier.map((d) => (
                <div key={d.name} className={s.heavyRow}>
                  <span className={`${s.dot} ${s.dotT}`} />
                  <span className={s.body}>
                    <span className={s.hn}>{d.name}</span>
                    <span className={s.hr}>{d.reason}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {answer && (
          <div className={s.answer} role="status">{answer}</div>
        )}

        {/* Ask + rescan — inline at the end of the poster. */}
        <div className={s.actions}>
          <form
            className={s.ask}
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <label htmlFor="ask" className="sr-only">Ask YoBite about the menu</label>
            <input
              id="ask"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask YoBite — “any good veg starters?”"
            />
            {speechSupported() && (
              <button
                type="button"
                className={`mic${listening ? " listening" : ""}`}
                aria-label={listening ? "Listening…" : "Ask by voice"}
                onClick={startVoice}
              >
                🎙
              </button>
            )}
          </form>
          <Link href="/scan" className={s.rescan}>↻ Scan another menu</Link>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <Link href="/scan" className="icon-btn" aria-label="Back">‹</Link>
        <span className="tb-title">Your order</span>
        <LogoMark size={26} />
      </div>
    </header>
  );
}

function ListRow({ d }: { d: RankedDish }) {
  return (
    <button className={s.pick} type="button">
      <span className={`${s.dot} ${dotClass[d.tier]}`} />
      <span className={s.body}>
        <span className={s.pn}>{d.name}</span>
        <span className={s.pr}>{d.reason}</span>
      </span>
      <span className={s.chev} aria-hidden="true">›</span>
    </button>
  );
}
