import { useCurrentFrame } from "remotion";
import { Counter } from "../components/Counter";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";
import { progress, reveal } from "../lib/anim";
import { zl } from "../lib/format";
import { C, headline } from "../theme";

// Act I, on black: the relationship, its intermediary, and what happens when trust fails.

export const ColdOpen: React.FC = () => (
  <Stage>
    <WordReveal
      start={14}
      stagger={6}
      dur={44}
      style={headline(124, C.inkDark)}
      lines={[[{ text: "Every month,", color: C.grayDark }], "colleagues save together."]}
    />
  </Stage>
);

export const Intermediary: React.FC = () => (
  <Stage gap={10}>
    <WordReveal
      start={6}
      stagger={5}
      style={headline(104, C.grayDark)}
      lines={[[{ text: "One treasurer", color: C.inkDark }, { text: "holds the money." }]]}
    />
    <WordReveal
      start={51}
      stagger={5}
      style={headline(104, C.grayDark)}
      lines={[[{ text: "One board", color: C.inkDark }, { text: "decides who borrows." }]]}
    />
  </Stage>
);

export const COUNT = { start: 10, dur: 84 };

export const TrustFails: React.FC<{ amount: number; caption: string; source: string }> = ({ amount, caption, source }) => {
  const frame = useCurrentFrame();
  const value = amount * progress(frame, COUNT.start, COUNT.dur);
  return (
    <Stage gap={28}>
      <div style={{ ...reveal(frame, 4, 50, 40) }}>
        <Counter
          value={value}
          final={zl(amount)}
          format={zl}
          style={{ ...headline(236, C.inkDark), fontWeight: 800, letterSpacing: "-0.055em" }}
          fill={{
            background: "linear-gradient(180deg, #ffffff 35%, #ffb3a1 125%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            paddingBottom: 12,
          }}
        />
      </div>
      <WordReveal start={44} stagger={3} style={{ ...headline(54, C.grayDark), fontWeight: 500, letterSpacing: "-0.02em", maxWidth: 1300 }} lines={[caption]} />
      <div
        style={{
          position: "absolute",
          bottom: 84,
          fontSize: 24,
          fontWeight: 500,
          color: "#5e5e63",
          letterSpacing: "0.01em",
          opacity: progress(frame, 70, 40),
        }}
      >
        {source}
      </div>
    </Stage>
  );
};

export const Turn: React.FC = () => (
  <Stage>
    <WordReveal
      start={10}
      stagger={6}
      dur={44}
      style={headline(132, C.inkDark)}
      lines={[[{ text: "What if" }, { text: "nobody", color: C.emerald300 }], "had to hold it?"]}
    />
  </Stage>
);
