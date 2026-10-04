# Trailer video (Remotion)

A 40-second, Apple-style trailer for the current version of Kasa bez zarządu (direct debit, standing orders, kasa history): 1920×1080, 60 fps, H.264 (CRF 12) with a few soft synthesised sound accents. **Rendering on another computer: see [RUN.md](RUN.md).** It can replace slides 1–3 (0:00–0:40) of the submission video in [`docs/VIDEO_SCRIPT.md`](../../docs/VIDEO_SCRIPT.md).

```bash
npm install
npm run studio          # preview with a scrubbable timeline
npm run render          # → out/kasa-bez-zarzadu-trailer.mp4
npm run sfx             # regenerate public/sfx/*.wav (deterministic)
npm run render:teaser   # the earlier 50 s teaser, made for the version before direct debits
```

## Story (frames @ 60 fps, all timing in `src/trailer/timeline.ts`)

| Time | Scene | On screen |
|---|---|---|
| 0:00 | Act I, black | "People go to a bank for four things." → To keep savings / borrow / pay on time / prove they repay |
| 0:06.5 | | "A group can do all four. Without a bank." → a riser and a white bloom open Act II |
| 0:08.5 | Act II, light | App icon and name; then five chapters, each with its own camera move and transition (push, slide, fly, snap, wipe) |
| 0:11.5 | 01 Savings | The kasa's money fills up, including a standing contribution pulled by the bot (2 600 zł) |
| 0:16 | 02 Credit | Locked savings cover Bartek's 1 000 zł; he pays it out with "Spłacaj raty automatycznie" ticked |
| 0:21 | 03 Direct debit | A ring counts down to the due date; the bot moves 250 zł from his wallet into the kasa, nobody clicks |
| 0:27 | 04 Safety net | Automatic repayment off: installment 2 is covered from his blocked savings |
| 0:31 | 05 Statement | "Historia kasy" builds row by row; ✓ zgadza się z historią |
| 0:35 | Act III, black | "No bank. No board. No treasurer." and the app URL |

## Layout

- `src/trailer/`: the trailer: timeline, one file per chapter, and `Sfx.tsx` (sound cues hung on the frames each scene exports).
- `src/components/`: shared pieces: `Scene` (enter/exit transitions: dissolve, fly, push-up, slide-left, wipe, snap, cut; slow push-in), `TextFx` (mask, tracking, punch and typewriter title moves), `Backdrop` (black → bloom → light → black), `Depth.tsx` (3D camera tilt/orbit), `WordReveal`, `Counter`, `Cursor`, and presentational copies of the app's cards (`ui.tsx`, `Loan.tsx`).
- `scripts/make-sfx.mjs`: synthesises every sound (no samples or licences), with a Freeverb-style stereo room for the trailer's `t-*` sounds.
- `src/Teaser.tsx`, `src/scenes/`: the earlier teaser.

Numbers, labels and the statement rows come from the recorded production run (`docs/screenshots/07-…`, `08c-kasa-history.png`) and the app's own Polish UI strings. Remotion is free for teams of up to 3 people ([license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)).
