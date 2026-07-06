import { Amiri } from "next/font/google";

// Amiri is a calligraphic Arabic typeface designed for scholarly and
// liturgical texts — well-suited for Quranic display. Loaded once,
// self-hosted by Next.js's font optimization pipeline.
export const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-amiri",
});
