import { loadFont } from "@remotion/google-fonts/Inter";
import { Easing } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Every scene's place on the timeline (frames @ 60 fps). Backdrop, scenes and SFX all read from here.
export const SCENES = {
  coldOpen: { from: 0, dur: 210 },
  intermediary: { from: 210, dur: 180 },
  numbers: { from: 390, dur: 330 },
  turn: { from: 720, dur: 180 },
  logo: { from: 900, dur: 240 },
  product: { from: 1140, dur: 240 },
  vault: { from: 1380, dur: 300 },
  loan: { from: 1680, dur: 420 },
  collect: { from: 2100, dur: 360 },
  stats: { from: 2460, dur: 270 },
  end: { from: 2730, dur: 270 },
} as const;

export const TOTAL_FRAMES = SCENES.end.from + SCENES.end.dur; // 3000 = 50 s

// The "numbers" slot holds two beats, one per case.
export const NUMBERS_A = { from: SCENES.numbers.from, dur: SCENES.numbers.dur / 2 };
export const NUMBERS_B = { from: SCENES.numbers.from + SCENES.numbers.dur / 2, dur: SCENES.numbers.dur / 2 };

// Act changes of the backdrop: black → white bloom → light → black.
export const BLOOM = { from: 836, to: 900 };
export const TO_DARK = { from: 2448, to: 2476 };

export const C = {
  black: "#000000",
  night: "#0b0b0d",
  light: "#f5f5f7",
  white: "#ffffff",
  inkDark: "#f5f5f7", // text on black
  grayDark: "#86868b",
  inkLight: "#1d1d1f", // text on light
  grayLight: "#6e6e73",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate700: "#334155",
  slate900: "#0f172a",
  emerald50: "#ecfdf5",
  emerald200: "#a7f3d0",
  emerald300: "#6ee7b7",
  emerald500: "#10b981",
  emerald600: "#059669",
  emerald700: "#047857",
  emerald800: "#065f46",
  emerald900: "#064e3b",
  amber50: "#fffbeb",
  amber300: "#fcd34d",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  amber800: "#92400e",
  amber900: "#78350f",
  sky50: "#f0f9ff",
  sky200: "#bae6fd",
  sky500: "#0ea5e9",
  sky700: "#0369a1",
  indigo500: "#6366f1",
  rose50: "#fff1f2",
  rose200: "#fecdd3",
  rose800: "#9f1239",
};

// Apple-like curves: decelerating entrances, accelerating exits, no overshoot.
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const headline = (size: number, color: string): React.CSSProperties => ({
  fontFamily,
  fontSize: size,
  fontWeight: 700,
  letterSpacing: "-0.045em",
  lineHeight: 1.04,
  color,
  margin: 0,
  textWrap: "balance",
});
