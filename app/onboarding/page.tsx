"use client";
// app/onboarding/page.tsx
// First-run welcome: a 3-slide value carousel (rotating brand colors) → a light
// dietary-only setup → Home. No goal step — the mood is asked per meal on /intent
// (DESIGN.md: presence over engagement; one-time light setup, not a wizard).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanReticle, MicIcon, CheckIcon } from "@/components/icons";
import { completeOnboarding, hasOnboarded } from "@/lib/storage";
import s from "./onboarding.module.css";

type Color = "coral" | "gold" | "green";
const SLIDES: { key: string; Icon: typeof ScanReticle; color: Color; title: string; body: string }[] = [
  { key: "scan", Icon: ScanReticle, color: "coral", title: "Scan any menu.", body: "Point your camera at a local menu. No app, no data needed." },
  { key: "mood", Icon: MicIcon, color: "gold", title: "Tell us your mood.", body: "High-protein? Something lighter? Just say it." },
  { key: "order", Icon: CheckIcon, color: "green", title: "Get one confident order.", body: "One bold pick with honest reasons. Order, and you’re back at the table." },
];

const DIETARY = ["Veg", "Vegan", "Jain", "Eggetarian", "No onion/garlic"];
const SWIPE_PX = 40;

export default function Onboarding() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"intro" | "diet">("intro");
  const [slide, setSlide] = useState(0);
  const [diet, setDiet] = useState<string[]>([]);
  const touchX = useRef<number | null>(null);

  // Already onboarded? Don't show this again — bounce Home.
  useEffect(() => {
    if (hasOnboarded()) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  function finish(dietary: string[]) {
    completeOnboarding(dietary);
    router.replace("/");
  }
  function toggle(d: string) {
    setDiet((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }
  function next() {
    if (slide < SLIDES.length - 1) setSlide(slide + 1);
    else setStep("diet");
  }
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -SWIPE_PX && slide < SLIDES.length - 1) setSlide(slide + 1);
    else if (dx > SWIPE_PX && slide > 0) setSlide(slide - 1);
    touchX.current = null;
  }

  if (step === "diet") {
    return (
      <div className={`${s.screen} ${s.diet}`}>
        <main className={s.dietMain}>
          <h1 className={s.dietTitle}>Anything you don’t eat?</h1>
          <p className={s.dietSub}>So I never put it in front of you. Change it anytime in Profile.</p>
          <div className={s.chips}>
            {DIETARY.map((d) => {
              const on = diet.includes(d);
              return (
                <button
                  key={d}
                  className={`${s.chip} ${on ? s.chipOn : ""}`}
                  onClick={() => toggle(d)}
                  aria-pressed={on}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </main>
        <div className={s.dock}>
          <button className={s.ctaGold} onClick={() => finish(diet)}>
            Done →
          </button>
          <button className={s.skip} onClick={() => finish([])}>
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  const active = SLIDES[slide];
  const last = slide === SLIDES.length - 1;
  return (
    <div
      className={`${s.screen} ${s[active.color]}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button className={s.topSkip} onClick={() => setStep("diet")}>
        Skip
      </button>

      <div className={s.viewport}>
        <div className={s.track} style={{ transform: `translateX(-${slide * 100}%)` }}>
          {SLIDES.map(({ key, Icon, title, body }, i) => (
            <section className={s.slide} key={key} aria-hidden={i !== slide}>
              <span className={s.iconRing}>
                <Icon size={38} />
              </span>
              <h1 className={s.title}>{title}</h1>
              <p className={s.body}>{body}</p>
            </section>
          ))}
        </div>
      </div>

      <div className={s.dock}>
        <div className={s.dots} aria-hidden="true">
          {SLIDES.map((sl, i) => (
            <span key={sl.key} className={`${s.dot} ${i === slide ? s.dotOn : ""}`} />
          ))}
        </div>
        <button className={s.cta} onClick={next}>
          {last ? "Get started →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
