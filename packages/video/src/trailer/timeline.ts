// The 40 s trailer for the "bank without a bank" version (frames @ 60 fps).
// It replaces slides 1–3 (0:00–0:40) of docs/VIDEO_SCRIPT.md. Scenes, backdrop and sounds all read from here.
export const T = {
  fourThings: { from: 0, dur: 150 },
  list: { from: 150, dur: 240 },
  withoutBank: { from: 390, dur: 120 },
  brand: { from: 510, dur: 180 },
  savings: { from: 690, dur: 270 },
  credit: { from: 960, dur: 300 },
  debit: { from: 1260, dur: 360 },
  safety: { from: 1620, dur: 240 },
  statement: { from: 1860, dur: 240 },
  finale: { from: 2100, dur: 300 },
} as const;

export const TRAILER_FRAMES = T.finale.from + T.finale.dur; // 2400 = 40 s

export const TRAILER_BLOOM = { from: 452, to: 510 };
// A near-cut to black once the statement has faded: a slow light-to-black fade reads as a grey wash.
export const TRAILER_TO_DARK = { from: 2100, to: 2103 };

// Strip transitions (the outgoing shot plays these frames past its end, over the next shot's start).
export const TRANSITION_FRAMES = { push: 28, slide: 28, wipe: 34 };
