// app/scan/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon, MicIcon, ScanReticle } from "@/components/icons";
import { postScan } from "@/lib/scan/postScan";
import { newSession, saveSession, upsertPlace } from "@/lib/storage";
import { normalizeDishes } from "@/lib/ai/normalizeDishes";
import { useVoiceInput } from "@/lib/useVoiceInput";
import s from "./scan.module.css";

type Status = "ready" | "reading" | "error";

// Explain WHY the camera won't start instead of failing silently. The #1 real cause on
// phones is an insecure origin (http://LAN-IP), where the browser hides mediaDevices
// entirely — so the camera "does nothing" with no clue why.
function describeCameraBlock(err?: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera needs a secure (https) connection. Open YoBite over https to scan — or type the menu below.";
  }
  const name =
    err && typeof err === "object" && "name" in err ? (err as { name?: string }).name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission is blocked. Allow it in your browser settings, then reopen — or type the menu.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera found on this device. You can type the menu instead.";
  }
  return "Couldn't start the camera. You can type the menu instead.";
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [place, setPlace] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [showType, setShowType] = useState(false);
  const [typed, setTyped] = useState("");
  // Multi-snap accumulation (OV-1): dishes gathered across pages before "Done".
  const [captured, setCaptured] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);

  // Voice input via the shared hook (Amendment 3): appends to the typed buffer.
  const { listening, supported: voiceSupported, start: startVoice } = useVoiceInput((text) =>
    setTyped((prev) => (prev ? `${prev}\n${text}` : text)),
  );

  // Start the in-app camera. Falls back to "type it" if denied/unsupported.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        // No camera API (commonly an insecure origin). Explain why, offer the type path.
        setError(describeCameraBlock());
        setShowType(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
      } catch (err) {
        // Surface the real reason (permission, no device…) instead of a silent fallback.
        setError(describeCameraBlock(err));
        setShowType(true);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Finalize: persist a session + place, then go to per-meal intent.
  const finalize = useCallback(
    (dishes: string[]) => {
      const session = newSession(place.trim(), dishes);
      saveSession(session);
      upsertPlace({ name: place.trim(), dishes, lastVisited: Date.now() });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      router.push("/intent");
    },
    [place, router],
  );

  // Capture one page: downscale (Amendment 1), read, then ACCUMULATE (OV-1).
  async function capture() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      // Video frame not ready yet — say so, don't silently bail to the type panel.
      setError("Camera is still warming up — hold steady and tap again in a second.");
      return;
    }
    setStatus("reading");
    setError("");
    try {
      // Downscale to a 1600px longest edge — plenty for OCR, ~5-10x smaller upload.
      const MAX_EDGE = 1600;
      const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      const dishes = await postScan(base64, "image/jpeg");
      // OV-1: merge + dedupe and stay on screen for the next page.
      // Functional updater avoids a stale-closure read of `captured` on rapid captures.
      setCaptured((prev) => normalizeDishes([...prev, ...dishes]));
      setPageCount((n) => n + 1);
      setStatus("ready");
    } catch (err) {
      // Surface the failure (don't pretend nothing happened); keep the type path available.
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't read the menu just now. Try again, or type it.");
      setShowType(true);
    }
  }

  // Finish from everything captured so far (OV-1).
  function done() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    if (captured.length === 0) {
      setError("Capture a page or type the menu first.");
      return;
    }
    finalize(captured);
  }

  // Type/voice fallback: merge typed lines into the captured set, then finish.
  function useTyped() {
    if (!place.trim()) {
      setError("Tell me where you are first.");
      return;
    }
    const dishes = normalizeDishes([...captured, ...typed.split("\n")]);
    if (dishes.length === 0) {
      setError("Add a few dish names first.");
      return;
    }
    finalize(dishes);
  }

  function recite() {
    setShowType(true);
    startVoice();
  }

  return (
    <div className={`app ${s.scanApp}`}>
      <header className={s.bar}>
        <Link href="/" className={s.back} aria-label="Back">
          <BackIcon size={20} />
        </Link>
        <span className={s.brand}>YoBite</span>
        <span className={s.barSpacer} />
        <div className={s.modeToggle} role="group" aria-label="Capture mode">
          <span className={`${s.modeOpt} ${s.modeActive}`}>Photo</span>
          <span className={s.modeOpt} aria-disabled="true">
            Video <small>soon</small>
          </span>
        </div>
      </header>

      <div className={s.placeRow}>
        <label htmlFor="place" className="sr-only">Place name</label>
        <input
          id="place"
          className={s.placeInput}
          placeholder="Where are you? (e.g. Chili's)"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>

      <div className={s.viewport}>
        <video ref={videoRef} className={s.video} autoPlay playsInline muted />
        {!cameraOn && <div className={s.viewportHint}>Point your camera at the menu</div>}
        <div className={s.frame} aria-hidden="true" />
        <p className={s.frameNote}>Fit each page inside the frame · hold steady</p>
      </div>

      {captured.length > 0 && (
        <div className={s.pageStatus}>
          <span className={s.pageBadge}>
            {captured.length} dishes · {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
          <button className={s.doneBtn} onClick={done} disabled={status === "reading"}>Done →</button>
        </div>
      )}

      <div className={s.controls}>
        <button
          className={`${s.mic}${listening ? ` ${s.listening}` : ""}`}
          onClick={recite}
          aria-label={listening ? "Listening…" : "Say the dishes"}
          disabled={!voiceSupported}
        >
          <MicIcon size={20} />
        </button>
        <button
          className={s.shutter}
          onClick={capture}
          disabled={status === "reading"}
          aria-label={captured.length > 0 ? "Add another page" : "Capture menu"}
        >
          {status === "reading" ? <span className={s.spinner} /> : <ScanReticle size={28} />}
        </button>
        <button className={s.typeToggle} onClick={() => setShowType(true)}>
          Type it
        </button>
      </div>

      {captured.length > 0 && status !== "reading" && (
        <p className={s.addHint}>Snap the next page, or tap Done.</p>
      )}

      {status === "reading" && <p className={s.reading}>Reading the menu…</p>}
      {error && <p className={s.error}>{error}</p>}

      {showType && (
        <div className={s.typePanel}>
          <label htmlFor="typed" className="sr-only">Paste the menu</label>
          <textarea
            id="typed"
            className={s.textarea}
            placeholder="Paste or say the menu — one dish per line."
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className={s.useBtn} onClick={useTyped}>Use this menu →</button>
        </div>
      )}
    </div>
  );
}
