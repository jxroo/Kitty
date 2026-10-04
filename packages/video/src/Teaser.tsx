import { AbsoluteFill } from "remotion";
import { Sfx } from "./audio/Sfx";
import { Backdrop } from "./components/Backdrop";
import { Scene } from "./components/Scene";
import { ColdOpen, Intermediary, TrustFails, Turn } from "./scenes/ActOne";
import { EndCard, Stats } from "./scenes/ActThree";
import { Collect } from "./scenes/Collect";
import { Loan } from "./scenes/Loan";
import { Logo } from "./scenes/Logo";
import { Product } from "./scenes/Product";
import { Vault } from "./scenes/Vault";
import { NUMBERS_A, NUMBERS_B, SCENES as S } from "./theme";

export const Teaser: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />

    {/* Act I — black */}
    <Scene name="S1 cold open" {...S.coldOpen} fadeIn={0}>
      <ColdOpen />
    </Scene>
    <Scene name="S2 intermediary" {...S.intermediary}>
      <Intermediary />
    </Scene>
    <Scene name="S3a 61 000 zł" {...NUMBERS_A}>
      <TrustFails amount={61000} caption="of colleagues’ savings, lost on a crypto exchange." source="PKZP treasurer, Jawor county · Puls Legnicy, 2024" />
    </Scene>
    <Scene name="S3b 261 510 zł" {...NUMBERS_B}>
      <TrustFails
        amount={261510}
        caption="of withdrawals hidden with falsified cash reports for ten years."
        source="PKZP cashier · Court of Appeal in Katowice, II AKa 98/15"
      />
    </Scene>
    <Scene name="S4 turn" {...S.turn} fadeOut={40}>
      <Turn />
    </Scene>

    {/* Act II — light */}
    <Scene name="S5 logo" {...S.logo} fadeIn={10}>
      <Logo />
    </Scene>
    <Scene name="S6 product" {...S.product} push={0.02}>
      <Product />
    </Scene>
    <Scene name="S7 vault" {...S.vault}>
      <Vault />
    </Scene>
    <Scene name="S8 loan" {...S.loan} push={0.02}>
      <Loan />
    </Scene>
    <Scene name="S9 collect" {...S.collect} push={0.02} fadeOut={28}>
      <Collect />
    </Scene>

    {/* Act III — black */}
    <Scene name="S10 stats" {...S.stats}>
      <Stats />
    </Scene>
    <Scene name="S11 end card" {...S.end} fadeOut={48}>
      <EndCard />
    </Scene>

    <Sfx />
  </AbsoluteFill>
);
