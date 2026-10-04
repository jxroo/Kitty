import { C, fontFamily } from "../theme";

// Presentational copies of the app's Card / Badge / Button (packages/web/src/components/ui.tsx), scaled for 1080p video.

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.white,
      border: `1.5px solid ${C.slate200}`,
      borderRadius: 36,
      padding: "44px 52px",
      boxShadow: "0 40px 100px rgba(15,23,42,0.12), 0 10px 30px rgba(15,23,42,0.06)",
      fontFamily,
      color: C.slate900,
      ...style,
    }}
  >
    {children}
  </div>
);

const TONES = {
  sky: { bg: C.sky50, fg: C.sky700, border: C.sky200 },
  amber: { bg: C.amber50, fg: C.amber800, border: "#fde68a" },
  emerald: { bg: C.emerald50, fg: C.emerald700, border: C.emerald200 },
} as const;

export type Tone = keyof typeof TONES;

export const Pill: React.FC<{ tone: Tone; children: React.ReactNode; style?: React.CSSProperties }> = ({ tone, children, style }) => (
  <span
    style={{
      fontSize: 24,
      fontWeight: 600,
      padding: "8px 20px",
      borderRadius: 999,
      background: TONES[tone].bg,
      color: TONES[tone].fg,
      border: `1.5px solid ${TONES[tone].border}`,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </span>
);

export const Button: React.FC<{
  children: React.ReactNode;
  bg: string;
  color?: string;
  pressed?: number;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ children, bg, color = C.white, pressed = 0, glow = 0, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      height: 84,
      padding: "0 40px",
      borderRadius: 22,
      background: bg,
      color,
      fontSize: 30,
      fontWeight: 600,
      whiteSpace: "nowrap",
      transform: `scale(${1 - pressed * 0.035})`,
      boxShadow: glow > 0 ? `0 0 0 ${8 * glow}px rgba(16,185,129,${0.16 * glow}), 0 16px 40px rgba(5,150,105,${0.35 * glow})` : "none",
      ...style,
    }}
  >
    {children}
  </div>
);

/** 0 → 1 → 0 over ten frames around a click. */
export const pressAt = (frame: number, clickAt: number) =>
  frame >= clickAt && frame < clickAt + 10 ? 1 - Math.abs(frame - clickAt - 5) / 5 : 0;
