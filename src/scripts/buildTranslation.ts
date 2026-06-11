// buildTranslation.ts
//
// Converts translation txt downloaded from https://tanzil.net/trans and turn it into translation json.
//
// Input:  src/assets/txt/en.sahih.txt
// Output: src/assets/json/translation-en.json

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

interface ISPECS {
  INPUT_FILE: string;
  OUTPUT_FILE: string;
  LANGUAGE: string;
  TRANSLATOR: string;
}

// const SPECS: ISpecs = {
//   INPUT_FILE: "en.sahih.txt",
//   OUTPUT_FILE: "translation-en.json",
//   LANGUAGE: "en",
//   TRANSLATOR: "Saheeh International",
// };

const SPECS: ISPECS = {
  INPUT_FILE: "id.indonesian.txt",
  OUTPUT_FILE: "translation-id.json",
  LANGUAGE: "id",
  TRANSLATOR: "Indonesian Ministry of Religious Affairs",
};

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const inputPath = resolve(__dirname, `../assets/txt/${SPECS.INPUT_FILE}`);
  const outputPath = resolve(__dirname, `../assets/json/${SPECS.OUTPUT_FILE}`);
  
  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------
  
  const raw = readFileSync(inputPath, "utf8");
  
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
        lang: SPECS.LANGUAGE,
        translator: SPECS.TRANSLATOR,
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
  
  writeFileSync(outputPath, JSON.stringify(translation, null, 2), "utf8");
  console.log(`Done — ${translation.length} translation written to ${outputPath}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
