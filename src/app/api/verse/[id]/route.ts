import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";

import { db } from "@/db";
import { verses, translations } from "@/db/schema";

// ---------------------------------------------------------------------------
// Supported language codes.
// Add to this list as new translations are seeded.
// ---------------------------------------------------------------------------
const SUPPORTED_LANGS = ["en", "id"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function isLang(value: unknown): value is Lang {
  return SUPPORTED_LANGS.includes(value as Lang);
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

type VerseResponse = {
  verseId: number;
  chapterId: number;
  verseNumber: number;
  text: string; // Uthmani Arabic with full harakat — for display
  translations: {
    lang: Lang;
    translator: string;
    text: string;
  }[];
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;

  // --- Validate id param ---
  const verseId = parseInt(rawId, 10);
  if (!Number.isInteger(verseId) || verseId < 1 || verseId > 6236) {
    return NextResponse.json(
      { error: `Invalid verse id: '${rawId}'. Must be an integer between 1 and 6236.` },
      { status: 400 }
    );
  }

  // --- Parse ?lang= query param ---
  // Accepts a single lang (e.g. ?lang=en) or a comma-separated list
  // (e.g. ?lang=en,id). Defaults to all supported languages if omitted.
  const url = new URL(_request.url);
  const rawLang = url.searchParams.get("lang");

  let requestedLangs: Lang[];
  if (!rawLang) {
    requestedLangs = [...SUPPORTED_LANGS];
  } else {
    const candidates = rawLang.split(",").map((s) => s.trim());
    const invalid = candidates.filter((c) => !isLang(c));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Unsupported language code(s): ${invalid.join(", ")}. Supported: ${SUPPORTED_LANGS.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    requestedLangs = candidates as Lang[];
  }

  // --- Fetch verse ---
  const [verse] = await db
    .select({
      id: verses.id,
      chapterId: verses.chapterId,
      verseNumber: verses.verseNumber,
      text: verses.text, // Uthmani — full harakat for display
    })
    .from(verses)
    .where(eq(verses.id, verseId))
    .limit(1);

  if (!verse) {
    return NextResponse.json({ error: `Verse ${verseId} not found.` }, { status: 404 });
  }

  // --- Fetch translations ---
  const translationRows = await db
    .select({
      lang: translations.lang,
      translator: translations.translator,
      text: translations.text,
    })
    .from(translations)
    .where(
      and(
        eq(translations.verseId, verseId),
        inArray(translations.lang, requestedLangs)
      )
    );

  const response: VerseResponse = {
    verseId: verse.id,
    chapterId: verse.chapterId,
    verseNumber: verse.verseNumber,
    text: verse.text,
    translations: translationRows.map((t) => ({
      lang: t.lang as Lang,
      translator: t.translator,
      text: t.text,
    })),
  };

  return NextResponse.json(response);
}
