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
  textNormalized: string;
}

const INPUT_PATH_SIMPLE = "../assets/txt/quran-simple.txt";
const INPUT_PATH_UTHMANI = "../assets/txt/quran-uthmani.txt";
const OUTPUT_PATH = "../assets/json/verses.json";

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // diacritics + Quranic annotation marks
    .replace(/\u0640/g, "") // tatweel (elongation character)
    .replace(/[إأآ]/g, "ا") // alef variants -> bare alef
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const inputPathSimple = path.resolve(__dirname, INPUT_PATH_SIMPLE);
  const inputPathUthmani = path.resolve(__dirname, INPUT_PATH_UTHMANI);
  const outputPath = path.resolve(__dirname, OUTPUT_PATH);

  const rawSimple = fs.readFileSync(inputPathSimple, "utf8");
  const rawUthmani = fs.readFileSync(inputPathUthmani, "utf8");

  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------

  const versesSimple: ISeedChapter[] = rawSimple
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split("|");
      const chapterId = parseInt(parts[0], 10);
      const verseNumber = parseInt(parts[1], 10);
      const textNormalized = normalizeArabic(parts.slice(2).join("|"));
      return { chapterId, verseNumber, text: "", textNormalized };
    })
    .filter(
      (e) =>
        !isNaN(e.chapterId) && !isNaN(e.verseNumber) && e.textNormalized.length > 0,
    );

  const versesUthmani: ISeedChapter[] = rawUthmani
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split("|");
      const chapterId = parseInt(parts[0], 10);
      const verseNumber = parseInt(parts[1], 10);
      const text = parts.slice(2).join("|");
      return { chapterId, verseNumber, text, textNormalized: "" };
    })
    .filter(
      (e) =>
        !isNaN(e.chapterId) && !isNaN(e.verseNumber) && e.text.length > 0,
    );

  const verses: ISeedChapter[] = versesUthmani
    .map((v, i) => ({
      chapterId: v.chapterId,
      verseNumber: v.verseNumber,
      text: v.text,
      textNormalized: versesSimple[i].textNormalized,
    }));

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
