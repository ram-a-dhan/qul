// buildVerses.ts
//
// Converts quran-simple.txt downloaded from https://tanzil.net/download and turn it into verses.json.
//
// Input:  src/assets/txt/quran-simple.txt
// Output: src/assets/json/verses.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

interface ISeedChapter {
  chapterId: number;
  verseNumber: number;
  text: string;
}

const INPUT_PATH = "../assets/txt/quran-simple.txt";
const OUTPUT_PATH = "../assets/json/verses.json";

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const inputPath = path.resolve(__dirname, INPUT_PATH);
  const outputPath = path.resolve(__dirname, OUTPUT_PATH);

  const raw = fs.readFileSync(inputPath, "utf8");

  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------

  const verses: ISeedChapter[] = raw
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

  fs.writeFileSync(outputPath, JSON.stringify(verses, null, 2), "utf8");

  console.log(`Done — ${verses.length} verses written to ${outputPath}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
