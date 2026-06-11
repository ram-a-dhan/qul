#!/usr/bin/env node

/**
 * seedTranslations.ts
 *
 * Seeds translations table from:
 *   src/assets/json/translation-en.json
 *   src/assets/json/translation-id.json
 *
 * Builds verseId lookup map from DB before inserting.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../index";
import { verses, translations } from "../schema";

interface ISeedTranslation {
  chapterId: number;
  verseNumber: number;
  lang: string;
  translator: string;
  text: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_DIR  = path.resolve(__dirname, "../../assets/json");

const CHUNK = 500;

// const TRANSLATION_FILE = "translation-en.json";
const TRANSLATION_FILE = "translation-id.json";

async function chunk<T>(
  arr: T[],
  size: number,
  fn: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < arr.length; i += size) {
    await fn(arr.slice(i, i + size));
  }
}

async function main() {
  // ── build verseId lookup map ───────────────────────────────────────────────
  console.log("\n🗺️  Building verse lookup map...");

  const verseRows = await db
    .select({
      id:          verses.id,
      chapterId:   verses.chapterId,
      verseNumber: verses.verseNumber,
    })
    .from(verses);

  const verseIdMap: Record<string, number> = {};
  for (const row of verseRows) {
    verseIdMap[`${row.chapterId}:${row.verseNumber}`] = row.id;
  }

  console.log(`✅ ${verseRows.length} verses mapped`);

  // ── translation ──────────────────────────────────────────────────────────
  console.log(`\n🌱 Seeding translation file: ${TRANSLATION_FILE}...`);

  const translationsJson: ISeedTranslation[] = JSON.parse(
    fs.readFileSync(path.join(JSON_DIR, TRANSLATION_FILE), "utf8")
  );

  const rows = translationsJson
    .map((t) => {
      const verseId = verseIdMap[`${t.chapterId}:${t.verseNumber}`];
      if (!verseId) {
        console.warn(`  ⚠️  No verse found for ${t.chapterId}:${t.verseNumber}`);
        return null;
      }
      return {
        verseId,
        lang: t.lang,
        translator: t.translator,
        text: t.text,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  let count = 0;
  await chunk(rows, CHUNK, async (batch) => {
    await db
      .insert(translations)
      .values(batch)
      .onConflictDoNothing();
    count += batch.length;
    console.log(`   ${count}/${rows.length}`);
  });

  console.log(`✅ ${count} ${TRANSLATION_FILE} translation file seeded`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
