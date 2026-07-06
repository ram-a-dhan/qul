"use client";

import { useQulListener, type ListenStatus } from "@/hooks/useQulListener";

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function StatusLabel({ status, surahName, verseNumber }: {
  status: ListenStatus;
  surahName?: string;
  verseNumber?: number;
}) {
  const configs: Record<ListenStatus, { label: string; color: string }> = {
    idle:       { label: "Tap to begin",          color: "#4a4a5e" },
    requesting: { label: "Requesting mic...",     color: "#4a4a5e" },
    listening:  { label: "Listening",             color: "#3a8a6e" },
    identifying:{ label: "Identifying...",        color: "#b8892f" },
    locked:     {
      label: surahName && verseNumber
        ? `${surahName} · ${verseNumber}`
        : "Locked",
      color: "#3a8a6e",
    },
    "no-signal":{ label: "No match — still listening", color: "#7a5a2f" },
    error:      { label: "Error",                 color: "#8a3a3a" },
  };

  const { label, color } = configs[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <WaveIndicator active={status === "listening" || status === "identifying"} color={color} />
      <span className="text-xs tracking-[0.12em] uppercase font-[inherit] transition-colors duration-400 ease-linear">
        {label}
      </span>
    </div>
  );
}

// Three bars that animate while listening
function WaveIndicator({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-0.75 h-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-0.75 rounded-xs"
          style={{
            backgroundColor: color,
            height: active ? "100%" : "4px",
            transition: "height 0.3s ease, background-color 0.4s ease",
            animation: active ? `wave 1.1s ease-in-out ${i * 0.18}s infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { height: 4px; }
          to   { height: 16px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function QulApp({ amiriClass }: { amiriClass: string }) {
  const { status, verse, errorMessage, start, stop } = useQulListener();
  const isListening = status !== "idle" && status !== "error";

  const translation = verse?.translations.find((t) => t.lang === "en");

  return (
    <div className="min-h-dvh bg-slate-950 text-amber-400 flex flex-col font-sans">
      {/* ── Status bar ─────────────────────────────── */}
      <header className="py-5 px-7 flex items-center justify-between border-b border-b-slate-900">
        <span className="text-sm font-semibold tracking-[0.08em] text-yellow-600">
          QUL
        </span>
        <StatusLabel
          status={status}
          surahName={verse?.surahName}
          verseNumber={verse?.verseNumber}
        />
      </header>

      {/* ── Verse area ─────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center py-12 px-8 gap-9 text-center">
        {verse ? (
          <>
            {/* Surah + verse badge */}
            <span className="text-xs tracking-[0.14em] uppercase text-gray-400">
              {verse.surahName} · Verse {verse.verseNumber}
            </span>

            {/* Arabic text */}
            <p
              className={`${amiriClass} text-[clamp(2rem,6vw,3.8rem)] leading-[1.8] text-amber-100 m-0 max-w-205 transition-opacity duration-500 ease-linear`}
              dir="rtl"
              lang="ar"
              // style={{
              //   fontSize: "clamp(2rem, 6vw, 3.8rem)",
              //   lineHeight: 1.8,
              //   color: "#f0ead8",
              //   margin: 0,
              //   maxWidth: "820px",
              //   transition: "opacity 0.5s ease",
              // }}
            >
              {verse.text}
            </p>

            {/* Translation */}
            {translation && (
              <p className="text-[clamp(0.95rem,2vw,1.15rem)] leading-[1.75] text-violet-300 m-0 max-w-150 italic transition-opacity duration-500 ease-linear">
                {translation.text}
              </p>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col gap-4 items-center">
            <div className="w-14 h-14 rounded-[50%] border border-slate-800 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a3850" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
            <p className="text-slate-800 text-sm/[1.6] m0 max-w-65">
              {errorMessage ?? "Tap start, then hold your device toward the recitation."}
            </p>
          </div>
        )}
      </main>

      {/* ── Controls ───────────────────────────────── */}
      <footer className="pt-7 px-8 pb-10 flex justify-center border-t border-t-slate-900">
        <button
          onClick={isListening ? stop : start}
          disabled={status === "requesting"}
          className="py-3.5 px-12 rounded-[100px] border-none text-sm font-semibold tracking-[0.06em] transition-colors duration-300 ease-linear outline-none"
          style={{
            cursor: status === "requesting" ? "not-allowed" : "pointer",
            backgroundColor: isListening ? "#1e1d26" : "#b8892f",
            color: isListening ? "#6a6478" : "#0d0c10",
          }}
        >
          {status === "requesting"
            ? "Requesting..."
            : isListening
            ? "Stop"
            : "Start Listening"}
        </button>
      </footer>
    </div>
  );
}