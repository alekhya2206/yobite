import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";
import s from "./page.module.css";

// Landing page — server component. Marketing only; the app lives at /scan and /order.
export default function LandingPage() {
  return (
    <>
      <a href="#main" className={s.skipLink}>Skip to content</a>

      <header className={s.header}>
        <div className={`${s.wrap} ${s.nav}`}>
          <Link href="/" className={s.logo} aria-label="YoBite home">
            <LogoMark size={30} />
            <Wordmark size={24} />
          </Link>
          <nav className={s.navLinks} aria-label="Primary">
            <a className="txt" href="#how">How it works</a>
            <a className="txt" href="#idea">The idea</a>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/scan" style={{ minHeight: 42, padding: "0 20px", fontSize: 15 }}>
              Scan a menu
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <p className={s.eyebrow}>For people who eat out and still care</p>
              <h1>Eat out. <em>Skip the menu math.</em></h1>
              <p className={s.lede}>
                Scan any menu, tell us your goal, and get one confident order — so you can put
                the phone down and enjoy the people you&rsquo;re with.
              </p>
              <div className={s.ctaRow}>
                <Link className={`${s.btn} ${s.btnPrimary}`} href="/scan">Scan a menu</Link>
                <a className={`${s.btn} ${s.btnGhost}`} href="#how">See how it works</a>
              </div>
              <div className={s.trust}>
                <span className={s.pip} aria-hidden="true" /> A ranker, not a calorie counter. No logging, no streaks.
              </div>
            </div>

            <div>
              <div
                className={s.phone}
                role="img"
                aria-label="YoBite result screen showing a recommended order: Grilled Chicken Tikka, with reasons and lighter alternatives."
              >
                <div className={s.screen}>
                  <div className={s.scrHead}>
                    <span className={s.scrBack} aria-hidden="true">‹</span>
                    <span className={s.scrGoal}>Goal: <b>High protein</b></span>
                  </div>
                  <p className={s.scrEyebrow}>Order this</p>
                  <div className={s.pickHero}>
                    <span className={s.pickBadge}>● Best for you</span>
                    <div className={s.pickName}>Grilled Chicken Tikka</div>
                    <div className={s.chips}>
                      <span className={s.chip}>High protein</span>
                      <span className={s.chip}>Grilled, not fried</span>
                      <span className={`${s.chip} ${s.chipMacro}`}>~32g protein</span>
                    </div>
                  </div>
                  <p className={s.scrEyebrow}>Also good</p>
                  <div className={s.pick}>
                    <div><div className={s.pn}>Paneer Tikka Salad</div><div className={s.pr}>High protein, veg · lighter oil</div></div>
                    <span className={`${s.dot} ${s.dotG}`} />
                  </div>
                  <div className={s.pick}>
                    <div><div className={s.pn}>Tandoori Fish</div><div className={s.pr}>Lean, grilled · easy on the naan</div></div>
                    <span className={`${s.dot} ${s.dotA}`} />
                  </div>
                  <div className={s.heavier}>
                    <p className={s.scrEyebrow} style={{ marginBottom: 6 }}>Heavier choices</p>
                    <div className={s.heavyRow}><span className={`${s.dot} ${s.dotT}`} /><span className={s.hn}>Butter Chicken</span> — rich, creamy</div>
                    <div className={s.heavyRow}><span className={`${s.dot} ${s.dotT}`} /><span className={s.hn}>Cheese Naan</span> — refined carbs + fat</div>
                  </div>
                  <div className={s.voiceBar}>
                    <span className={s.vmic} aria-hidden="true">🎙</span>
                    <span>&ldquo;I had rice for lunch — still good?&rdquo;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={s.band} id="how">
          <div className={s.wrap}>
            <p className={`${s.eyebrow} ${s.secEyebrow}`}>How it works</p>
            <h2 className={s.secTitle}>Three taps between you and the right order.</h2>
            <div className={s.steps}>
              <div className={s.step}>
                <div className={s.stepNum}>01</div>
                <div className={s.stepBody}>
                  <h3>Scan the menu</h3>
                  <p>Point your phone at the menu, or paste it in. Works at the local place that never published a single calorie.</p>
                </div>
              </div>
              <div className={s.step}>
                <div className={s.stepNum}>02</div>
                <div className={s.stepBody}>
                  <h3>Tell it your goal</h3>
                  <p>High protein, lighter today, whatever you&rsquo;re after. Add what you already ate, by typing or just talking to it.</p>
                </div>
              </div>
              <div className={s.step}>
                <div className={s.stepNum}>03</div>
                <div className={s.stepBody}>
                  <h3>Order with confidence</h3>
                  <p>One clear pick, with the reasons it works for you. Order it, put the phone down, and get back to the table.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE IDEA */}
        <section className={`${s.band} ${s.soul}`} id="idea">
          <div className={s.wrap}>
            <p className={`${s.eyebrow} ${s.secEyebrow}`}>The idea</p>
            <h2 className={s.secTitle}>Not another app that wants you <em>logging every day.</em></h2>
            <p className={s.secSub}>
              Every nutrition app is built to keep you opening it. YoBite is built to get you out
              fast. The best visit is the shortest one — a better order, then back to your life.
            </p>
            <div className={s.soulPoints}>
              <div className={s.soulPoint}>
                <h4>Presence, not streaks</h4>
                <p>No badges, no daily check-ins, no guilt trip. Use it for ten seconds at the table and forget it exists.</p>
              </div>
              <div className={s.soulPoint}>
                <h4>Built for the unknown menu</h4>
                <p>At the chain you know, you don&rsquo;t need us. At the local spot where you&rsquo;ve no idea what&rsquo;s in it — that&rsquo;s where YoBite earns its keep.</p>
              </div>
              <div className={s.soulPoint}>
                <h4>Reasons over numbers</h4>
                <p>&ldquo;Grilled, high protein, lighter on refined carbs&rdquo; beats a fake-precise calorie count. Honest beats impressive.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={`${s.band} ${s.final}`}>
          <div className={s.wrap}>
            <h2 className={s.secTitle}>Stop doing menu math at dinner.</h2>
            <p className={s.secSub}>Scan the menu. Get your order. Be where you are.</p>
            <div className={s.ctaRow}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/scan">Scan a menu</Link>
              <a className={`${s.btn} ${s.btnGhost}`} href="#how">See how it works</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footRow}`}>
          <Link href="/" className={s.logo} aria-label="YoBite home">
            <LogoMark size={30} />
            <Wordmark size={24} />
          </Link>
          <nav className={s.footLinks} aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#idea">The idea</a>
            <a href="#">Privacy</a>
          </nav>
          <span className={s.footTag}>The menu should not flesh in your mind.</span>
        </div>
      </footer>
    </>
  );
}
