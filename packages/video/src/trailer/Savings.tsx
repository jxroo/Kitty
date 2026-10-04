import { Bot, Check, Vault as VaultIcon } from "lucide-react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Counter } from "../components/Counter";
import { Stage } from "../components/Stage";
import { progress, reveal } from "../lib/anim";
import { zl } from "../lib/format";
import { C } from "../theme";
import { ChapterHead } from "./Chapter";

// The first four movements of the recorded run's "Historia kasy" (docs/screenshots/08c-kasa-history.png).
export const INFLOWS = [
  { who: "Anna", what: "Wpłata", amount: 1000, color: C.sky500, bot: false, at: 54 },
  { who: "Anna", what: "Stała składka", amount: 100, color: C.sky500, bot: true, at: 92 },
  { who: "Bartek", what: "Wpłata", amount: 500, color: C.amber400, bot: false, at: 130 },
  { who: "Celina", what: "Wpłata", amount: 1000, color: C.indigo500, bot: false, at: 168 },
];
export const EQUATION_AT = 206;
// A coin landing: overshoots a little and settles.
const COIN = Easing.bezier(0.34, 1.56, 0.64, 1);

/** 01 · Savings: the kasa's money fills up, including a standing contribution nobody had to send by hand. */
export const Savings: React.FC = () => {
  const frame = useCurrentFrame();
  const total = INFLOWS.reduce((s, f) => s + f.amount * progress(frame, f.at + 4, 28), 0);
  const check = progress(frame, EQUATION_AT + 12, 22);
  return (
    <Stage gap={52}>
      <ChapterHead n={1} kicker="Savings" look="mask" title="A vault owned by code." sub="Not by a treasurer. Not by a bank." />
        <div
          style={{
            position: "relative",
            width: 1320,
            background: C.emerald50,
            border: `1.5px solid ${C.emerald200}`,
            borderRadius: 40,
            padding: "40px 52px 44px",
            boxShadow: "0 50px 120px rgba(6,95,70,0.18), 0 12px 32px rgba(6,95,70,0.08)",
            color: C.emerald900,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 700, letterSpacing: "0.08em" }}>
            <VaultIcon size={32} strokeWidth={2} /> PIENIĄDZE KASY
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12, gap: 40 }}>
            <div>
              <Counter value={total} final={zl(2600)} format={zl} align="left" style={{ fontSize: 140, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.05 }} />
              <div style={{ fontSize: 27, marginTop: 8, display: "flex", alignItems: "center", gap: 10, ...reveal(frame, EQUATION_AT, 34, 14) }}>
                = odłożone {zl(2600)} − pożyczone {zl(0)}
                <Check size={32} strokeWidth={3} color={C.emerald600} style={{ transform: `scale(${0.4 + 0.6 * check})`, opacity: check }} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 620 }}>
              {INFLOWS.map((f, i) => {
                const p = progress(frame, f.at, 10);
                const fall = interpolate(frame, [f.at, f.at + 22], [-70, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: COIN });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: C.white,
                      border: `1.5px solid ${f.bot ? C.emerald500 : C.emerald200}`,
                      borderRadius: 18,
                      padding: "10px 20px 10px 10px",
                      fontSize: 23,
                      opacity: p,
                      transform: `translateY(${fall}px)`,
                      boxShadow: f.bot ? `0 0 0 ${5 * (1 - progress(frame, f.at + 10, 50))}px rgba(16,185,129,0.25)` : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        background: f.color,
                        color: C.white,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 19,
                        flexShrink: 0,
                      }}
                    >
                      {f.who[0]}
                    </span>
                    <span style={{ flex: 1, color: C.slate700, whiteSpace: "nowrap" }}>
                      <strong style={{ color: C.slate900 }}>{f.who}</strong> · {f.what}
                    </span>
                    {f.bot ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.emerald700, fontWeight: 600, fontSize: 21 }}>
                        <Bot size={24} strokeWidth={2} /> automat
                      </span>
                    ) : null}
                    <span style={{ fontWeight: 700, color: C.emerald700, fontVariantNumeric: "tabular-nums", minWidth: 120, textAlign: "right" }}>+{zl(f.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
    </Stage>
  );
};
