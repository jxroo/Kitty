import { AbsoluteFill } from "remotion";
import { fontFamily } from "../theme";

/** The default frame: one centred column inside a 1080p safe area, elements spaced by `gap`. */
export const Stage: React.FC<{ children: React.ReactNode; gap?: number; style?: React.CSSProperties }> = ({ children, gap = 48, style }) => (
  <AbsoluteFill
    style={{
      fontFamily,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap,
      padding: "96px 120px",
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);
