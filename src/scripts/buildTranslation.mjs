// scripts/buildTranslation.mjs
//
// Converts translation txt downloaded from https://tanzil.net/trans and turn it into translation json.
// Run once manually from the project root:
//   node src/scripts/buildTranslation.mjs
//
// Input:  src/assets/txt/en.sahih.txt
// Output: src/assets/json/translation-en.json

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// const INPUT_FILE = "en.sahih.txt";
// const OUTPUT_FILE = "translation-en.json";
// const LANGUAGE = "en";
// const TRANSLATOR = "Saheeh International";

const INPUT_FILE = "id.indonesian.txt";
const OUTPUT_FILE = "translation-id.json";
const LANGUAGE = "id";
const TRANSLATOR = "Indonesian Ministry of Religious Affairs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(__dirname, `../assets/txt/${INPUT_FILE}`);
const OUTPUT = resolve(__dirname, `../assets/json/${OUTPUT_FILE}`);

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const raw = readFileSync(INPUT, "utf8");

const translation = raw
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .map((line) => {
    const parts = line.split("|");
    const chapterId = parseInt(parts[0], 10);
    const verseNumber = parseInt(parts[1], 10);
    const text = parts.slice(2).join("|");
    return {
      chapterId,
      verseNumber,
      lang: LANGUAGE,
      translator: TRANSLATOR,
      text,
    };
  })
  .filter(
    (e) =>
      !isNaN(e.chapterId) && !isNaN(e.verseNumber) && e.text.length > 0,
  );

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

writeFileSync(OUTPUT, JSON.stringify(translation, null, 2), "utf8");
console.log(`Done — ${translation.length} translation written to ${OUTPUT}`);