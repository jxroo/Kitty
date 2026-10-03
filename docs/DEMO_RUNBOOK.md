# Runbook demo na żywo (dla prezentującego)

Demo: https://web-production-ad49f.up.railway.app · Program: `EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2` (devnet)

## T-60 min: przygotowanie

1. **Phantom → Settings → Developer Settings → Testnet Mode: ON**, sieć **Solana Devnet**.
2. Trzy konta w Phantomie: **Anna**, **Bartek**, **Celina**. Na każdym w aplikacji kliknij **„Dobierz testowe zł”** (2000 tPLN i trochę SOL, jeśli konto ma mniej niż 0,02 SOL). Zapas SOL: https://faucet.solana.com.
3. **Helius:** w panelu Helius ogranicz klucz do domeny `web-production-ad49f.up.railway.app` (klucz jest widoczny w przeglądarce).
4. Przygotuj dwie kasy:
   - **A. Do pokazania od zera na scenie:** nic nie przygotowujesz, tworzysz ją na żywo (preset „Demo”).
   - **B. Egzekucja na żywo (najważniejsza):** ok. 3 min przed wejściem na scenę: Anna zakłada kasę (Demo), wszyscy dołączają i wpłacają (Anna 1000, Bartek 500, Celina 1000), Bartek bierze 1000 zł na 4 raty, Anna poręcza 300, Celina 200, Bartek wypłaca i spłaca ratę 1. Rata 2 będzie do egzekucji po ok. 2 min 15 s od wypłaty. Jeśli się spóźnisz, nic nie szkodzi: kolejne raty też będą zaległe.
5. Karty w przeglądarce: aplikacja (kasa B otwarta jako Celina), Solana Explorer (devnet), README na GitHubie (sekcja „Where exactly the intermediary disappears”).
6. Plan awaryjny: nagranie wideo + `docs/devnet-e2e.md` (linki do prawdziwych transakcji z całej ścieżki, łącznie z egzekucją i „runem na kasę”).

## Scenariusz na scenie (~4 min)

| Krok | Konto | Co klikasz | Co mówisz |
|---|---|---|---|
| 1 | Anna | **Załóż kasę i dołącz** (Demo, 2×) | „Zasady zapisują się w programie raz na zawsze. Jako założycielka nie mam żadnych uprawnień.” |
| 2 | Anna | **Wpłać** 1000 → link „skarbiec w eksploratorze” | „Pieniądze są na koncie programu, nie u skarbnika. Tu jest saldo w eksploratorze.” |
| 3 | Bartek | otwiera link z zaproszeniem → **Dołącz**, **Wpłać** 500, **Złóż wniosek** 1000 / 4 raty | „Nikt nie zatwierdza ani członków, ani pożyczek. Moje 500 zł blokuje się jako zabezpieczenie. Brakuje połowy.” |
| 4 | Bartek | **Wypłać pożyczkę** (przycisk wyłączony) | „Program nie wypłaci, dopóki zabezpieczenie nie pokrywa 100%.” |
| 5 | Anna, Celina | **Poręczam** 300 i 200 | „Koleżanki poręczają, blokując własne oszczędności. Pasek jest pełny.” |
| 6 | Bartek | **Wypłać pożyczkę na mój portfel** | „Wypłacam sam. Bez zarządu.” Saldo w nagłówku +1000 zł. |
| 7 | Celina, kasa B | rata 2 „zaległa – do egzekucji” → **Egzekwuj zaległą ratę** | **Moment kulminacyjny:** „Bartek przestał płacić. Każdy, nawet ja, może teraz kliknąć: rata schodzi z jego zablokowanych oszczędności, potem z poręczeń. Nikt nie musiał nikogo ścigać.” Pokaż tx w eksploratorze. |
| 8 | Anna, kasa B | karta skarbca „= oszczędności − pożyczone ✓” → **Wypłać** wolne oszczędności | „Każda pożyczka jest w pełni zabezpieczona, więc w skarbcu zawsze są wszystkie wolne oszczędności. Wypłacam swoje teraz, bez pytania kogokolwiek.” |
| 9 | — | „Gdzie znika pośrednik?” | Tabela ról i linki do kodu. „Nie ma klucza admina ani instrukcji, która pozwala nam ruszyć cudze oszczędności.” |

## Pytania jury: krótkie odpowiedzi

- **Gdzie znika pośrednik w kodzie?** `instructions/loan.rs` (wypłata tylko przy 100% zabezpieczenia), `instructions/repay.rs` → `collect_overdue` (egzekucja bez podpisu), `vault.rs` → `pay_out` (jedyna droga wyjścia tokenów).
- **Ktoś znika w połowie?** Pożyczkobiorca: raty schodzą z zabezpieczeń. Poręczyciel: nic nie musi robić, poręczenie odblokuje się po spłacie. Założyciel / my: bez znaczenia.
- **Kto może co? Czy możecie coś zmienić?** Żadna instrukcja nie pozwala zmienić zasad ani ruszyć cudzych oszczędności, także nam. Uczciwie: na devnecie upgrade authority to wciąż nasz klucz deployu, więc moglibyśmy wgrać inny kod. Trzymamy go na czas hackathonu do poprawek; przed prawdziwymi pieniędzmi trafia do multisiga członków albo zostaje usunięty (`--final`). Stan do sprawdzenia: `solana program show EEUF… --url devnet`.
- **Dlaczego blockchain, nie baza?** W bazie pośrednikiem jest ten, kto ją prowadzi. Tak właśnie znikały pieniądze z KZP. Tu saldo to konto programu, zasady to kod, a egzekucję może uruchomić każdy.
- **Kto traci, gdy ktoś nie spłaca?** Tylko poręczyciel, który sam się na to zgodził, maksymalnie do kwoty poręczenia. Kasa nigdy nie traci.
- **Co dalej, gdyby był tydzień?** Automatyczne raty przez delegację tokenów SPL („stałe zlecenie bez banku”), zapomogi z głosowaniem, stablecoin w złotówkach, BLIK, passkeys, bot egzekucyjny.

## Jeśli coś się wysypie

- **RPC 429 / „Problem z RPC devnetu”**: odczekaj 5–10 s, kliknij odśwież. Transakcje są potwierdzane także bez websocketu.
- **„żadna rata nie jest jeszcze zaległa”**: zegar devnetu spóźnia się kilka sekund; poczekaj, aż przycisk pojawi się ponownie.
- **Brak tPLN / SOL**: „Dobierz testowe zł” (limit: raz na 30 s na adres).
