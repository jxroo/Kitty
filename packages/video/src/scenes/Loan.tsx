import { Check, CircleCheck } from "lucide-react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { Cursor } from "../components/Cursor";
import { CollateralBar } from "../components/Loan";
import { Stage } from "../components/Stage";
import { Button, Card, Pill, pressAt } from "../components/ui";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal } from "../lib/anim";
import { zl } from "../lib/format";
import { C, headline } from "../theme";

// The demo loan: 1000 zł, covered by Bartek's own 500 zł, then Anna's 300 zł and Celina's 200 zł pledges.
export const PLEDGES = [
  { label: "Bartek (własne)", amount: 500, color: C.amber400, at: 60, dur: 40 },
  { label: "Anna poręcza", amount: 300, color: C.sky500, at: 140, dur: 35 },
  { label: "Celina poręcza", amount: 200, color: C.indigo500, at: 205, dur: 35 },
];
export const FULL_AT = 240;
export const PAYOUT_CLICK = 316;
const LOAN = 1000;

/** Nobody approves: the bar fills with locked savings, the button wakes up at 100 %, Bartek pays it out himself. */
export const Loan: React.FC = () => {
  const frame = useCurrentFrame();
  const segments = PLEDGES.map((p) => ({
    label: p.label,
    color: p.color,
    value: p.amount * progress(frame, p.at, p.dur),
    opacity: progress(frame, p.at, 20),
  }));
  const covered = Math.round(segments.reduce((s, x) => s + x.value, 0) / 10) * 10;
  const full = progress(frame, FULL_AT - 4, 20);
  const paid = progress(frame, PAYOUT_CLICK + 8, 18);
  const glow = full * (1 - paid);

  return (
    <Stage gap={56}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <WordReveal start={6} stagger={5} style={headline(100, C.inkLight)} lines={["Nobody approves a loan."]} />
        <WordReveal
          start={22}
          stagger={3}
          style={{ ...headline(44, C.grayLight), fontWeight: 500, letterSpacing: "-0.02em" }}
          lines={["When locked savings cover 100%, it pays out."]}
        />
      </div>

      <Card style={{ width: 1320, ...reveal(frame, 28, 50, 70) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.02em" }}>Bartek pożycza {zl(LOAN)}</div>
            <div style={{ fontSize: 26, color: C.slate500, marginTop: 6 }}>4 raty po ok. {zl(250)} · 0% odsetek</div>
          </div>
          <div style={{ position: "relative" }}>
            <Pill tone="sky" style={{ opacity: 1 - paid }}>
              Czeka na poręczenia
            </Pill>
            <Pill tone="amber" style={{ position: "absolute", right: 0, top: 0, opacity: paid }}>
              Spłacana
            </Pill>
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <CollateralBar title={`Zabezpieczenie pożyczki: ${zl(covered)} z ${zl(LOAN)}`} segments={segments} total={LOAN} glow={glow} />
        </div>

        <div style={{ position: "relative", height: 40, marginTop: 30, fontSize: 26 }}>
          <div style={{ position: "absolute", inset: 0, color: C.slate700, opacity: 1 - full }}>
            Do wypłaty brakuje <strong>{zl(LOAN - covered)}</strong> zabezpieczenia.
          </div>
          <div
            style={{ position: "absolute", inset: 0, color: C.emerald700, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, opacity: full }}
          >
            <Check size={30} strokeWidth={2.6} /> Zabezpieczona w 100%. Nikt nie musi tego zatwierdzać.
          </div>
        </div>

        <div style={{ position: "relative", height: 84, marginTop: 30 }}>
          <div style={{ position: "absolute", left: 0, top: 0, opacity: 1 - paid }}>
            <div style={{ position: "relative" }}>
              <Button
                bg={interpolateColors(full, [0, 1], [C.slate200, C.emerald600])}
                color={interpolateColors(full, [0, 1], [C.slate400, C.white])}
                pressed={pressAt(frame, PAYOUT_CLICK)}
                glow={glow * (0.75 + 0.25 * Math.sin(frame / 8))}
              >
                Wypłać pożyczkę na mój portfel
              </Button>
              <Cursor fromX={520} fromY={260} enterAt={262} arriveAt={306} clickAt={PAYOUT_CLICK} />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 84,
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 32,
              fontWeight: 600,
              color: C.emerald700,
              opacity: paid,
              transform: `translateY(${(1 - paid) * 16}px)`,
            }}
          >
            <CircleCheck size={40} strokeWidth={2.2} /> Wypłata pożyczki {zl(LOAN)}
            <span style={{ color: C.slate500, fontWeight: 500 }}>· na portfel Bartka, bez zarządu</span>
          </div>
        </div>
      </Card>
    </Stage>
  );
};
