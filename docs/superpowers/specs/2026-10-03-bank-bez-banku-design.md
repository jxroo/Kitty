# Kasa bez zarządu → „Bank bez banku” (HackYeah 2026, Superteam PL)

## Kontekst

Obecne MVP (kasa zapomogowo-pożyczkowa na Solanie: skarbiec programu, pożyczki z 100% zabezpieczeniem, egzekucja zaległej raty przez każdego) działa na devnecie. Chcemy mierzyć wyżej: system, który zastępuje **bank jako pośrednika** dla zwykłych ludzi, w skali sieci, a nie jednej grupy.

Uczciwa teza na pitch: przelewy bez banku Solana już robi (SPL transfer). Banki trzymają ludzi tym, czego krypto jeszcze nie zastąpiło: **kredytem, poleceniem zapłaty / potrąceniem z pensji, stałym zleceniem oszczędzania i historią kredytową (BIK)**. Każdą z tych usług ma zastąpić konkretna instrukcja programu, pokazana na żywo.

**Ograniczenia:**
- Deadline: 4.10, 23:00 (teraz sobota ok. 22:20); zmian po deadlinie jury nie bierze pod uwagę.
- Kryteria oceny: związek z wyzwaniem 30%, kompletność i działanie na żywo 25%, pomysł 20%, potencjał wdrożeniowy 15%, oryginalność 10%.
- Logika zastępująca pośrednika musi być on-chain.

**Decyzja użytkownika:** kierunek „Bank bez banku”, rozbudowa obecnej kasy, bez zmiany projektu.

**Moment kulminacyjny nowego demo:** rata ściąga się sama z portfela pożyczkobiorcy w dniu terminu, a gdy portfel jest pusty albo zgoda cofnięta, po karencji schodzi z zabezpieczeń. Nikt nic nie klika: transakcje wysyła bot, który nie ma żadnych uprawnień.

## Mapowanie na pitch (README i slajd)

| Usługa banku | Pośrednik dziś | Co ją zastępuje | Status |
|---|---|---|---|
| Konto oszczędnościowe | bank, skarbnik | skarbiec programu (`vault.rs`) | jest |
| Kredyt | bank, ocena zdolności | 100% zabezpieczenia: własne oszczędności + poręczenia (`loan.rs`) | jest |
| Windykacja | firma windykacyjna | `collect_overdue`, każdy może wywołać | jest |
| Polecenie zapłaty / potrącenie z pensji | bank + pracodawca | zgoda SPL dla PDA członka + `pull_installment` | **NOWE (P0)** |
| Stałe zlecenie oszczędzania | bank | `set_contribution` + `pull_contribution` | **NOWE (P1)** |
| BIK | biuro kredytowe | publiczna historia liczona z kont `Loan` w całej sieci | **NOWE (P1, UI)** |
| Skala: sieć zamiast jednej kasy | — | panel „Sieć kas” (statystyki ze wszystkich kas) | **NOWE (P1, UI)** |
| Przelew | bank, Elixir/BLIK | zwykły transfer SPL (uczciwie: Solana już to robi) | P2, opcjonalnie |

## Projekt on-chain

Praca na gałęzi `bank-bez-banku`. Program idzie pod **nowym program ID**, bo zmienia się układ konta `Member`. Stary program i obecny deploy na Railway zostają nietknięte jako plan awaryjny.

### Mechanizm „polecenia zapłaty” (P0)

