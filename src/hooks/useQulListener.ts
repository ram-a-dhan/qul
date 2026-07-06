"use client";

import { useCallback, useRef, useState } from "react";
import type { VerseResponse } from "@/app/api/verse/[id]/route";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHUNK_DURATION_MS = 5_000; // record 5s chunks
const LOCK_FAILURE_LIMIT = 3;    // switch cold→fallback after N consecutive misses
const FALLBACK_FAILURE_LIMIT = 6; // reset fallback→cold after N consecutive misses

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListenStatus =
  | "idle"
  | "requesting"
  | "listening"
  | "identifying"
  | "locked"
  | "no-signal"
  | "error";

type Phase = "cold" | "locked" | "fallback";

interface LoopState {
  phase: Phase;
  currentVerseId: number | null;
  currentVerseNumber: number | null;
  nextVerseId: number | null;
  chapterId: number | null;
  failureCount: number;
}

const INITIAL_LOOP_STATE: LoopState = {
  phase: "cold",
  currentVerseId: null,
  currentVerseNumber: null,
  nextVerseId: null,
  chapterId: null,
  failureCount: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "wav";
}

function recordChunk(stream: MediaStream): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = reject;

    recorder.start();
    setTimeout(() => recorder.stop(), CHUNK_DURATION_MS);
  });
}

async function callIdentify(
  blob: Blob,
  state: LoopState
): Promise<{
  passed: boolean;
  best: { verseId: number; chapterId: number; verseNumber: number } | null;
}> {
  const ext = mimeTypeToExtension(blob.type);
  const form = new FormData();
  form.append("audio", blob, `chunk.${ext}`);

  if (state.phase === "locked" && state.currentVerseId && state.nextVerseId) {
    form.append("mode", "locked");
    form.append("currentVerseId", String(state.currentVerseId));
    form.append("nextVerseId", String(state.nextVerseId));
  } else if (state.phase === "fallback" && state.chapterId) {
    form.append("mode", "fallback");
    form.append("chapterId", String(state.chapterId));
  } else {
    form.append("mode", "cold");
  }

  const res = await fetch("/api/identify", { method: "POST", body: form });
  if (!res.ok) throw new Error(`identify failed: ${res.status}`);
  return res.json();
}

async function fetchAyah(verseId: number): Promise<VerseResponse> {
  const res = await fetch(`/api/verse/${verseId}?lang=en`);
  if (!res.ok) throw new Error(`ayah fetch failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQulListener() {
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [verse, setVerse] = useState<VerseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs hold mutable loop state that shouldn't trigger re-renders
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const loopStateRef = useRef<LoopState>({ ...INITIAL_LOOP_STATE });

  const runLoop = useCallback(async () => {
    while (activeRef.current && streamRef.current) {
      setStatus("listening");

      let blob: Blob;
      try {
        blob = await recordChunk(streamRef.current);
      } catch {
        // Stream was killed (user stopped) — exit cleanly
        break;
      }

      if (!activeRef.current) break;
      setStatus("identifying");

      let result: Awaited<ReturnType<typeof callIdentify>>;
      try {
        result = await callIdentify(blob, loopStateRef.current);
      } catch {
        // API/network error — increment failure count and continue
        loopStateRef.current.failureCount++;
        setStatus(loopStateRef.current.failureCount > 2 ? "no-signal" : "listening");
        continue;
      }

      console.log(result)

      if (!activeRef.current) break;

      if (result.passed && result.best) {
        const { verseId, chapterId, verseNumber } = result.best;
        const state = loopStateRef.current;
        const isAdvance =
          state.phase === "locked" && verseId === state.nextVerseId;
        const isStay =
          state.phase === "locked" && verseId === state.currentVerseId;

        if (isStay) {
          // Same verse — stay, just reset failure count
          loopStateRef.current.failureCount = 0;
        } else if (isAdvance || state.phase !== "locked") {
          // New verse (advance, fresh cold lock, or fallback re-lock)
          try {
            const ayah = await fetchAyah(verseId);
            loopStateRef.current = {
              phase: "locked",
              currentVerseId: verseId,
              currentVerseNumber: verseNumber,
              nextVerseId: ayah.nextVerseId,
              chapterId,
              failureCount: 0,
            };
            setVerse(ayah);
          } catch {
            // Ayah fetch failed — treat as a miss, don't update display
            loopStateRef.current.failureCount++;
          }
        } else {
          // Unexpected verse returned (jump) — re-lock cold
          try {
            const ayah = await fetchAyah(verseId);
            loopStateRef.current = {
              phase: "locked",
              currentVerseId: verseId,
              currentVerseNumber: verseNumber,
              nextVerseId: ayah.nextVerseId,
              chapterId,
              failureCount: 0,
            };
            setVerse(ayah);
          } catch {
            loopStateRef.current.failureCount++;
          }
        }

        setStatus("locked");
      } else {
        // No match
        const s = loopStateRef.current;
        s.failureCount++;

        if (s.phase === "locked" && s.failureCount >= LOCK_FAILURE_LIMIT) {
          loopStateRef.current = { ...s, phase: "fallback" };
        } else if (
          s.phase === "fallback" &&
          s.failureCount >= FALLBACK_FAILURE_LIMIT
        ) {
          loopStateRef.current = { ...INITIAL_LOOP_STATE };
          setStatus("listening");
        } else {
          setStatus(s.phase === "locked" ? "locked" : "no-signal");
        }
      }
    }

    // Loop exited — clean up
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMessage(
        "Microphone access denied. Allow mic access in your browser settings and try again."
      );
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    loopStateRef.current = { ...INITIAL_LOOP_STATE };
    activeRef.current = true;

    runLoop();
  }, [runLoop]);

  const stop = useCallback(() => {
    activeRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  return { status, verse, errorMessage, start, stop };
}
