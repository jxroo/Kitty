import { Composition } from "remotion";
import { Teaser } from "./Teaser";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./theme";
import { Trailer } from "./trailer/Trailer";
import { TRAILER_FRAMES } from "./trailer/timeline";

export const RemotionRoot: React.FC = () => (
  <>
    {/* The 40 s trailer for the current version (direct debit, standing orders, kasa history). */}
    <Composition id="KasaTrailer" component={Trailer} durationInFrames={TRAILER_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    {/* The first 50 s teaser, for the version before direct debits. */}
    <Composition id="KasaTeaser" component={Teaser} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