- **Zgoda.** Członek wywołuje SPL `approve_checked` na swoim koncie tokenowym tPLN. Delegatem jest **PDA jego `Member` w tej kasie**: zgoda dotyczy tylko tej kasy i jest ograniczona kwotą. Cofa ją zwykłym SPL `revoke` w dowolnym momencie. Program nie dodaje żadnej instrukcji do zarządzania zgodą: używamy standardu SPL Token.
- **Nowa instrukcja `pull_installment`.** Plik `programs/kasa/src/instructions/autopay.rs`. Bez podpisu: wywołać ją może każdy, w tym bot.
  - Konta: `kasa` (mut, `has_one = mint`, `has_one = vault`), `loan` (mut, `has_one = kasa`), `borrower_member` (mut, seeds `[MEMBER_SEED, kasa, loan.borrower]`), `guarantor0..2` (Option, jak w `Repay`), `mint`, `vault` (mut), `from` (mut, `token::mint = mint`), `token_program`.
  - Ograniczenia na `from`:
    - `from.owner == loan.borrower`, inaczej `WrongPayerAccount`;
    - `from.delegate == Some(borrower_member)`, inaczej `NoMandate`.
  - Wyliczenie kwoty:
    - `owed_now = due_by(..., grace = 0, now) − repaid − seized` (rata wymagalna od dnia terminu, bez karencji); przy `owed_now == 0` błąd `InstallmentNotDue`;
    - `pull = min(owed_now, from.delegated_amount, from.amount)`; przy `pull == 0` błąd `NoMandate`.
  - Przelew: CPI `transfer_checked` z `from` do skarbca, podpisany seedami PDA członka (nowa funkcja `pay_in_by_mandate` w `vault.rs`).
  - Księgowanie: wspólna funkcja `apply_repayment(...)`, wydzielona z `handle_repay` w `repay.rs` i używana przez obie instrukcje. Robi `total_outstanding −= pull`, `loan.repaid += pull`, `check_guarantors`, `release_excess` (poręczyciele odblokowani najpierw) i `close_if_settled`. Dodatkowo `loan.autopaid += pull`.
- **Kaskada bezpieczeństwa:** najpierw portfel (zgoda), potem po karencji `collect_overdue` z zabezpieczeń (bez zmian). Zgodę można cofnąć, więc gwarancją dla kasy nadal jest zabezpieczenie, a polecenie zapłaty jest tylko wygodą. To ważna odpowiedź na pytania jury.

### Składka stała (P1, ten sam mechanizm zgody)

- Nowe pola `Member`: `contribution: u64` i `next_contribution_at: i64`.
- `set_contribution(amount)`: podpis członka; `0` wyłącza składkę, a przy `amount > 0` ustawia `next_contribution_at = now`.
- `pull_contribution()`: bez podpisu.
  - Warunki: `contribution > 0` (inaczej `ContributionNotSet`) i `now >= next_contribution_at` (inaczej `ContributionNotDue`).
  - Pobranie wszystko albo nic: `min(delegated, balance) >= contribution`, inaczej `NoMandate`.
  - Skutek: `savings += c`, `total_deposited += c`, `kasa.total_savings += c`.
  - Kolejny termin: `next += period_secs`, a jeśli wciąż jest w przeszłości, to `now + period_secs` (bez nadrabiania zaległych składek).

### Pozostałe zmiany w stanie

- `Loan.autopaid: u64`: część `repaid`, która przyszła z polecenia zapłaty (UI pokazuje ratę jako „pobrana automatycznie”).
- `ActivityKind`: nowe warianty dopisane na końcu: `InstallmentPulled`, `ContributionSet`, `ContributionPulled`.
- `KasaError`: nowe kody dopisane na końcu (6023+), żeby istniejące kody się nie przesunęły: `InstallmentNotDue`, `NoMandate`, `WrongPayerAccount`, `ContributionNotSet`, `ContributionNotDue`.
- `lib.rs`: trzy nowe entrypointy. Nowy `declare_id!` oraz `Anchor.toml`. Nowy keypair programu powstaje przy `anchor keys sync`.

## Klient, bot i UI (`packages/web`)

### Generowany klient

`anchor build` → `idl/kasa.json` → `npm run codama` (`scripts/codama.mjs`) → `src/generated/`.

### `src/lib/kasa.ts`

- `owedNow(loan, kasa, now)`: lustro `due_by` z karencją 0.
- Polskie komunikaty dla kodów 6023+.
- Etykiety nowych zdarzeń.

### `src/lib/instructions.ts`

- `approveMandateIx(owner, kasa, mint, amount)`, zbudowane na `getApproveCheckedInstruction` z `@solana-program/token`; delegatem jest `memberPda(kasa, owner)`.
- `revokeMandateIx`, zbudowane na `getRevokeInstruction`.
- `pullInstallmentIx(loan, loanData, kasaData)`, z ponownym użyciem `guarantorSlots` i `ataOf`.
- `setContributionIx`.
- `pullContributionIx`.
- `disburseIxs(..., { mandate: true })`: w tej samej transakcji kolejno tworzenie ATA, wypłata i zgoda na kwotę pożyczki. Jeden klik: „Wypłać i włącz polecenie zapłaty”.

