# Runbook demo na żywo (dla prezentującego)

Demo: https://web-production-ad49f.up.railway.app · Program: `2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR` (devnet) · Bot: `AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz` (usługa „automat” na Railway, bez żadnych uprawnień)

## T-60 min: przygotowanie

1. **Phantom → Settings → Developer Settings → Testnet Mode: ON**, sieć **Solana Devnet**.
2. Trzy konta w Phantomie: **Anna**, **Bartek**, **Celina**. Na każdym w aplikacji kliknij **„Dobierz testowe zł”** (2000 tPLN i trochę SOL, jeśli konto ma mniej niż 0,02 SOL). Zapas SOL: https://faucet.solana.com.
3. **Bot działa?** Railway → projekt `kasa-bez-zarzadu` → usługa `automat` → Logs. Ma być linia `automat AuEG… · RPC …`. Saldo bota: `solana balance AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz --url devnet` (wystarczy > 0,05 SOL). Awaryjnie z laptopa: `cd packages/web && CRANK_KEYPAIR=~/crank-keypair.json npx tsx scripts/crank.ts`.
4. **Helius:** w panelu Helius ogranicz klucz do domeny `web-production-ad49f.up.railway.app` (klucz jest widoczny w przeglądarce).
5. Dwie kasy:
   - **A. Do pokazania od zera na scenie:** nic nie przygotowujesz, tworzysz ją na żywo (preset „Demo”).
   - **B. Moment kulminacyjny (najważniejsza):** ok. **1 min przed wejściem na scenę** uruchom w terminalu:
     ```bash
     cd packages/web && npx tsx scripts/burners.ts fund && npx tsx scripts/demo-seed.ts --revoke
     ```
     Skrypt zakłada kasę testowymi portfelami, Bartek bierze 1000 zł na 4 raty z poręczeniami Anny i Celiny i wypłaca z poleceniem zapłaty. Wypisuje link do kasy i godzinę raty 1. Po pobraniu raty 1 przez bota Bartek cofa zgodę, więc ratę 2 bot ściągnie z zabezpieczeń po karencji (ok. 75 s później). Otwórz link w przeglądarce: do oglądania portfel nie jest potrzebny.
     Bez skryptu: zrób to samo ręcznie kontami z Phantoma (Anna zakłada, wszyscy wpłacają, Bartek prosi o 1000 zł / 4 raty, Anna poręcza 300, Celina 200, Bartek wypłaca z zaznaczonym poleceniem zapłaty) ok. 1 min przed wejściem.
6. Karty w przeglądarce: aplikacja (kasa B), Solana Explorer (devnet), logi bota na Railway, README na GitHubie (sekcja „The bank services it replaces”).
7. Plan awaryjny: nagranie wideo + `docs/devnet-e2e.md` (linki do prawdziwych transakcji z całej ścieżki: bot pobiera składkę i ratę, cofnięcie zgody, egzekucja, „run na kasę”).

## Scenariusz na scenie (~4 min)

| Krok | Konto | Co klikasz | Co mówisz |
|---|---|---|---|
| 1 | Anna | **Załóż kasę i dołącz** (Demo, 2×) | „Zasady zapisują się w programie raz na zawsze. Jako założycielka nie mam żadnych uprawnień.” |
| 2 | Anna | **Wpłać** 1000 → **Włącz stałą składkę** 100 zł | „Pieniądze są na koncie programu, nie u skarbnika. A to stałe zlecenie bez banku: jedna zgoda SPL, składka schodzi z portfela co okres.” |
| 3 | Bartek | link z zaproszeniem → **Dołącz**, **Wpłać** 500, **Poproś o pożyczkę** 1000 / 4 raty | „Nikt nie zatwierdza ani członków, ani pożyczek. Moje 500 zł blokuje się jako zabezpieczenie. Brakuje połowy.” |
| 4 | Anna, Celina | historia Bartka nad pożyczką → **Poręczam** 300 i 200 | „Zanim poręczę, widzę historię Bartka z całej sieci kas, prosto z łańcucha. To zamiast BIK.” |
| 5 | Bartek | **Wypłać pożyczkę na mój portfel** („Spłacaj raty automatycznie” zaznaczone) | „Wypłacam sam, bez zarządu. W tej samej transakcji daję zgodę na pobieranie rat: to polecenie zapłaty bez banku i bez pracodawcy.” |
| 6 | — | **kasa B**: rata 1 „termin minął – pobieram z portfela” → za kilka sekund „spłacona”, „Spłacone automatycznie: 250 zł”; w **Historii kasy** wiersz „Rata pobrana automatycznie z portfela · automat” → link do tx w eksploratorze | **Moment kulminacyjny:** „Nikt nic nie klika. W dniu terminu bot – klucz bez żadnych uprawnień – wysyła transakcję, a program bierze z portfela Bartka dokładnie wymagalną ratę. Bartek niczego nie podpisuje. W eksploratorze: podpisał tylko bot, przelew autoryzuje PDA Bartka w tej kasie.” |
| 7 | — | kasa B: Bartek wyłączył automatyczną spłatę → rata 2 „pokryta z oszczędności”; w historii „Niezapłacona rata pokryta z zablokowanych oszczędności · pieniądze nie wychodzą z kasy” | „Bartek cofnął zgodę i przestał płacić. Kasa nigdy na tej zgodzie nie polegała: po karencji bot ściąga ratę z jego zablokowanych oszczędności, potem z poręczeń. Bez windykacji i niczyjej zgody.” |
| 8 | Anna | „Historia kasy”: „Jest w kasie … ✓ zgadza się z historią” → karta „Pieniądze kasy” → **Wypłać** wolne pieniądze; strona główna: „Wszystkie kasy razem” | „Każdy grosz, który wszedł i wyszedł, z saldem po każdej operacji – prosto z łańcucha, nikt tego nie poprawi. W kasie zawsze leżą wszystkie wolne pieniądze. Wypłacam swoje teraz, bez pytania kogokolwiek.” |
| 9 | — | „Gdzie znika pośrednik?” → „Jak to działa – w 5 zdaniach”, tabela „Dziś → u nas”, rozwiń „Dla jury i programistów” | Linki do kodu i tabela uprawnień. „Nie ma klucza admina ani instrukcji, która pozwala nam ruszyć cudze oszczędności.” |

