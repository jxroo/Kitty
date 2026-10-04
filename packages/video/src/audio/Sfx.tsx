import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { tickFrames } from "../lib/anim";
import { STAT_ROWS_AT } from "../scenes/ActThree";
import { COUNT } from "../scenes/ActOne";
import { COLLECT_CLICK, LATE_AT } from "../scenes/Collect";
import { FULL_AT, PAYOUT_CLICK, PLEDGES } from "../scenes/Loan";
import { ICON_LANDS } from "../scenes/Logo";
import { DEPOSITS, EQUATION_AT } from "../scenes/Vault";
import { BLOOM, NUMBERS_A, NUMBERS_B, SCENES, TO_DARK } from "../theme";

type Sound = "whoosh" | "tick" | "click" | "hit" | "chime";
type Cue = { at: number; sound: Sound; volume: number };

const LENGTH: Record<Sound, number> = { whoosh: 66, tick: 6, click: 8, hit: 144, chime: 132 };

const S = SCENES;
const at = (scene: { from: number }, local: number) => scene.from + local;

// Every cue is derived from a scene's start plus the frame its animation uses, so moving a scene moves its sounds.
export const CUES: Cue[] = [
  { at: at(S.intermediary, 6), sound: "tick", volume: 0.22 },
  { at: at(S.intermediary, 51), sound: "tick", volume: 0.22 },
  ...tickFrames(NUMBERS_A.from + COUNT.start, COUNT.dur, 10).map((f) => ({ at: f, sound: "tick" as const, volume: 0.11 })),
  ...tickFrames(NUMBERS_B.from + COUNT.start, COUNT.dur, 10).map((f) => ({ at: f, sound: "tick" as const, volume: 0.11 })),
  { at: BLOOM.from - 4, sound: "whoosh", volume: 0.45 },
  { at: at(S.logo, ICON_LANDS), sound: "hit", volume: 0.7 },
  { at: at(S.product, 2), sound: "whoosh", volume: 0.28 },
  ...DEPOSITS.map((d) => ({ at: at(S.vault, d.at + 4), sound: "tick" as const, volume: 0.24 })),
  { at: at(S.vault, EQUATION_AT + 14), sound: "tick", volume: 0.24 },
  ...PLEDGES.map((p) => ({ at: at(S.loan, p.at), sound: "tick" as const, volume: 0.22 })),
  { at: at(S.loan, FULL_AT), sound: "chime", volume: 0.3 },
  { at: at(S.loan, PAYOUT_CLICK), sound: "click", volume: 0.55 },
  { at: at(S.collect, LATE_AT), sound: "tick", volume: 0.24 },
  { at: at(S.collect, COLLECT_CLICK), sound: "click", volume: 0.55 },
  { at: TO_DARK.from - 14, sound: "whoosh", volume: 0.3 },
  ...STAT_ROWS_AT.map((f) => ({ at: at(S.stats, f), sound: "tick" as const, volume: 0.2 })),
  { at: at(S.end, 4), sound: "hit", volume: 0.5 },
];

export const Sfx: React.FC = () => (
  <>
    {CUES.map((c, i) => (
      <Sequence key={i} from={c.at} durationInFrames={LENGTH[c.sound]} name={`sfx ${c.sound}`} layout="none">
        <Audio src={staticFile(`sfx/${c.sound}.wav`)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
