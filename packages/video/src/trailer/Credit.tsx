import { Check, CircleCheck } from "lucide-react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { Cursor } from "../components/Cursor";
import { CollateralBar } from "../components/Loan";
import { Stage } from "../components/Stage";
import { Button, Card, Pill, pressAt } from "../components/ui";
import { progress, reveal, tween } from "../lib/anim";
import { zl } from "../lib/format";
import { C } from "../theme";
import { ChapterHead } from "./Chapter";

export const PLEDGES = [
  { label: "Bartek (swoje)", amount: 500, color: C.amber400, at: 34, dur: 30 },
  { label: "Anna poręcza", amount: 300, color: C.sky500, at: 78, dur: 26 },
  { label: "Celina poręcza", amount: 200, color: C.indigo500, at: 116, dur: 26 },
];
export const FULL_AT = 142;
export const MANDATE_AT = 160;
export const PAYOUT_CLICK = 214;
const LOAN = 1000;

/** 02 · Credit: locked savings fill the bar; at 100 % Bartek pays the loan out himself and signs the direct-debit mandate in the same click. */
export const Credit: React.FC = () => {
  const frame = useCurrentFrame();
  const segments = PLEDGES.map((p) => ({ label: p.label, color: p.color, value: p.amount * progress(frame, p.at, p.dur), opacity: progress(frame, p.at, 18) }));
  const covered = Math.round(segments.reduce((s, x) => s + x.value, 0) / 10) * 10;
  const full = progress(frame, FULL_AT - 4, 18);
  const ticked = progress(frame, MANDATE_AT, 14);
  const paid = progress(frame, PAYOUT_CLICK + 8, 18);
  const glow = full * (1 - paid);
  const focus = 1 + 0.13 * tween(frame, [PLEDGES[0].at - 6, PLEDGES[0].at + 30], [0, 1]) - 0.13 * tween(frame, [FULL_AT + 6, MANDATE_AT + 6], [0, 1]);

  return (
    <Stage gap={48}>
      <ChapterHead n={2} kicker="Credit" look="track" title="Nobody approves a loan." sub="Locked savings cover it 100%. Then it pays out." />
      {/* The camera leans in on the bar while it fills, then pulls back for the payout. */}
      <div style={{ transform: `scale(${focus})`, transformOrigin: "50% 36%" }}>
        <Card style={{ position: "relative", width: 1320, ...reveal(frame, 18, 40, 60) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.02em" }}>Bartek pożycza {zl(LOAN)}</div>
              <div style={{ fontSize: 25, color: C.slate500, marginTop: 6 }}>4 raty po ok. {zl(250)} · 0% odsetek</div>
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

          <div style={{ marginTop: 34 }}>
            <CollateralBar title={`Zablokowane oszczędności na tę pożyczkę: ${zl(covered)} z ${zl(LOAN)}`} segments={segments} total={LOAN} glow={glow} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30, fontSize: 26, color: C.slate700, opacity: progress(frame, FULL_AT, 20) }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: `2px solid ${interpolateColors(ticked, [0, 1], [C.slate400, C.emerald600])}`,
                background: interpolateColors(ticked, [0, 1], [C.white, C.emerald600]),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={24} strokeWidth={3.2} color={C.white} style={{ transform: `scale(${ticked})` }} />
            </span>
            <span>
              <strong style={{ color: C.slate900 }}>Spłacaj raty automatycznie:</strong> w dniu terminu rata sama zejdzie z mojego portfela
            </span>
          </div>

          <div style={{ position: "relative", height: 84, marginTop: 28 }}>
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
                <Cursor fromX={560} fromY={220} enterAt={168} arriveAt={204} clickAt={PAYOUT_CLICK} />
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
              <CircleCheck size={40} strokeWidth={2.2} /> Wypłata pożyczki {zl(LOAN)} + automatyczna spłata rat
            </div>
          </div>
        </Card>
      </div>
    </Stage>
  );
};
