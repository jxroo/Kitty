import { Bot, Vault as VaultIcon, Wallet } from "lucide-react";
import { useCurrentFrame } from "remotion";
import { Counter } from "../components/Counter";
import { Camera } from "../components/Depth";
import { InstallmentChip, type ChipState } from "../components/Loan";
import { Stage } from "../components/Stage";
import { progress, reveal, tween } from "../lib/anim";
import { zl } from "../lib/format";
import { C, EASE_IN_OUT, fontFamily } from "../theme";
import { ChapterHead } from "./Chapter";
import { T } from "./timeline";

// Countdown 3-2-1 to the due date, then the bot's transaction: 250 zł from Bartek's wallet into the kasa.
export const COUNTDOWN_AT = [40, 80, 120];
export const DUE_AT = 152;
export const FLIGHT = { from: 172, to: 226 };
export const PAID_AT = 234;
const PATH_W = 380;

/** 03 · Direct debit: the climax. Nobody clicks; the installment leaves the wallet on the due date, exactly what is due. */
export const DirectDebit: React.FC = () => {
  const frame = useCurrentFrame();
  const secondsLeft = frame < COUNTDOWN_AT[1] ? 3 : frame < COUNTDOWN_AT[2] ? 2 : 1;
  const chip: { state: ChipState; note: string } =
    frame >= PAID_AT
      ? { state: "paid", note: "spłacona" }
      : frame >= DUE_AT
        ? { state: "pulling", note: "teraz – automat pobiera" }
        : { state: "due", note: `za ${secondsLeft} s · zapłaci się sama` };
  const ring = tween(frame, [26, DUE_AT], [0, 1], (t) => t);
  const flight = tween(frame, [FLIGHT.from, FLIGHT.to], [0, 1], EASE_IN_OUT);
  const inFlight = frame >= FLIGHT.from && frame <= FLIGHT.to + 6;
  const wallet = 6750 - 250 * progress(frame, FLIGHT.from, 26);
  const vault = 1700 + 250 * progress(frame, FLIGHT.to - 6, 26);
  const bot = progress(frame, DUE_AT - 4, 20);
  const landed = progress(frame, FLIGHT.to, 40);

  return (
    <Stage gap={44}>
      <ChapterHead n={3} kicker="Direct debit" look="punch" title="Due date. Nobody clicks anything." sub="The installment leaves the wallet by itself. Only what’s due." />
      <Camera dur={T.debit.dur} rx={[14, 5]} ry={[-6, 6]}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, ...reveal(frame, 24, 50, 80) }}>
          {/* The installment with a ring counting down to its due date. */}
          <div style={{ display: "flex", alignItems: "center", gap: 22, width: 640, position: "relative" }}>
            <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
              <circle cx={38} cy={38} r={32} fill="none" stroke={C.slate200} strokeWidth={6} />
              <circle
                cx={38}
                cy={38}
                r={32}
                fill="none"
                stroke={frame >= DUE_AT ? C.emerald500 : C.slate700}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - ring)}
                transform="rotate(-90 38 38)"
              />
              <text x={38} y={47} textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={26} fill={C.slate900}>
                {frame >= DUE_AT ? "0" : secondsLeft}
              </text>
            </svg>
            <InstallmentChip k={1} amount={250} state={chip.state} note={chip.note} flash={frame >= DUE_AT && frame < PAID_AT ? 0.5 + 0.5 * Math.sin(frame / 5) : 0} />
          </div>

          {/* Wallet → kasa, carried by a bot that has no rights. */}
          <div style={{ display: "flex", alignItems: "center", fontFamily }}>
            <Account icon={<Wallet size={30} strokeWidth={2} />} title="Portfel Bartka" note="zgoda: do 1 000 zł · może ją wyłączyć" value={wallet} final={zl(6750)} light />
            <div style={{ width: PATH_W, height: 140, position: "relative" }}>
              <div style={{ position: "absolute", left: 20, right: 20, top: 69, borderTop: `3px dashed ${C.slate200}` }} />
              <div
                style={{
                  position: "absolute",
                  left: 20,
                  top: 68,
                  height: 5,
                  width: (PATH_W - 40) * flight,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, rgba(16,185,129,0) 0%, ${C.emerald500} 100%)`,
                  opacity: 1 - landed,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  display: "flex",
                  justifyContent: "center",
                  opacity: bot,
                  transform: `translateY(${(1 - bot) * 10}px)`,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 600, color: C.emerald700 }}>
                  <Bot size={26} strokeWidth={2} /> automat · bez żadnych praw
                </span>
              </div>
              {inFlight ? (
                <div
                  style={{
                    position: "absolute",
                    top: 46,
                    left: 20 + (PATH_W - 40) * flight - 64,
                    width: 128,
                    height: 48,
                    borderRadius: 24,
                    background: C.emerald600,
                    color: C.white,
                    fontSize: 24,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 1 - progress(frame, FLIGHT.to, 8),
                    boxShadow: "0 10px 30px rgba(5,150,105,0.35)",
                  }}
                >
                  {zl(250)}
                </div>
              ) : null}
            </div>
            <Account icon={<VaultIcon size={30} strokeWidth={2} />} title="Pieniądze kasy" note="konto programu, nie banku" value={vault} final={zl(1950)} glow={landed * (1 - progress(frame, FLIGHT.to + 40, 60))} />
          </div>

          <div style={{ fontFamily, fontSize: 28, color: C.slate700, opacity: progress(frame, PAID_AT + 6, 24), display: "flex", gap: 28 }}>
            <span>
              Spłacone automatycznie: <strong style={{ color: C.emerald700 }}>{zl(250)}</strong>
            </span>
            <span style={{ color: C.slate500 }}>Bartek niczego nie podpisuje. Poręczyciele odzyskują część zabezpieczenia.</span>
          </div>
        </div>
      </Camera>
    </Stage>
  );
};

const Account: React.FC<{ icon: React.ReactNode; title: string; note: string; value: number; final: string; light?: boolean; glow?: number }> = ({
  icon,
  title,
  note,
  value,
  final,
  light = false,
  glow = 0,
}) => (
  <div
    style={{
      position: "relative",
      width: 440,
      padding: "28px 34px 30px",
      borderRadius: 32,
      background: light ? C.white : C.emerald50,
      border: `1.5px solid ${light ? C.slate200 : C.emerald200}`,
      boxShadow: `0 40px 100px rgba(15,23,42,0.13), 0 0 0 ${10 * glow}px rgba(16,185,129,${0.2 * glow}), 0 0 ${60 * glow}px rgba(16,185,129,${0.45 * glow})`,
      color: light ? C.slate900 : C.emerald900,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 25, fontWeight: 700 }}>
      {icon} {title}
    </div>
    <Counter value={value} final={final} format={zl} align="left" style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.04em", marginTop: 10, lineHeight: 1.1 }} />
    <div style={{ fontSize: 20, color: light ? C.slate500 : C.emerald700, marginTop: 6 }}>{note}</div>
  </div>
);
