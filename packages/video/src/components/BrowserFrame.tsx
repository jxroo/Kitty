import { Lock } from "lucide-react";
import { C, fontFamily } from "../theme";

type Props = { width: number; height: number; url: string; children: React.ReactNode; style?: React.CSSProperties };

/** A minimal Safari-like window: traffic lights, a URL pill, and a clipped viewport. */
export const BrowserFrame: React.FC<Props> = ({ width, height, url, children, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 28,
      overflow: "hidden",
      background: C.white,
      border: "1px solid rgba(15,23,42,0.08)",
      boxShadow: "0 50px 120px rgba(15,23,42,0.22), 0 18px 40px rgba(15,23,42,0.10)",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    <div
      style={{
        height: 68,
        flexShrink: 0,
        background: "#f6f6f8",
        borderBottom: "1px solid rgba(15,23,42,0.07)",
        display: "flex",
        alignItems: "center",
        padding: "0 26px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          height: 40,
          padding: "0 22px",
          borderRadius: 12,
          background: "rgba(15,23,42,0.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily,
          fontSize: 21,
          fontWeight: 500,
          color: C.slate500,
        }}
      >
        <Lock size={17} strokeWidth={2.2} /> {url}
      </div>
    </div>
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>{children}</div>
  </div>
);