### `src/lib/chain.ts`

Odczyt konta tokenowego (`fetchMaybeToken`), żeby pokazać stan zgody (delegat i limit) dla bieżącego portfela.

### Komponenty

- **`LoanCard.tsx`:**
  - przy wypłacie checkbox polecenia zapłaty (domyślnie włączony);
  - kafelki rat: „pobierze się automatycznie z portfela za X” albo „pobrana automatycznie” (z `autopaid`);
  - przycisk awaryjny „Pobierz ratę z polecenia zapłaty”, czyli to samo, co robi bot: każdy może.
- **`KasaView.tsx`, panel członka:** sekcja „Polecenie zapłaty” (status zgody, limit, „Udziel zgody” / „Cofnij”) i „Składka stała” (kwota co okres, „Ustaw”).
  - Ostrzeżenie: jedno konto tokenowe ma jednego delegata, więc zgoda w kasie B zastępuje zgodę w kasie A.
- **`ActivityFeed.tsx`:** nowe zdarzenia.
  - „Rata pobrana z polecenia zapłaty, wywołał: automat (bez uprawnień)”, rozpoznawane po adresie bota z `NEXT_PUBLIC_CRANK_ADDRESS`.
- **Historia kredytowa (P1, tylko odczyt z łańcucha):**
  - nowy komponent `History.tsx`, czyli profil portfela agregowany z kont `Loan` i `Member` we wszystkich kasach;
  - zawartość: pożyczki spłacone bez egzekucji, z egzekucją, poręczenia (ile, ile pobrano), oszczędności;
  - skrót pokazywany w `PendingActions` przy pożyczce („Bartek: 2 spłacone bez egzekucji, 0 egzekucji”), czyli poręczyciel decyduje na publicznych danych zamiast BIK;
  - uczciwe ograniczenie: historia jest publiczna (prywatność).
- **Panel „Sieć kas” w `KasyList.tsx` (P1):** liczba kas, unikalnych członków, łączne oszczędności, pożyczone teraz, rozliczone pożyczki, egzekucje.
- **Przelew (P2, opcjonalnie):** mały dialog „Wyślij zł” w `Header.tsx` (`transfer_checked`).

### Bot `scripts/crank.ts`

- Pętla co ok. 4 s: `fetchChainState` → dla każdej aktywnej pożyczki:
  - jeśli `owedNow > 0` i ATA pożyczkobiorcy ma delegata równego PDA członka z niezerowym limitem i saldem → `pull_installment`;
  - następnie, jeśli `overdueNow > 0` → `collect_overdue`.
- Dla członków z `contribution > 0` i `next <= now` → `pull_contribution`.
- Do wysyłki używa `sendWithFallback` z `src/lib/send.ts`. Odrzucenia w preflighcie nic nie kosztują.
- Zegar: czas klastra (`getBlockTime`), tak jak `useChainNow` w `KasaProvider.tsx`.
- Klucz bota to osobny keypair devnet (`CRANK_SECRET_KEY`), zasilony ok. 0,5 SOL z portfela deployu. Nie może to być klucz faucetu.
- Wdrożenie: druga usługa Railway z tego samego katalogu (`npx tsx scripts/crank.ts`). Zapas: uruchomienie z laptopa.

## Kolejność, punkty kontrolne i cięcia

