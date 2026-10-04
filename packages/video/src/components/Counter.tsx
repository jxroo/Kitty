type Props = {
  value: number;
  /** The widest string this counter will show; reserves its width so the layout never shifts. */
  final: string;
  format: (n: number) => string;
  style?: React.CSSProperties;
  /** Paint for the visible digits only (e.g. a gradient clipped to text). */
  fill?: React.CSSProperties;
  /** Odometer (right, default) or growing to the right from a fixed left edge. */
  align?: "left" | "right";
};

/** A counting number inside the width of its final value, so nothing around it moves. */
export const Counter: React.FC<Props> = ({ value, final, format, style, fill, align = "right" }) => (
  <span style={{ position: "relative", display: "inline-block", fontVariantNumeric: "tabular-nums", ...style }}>
    <span style={{ visibility: "hidden" }}>{final}</span>
    <span style={{ position: "absolute", [align]: 0, top: 0, whiteSpace: "nowrap", ...fill }}>{format(value)}</span>
  </span>
);
