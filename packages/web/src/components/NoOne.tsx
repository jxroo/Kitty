import React from "react";

// The trailer's cut, "Someone manages the money" → "No one manages the money".
const SENTENCES = ["manages the money.", "decides who gets a loan.", "has to chase debtors.", "runs off with the money."];

export function NoOne({ className = "" }: { className?: string }) {
  return (
    <ul className={`font-serif text-cream text-lg sm:text-xl leading-snug space-y-0.5 ${className}`}>
      {SENTENCES.map((rest, i) => (
        <li key={rest} style={{ "--d": `${0.3 + i * 0.45}s` } as React.CSSProperties}>
          <span className="no-one-someone" aria-hidden>
            Someone
          </span>
          <span className="no-one-noone font-mono text-mint text-[0.8em] font-semibold">No one</span> {rest}
        </li>
      ))}
    </ul>
  );
}
