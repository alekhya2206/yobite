"use client";
// lib/useVoiceInput.ts
// Single source of truth for the Web Speech mic wiring used by Scan + Intent.
// Caller supplies what to do with a finalized transcript (append vs replace).
import { useEffect, useRef, useState } from "react";
import { listenOnce, speechSupported, type VoiceHandle } from "@/lib/voice";

export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const supported = speechSupported();
  const handleRef = useRef<VoiceHandle | null>(null);

  // Stop any active recognition if the component unmounts mid-listen
  // (route change, sheet close) so the mic doesn't stay live. (Copilot review.)
  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, []);

  function start() {
    if (listening || !supported) return;
    setListening(true);
    const handle = listenOnce(
      (text, isFinal) => {
        if (isFinal) onFinal(text);
      },
      () => {
        setListening(false);
        handleRef.current = null;
      },
    );
    handleRef.current = handle;
    if (!handle) setListening(false);
  }

  return { listening, supported, start };
}
