import React from "react";

// The trailer's cut, "Someone holds the savings" → "No one holds the savings", in Polish.
// "Nikt" needs "nie", which usually changes the object's case, so these are sentences whose
// rest reads the same after "Ktoś" and after "Nikt nie".
const SENTENCES = ["zarządza pieniędzmi.", "decyduje o pożyczce.", "musi ścigać dłużników.", "znika z pieniędzmi."];

export function NoOne({ className = "" }: { className?: string }) {
  return (
    <ul className={`font-serif text-cream text-lg sm:text-xl leading-snug space-y-0.5 ${className}`}>
      {SENTENCES.map((rest, i) => (
        <li key={rest} style={{ "--d": `${0.3 + i * 0.45}s` } as React.CSSProperties}>
          <span className="no-one-someone" aria-hidden>
            Ktoś
          </span>
          <span className="no-one-noone font-mono text-mint text-[0.8em] font-semibold">Nikt nie</span> {rest}
        </li>
      ))}
    </ul>
  );
}
