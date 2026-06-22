import { scoreCandidates } from "@/utils/confidence";

// Real output from the ASR service (curl test against 001001.mp3):
const transcribed = "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ";

function run(label: string, transcribedText: string, candidates: Parameters<typeof scoreCandidates>[1]) {
  const result = scoreCandidates(transcribedText, candidates);
  console.log(`\n--- ${label} ---`);
  console.log(`transcribed: "${transcribedText}"`);
  for (const c of candidates) {
    console.log(`  candidate ${c.chapterId}:${c.verseNumber} -> "${c.text}"`);
  }
  console.log("result:", JSON.stringify(result, null, 2));
  return result;
}

// Case 1: correct verse present alongside an unrelated one — best should
// be 1:1, with a healthy margin over the unrelated candidate.
const case1 = run("correct match vs. unrelated verse", transcribed, [
  { chapterId: 1, verseNumber: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
  { chapterId: 112, verseNumber: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
]);

// Case 2: locked-tracking shape — current vs. next, where "next" is a
// real, plausible neighboring verse (1:2) rather than a wildly different
// one. Margin should still favor the correct current verse.
const case2 = run("locked tracking: current vs. next", transcribed, [
  { chapterId: 1, verseNumber: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
  { chapterId: 1, verseNumber: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
]);

// Case 3: truncated chunk (as if the audio cut off mid-verse) — confidence
// should drop noticeably due to lengthConsistency, even though the words
// present are exactly right and in order.
const truncated = "بِسْمِ اللَّهِ";
const case3 = run("truncated mid-verse chunk", truncated, [
  { chapterId: 1, verseNumber: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
]);

console.log("\n=== Summary ===");
console.log(
  `Case 1 passed=${case1.passed} confidence=${case1.confidence.toFixed(3)} best=${case1.best?.chapterId}:${case1.best?.verseNumber}`
);
console.log(
  `Case 2 passed=${case2.passed} confidence=${case2.confidence.toFixed(3)} best=${case2.best?.chapterId}:${case2.best?.verseNumber}`
);
console.log(
  `Case 3 passed=${case3.passed} confidence=${case3.confidence.toFixed(3)} (expect lower than case 1 due to truncation)`
);
