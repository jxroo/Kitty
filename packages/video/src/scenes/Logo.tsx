import { useCurrentFrame } from "remotion";
import { AppIcon } from "../components/AppIcon";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";
import { progress } from "../lib/anim";
import { C, headline } from "../theme";

export const ICON_LANDS = 6;

/** Out of the bloom: the icon settles, the name follows, then the one-line promise. */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const p = progress(frame, ICON_LANDS, 56);
  return (
    <Stage gap={40}>
      <AppIcon
        size={210}
        glow={p}
        style={{
          opacity: p,
          transform: `translateY(${(1 - p) * 30}px) scale(${0.62 + 0.38 * p})`,
          filter: p < 1 ? `blur(${(1 - p) * 16}px)` : undefined,
        }}
      />
      <WordReveal
        start={26}
        stagger={7}
        dur={46}
        style={{ ...headline(156, C.inkLight), fontWeight: 800, letterSpacing: "-0.05em", paddingBottom: 10 }}
        lines={["Kasa bez zarządu"]}
      />
      <WordReveal
        start={72}
        stagger={3}
        style={{ ...headline(48, C.grayLight), fontWeight: 500, letterSpacing: "-0.02em" }}
        lines={[[{ text: "A savings & loan fund with" }, { text: "no board and no treasurer.", color: C.inkLight, weight: 600 }]]}
      />
    </Stage>
  );
};
