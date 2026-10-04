import { useCurrentFrame } from "remotion";
import { AppIcon } from "../components/AppIcon";
import { Counter } from "../components/Counter";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal } from "../lib/anim";
import { C, headline } from "../theme";

// Act III, back on black: the three numbers from the cover, then the end card.

export const STAT_ROWS_AT = [18, 32, 46];

export const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const pct = 100 * progress(frame, STAT_ROWS_AT[1], 70);
  const rows: { stat: React.ReactNode; label: string }[] = [
    { stat: "0", label: "people approve a loan" },
    { stat: <Counter value={pct} final="100%" format={(n) => `${Math.round(n)}%`} />, label: "of every loan covered by locked savings" },
    { stat: "Anyone", label: "can collect an overdue installment" },
  ];
  return (
    <Stage gap={74}>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 64, rowGap: 30, alignItems: "baseline" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ ...headline(138, C.emerald300), fontWeight: 800, letterSpacing: "-0.05em", ...reveal(frame, STAT_ROWS_AT[i], 44, 40) }}>{r.stat}</div>
            <div style={{ ...headline(50, C.inkDark), fontWeight: 500, letterSpacing: "-0.02em", ...reveal(frame, STAT_ROWS_AT[i] + 6, 44, 40) }}>{r.label}</div>
          </div>
        ))}
      </div>
      <WordReveal
        start={118}
        stagger={3}
        style={{ ...headline(40, C.grayDark), fontWeight: 500, letterSpacing: "-0.015em" }}
        lines={["Rules are public code no instruction can bypass."]}
      />
    </Stage>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const p = progress(frame, 4, 56);
  return (
    <Stage gap={34}>
      <AppIcon
        size={168}
        glow={p * 0.8}
        style={{ opacity: p, transform: `scale(${0.7 + 0.3 * p})`, filter: p < 1 ? `blur(${(1 - p) * 14}px)` : undefined }}
      />
      <WordReveal
        start={18}
        stagger={7}
        dur={46}
        style={{ ...headline(128, C.inkDark), fontWeight: 800, letterSpacing: "-0.05em", paddingBottom: 8 }}
        lines={["Kasa bez zarządu"]}
      />
      <WordReveal
        start={52}
        stagger={4}
        style={{ ...headline(50, C.grayDark), fontWeight: 500, letterSpacing: "-0.02em" }}
        lines={[[{ text: "Zero Interest.", color: C.inkDark }, { text: "No approval." }]]}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 34, ...reveal(frame, 96, 44, 20) }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.emerald300, letterSpacing: "-0.01em" }}>web-production-ad49f.up.railway.app</div>
        <div style={{ fontSize: 26, fontWeight: 500, color: C.grayDark }}>Built on Solana · Independent Finance · For Superteam Poland</div>
      </div>
    </Stage>
  );
};
