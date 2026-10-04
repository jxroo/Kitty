import { Check, Vault as VaultIcon } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { Counter } from "../components/Counter";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal } from "../lib/anim";
import { zl } from "../lib/format";
import { C, headline } from "../theme";

// Same people and colours as the loan scenes: Bartek borrows (amber), Anna and Celina guarantee (sky, indigo).
export const DEPOSITS = [
  { name: "Anna", amount: 1000, color: C.sky500, at: 80 },
  { name: "Bartek", amount: 500, color: C.amber400, at: 110 },
  { name: "Celina", amount: 1000, color: C.indigo500, at: 140 },
];
export const EQUATION_AT = 184;

/** The vault card from KasaView, filling up as the three members deposit. */
export const Vault: React.FC = () => {
  const frame = useCurrentFrame();
  const total = DEPOSITS.reduce((sum, d) => sum + d.amount * progress(frame, d.at + 4, 30), 0);
  const check = progress(frame, EQUATION_AT + 14, 24);
  return (
    <Stage gap={60}>
      <WordReveal
        start={8}
        stagger={5}
        style={headline(100, C.inkLight)}
        lines={["Your savings sit in a vault", [{ text: "owned by code.", color: C.emerald600 }]]}
      />
      <div
        style={{
          width: 1180,
          background: C.emerald50,
          border: `1.5px solid ${C.emerald200}`,
          borderRadius: 40,
          padding: "46px 56px 50px",
          boxShadow: "0 40px 100px rgba(6,95,70,0.14), 0 10px 30px rgba(6,95,70,0.06)",
          color: C.emerald900,
          ...reveal(frame, 30, 50, 70),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 700, letterSpacing: "0.08em" }}>
          <VaultIcon size={32} strokeWidth={2} /> SKARBIEC (KONTO PROGRAMU, NIE SKARBNIKA)
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 14 }}>
          <Counter value={total} final={zl(2500)} format={zl} align="left" style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.05 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 18 }}>
            {DEPOSITS.map((d) => {
              const p = progress(frame, d.at, 34);
              return (
                <div
                  key={d.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: C.white,
                    border: `1.5px solid ${C.emerald200}`,
                    borderRadius: 999,
                    padding: "8px 26px 8px 8px",
                    fontSize: 26,
                    opacity: p,
                    transform: `translateX(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})`,
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: d.color,
                      color: C.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 22,
                    }}
                  >
                    {d.name[0]}
                  </span>
                  <span style={{ fontWeight: 600, color: C.slate900, width: 100 }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: C.emerald700, fontVariantNumeric: "tabular-nums" }}>+{zl(d.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 28, marginTop: 10, display: "flex", alignItems: "center", gap: 12, ...reveal(frame, EQUATION_AT, 36, 16) }}>
          = oszczędności {zl(2500)} − pożyczone {zl(0)}
          <Check size={34} strokeWidth={3} color={C.emerald600} style={{ transform: `scale(${0.4 + 0.6 * check})`, opacity: check }} />
        </div>
      </div>
    </Stage>
  );
};
