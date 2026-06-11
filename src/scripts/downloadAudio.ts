/**
 * downloadAudio.ts
 *
 * Downloads per-chapter translation audio zips from EveryAyah.com/data.
 * Saves to src/assets/audio/{001..114}.zip
 *
 * Options:
 *   --delay 3000   (ms between chapters)
 *   --from 10      (resume from chapter)
 *   --retries 5
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

// ─── Config ───────────────────────────────────────────────────────────────────

const FOLDER_NAME = "Alafasy_128kbps"; // Change this to change reciter
const BASE_URL = `https://everyayah.com/data/${FOLDER_NAME}/zips`;
const OUTPUT_DIR = "../assets/audio";
const TOTAL_CHAPTERS = 114;

const DEFAULTS = {
  delay: 5_000,      // ms to wait between chapters (be polite to the server)
  from: 1,           // resume from this chapter number
  retries: 3,        // attempts per chapter before giving up
  retryDelay: 5_000, // ms to wait before a retry
};

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? Number(args[i + 1]) : null;
  };
  return {
    delay:      get("--delay")   ?? DEFAULTS.delay,
    from:       get("--from")    ?? DEFAULTS.from,
    retries:    get("--retries") ?? DEFAULTS.retries,
    retryDelay: get("--retry-delay") ?? DEFAULTS.retryDelay,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(3, "0");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatEta(remainingChapters: number, msPerChapter: number) {
  const totalMs = remainingChapters * msPerChapter;
  const totalSec = Math.round(totalMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `~${min}m ${sec}s` : `~${sec}s`;
}

// ─── Download ─────────────────────────────────────────────────────────────────

function fetchToBuffer(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchToBuffer(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(merged);
      });
      res.on("error", (err) => reject(new Error(`res error: ${err.message}`)));
    });

    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", (err) => reject(new Error(`get error: ${err.message} | code: ${(err as NodeJS.ErrnoException).code}`)));
  });
}

async function downloadChapter(chapter: number, outputDir: string, retries: number, retryDelay: number) {
  const filename = `${pad(chapter)}.zip`;
  const url = `${BASE_URL}/${filename}`;
  const dest = path.join(outputDir, filename);

  if (fs.existsSync(dest)) {
    const size = fs.statSync(dest).size;
    if (size > 0) {
      console.log(`⏭️  ${filename} already exists (${formatBytes(size)}) — skipping`);
      return { skipped: true, bytes: size };
    }
    fs.unlinkSync(dest);
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const buffer = await fetchToBuffer(url);
      const bytes = buffer.byteLength;

      if (bytes === 0) throw new Error("Empty response body");

      fs.writeFileSync(dest, buffer);
      return { skipped: false, bytes };
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        console.log(
          `⚠️  Attempt ${attempt}/${retries} failed: ${(err as Error).message}. Retrying in ${retryDelay / 1000}s…`
        );
        await sleep(retryDelay);
      }
    }
  }

  throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { delay, from, retries, retryDelay } = parseArgs();

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(__dirname, OUTPUT_DIR);

  fs.mkdirSync(outputDir, { recursive: true });

  const chapters = Array.from(
    { length: TOTAL_CHAPTERS - from + 1 },
    (_, i) => from + i
  );

  console.log(`\n📥 Downloading ${chapters.length} chapter(s) → ${outputDir}`);
  console.log(`⏱️ Delay between chapters: ${delay}ms`);
  console.log(`🎲 Retries: ${retries}\n`);

  const failed = [];
  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;
  const startTime = Date.now();
  const downloadTimes = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const position = `[${i + 1}/${chapters.length}]`;

    process.stdout.write(`🛄 ${position} Chapter ${pad(chapter)}…\n`);

    const t0 = Date.now();

    try {
      const { bytes, skipped: skippedChapter } = await downloadChapter(
        chapter,
        outputDir,
        retries,
        retryDelay
      );

      const elapsed = Date.now() - t0;
      totalBytes += bytes;

      if (skippedChapter) {
        skipped++;
        continue;
      } else {
        downloaded++;
        downloadTimes.push(elapsed + delay);
        const avgMs =
          downloadTimes.reduce((a, b) => a + b, 0) / downloadTimes.length;
        const remaining = chapters.length - i - 1;
        const eta = remaining > 0 ? `  ETA ${formatEta(remaining, avgMs)}` : "";
        console.log(`✅ ${formatBytes(bytes)} in ${(elapsed / 1000).toFixed(1)}s${eta}`);
      }
    } catch (err) {
      const errMsg = (err as Error).message
      console.log(`⛔ ${errMsg}`);
      failed.push({ chapter, error: errMsg });
    }

    // Wait between chapters — skip after the last one
    if (i < chapters.length - 1) {
      await sleep(delay);
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ Downloaded : ${downloaded} chapter(s) (${formatBytes(totalBytes)})`);
  console.log(`⏭️  Skipped    : ${skipped} already present`);
  console.log(`⛔ Failed     : ${failed.length}`);
  console.log(`⏱️  Total time : ${totalSec}s`);

  if (failed.length > 0) {
    console.log(`\nFailed chapters:`);
    for (const { chapter, error } of failed) {
      console.log(`  ${pad(chapter)} — ${error}`);
    }
    console.log(
      `\nResume failed chapters with: node src/scripts/downloadAudio.mjs --from <chapter>`
    );
    process.exit(1);
  }

  console.log(`\nDone. Unzip all files with:`);
  console.log(
    `  for f in src/assets/audio/*.zip; do unzip -n "$f" -d src/assets/audio/; done`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
