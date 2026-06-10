// app/browse/page.tsx
"use client";
import { Deck } from "@/components/Deck";
import s from "../page.module.css";

export default function BrowsePage() {
  return (
    <div className="app">
      <main className={s.main}>
        <h1 className={s.greet}>Browse</h1>
        <p className={s.sub}>My Places lands here soon.</p>
      </main>
      <Deck />
    </div>
  );
}
