// buildChapters.ts
//
// Fetches chapters from https://quran.com and turn it into chapters.json.
//
// Output: src/assets/json/chapters.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://api.qurancdn.com/api/qdc";
const OUTPUT_PATH = "../assets/json/chapters.json";

interface IResChapter {
  chapters: {
    id: number;
    revelation_place: string;
    revelation_order: number;
    bismillah_pre: boolean;
    name_simple: string;
    name_complex: string;
    name_arabic: string;
    verses_count: number;
    pages: [number, number];
    slug: {
      slug: string;
      locale: string;
    },
    translated_name: {
      language_name: string;
      name: string;
    }
  }[];
}

interface ISeedChapter {
  id: number;
  name: string;
  verseCount: number;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputPath = path.resolve(__dirname, OUTPUT_PATH);

  console.log("Fetching chapters...");

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const response = await fetch(`${BASE_URL}/chapters?language=en`);
  if (!response.ok) throw new Error(`HTTP Status: ${response.status}`);

  console.log("Chapters fetched.");
  console.log("Building chapters...");

  // ---------------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------------

  const result: IResChapter = await response.json();
  const chapters: ISeedChapter[] = result.chapters.map((c) => ({
    id: c.id,
    name: c.name_simple,
    verseCount: c.verses_count,
  }));

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  fs.writeFileSync(outputPath, JSON.stringify(chapters, null, 2));

  console.log("Chapters built.");
  console.log(`Done — ${chapters.length} chapters written to ${outputPath}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
