"use client";
// lib/useVoiceInput.ts
// Single source of truth for the Web Speech mic wiring used by Scan + Intent.
// Caller supplies what to do with a finalized transcript (append vs replace).
import { useState } from "react";
import { listenOnce, speechSupported } from "@/lib/voice";

export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const supported = speechSupported();

  function start() {
    if (listening || !supported) return;
    setListening(true);
    const handle = listenOnce(
      (text, isFinal) => { if (isFinal) onFinal(text); },
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  return { listening, supported, start };
}
