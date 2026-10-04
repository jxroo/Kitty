import { Bot, Check, ScrollText } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { Counter } from "../components/Counter";
import { Camera } from "../components/Depth";
import { Stage } from "../components/Stage";
import { Card } from "../components/ui";
import { progress, reveal } from "../lib/anim";
import { zl } from "../lib/format";
import { C } from "../theme";
import { ChapterHead } from "./Chapter";
import { T } from "./timeline";

// The newest rows of "Historia kasy" from the recorded production run (docs/screenshots/08c-kasa-history.png).
const ROWS = [
  { when: "00:19:18", what: "Niezapłacona rata pokryta z zablokowanych oszczędności", who: "Bartek", amount: "250 zł", tone: "neutral", after: 2050, by: "automat", sig: "3fFaGhCVL4…" },
  { when: "00:18:30", what: "Składka pobrana automatycznie z portfela", who: "Anna", amount: "+100 zł", tone: "in", after: 2050, by: "automat", sig: "4RcxfevFYA…" },
  { when: "00:18:02", what: "Rata pobrana automatycznie z portfela", who: "Bartek", amount: "+250 zł", tone: "in", after: 1950, by: "automat", sig: "BA5E6Kj9Dt…" },
  { when: "00:17:31", what: "Składka pobrana automatycznie z portfela", who: "Anna", amount: "+100 zł", tone: "in", after: 1700, by: "automat", sig: "DpkpzWmiD1…" },
  { when: "00:16:58", what: "Wypłata pożyczki", who: "Bartek", amount: "−1 000 zł", tone: "out", after: 1600, by: "Bartek", sig: "2XnA7rfahG…" },
  { when: "00:16:53", what: "Wpłata", who: "Celina", amount: "+1 000 zł", tone: "in", after: 2600, by: "Celina", sig: "524miAUWdz…" },
] as const;

// Rows arrive oldest first, building the statement upward like transactions landing on the chain.
export const ROW_AT = (i: number) => 30 + (ROWS.length - 1 - i) * 14;
export const MATCH_AT = 128;

const COLS = "130px 1fr 160px 140px 170px 170px 180px";

/** 05 · Statement: every movement read from the chain, with the balance after each; it matches the vault. */
export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const match = progress(frame, MATCH_AT, 24);
  return (
    <Stage gap={44}>
      <ChapterHead n={5} kicker="Statement" look="type" title="A statement nobody can edit." sub="Every złoty in and out, read straight from the chain." />
      {/* A document lying on a desk that slowly lifts toward the viewer. */}
      <Camera dur={T.statement.dur} rx={[38, 6]} ry={[0, 0]}>
        <Card style={{ position: "relative", width: 1560, padding: "34px 44px 30px", ...reveal(frame, 20, 50, 80) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            <ScrollText size={36} strokeWidth={2} color={C.emerald600} /> Historia kasy
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 34, fontSize: 26, marginTop: 16, color: C.slate700 }}>
            <span>
              Wpłynęło: <strong style={{ color: C.emerald700 }}>{zl(3050)}</strong>
            </span>
            <span>
              Wypłynęło: <strong style={{ color: C.rose800 }}>{zl(1000)}</strong>
            </span>
            <span>
              Jest w kasie: <Counter value={2050 * progress(frame, 40, 80)} final={zl(2050)} format={zl} style={{ fontWeight: 700, color: C.slate900 }} />
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: C.emerald700,
                fontWeight: 600,
                opacity: match,
                transform: `scale(${0.85 + 0.15 * match})`,
              }}
            >
              <Check size={28} strokeWidth={3} /> zgadza się z historią
            </span>
          </div>

          <div style={{ marginTop: 20, fontSize: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: COLS, color: C.slate500, padding: "10px 0", borderBottom: `1.5px solid ${C.slate200}`, whiteSpace: "nowrap" }}>
              <span>Kiedy</span>
              <span>Co się stało</span>
              <span>Kogo dotyczy</span>
              <span style={{ textAlign: "right" }}>Kwota</span>
              <span style={{ textAlign: "right" }}>W kasie potem</span>
              <span style={{ paddingLeft: 24 }}>Kto wysłał</span>
              <span>Dowód</span>
            </div>
            {ROWS.map((r, i) => {
              const p = progress(frame, ROW_AT(i), 26);
              return (
                <div
                  key={r.sig}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    alignItems: "center",
                    padding: "13px 0",
                    borderBottom: `1.5px solid ${C.slate100}`,
                    color: C.slate900,
                    opacity: p,
                    transform: `translateY(${(1 - p) * -18}px)`,
                    filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined,
                  }}
                >
                  <span style={{ color: C.slate500, fontVariantNumeric: "tabular-nums" }}>{r.when}</span>
                  <span style={{ paddingRight: 16, lineHeight: 1.3 }}>{r.what}</span>
                  <span>{r.who}</span>
                  <span
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: r.tone === "in" ? C.emerald700 : r.tone === "out" ? C.rose800 : C.slate500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.amount}
                  </span>
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{zl(r.after)}</span>
                  <span style={{ paddingLeft: 24, display: "flex", alignItems: "center", gap: 6, color: r.by === "automat" ? C.emerald700 : C.slate900 }}>
                    {r.by === "automat" ? <Bot size={24} strokeWidth={2} /> : null} {r.by}
                  </span>
                  <span style={{ color: C.sky700, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.sig}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Camera>
    </Stage>
  );
};
