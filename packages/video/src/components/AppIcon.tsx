import { PiggyBank } from "lucide-react";
import { C } from "../theme";

/** The app's header mark (PiggyBank on emerald-600), redrawn as an app-icon squircle. */
export const AppIcon: React.FC<{ size: number; glow?: number; style?: React.CSSProperties }> = ({ size, glow = 1, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.2237,
      background: `linear-gradient(160deg, ${C.emerald500} 0%, ${C.emerald600} 45%, ${C.emerald700} 100%)`,
      boxShadow: `inset 0 ${size * 0.012}px 0 rgba(255,255,255,0.35), inset 0 -${size * 0.02}px ${size * 0.06}px rgba(6,78,59,0.35), 0 ${size * 0.14}px ${size * 0.3}px rgba(5,150,105,${0.35 * glow})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      ...style,
    }}
  >
    <PiggyBank color="#ffffff" size={size * 0.56} strokeWidth={1.6} />
  </div>
);
