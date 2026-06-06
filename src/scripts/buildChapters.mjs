import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://api.qurancdn.com/api/qdc";
const OUTPUT_DIR = "../assets/json";
const FILENAME = "chapters.json";

async function main() {
  console.log("Fetching chapters...");

  const response = await fetch(`${BASE_URL}/chapters?language=en`);
  if (!response.ok) throw new Error(response.status);

  console.log("Chapters fetched.");
  console.log("Building chapters...");

  const result = await response.json();
  const chapters = result.chapters.map((c) => ({
    id: c.id,
    name: c.name_simple,
    verseCount: c.verses_count,
  }));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(__dirname, OUTPUT_DIR);
  const fullPath = path.join(outputDir, FILENAME);
  
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  fs.writeFileSync(fullPath, JSON.stringify(chapters, null, 2));

  console.log("Chapters built.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
