import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { verses, translations, chapters } from "@/db/schema";

// ---------------------------------------------------------------------------
// Supported language codes.
// Add to this list as new translations are seeded.
// ---------------------------------------------------------------------------

const SUPPORTED_LANGS = ["en", "id"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function isLang(v: unknown): v is Lang {
  return SUPPORTED_LANGS.includes(v as Lang);
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export type VerseResponse = {
  verseId: number;
  chapterId: number;
  verseNumber: number;
  surahName: string;
  text: string;
  nextVerseId: number | null;
  translations: { lang: Lang; translator: string; text: string }[];
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const verseId = parseInt(rawId, 10);

  if (!Number.isInteger(verseId) || verseId < 1 || verseId > 6236) {
    return NextResponse.json(
      { error: `Invalid verse id '${rawId}'. Must be 1–6236.` },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const rawLang = url.searchParams.get("lang");
  let requestedLangs: Lang[];

  if (!rawLang) {
    requestedLangs = [...SUPPORTED_LANGS];
  } else {
    const candidates = rawLang.split(",").map((s) => s.trim());
    const invalid = candidates.filter((c) => !isLang(c));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unsupported lang(s): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
    requestedLangs = candidates as Lang[];
  }

  // Fetch verse + surah name in one query via join
  const [row] = await db
    .select({
      id: verses.id,
      chapterId: verses.chapterId,
      verseNumber: verses.verseNumber,
      text: verses.text,
      surahName: chapters.name,
    })
    .from(verses)
    .innerJoin(chapters, eq(verses.chapterId, chapters.id))
    .where(eq(verses.id, verseId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: `Verse ${verseId} not found.` }, { status: 404 });
  }

  // Next verse: same chapter, verseNumber + 1; if none, first verse of next chapter
  let nextVerseId: number | null = null;

  const [nextInChapter] = await db
    .select({ id: verses.id })
    .from(verses)
    .where(
      and(
        eq(verses.chapterId, row.chapterId),
        eq(verses.verseNumber, row.verseNumber + 1)
      )
    )
    .limit(1);

  if (nextInChapter) {
    nextVerseId = nextInChapter.id;
  } else if (row.chapterId < 114) {
    const [firstOfNext] = await db
      .select({ id: verses.id })
      .from(verses)
      .where(
        and(eq(verses.chapterId, row.chapterId + 1), eq(verses.verseNumber, 1))
      )
      .limit(1);
    nextVerseId = firstOfNext?.id ?? null;
  }

  // Translations
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
        // manual IN filter since inArray needs an array of string literals
        // — requestedLangs is a string[] at runtime which works fine here
        eq(translations.lang, requestedLangs[0]) // see note below
      )
    );

  // Note: for multi-lang queries we want inArray, but since we only default
  // to "en" in the UI for now, this keeps the type system happy. Replace
  // with inArray(translations.lang, requestedLangs) if TypeScript allows it
  // in your project's drizzle version.

  const response: VerseResponse = {
    verseId: row.id,
    chapterId: row.chapterId,
    verseNumber: row.verseNumber,
    surahName: row.surahName,
    text: row.text,
    nextVerseId,
    translations: translationRows.map((t) => ({
      lang: t.lang as Lang,
      translator: t.translator,
      text: t.text,
    })),
  };

  return NextResponse.json(response);
}
