import { zl } from "../lib/format";
import { C } from "../theme";

// Presentational copies of the loan card pieces in packages/web/src/components/LoanCard.tsx.

export type Segment = { label: string; value: number; color: string; opacity?: number };

/** The collateral bar: borrower's own savings in amber, then each guarantor's pledge. Widths are % of `total`. */
export const CollateralBar: React.FC<{ title: string; segments: Segment[]; total: number; glow?: number }> = ({
  title,
  segments,
  total,
  glow = 0,
}) => (
  <div>
    <div style={{ fontSize: 26, fontWeight: 600, color: C.slate700, marginBottom: 16 }}>{title}</div>
    <div
      style={{
        height: 30,
        borderRadius: 999,
        background: C.slate100,
        overflow: "hidden",
        display: "flex",
        boxShadow: glow > 0 ? `0 0 0 ${6 * glow}px rgba(16,185,129,${0.18 * glow}), 0 0 ${40 * glow}px rgba(16,185,129,${0.45 * glow})` : "none",
      }}
    >
      {segments.map((s) => (
        <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color, height: "100%" }} />
      ))}
    </div>
    <div style={{ display: "flex", gap: 36, marginTop: 18, fontSize: 24, color: C.slate700 }}>
      {segments.map((s) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, opacity: s.opacity ?? 1 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: s.color }} />
          <span>
            {s.label}: <span style={{ fontVariantNumeric: "tabular-nums" }}>{zl(Math.round(s.value / 10) * 10)}</span>
          </span>
        </div>
      ))}
    </div>
  </div>
);

export type ChipState = "paid" | "due" | "late" | "seized" | "pulling";

const CHIP = {
  paid: { bg: C.emerald50, border: C.emerald200, fg: C.emerald800 },
  due: { bg: C.white, border: C.slate200, fg: C.slate700 },
  late: { bg: C.amber50, border: C.amber300, fg: C.amber900 },
  seized: { bg: C.rose50, border: C.rose200, fg: C.rose800 },
  pulling: { bg: C.emerald50, border: C.emerald500, fg: C.emerald800 },
} as const;

/** One installment in the schedule grid. */
export const InstallmentChip: React.FC<{ k: number; amount: number; state: ChipState; note: string; flash?: number }> = ({
  k,
  amount,
  state,
  note,
  flash = 0,
}) => (
  <div
    style={{
      flex: 1,
      borderRadius: 20,
      border: `1.5px solid ${CHIP[state].border}`,
      background: CHIP[state].bg,
      color: CHIP[state].fg,
      padding: "18px 22px",
      boxShadow: flash > 0 ? `0 0 0 ${8 * flash}px rgba(245,158,11,${0.25 * flash})` : "none",
    }}
  >
    <div style={{ fontSize: 26, fontWeight: 700 }}>
      Rata {k}: {zl(amount)}
    </div>
    <div style={{ fontSize: 22, marginTop: 4, whiteSpace: "nowrap" }}>{note}</div>
  </div>
);
