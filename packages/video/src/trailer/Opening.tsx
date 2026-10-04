import { useCurrentFrame } from "remotion";
import { AppIcon } from "../components/AppIcon";
import { Stage } from "../components/Stage";
import { MaskLines, TrackIn } from "../components/TextFx";
import { WordReveal } from "../components/WordReveal";
import { progress } from "../lib/anim";
import { C, headline } from "../theme";

// Act I on black: the four things people go to a bank for. Then the bloom, and the brand.

export const FourThings: React.FC = () => (
  <Stage>
    <WordReveal
      start={10}
      stagger={5}
      dur={44}
      style={headline(124, C.inkDark)}
      lines={[[{ text: "People go to a bank", color: C.grayDark }], "for four things."]}
    />
  </Stage>
);

export const THINGS = ["To keep savings.", "To borrow.", "To pay on time.", "To prove they repay."];
export const THING_AT = (i: number) => 8 + i * 38;

export const List: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {THINGS.map((t, i) => {
          // Each line takes the light when it arrives, then steps back for the next one.
          const next = i < THINGS.length - 1 ? progress(frame, THING_AT(i + 1), 30) : progress(frame, 190, 40);
          return (
            <div key={t} style={{ display: "flex", alignItems: "baseline", gap: 36, overflow: "hidden", paddingBottom: 8 }}>
              <span
                style={{
                  ...headline(40, C.emerald300),
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  width: 64,
                  fontVariantNumeric: "tabular-nums",
                  opacity: progress(frame, THING_AT(i), 20),
                }}
              >
                0{i + 1}
              </span>
              <span
                style={{
                  ...headline(100, C.inkDark),
                  display: "inline-block",
                  opacity: 1 - next * 0.6,
                  transform: `translateY(${(1 - progress(frame, THING_AT(i), 30)) * 115}%)`,
                }}
              >
                {t}
              </span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

export const WithoutBank: React.FC = () => (
  <Stage>
    <TrackIn start={0} dur={60} style={headline(124, C.inkDark)} lines={["A group can do all four.", [{ text: "Without a bank.", color: C.emerald300 }]]} />
  </Stage>
);

export const ICON_LANDS = 4;

export const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const p = progress(frame, ICON_LANDS, 56);
  const curtain = progress(frame, 22, 48);
  return (
    <Stage gap={38}>
      <AppIcon
        size={200}
        glow={p}
        style={{
          opacity: p,
          transform: `translateY(${(1 - p) * 30}px) scale(${0.62 + 0.38 * p})`,
          filter: p < 1 ? `blur(${(1 - p) * 16}px)` : undefined,
        }}
      />
      <div
        style={{
          ...headline(156, C.inkLight),
          fontWeight: 800,
          letterSpacing: "-0.05em",
          paddingBottom: 10,
          clipPath: `inset(-10% ${(1 - curtain) * 100}% -20% 0)`,
          transform: `translateX(${(1 - curtain) * -24}px)`,
        }}
      >
        Kasa bez zarządu
      </div>
      <MaskLines
        start={58}
        stagger={7}
        style={{ ...headline(46, C.grayLight), fontWeight: 500, letterSpacing: "-0.02em" }}
        lines={["Savings, 0% loans and direct debits", [{ text: "with no board, no treasurer and no bank.", color: C.inkLight, weight: 600 }]]}
      />
    </Stage>
  );
};
