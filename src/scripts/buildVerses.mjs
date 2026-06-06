// scripts/buildVerses.mjs
//
// Converts quran-simple.txt downloaded from https://tanzil.net/download and turn it into verses.json.
// Run once manually from the project root:
//   node src/scripts/buildVerses.mjs
//
// Input:  src/assets/txt/quran-simple.txt
// Output: src/assets/json/verses.json

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(__dirname, "../assets/txt/quran-simple.txt");
const OUTPUT = resolve(__dirname, "../assets/json/verses.json");

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const raw = readFileSync(INPUT, "utf8");

const verses = raw
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .map((line) => {
    const parts = line.split("|");
    const chapterId = parseInt(parts[0], 10);
    const verseNumber = parseInt(parts[1], 10);
    const text = parts.slice(2).join("|");
    return { chapterId, verseNumber, text };
  })
  .filter(
    (e) =>
      !isNaN(e.chapterId) && !isNaN(e.verseNumber) && e.text.length > 0,
  );

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

writeFileSync(OUTPUT, JSON.stringify(verses, null, 2), "utf8");
console.log(`Done — ${verses.length} verses written to ${OUTPUT}`);