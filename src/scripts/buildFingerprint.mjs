#!/usr/bin/env node

/**
 * buildFingerprint.mjs
 *
 * Reads unzipped mp3s from src/assets/audio/, generates spectral
 * peak fingerprint hashes using fft.js, streams to fingerprint.ndjson.
 *
 * Hash encoding: packed 32-bit integer
 *   bits [19..11] = f1 (dominant bin in band, 9 bits, 0–511)
 *   bits [10..2]  = f2 (dominant bin in band, 9 bits, 0–511)
 *   bits [1..0]   = dt (frame delta, 2 bits, 1–2)
 *   max value: ~1,048,574 — well within Postgres integer range
 *
 * Prerequisites:
 *   - brew install ffmpeg
 *   - audio zips already downloaded and unzipped
 *
 * Usage:
 *   node scripts/buildFingerprint.mjs
 *   node scripts/buildFingerprint.mjs --from 10
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import FFT from "fft.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const AUDIO_DIR   = "../assets/audio";
const OUTPUT_DIR  = "../assets/json";
const OUTPUT_FILE = "fingerprint.ndjson";

const FFT_SIZE    = 1024;
const HOP_SIZE    = 512;
const SAMPLE_RATE = 16000;
const BAND_EDGES  = [0, 40, 80, 512];
const FAN_OUT     = 1;

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--from");
  return { from: i !== -1 && args[i + 1] ? Number(args[i + 1]) : 1 };
}

// ─── Decode ───────────────────────────────────────────────────────────────────

function decodeToFloat32(mp3Path) {
  const raw = execSync(
    `ffmpeg -i "${mp3Path}" -ar ${SAMPLE_RATE} -ac 1 -f s16le -loglevel error -`,
    { maxBuffer: 20 * 1024 * 1024 }
  );
  const samples = new Float32Array(raw.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = raw.readInt16LE(i * 2) / 32768.0;
  }
  return samples;
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

const fft = new FFT(FFT_SIZE);

const hannWindow = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// pack f1, f2, dt into a single 32-bit integer
// f1/f2: 9 bits each (0–511), dt: 2 bits (1–2)
function packHash(f1, f2, dt) {
  return (f1 << 11) | (f2 << 2) | dt;
}

function generateHashes(samples) {
  const out   = fft.createComplexArray();
  const frame = new Float32Array(FFT_SIZE);
  const frames = [];

  // 1. frame + hann window + FFT → magnitude per frame
  for (let i = 0; i + FFT_SIZE <= samples.length; i += HOP_SIZE) {
    for (let j = 0; j < FFT_SIZE; j++) {
      frame[j] = samples[i + j] * hannWindow[j];
    }
    fft.realTransform(out, frame);

    const mag = new Float32Array(FFT_SIZE / 2);
    for (let k = 0; k < FFT_SIZE / 2; k++) {
      mag[k] = Math.sqrt(
        out[2 * k] * out[2 * k] + out[2 * k + 1] * out[2 * k + 1]
      );
    }
    frames.push(mag);
  }

  // 2. dominant bin per band per frame
  const peaks = frames.map((mag) =>
    BAND_EDGES.slice(0, -1).map((start, b) => {
      const end = BAND_EDGES[b + 1];
      let maxVal = -1;
      let maxBin = start;
      for (let k = start; k < end; k++) {
        if (mag[k] > maxVal) {
          maxVal = mag[k];
          maxBin = k;
        }
      }
      return maxBin;
    })
  );

  // 3. same-band fan-out pairing → packed integer hash
  const hashes = [];
  for (let t1 = 0; t1 < peaks.length; t1++) {
    const limit = Math.min(t1 + FAN_OUT, peaks.length - 1);
    for (let t2 = t1 + 1; t2 <= limit; t2++) {
      const dt = t2 - t1;
      for (let b = 0; b < peaks[t1].length; b++) {
        hashes.push({
          hash:     packHash(peaks[t1][b], peaks[t2][b], dt),
          offsetMs: Math.round((t1 * HOP_SIZE / SAMPLE_RATE) * 1000),
        });
      }
    }
  }

  return hashes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
  } catch {
    console.error("ffmpeg not found. Install it: brew install ffmpeg");
    process.exit(1);
  }

  const { from } = parseArgs();
  const __dirname  = path.dirname(fileURLToPath(import.meta.url));
  const audioDir   = path.resolve(__dirname, AUDIO_DIR);
  const outputDir  = path.resolve(__dirname, OUTPUT_DIR);
  const outputPath = path.join(outputDir, OUTPUT_FILE);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(audioDir)
    .filter((f) => f.endsWith(".mp3"))
    .sort()
    .filter((f) => parseInt(f.slice(0, 3), 10) >= from);

  console.log(`\n🎵 Fingerprinting ${files.length} file(s) from chapter ${from}\n`);

  const writeStream = fs.createWriteStream(outputPath, {
    flags: from > 1 ? "a" : "w",
  });

  const failed   = [];
  let succeeded  = 0;
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file        = files[i];
    const chapterId   = parseInt(file.slice(0, 3), 10);
    const verseNumber = parseInt(file.slice(3, 6), 10);
    const mp3Path     = path.join(audioDir, file);
    const position    = `[${i + 1}/${files.length}]`;

    try {
      const samples = decodeToFloat32(mp3Path);
      const hashes  = generateHashes(samples);

      writeStream.write(
        JSON.stringify({ chapterId, verseNumber, hashes }) + "\n"
      );
      succeeded++;

      if ((i + 1) % 100 === 0) {
        const elapsed   = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate      = ((i + 1) / elapsed).toFixed(1);
        const remaining = files.length - i - 1;
        const eta       = Math.round(remaining / rate);
        console.log(
          `✅ ${position} ${file}  |  ${hashes.length} hashes  |  ${rate} files/s  |  ETA ~${eta}s`
        );
      }
    } catch (err) {
      console.error(`⛔ ${position} ${file} — ${err.message}`);
      failed.push({ file, error: err.message });
    }
  }

  await new Promise((resolve) => writeStream.end(resolve));

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ Fingerprinted : ${succeeded} verses`);
  console.log(`⛔ Failed        : ${failed.length}`);
  console.log(`⏱️  Total time    : ${totalSec}s`);
  console.log(`📄 Output        : ${outputPath}`);

  if (failed.length > 0) {
    console.log(`\nFailed files:`);
    for (const { file, error } of failed) {
      console.log(`  ${file} — ${error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});