#!/usr/bin/env node

/**
 * seedChaptersVerses.ts
 *
 * Seeds chapters and verses tables from:
 *   src/assets/json/chapters.json
 *   src/assets/json/verses.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../index";
import { chapters, verses } from "../schema";

interface ISeedChapter {
  id: number;
  name: string;
  verseCount: number;
}

interface ISeedVerse {
  chapterId: number;
  verseNumber: number;
  text: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_DIR  = path.resolve(__dirname, "../../assets/json");

const CHUNK = 500;

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
  // ── chapters ──────────────────────────────────────────────────────────────
  console.log("\n🌱 Seeding chapters...");

  const chaptersJson: ISeedChapter[] = JSON.parse(
    fs.readFileSync(path.join(JSON_DIR, "chapters.json"), "utf8")
  );

  await db
    .insert(chapters)
    .values(chaptersJson.map((c) => ({
      id:         c.id,
      name:       c.name,
      verseCount: c.verseCount,
    })))
    .onConflictDoNothing();

  console.log(`✅ ${chaptersJson.length} chapters seeded`);

  // ── verses ────────────────────────────────────────────────────────────────
  console.log("\n🌱 Seeding verses...");

  const versesJson: ISeedVerse[] = JSON.parse(
    fs.readFileSync(path.join(JSON_DIR, "verses.json"), "utf8")
  );

  let verseCount = 0;
  await chunk(versesJson, CHUNK, async (batch) => {
    await db
      .insert(verses)
      .values(batch.map((v) => ({
        chapterId:   v.chapterId,
        verseNumber: v.verseNumber,
        text:        v.text,
      })))
      .onConflictDoNothing();
    verseCount += batch.length;
    console.log(`   ${verseCount}/${versesJson.length}`);
  });

  console.log(`✅ ${verseCount} verses seeded`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
