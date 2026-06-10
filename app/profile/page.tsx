// app/profile/page.tsx
"use client";
import { Deck } from "@/components/Deck";
import s from "../page.module.css";

export default function ProfilePage() {
  return (
    <div className="app">
      <main className={s.main}>
        <h1 className={s.greet}>Profile</h1>
        <p className={s.sub}>Your goal &amp; preferences land here soon.</p>
      </main>
      <Deck />
    </div>
  );
}
