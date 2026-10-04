import { AbsoluteFill } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Scene, type Transition } from "../components/Scene";
import { Credit } from "./Credit";
import { DirectDebit } from "./DirectDebit";
import { Finale } from "./Finale";
import { Brand, FourThings, List, WithoutBank } from "./Opening";
import { SafetyNet } from "./SafetyNet";
import { Savings } from "./Savings";
import { Statement } from "./Statement";
import { TrailerSfx } from "./Sfx";
import { T, TRAILER_BLOOM, TRAILER_TO_DARK, TRANSITION_FRAMES } from "./timeline";

// Paired moves: the outgoing and incoming shot share the same transition and length.
const X: Record<string, Transition> = {
  cut: { kind: "cut", frames: 0 },
  fadeIn: { kind: "fade", frames: 18 },
  fadeOut: { kind: "fade", frames: 14 },
  push: { kind: "push-up", frames: TRANSITION_FRAMES.push },
  slide: { kind: "slide-left", frames: TRANSITION_FRAMES.slide },
  wipe: { kind: "wipe", frames: TRANSITION_FRAMES.wipe },
};

export const Trailer: React.FC = () => (
  <AbsoluteFill>
    <Backdrop bloom={TRAILER_BLOOM} toDark={TRAILER_TO_DARK} />

    {/* Act I — black. A clean fade, then a hard cut on the beat, then the bloom. */}
    <Scene name="T1 four things" {...T.fourThings} enter={X.cut} exit={X.fadeOut}>
      <FourThings />
    </Scene>
    <Scene name="T2 list" {...T.list} enter={X.fadeIn} exit={X.cut}>
      <List />
    </Scene>
    <Scene name="T3 without a bank" {...T.withoutBank} enter={X.cut} exit={{ kind: "fade", frames: 30 }}>
      <WithoutBank />
    </Scene>

    {/* Act II — light. Every chapter change is a different camera move. */}
    <Scene name="T4 brand" {...T.brand} enter={{ kind: "fade", frames: 10 }} exit={X.push}>
      <Brand />
    </Scene>
    <Scene name="T5 01 savings" {...T.savings} enter={X.push} exit={X.slide} push={0.02}>
      <Savings />
    </Scene>
    <Scene name="T6 02 credit" {...T.credit} enter={X.slide} exit={{ kind: "fly", frames: 18 }} push={0}>
      <Credit />
    </Scene>
    <Scene name="T7 03 direct debit" {...T.debit} enter={{ kind: "fly", frames: 22 }} exit={X.cut} push={0.05}>
      <DirectDebit />
    </Scene>
    <Scene name="T8 04 safety net" {...T.safety} enter={{ kind: "snap", frames: 14 }} exit={X.wipe} push={0}>
      <SafetyNet />
    </Scene>
    <Scene name="T9 05 statement" {...T.statement} enter={X.wipe} exit={{ kind: "fade", frames: 16 }} push={0.02}>
      <Statement />
    </Scene>

    {/* Act III — black */}
    <Scene name="T10 finale" {...T.finale} enter={X.fadeIn} exit={{ kind: "fade", frames: 48 }}>
      <Finale />
    </Scene>

    <TrailerSfx />
  </AbsoluteFill>
);