| Kiedy (CEST) | Krok | Sprawdzenie |
|---|---|---|
| sob 22:30 | Gałąź; ten projekt zapisany jako `docs/superpowers/specs/2026-10-03-bank-bez-banku-design.md`; nowy keypair programu | — |
| do ~03:00 | **P0 on-chain, TDD:** najpierw testy LiteSVM w `tests/kasa.rs` (helpery `warp`, `assert_invariants`, `repay`, `collect_overdue`), potem kod | `anchor build && cargo test`: stare 12 + nowe testy zielone |
| ~03:30 | **Deploy na devnet** pod nowym ID + `anchor idl init`; nowy ID w `.env` / `kasa.ts` | `solana program show <ID> --url devnet` |
| do ~08:00 | **P0 klient i bot:** codama, buildery, UI zgody i wypłaty, kafelki rat, bot lokalnie | Na devnecie bot sam pobiera ratę; tx w eksploratorze bez podpisu pożyczkobiorcy |
| do ~11:00 | **P1:** składka stała (UI i bot), historia, panel „Sieć kas” | `npm test`, `npm run build` zielone; przeklikanie w Browser pane |
| do ~13:00 | **Weryfikacja:** rozszerzony `scripts/e2e-devnet.ts` → nowy `docs/devnet-e2e.md`; `scripts/ui-e2e.mjs` z 3 portfelami; bot jako usługa Railway (logi przez `get-logs`) | Linki do eksploratora dla każdej ścieżki |
| do ~16:00 | **Materiały:** README (tabela „Bank bez banku”, „gdzie znika pośrednik” z nowymi liniami kodu, „co jeśli ktoś zniknie”: bot pada / zgoda cofnięta, uprawnienia, ograniczenia), `SUBMISSION.md`, `docs/HACKTRIBE_FORM.md`, `docs/DEMO_RUNBOOK.md`, `docs/VIDEO_SCRIPT.md`, `docs/slides/index.html` → `node scripts/pitch-pdf.mjs` (maks. 10 slajdów), screenshoty | PDF bez przepełnionych slajdów |
| 16:00–20:00 | Zespół nagrywa wideo (maks. 3 min), próba demo | — |
| do ~21:00 | Push (po Twojej zgodzie), redeploy Railway, wysłanie na HackTribe | 2 h zapasu |

**Cięcia przy opóźnieniu, w tej kolejności:** P2 przelew → panel „Sieć kas” → historia → składka stała. **P0 (polecenie zapłaty i bot) zostaje zawsze.**

**Twardy bezpiecznik:** jeśli o 12:00 P0 nie działa na devnecie, wracamy do obecnej wersji i dopracowujemy tylko materiały.

## Testy LiteSVM do napisania najpierw (P0/P1)

1. Bot bez podpisu pożyczkobiorcy pobiera dokładnie wymagalną ratę z portfela. Poręczyciele zostają odblokowani najpierw, `autopaid` rośnie, a niezmiennik skarbca się trzyma.
2. Przed terminem raty: `InstallmentNotDue`.
3. Bez zgody albo po `revoke`: `NoMandate`; po karencji `collect_overdue` bierze z zabezpieczeń.
4. Nawet przy dużym limicie zgody pobiera najwyżej to, co wymagalne.
5. Konto innego portfela, nawet z delegatem: `WrongPayerAccount`.
6. Za mało środków w portfelu: pobiera częściowo, resztę po karencji ściąga z zabezpieczeń; pożyczka kończy się rozliczona, kasa cała.
7. Składka:
   - ustawienie i pobranie przez obcego;
   - drugi raz w tym samym okresie: `ContributionNotDue`;
   - bez zgody: `NoMandate`;
   - `0` wyłącza składkę.
8. Pełny scenariusz: wszystkie raty z polecenia zapłaty → `Repaid`, po czym wszyscy wypłacają wszystko i skarbiec kończy na 0.

Plus test w `tests/kasa.test.ts`: `owedNow` daje te same liczby co Rust.

## Weryfikacja end-to-end

- `cd packages/contracts && anchor build && cargo test`
- `cd packages/web && npm test && npm run build`
- `npx tsx scripts/e2e-devnet.ts`: pełna ścieżka na devnecie z linkami do eksploratora.
- Bot na Railway + `node scripts/ui-e2e.mjs`: Anna, Bartek i Celina przechodzą scenariusz; rata 1 schodzi sama, Bartek cofa zgodę, rata 2 schodzi z zabezpieczeń po karencji.
- Ręczne przeklikanie w Browser pane i sprawdzenie transakcji w Solana Explorer.

## Ryzyka i ograniczenia (do README)

- Jedno konto SPL ma jednego delegata.
- Bot to wygoda: płaci opłaty, nie ma uprawnień, każdy może go uruchomić albo zastąpić.
- Zgodę można cofnąć, ale zabezpieczenie i tak chroni kasę.
- Historia kredytowa jest publiczna.
- Program nadal jest upgradeable kluczem deployu, jak dziś.
- Devnet, brak audytu.
