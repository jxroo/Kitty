import { AlertTriangle, Check } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { CollateralBar, InstallmentChip, type ChipState } from "../components/Loan";
import { Stage } from "../components/Stage";
import { Card } from "../components/ui";
import { progress, tween } from "../lib/anim";
import { zl } from "../lib/format";
import { C } from "../theme";
import { ChapterHead } from "./Chapter";
import { T } from "./timeline";

export const REFUSED_AT = 50;
export const COVERED_AT = 120;

/**
 * 04 · Safety net: Bartek switched automatic repayment off. Installment 2 can't be pulled, so after the grace period
 * the bot covers it from his blocked savings. State after installment 1: 750 zł left, Bartek 500 + Anna 150 + Celina 100.
 */
export const SafetyNet: React.FC = () => {
  const frame = useCurrentFrame();
  const seize = tween(frame, [COVERED_AT, COVERED_AT + 40], [0, 1]);
  const own = 500 - 250 * seize;
  const left = 750 - 250 * seize;
  const covered = frame >= COVERED_AT;
  const r2: { state: ChipState; note: string } = covered
    ? { state: "seized", note: "pokryta z oszczędności" }
    : { state: "late", note: "termin minął – pobieram z portfela" };
  const refused = progress(frame, REFUSED_AT, 24);
  const done = progress(frame, COVERED_AT + 2, 20);
  const pan = tween(frame, [0, T.safety.dur], [44, -44], (t) => t);

  return (
    <Stage gap={48}>
      <ChapterHead n={4} kicker="Safety net" look="blur" title="Switched it off? Still covered." sub="After a short grace, the installment comes from blocked savings." />
      {/* A slow lateral pan across the card, like a dolly move. */}
      <div style={{ transform: `translateX(${pan}px)` }}>
        <Card style={{ position: "relative", width: 1320, padding: "40px 50px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>Bartek pożycza {zl(1000)}</div>
            <span
              style={{
                fontSize: 23,
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: 999,
                background: C.rose50,
                color: C.rose800,
                border: `1.5px solid ${C.rose200}`,
              }}
            >
              Automatyczna spłata wyłączona
            </span>
          </div>

          <div style={{ marginTop: 28 }}>
            <CollateralBar
              title={`Zablokowane oszczędności na resztę do spłaty: ${zl(left)} z ${zl(left)}`}
              total={left}
              segments={[
                { label: "Bartek (swoje)", value: own, color: C.amber400 },
                { label: "Anna poręcza", value: 150, color: C.sky500 },
                { label: "Celina poręcza", value: 100, color: C.indigo500 },
              ]}
            />
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
            <InstallmentChip k={1} amount={250} state="paid" note="spłacona" />
            <InstallmentChip k={2} amount={250} state={r2.state} note={r2.note} flash={!covered ? 1 - progress(frame, 10, 40) : 0} />
            <InstallmentChip k={3} amount={250} state="due" note="za 1 min" />
            <InstallmentChip k={4} amount={250} state="due" note="za 2 min" />
          </div>

          <div style={{ position: "relative", height: 76, marginTop: 24, fontSize: 25 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                border: `1.5px solid ${C.amber300}`,
                background: C.amber50,
                color: C.amber900,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 26px",
                opacity: refused * (1 - done),
              }}
            >
              <AlertTriangle size={30} strokeWidth={2.2} /> Automatyczna spłata jest wyłączona albo w portfelu brakuje pieniędzy.
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                border: `1.5px solid ${C.emerald200}`,
                background: C.emerald50,
                color: C.emerald800,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 26px",
                opacity: done,
                transform: `translateY(${(1 - done) * 14}px)`,
              }}
            >
              <Check size={32} strokeWidth={2.6} /> Niezapłacona rata pokryta z zablokowanych oszczędności
              <span style={{ fontWeight: 500, color: C.emerald700 }}>· bez niczyjej zgody</span>
            </div>
          </div>
        </Card>
      </div>
    </Stage>
  );
};
