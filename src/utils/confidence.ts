/**
 * Composite confidence scoring for verse matching.
 *
 * Combines four signals into one score, used identically for cold-start
 * (matching a transcribed chunk against the full 6236-verse table),
 * locked tracking (matching against just the current + next verse), and
 * fallback (re-widening to a full chapter after tracking fails) — no
 * separate machinery per mode, just a different candidate list passed in.
 */

export interface VerseCandidate {
  chapterId: number;
  verseNumber: number;
  text: string; // canonical Arabic verse text
}

export interface ScoredCandidate extends VerseCandidate {
  trigramScore: number;
  lengthScore: number;
  wordOverlapScore: number;
}

export interface ConfidenceResult {
  best: ScoredCandidate | null;
  secondBest: ScoredCandidate | null;
  margin: number;
  confidence: number;
  passed: boolean;
}

// --- Tunable weights ---------------------------------------------------
// Reasonable starting points, not yet validated against real recitation
// audio. Once the pipeline runs end-to-end, log the breakdown below for
// real chunks (correct matches AND near-misses) and adjust these based on
// where false locks or false rejections actually happen.
const WEIGHTS = {
  trigram: 0.35,
  margin: 0.25,
  length: 0.15,
  wordOverlap: 0.25,
};

export const CONFIDENCE_THRESHOLD = 0.6;
// -------------------------------------------------------------------------

/**
 * Strips Arabic diacritics, tatweel, and normalizes alef variants/whitespace
 * so ASR output and stored verse text compare fairly even when their
 * diacritic styles differ slightly between editions or ASR runs.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // diacritics + Quranic annotation marks
    .replace(/\u0640/g, "") // tatweel (elongation character)
    .replace(/[إأآ]/g, "ا") // alef variants -> bare alef
    .replace(/\s+/g, " ")
    .trim();
}

function getTrigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Jaccard similarity over character trigrams — the same idea as Postgres'
 * pg_trgm similarity(). Used here for the locked-tracking fast path (just
 * 2 known candidates, no DB round trip needed) and for testing. The
 * full-table cold-start/fallback search should still use pg_trgm's index
 * in SQL to narrow 6236 verses down to a shortlist cheaply — this function
 * then scores that shortlist the same way regardless of where it came from.
 */
export function trigramSimilarity(a: string, b: string): number {
  const setA = getTrigrams(normalizeArabic(a));
  const setB = getTrigrams(normalizeArabic(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const gram of setA) if (setB.has(gram)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 1.0 when normalized lengths match exactly, decaying toward 0 as they
 * diverge. Catches partial transcriptions (chunk cut off mid-verse) and
 * over-long ones (e.g. taawudh/basmalah bleeding into the chunk).
 */
export function lengthConsistency(a: string, b: string): number {
  const lenA = normalizeArabic(a).length;
  const lenB = normalizeArabic(b).length;
  if (lenA === 0 || lenB === 0) return 0;
  return Math.min(lenA, lenB) / Math.max(lenA, lenB);
}

/**
 * Longest common subsequence length between two word arrays — rewards the
 * candidate's words appearing in the transcription in the right relative
 * order, not just present somewhere. Catches transposed/jumbled matches
 * that raw character-trigram overlap alone can miss.
 */
function lcsLength(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Fraction of the candidate verse's words found in the transcription, in
 * order. Normalized by the candidate's word count (not the transcription's)
 * so extra leading/trailing words in the transcription — taawudh,
 * basmalah, mic noise — don't unfairly tank this score; that's what
 * lengthConsistency is for instead.
 */
export function orderedWordOverlap(transcribed: string, candidate: string): number {
  const wordsA = normalizeArabic(transcribed).split(" ").filter(Boolean);
  const wordsB = normalizeArabic(candidate).split(" ").filter(Boolean);
  if (wordsB.length === 0) return 0;
  return lcsLength(wordsA, wordsB) / wordsB.length;
}

/**
 * Scores every candidate against the transcribed text and returns the best
 * match plus a single composite confidence score. The same function is
 * used for cold-start (candidates = top-N from a full pg_trgm search),
 * locked tracking (candidates = [current, next]), and fallback (candidates
 * = full chapter) — only the candidate list passed in differs.
 */
export function scoreCandidates(
  transcribed: string,
  candidates: VerseCandidate[]
): ConfidenceResult {
  if (candidates.length === 0) {
    return { best: null, secondBest: null, margin: 0, confidence: 0, passed: false };
  }

  const scored: ScoredCandidate[] = candidates.map((c) => ({
    ...c,
    trigramScore: trigramSimilarity(transcribed, c.text),
    lengthScore: lengthConsistency(transcribed, c.text),
    wordOverlapScore: orderedWordOverlap(transcribed, c.text),
  }));

  scored.sort((x, y) => y.trigramScore - x.trigramScore);

  const best = scored[0];
  const secondBest = scored[1] ?? null;
  const margin = best.trigramScore - (secondBest?.trigramScore ?? 0);

  const confidence =
    WEIGHTS.trigram * best.trigramScore +
    WEIGHTS.margin * margin +
    WEIGHTS.length * best.lengthScore +
    WEIGHTS.wordOverlap * best.wordOverlapScore;

  return {
    best,
    secondBest,
    margin,
    confidence,
    passed: confidence >= CONFIDENCE_THRESHOLD,
  };
}
