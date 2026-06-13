#!/usr/bin/env node

/**
 * seedReciterFingerprint.ts
 *
 * Seeds reciters and fingerprints tables from:
 *   src/assets/json/fingerprint.ndjson
 *
 * Deletes existing fingerprints for the reciter before inserting.
 * Builds verseId lookup map from DB before inserting fingerprints.
 */

import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { db } from "../index";
import { reciters, verses, fingerprints } from "../schema";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const NDJSON     = path.resolve(__dirname, "../../assets/json/fingerprint.ndjson");
const CHUNK      = 500;

interface ISeedReciter {
  slug: string;
  name: string;
  recitationStyle: string;
}

// ── reciter definitions ────────────────────────────────────────────────────────
const RECITER: ISeedReciter = {
  slug:            "mishary-alafasy",
  name:            "Mishary Rashid Alafasy",
  recitationStyle: "hafs",
};

async function main() {
  // ── upsert reciter ────────────────────────────────────────────────────────
  console.log("\n🎙️  Upserting reciter...");

  const [reciter] = await db
    .insert(reciters)
    .values(RECITER)
    .onConflictDoUpdate({
      target: reciters.slug,
      set: {
        name:            RECITER.name,
        recitationStyle: RECITER.recitationStyle,
      },
    })
    .returning();

  console.log(`✅ Reciter: ${reciter.name} (id: ${reciter.id})`);

  // ── wipe existing fingerprints for this reciter ───────────────────────────
  console.log("\n🗑️  Clearing existing fingerprints...");

  const deleted = await db
    .delete(fingerprints)
    .where(eq(fingerprints.reciterId, reciter.id))
    .returning({ hash: fingerprints.hash });

  console.log(`✅ Cleared ${deleted.length} existing rows`);

  // ── build verseId lookup map ──────────────────────────────────────────────
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

  // ── stream ndjson and insert fingerprints ─────────────────────────────────
  console.log("\n🌱 Seeding fingerprints...");

  const rl = readline.createInterface({
    input: fs.createReadStream(NDJSON),
  });

  let batch: InferInsertModel<typeof fingerprints>[] = [];
  let total = 0;
  let skipped = 0;
  const startTime = Date.now();

  async function flushBatch() {
    if (batch.length === 0) return;
    await db.insert(fingerprints).values(batch).onConflictDoNothing();
    total += batch.length;
    batch  = [];
  }

  for await (const line of rl) {
    if (!line.trim()) continue;

    const { chapterId, verseNumber, hashes } = JSON.parse(line);
    const verseId = verseIdMap[`${chapterId}:${verseNumber}`];

    if (!verseId) {
      console.warn(`  ⚠️  No verse found for ${chapterId}:${verseNumber}`);
      skipped++;
      continue;
    }

    for (const { hash, offsetMs } of hashes) {
      batch.push({
        verseId,
        reciterId: reciter.id,
        hash,
        offsetMs,
      });

      if (batch.length >= CHUNK) {
        await flushBatch();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r   inserted: ${total} rows — ${elapsed}s`);
      }
    }
  }

  // flush remaining
  await flushBatch();

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n─────────────────────────────────────`);
  console.log(`✅ Fingerprints inserted : ${total}`);
  console.log(`⚠️  Verses skipped       : ${skipped}`);
  console.log(`⏱️  Total time           : ${totalSec}s`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
