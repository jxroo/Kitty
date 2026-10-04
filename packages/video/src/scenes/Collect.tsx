import { AlertTriangle, Check, Gavel } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { Cursor } from "../components/Cursor";
import { CollateralBar, InstallmentChip, type ChipState } from "../components/Loan";
import { Stage } from "../components/Stage";
import { Button, Card, Pill, pressAt } from "../components/ui";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal, tween } from "../lib/anim";
import { zl } from "../lib/format";
import { C, headline } from "../theme";

export const LATE_AT = 50;
export const COLLECT_CLICK = 172;
const SEIZED_AT = COLLECT_CLICK + 8;

/**
 * The state from the recorded devnet run after installment 1: 750 zł left, covered by Bartek 500 + Anna 150 + Celina 100.
 * Installment 2 goes overdue; anyone collects it from Bartek's locked savings; the rest stays 100 % covered.
 */
export const Collect: React.FC = () => {
  const frame = useCurrentFrame();
  const seize = tween(frame, [SEIZED_AT, SEIZED_AT + 40], [0, 1]);
  const own = 500 - 250 * seize;
  const left = 750 - 250 * seize;
  const late = frame >= LATE_AT;
  const seized = frame >= SEIZED_AT;
  const flash = late && !seized ? 1 - progress(frame, LATE_AT, 40) : 0;
  const warn = progress(frame, LATE_AT + 6, 34);
  const done = progress(frame, SEIZED_AT + 2, 20);

  const r2: { state: ChipState; note: string } = seized
    ? { state: "seized", note: "pobrana z zabezpieczeń" }
    : late
      ? { state: "late", note: "zaległa – do egzekucji" }
      : { state: "due", note: "termin za 1 s" };

  return (
    <Stage gap={50}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <WordReveal start={6} stagger={5} style={headline(100, C.inkLight)} lines={["Late? Anyone can collect."]} />
        <WordReveal
          start={22}
          stagger={3}
          style={{ ...headline(44, C.grayLight), fontWeight: 500, letterSpacing: "-0.02em" }}
          lines={["No payroll. No debt collector. Nobody’s consent."]}
        />
      </div>

      <Card style={{ width: 1320, padding: "40px 50px", ...reveal(frame, 28, 50, 70) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>Bartek pożycza {zl(1000)}</div>
          <Pill tone="amber">Spłacana</Pill>
        </div>

        <div style={{ marginTop: 30 }}>
          <CollateralBar
            title={`Zabezpieczenie pozostałej kwoty: ${zl(left)} z ${zl(left)}`}
            total={left}
            segments={[
              { label: "Bartek (własne)", value: own, color: C.amber400 },
              { label: "Anna poręcza", value: 150, color: C.sky500 },
              { label: "Celina poręcza", value: 100, color: C.indigo500 },
            ]}
          />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
          <InstallmentChip k={1} amount={250} state="paid" note="spłacona" />
          <InstallmentChip k={2} amount={250} state={r2.state} note={r2.note} flash={flash} />
          <InstallmentChip k={3} amount={250} state="due" note="termin za 1 min" />
          <InstallmentChip k={4} amount={250} state="due" note="termin za 2 min" />
        </div>

        <div style={{ position: "relative", height: 132, marginTop: 28 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 24,
              border: `1.5px solid ${C.amber300}`,
              background: C.amber50,
              padding: "0 24px 0 30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              opacity: warn * (1 - done),
              transform: `translateY(${(1 - warn) * 20}px)`,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 25, color: C.amber900, lineHeight: 1.35 }}>
              <AlertTriangle size={32} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Zaległe <strong>{zl(250)}</strong>. Program pozwala <strong>każdemu</strong>
                <br />
                ściągnąć tę kwotę z zabezpieczeń.
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <Button bg={C.amber500} pressed={pressAt(frame, COLLECT_CLICK)}>
                <Gavel size={30} strokeWidth={2.2} /> Egzekwuj zaległą ratę
              </Button>
              <Cursor fromX={-360} fromY={240} enterAt={104} arriveAt={160} clickAt={COLLECT_CLICK} />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 24,
              border: `1.5px solid ${C.emerald200}`,
              background: C.emerald50,
              padding: "0 30px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 28,
              fontWeight: 600,
              color: C.emerald800,
              opacity: done,
              transform: `translateY(${(1 - done) * 16}px)`,
            }}
          >
            <Check size={34} strokeWidth={2.6} /> Egzekucja zaległej raty {zl(250)}
            <span style={{ fontWeight: 500, color: C.emerald700 }}>· najpierw z oszczędności Bartka</span>
          </div>
        </div>
      </Card>
    </Stage>
  );
};
