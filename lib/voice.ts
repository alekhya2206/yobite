// Voice input via the Web Speech API. DESIGN.md calls for voice to be welcomed,
// not buried — so this stays tiny and degrades silently where unsupported.

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export interface VoiceHandle {
  stop: () => void;
}

/**
 * Listen once and stream interim + final transcripts to `onResult`.
 * Returns a handle to stop early, or null if speech isn't supported.
 */
export function listenOnce(
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void,
): VoiceHandle | null {
  if (!speechSupported()) return null;
  const Ctor =
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition })
      .webkitSpeechRecognition ||
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = "en-IN"; // India-first; the browser still copes with general English
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e: SpeechRecognitionEvent) => {
    let text = "";
    let isFinal = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) isFinal = true;
    }
    onResult(text.trim(), isFinal);
  };
  rec.onerror = () => onEnd();
  rec.onend = () => onEnd();

  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}
