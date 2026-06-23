import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  scoreCandidates,
  normalizeArabic,
  type VerseCandidate,
} from "@/utils/confidence";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ASR_SERVICE_URL = process.env.ASR_SERVICE_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Request validation
//
// The client sends multipart/form-data with:
//   audio         — the recorded audio chunk (Blob/File)
//   mode          — "cold" | "locked" | "fallback"
//   currentVerseId, nextVerseId  — DB verse ids (mode=locked only)
//   chapterId                    — 1–114 (mode=fallback only)
// ---------------------------------------------------------------------------

const ColdPayload = z.object({ mode: z.literal("cold") });

const LockedPayload = z.object({
  mode: z.literal("locked"),
  currentVerseId: z.coerce.number().int().positive(),
  nextVerseId: z.coerce.number().int().positive(),
});

const FallbackPayload = z.object({
  mode: z.literal("fallback"),
  chapterId: z.coerce.number().int().min(1).max(114),
});

const RequestPayload = z.discriminatedUnion("mode", [
  ColdPayload,
  LockedPayload,
  FallbackPayload,
]);

type Payload = z.infer<typeof RequestPayload>;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type DBVerseRow = {
  id: number;
  chapter_id: number;
  verse_number: number;
  text_normalized: string;
};

// Extends VerseCandidate with the DB primary key so we can return verseId
// to the client for subsequent locked-tracking calls.
// NOTE: the `text` field in VerseCandidate is populated from text_normalized
// (the clean simple-corpus text), not the Uthmani text column. This keeps
// scoring consistent with what the trigram index was built on — normalizing
// Uthmani text in TS doesn't produce byte-identical output to what Tanzil's
// simple corpus contains, so using text_normalized directly avoids that gap.
type CandidateWithId = VerseCandidate & { id: number };


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, filename);
  const res = await fetch(`${ASR_SERVICE_URL}/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`ASR service error ${res.status}: ${detail}`);
  }
  const { text } = (await res.json()) as { text: string };
  return text;
}

function rowToCandidate(r: DBVerseRow): CandidateWithId {
  return {
    id: r.id,
    chapterId: r.chapter_id,
    verseNumber: r.verse_number,
    text: r.text_normalized, // used for scoring, not display
  };
}

async function fetchCandidates(
  payload: Payload,
  normalized: string
): Promise<CandidateWithId[]> {
  switch (payload.mode) {
    case "cold": {
      // Full-table trigram search. Threshold 0.2 is a cheap pre-filter that
      // lets the GIN index do the heavy lifting; the real gate is the
      // composite confidence score applied afterward.
      const result = await db.execute<DBVerseRow>(sql`
        SELECT id, chapter_id, verse_number, text_normalized
        FROM verses
        WHERE similarity(text_normalized, ${normalized}) > 0.2
        ORDER BY text_normalized <-> ${normalized}
        LIMIT 5
      `);
      return result.rows.map(rowToCandidate);
    }

    case "locked": {
      // No similarity search needed — we already know which two verses to
      // compare. Fetch them by id and let the TypeScript scorer decide.
      const result = await db.execute<DBVerseRow>(sql`
        SELECT id, chapter_id, verse_number, text_normalized
        FROM verses
        WHERE id IN (${payload.currentVerseId}, ${payload.nextVerseId})
      `);
      return result.rows.map(rowToCandidate);
    }

    case "fallback": {
      // Scoped to the locked chapter after repeated current/next failures.
      // Lower threshold than cold-start since we already know the chapter.
      const result = await db.execute<DBVerseRow>(sql`
        SELECT id, chapter_id, verse_number, text_normalized
        FROM verses
        WHERE chapter_id = ${payload.chapterId}
          AND similarity(text_normalized, ${normalized}) > 0.1
        ORDER BY text_normalized <-> ${normalized}
        LIMIT 5
      `);
      return result.rows.map(rowToCandidate);
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // --- Parse multipart form data ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "Missing or empty audio field" },
      { status: 400 }
    );
  }

  const parsed = RequestPayload.safeParse({
    mode: formData.get("mode"),
    currentVerseId: formData.get("currentVerseId"),
    nextVerseId: formData.get("nextVerseId"),
    chapterId: formData.get("chapterId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const payload = parsed.data;

  // --- Transcribe ---
  let transcribed: string;
  try {
    const filename = audio instanceof File ? audio.name : "chunk.wav";
    transcribed = await transcribe(audio, filename);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (!transcribed.trim()) {
    return NextResponse.json(
      { error: "ASR returned empty transcription — chunk may be silence" },
      { status: 422 }
    );
  }

  // --- Fetch candidates ---
  const normalized = normalizeArabic(transcribed);
  let candidates: CandidateWithId[];
  try {
    candidates = await fetchCandidates(payload, normalized);
  } catch (err) {
    return NextResponse.json(
      { error: `Database error: ${String(err)}` },
      { status: 500 }
    );
  }

  // No candidates above the pre-filter threshold — nothing to score.
  if (candidates.length === 0) {
    return NextResponse.json({
      transcribed,
      passed: false,
      confidence: 0,
      best: null,
    });
  }

  // --- Score ---
  const result = scoreCandidates(transcribed, candidates);

  // Recover the DB id for the winning candidate so the client can pass it
  // as currentVerseId/nextVerseId on the next locked-tracking request.
  const bestWithId = result.best
    ? candidates.find(
        (c) =>
          c.chapterId === result.best!.chapterId &&
          c.verseNumber === result.best!.verseNumber
      )
    : null;

  return NextResponse.json({
    transcribed,
    passed: result.passed,
    confidence: result.confidence,
    margin: result.margin,
    best: bestWithId
      ? {
          verseId: bestWithId.id,
          chapterId: bestWithId.chapterId,
          verseNumber: bestWithId.verseNumber,
        }
      : null,
  });
}
