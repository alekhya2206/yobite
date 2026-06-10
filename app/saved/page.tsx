// app/saved/page.tsx
"use client";
import { Deck } from "@/components/Deck";
import s from "../page.module.css";

export default function SavedPage() {
  return (
    <div className="app">
      <main className={s.main}>
        <h1 className={s.greet}>Saved</h1>
        <p className={s.sub}>Your saved spots land here soon.</p>
      </main>
      <Deck />
    </div>
  );
}