## Pytania jury: krótkie odpowiedzi

- **Gdzie znika pośrednik w kodzie?** `instructions/autopay.rs` → `pull_installment` (z portfela tylko wymagalna rata, tylko z konta pożyczkobiorcy, w limicie zgody), `instructions/loan.rs` (wypłata tylko przy 100% zabezpieczenia), `instructions/repay.rs` → `collect_overdue` (egzekucja bez podpisu), `vault.rs` → `pay_out` (jedyna droga wyjścia tokenów ze skarbca).
- **Ktoś znika w połowie?** Pożyczkobiorca: cofnie zgodę albo opróżni portfel, to raty zejdą z zabezpieczeń. Poręczyciel: nic nie musi robić. Bot: nie ma uprawnień, te same przyciski są w aplikacji dla każdego, a kod bota jest publiczny. Założyciel / my: bez znaczenia.
- **Czy bot to nie nowy pośrednik?** Nie. Płaci tylko opłatę sieci i wysyła to, co program i tak pozwala wysłać każdemu. Nie może pobrać więcej niż wymagalne, z cudzego konta ani ponad zgodę. Jeśli zniknie, kliknie ktokolwiek albo uruchomi `scripts/crank.ts`.
- **Kto może co? Czy możecie coś zmienić?** Zgodę daje i cofa tylko właściciel portfela (standardowe SPL approve / revoke). Żadna instrukcja nie pozwala zmienić zasad ani ruszyć cudzych oszczędności, także nam. Uczciwie: na devnecie upgrade authority to wciąż nasz klucz deployu, więc moglibyśmy wgrać inny kod. Trzymamy go na czas hackathonu do poprawek; przed prawdziwymi pieniędzmi trafia do multisiga członków albo zostaje usunięty (`--final`). Stan: `solana program show 2GCG… --url devnet`.
- **Dlaczego blockchain, nie baza?** W bazie pośrednikiem jest ten, kto ją prowadzi. Tak właśnie znikały pieniądze z KZP. Tu saldo to konto programu, zasady to kod, a polecenie zapłaty nie potrzebuje banku: limit pilnuje program SPL Token, kwotę i termin nasz program.
- **Czemu nie po prostu przelew USDC?** Przelewy bez banku już są. Do banku chodzi się po kredyt, polecenie zapłaty, stałe zlecenie i historię kredytową. Te rzeczy zastępuje program.
- **Kto traci, gdy ktoś nie spłaca?** Tylko poręczyciel, który sam się na to zgodził, maksymalnie do kwoty poręczenia. Kasa nigdy nie traci.
- **Co dalej, gdyby był tydzień?** Stablecoin w złotówkach, BLIK, passkeys; poręczenia między kasami; zapomogi z głosowaniem; multisig i audyt.

## Jeśli coś się wysypie

- **Bot nie pobiera raty**: sprawdź logi `automat` na Railway; awaryjnie kliknij w kasie **„Pobierz ratę teraz”** albo **„Pokryj zaległą ratę”** (to te same transakcje, każdy może) albo uruchom bota z laptopa.
- **RPC 429 / „Problem z RPC devnetu”**: odczekaj 5–10 s, kliknij odśwież. Transakcje są potwierdzane także bez websocketu.
- **„żadna rata nie jest jeszcze wymagalna / zaległa”**: zegar devnetu spóźnia się kilka sekund; poczekaj, aż przycisk pojawi się ponownie.
- **Brak tPLN / SOL**: „Dobierz testowe zł” (limit: raz na 30 s na adres).
