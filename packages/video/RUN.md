# Jak wyrenderować trailer na innym komputerze

Działa na macOS, Windows i Linuksie. Potrzebny jest internet (pierwsza instalacja pobiera przeglądarkę do renderu i font Inter).

## 1. Zainstaluj Node.js

Pobierz wersję **LTS (20 lub nowszą)** z https://nodejs.org i zainstaluj. Sprawdź w terminalu:

```bash
node -v    # np. v22.x
npm -v
```

## 2. Skopiuj projekt

Jedna z dwóch dróg:

- **Git:** `git clone https://github.com/jxroo/kasa-bez-zarzadu.git` (działa, gdy folder `packages/video` jest wypchnięty na GitHuba).
- **Pendrive / chmura:** skopiuj folder `packages/video` **bez** podfolderów `node_modules` i `out` (są duże i odtwarzają się same).

## 3. Zainstaluj zależności

```bash
cd kasa-bez-zarzadu/packages/video     # albo tam, gdzie skopiowałeś folder video
npm install
```

## 4. Wyrenderuj

```bash
npm run render
```

- Za pierwszym razem Remotion pobiera Chrome Headless Shell (~100 MB), potem renderuje.
- Gotowy plik: `out/kasa-bez-zarzadu-trailer.mp4` (40 s, 1920×1080, 60 fps, z dźwiękiem).
- Czas: ok. 5–10 min na zwykłym laptopie; postęp widać na bieżąco (`Rendered 1200/2400`).

## Podgląd i edycja

```bash
npm run studio
```

Otwiera się przeglądarka z osią czasu, którą można przewijać. Po zapisaniu pliku podgląd odświeża się sam.

| Co zmienić | Gdzie |
|---|---|
| Napisy i liczby w rozdziałach | `src/trailer/*.tsx` (jeden plik na scenę) |
| Długość i kolejność scen, przejścia | `src/trailer/timeline.ts`, `src/trailer/Trailer.tsx` |
| Dźwięki (które i jak głośno) | `src/trailer/Sfx.tsx`; same pliki generuje `npm run sfx` |
| Kolory, font | `src/theme.ts` |

## Najczęstsze problemy

- **`npm: command not found`**: Node.js nie jest zainstalowany albo terminal był otwarty przed instalacją. Otwórz nowy terminal.
- **Render przerywa się na pobieraniu Chrome**: sprawdź internet i uruchom `npm run render` jeszcze raz.
- **Słaby komputer albo brak pamięci**: zmniejsz liczbę równoległych wątków, np. `npx remotion render KasaTrailer out/kasa-bez-zarzadu-trailer.mp4 --codec=h264 --crf=12 --concurrency=2`.
- **Windows, ścieżka ze spacjami lub polskimi znakami**: przenieś projekt np. do `C:\projekty\kasa-bez-zarzadu`.
