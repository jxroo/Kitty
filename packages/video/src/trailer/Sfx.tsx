import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { PAYOUT_CLICK } from "./Credit";
import { FLIGHT } from "./DirectDebit";
import { FINALE_HIT } from "./Finale";
import { ICON_LANDS } from "./Opening";
import { T, TRAILER_BLOOM, TRANSITION_FRAMES } from "./timeline";

// Lengths in frames (60 fps), from `npm run sfx`.
const LENGTH = {
  "t-fly": 150,
  "t-riser": 228,
  "t-impact": 336,
  "t-tick": 48,
  "t-pop": 46,
  "t-click": 38,
  "t-clock-hi": 56,
  "t-clock-lo": 56,
  "t-transfer": 204,
  "t-shimmer": 228,
  "t-chime": 240,
  "t-swipe": 66,
  "t-swipe-lr": 66,
  "t-thud": 42,
  "t-coin": 84,
} as const;

type Sound = keyof typeof LENGTH;
type Cue = { at: number; sound: Sound; volume: number };

const at = (scene: { from: number }, local: number) => scene.from + local;
// A fly-through peaks 0.55 s (33 frames) in: start it so the rush peaks exactly on the cut.
const flyInto = (scene: { from: number }, volume = 0.34): Cue => ({ at: scene.from - 33, sound: "t-fly", volume });
// A swipe peaks 0.2 s (12 frames) in: centre it on a strip transition of `frames`.
const swipeOver = (scene: { from: number }, frames: number, sound: "t-swipe" | "t-swipe-lr", volume: number): Cue => ({
  at: scene.from + Math.round(frames / 2) - 12,
  sound,
  volume,
});
const RISER_FRAMES = 132; // the riser's audible part is 2.2 s; it tops out on the bloom.

// Few, soft, low sounds: one accent per idea, nothing on every word or row.
export const TRAILER_CUES: Cue[] = [
  { at: TRAILER_BLOOM.to - RISER_FRAMES, sound: "t-riser", volume: 0.22 },
  { at: at(T.brand, ICON_LANDS), sound: "t-impact", volume: 0.42 },

  swipeOver(T.savings, TRANSITION_FRAMES.push, "t-swipe", 0.14),
  swipeOver(T.credit, TRANSITION_FRAMES.slide, "t-swipe-lr", 0.14),
  { at: at(T.credit, PAYOUT_CLICK), sound: "t-pop", volume: 0.22 },

  flyInto(T.debit, 0.16),
  { at: at(T.debit, FLIGHT.from), sound: "t-transfer", volume: 0.2 },

  swipeOver(T.statement, TRANSITION_FRAMES.wipe, "t-swipe", 0.1),

  { at: at(T.finale, FINALE_HIT), sound: "t-impact", volume: 0.36 },
];

export const TrailerSfx: React.FC = () => (
  <>
    {TRAILER_CUES.map((c, i) => (
      <Sequence key={i} from={c.at} durationInFrames={LENGTH[c.sound]} name={`sfx ${c.sound}`} layout="none">
        <Audio src={staticFile(`sfx/${c.sound}.wav`)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
