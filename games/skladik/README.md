# Skladík

Útulný skladový clicker: vykládej kamiony, zaskladňuj boxy, pickuj do košíku a expeduj palety. Za kredity najímáš skladníky, rozšiřuješ regály a zrychluješ klik.

Živá hra: https://hastik.github.io/game-concepts/games/skladik/

## Ovládání

- **Klepnutí** na krok v záložce Manual posune jednu jednotku dál v řetězci
- Řetězec: **Kamion → příchozí paleta → box → regál → košík → balík → expedice = kredity**
- Zlatý rámeček = krok, který jde právě kliknout
- Prázdný nebo ucpaný krok se zatřese (plný buffer jen krátce blokuje daný krok)
- Spodní záložky: **Manual**, **Staff**, **Storing**, **Upgrades**, **Úspěchy**
- **M** ztlumí zvuk; dlouhý stisk loga (nebo 7× klepnutí na verzi) otevře skryté nastavení
- Na výšku (portrait); na šířku v malém okně se zobrazí výzva otočit telefon

## Co je implementováno

- Celý ruční řetězec s buffery a kapacitami ze `SETTINGS`
- 5 rolí staffu (idle automatizace), 4 nákupy kapacit, 7 upgradů
- 22 úspěchů s odměnami v kreditech
- Offline progress až 8 hodin (jen staff, ne ruční kliky)
- Autosave do `localStorage` (`skladik.save`)
- WebAudio hudba a SFX, mute, slidery hlasitosti
- Debug: globální rychlost 0.5× / 1× / 2×, export/import save, reset

## Placeholder ilustrace

Ilustrace kroků (kamion, paleta, box, …) jsou **dočasné výřezy** ze schváleného mockupu záložky Manual. Finální kresby dodá výtvarnice; ve hře žijí v objektu `ASSETS`, aby šly vyměnit na jednom místě. UI (karty, dřevo, taby, šipky) je kreslené v CSS.

## Známá omezení

- Žádný pixel-art (schválený vzhled je zářivý kreslený mobilní styl)
- Hudba je jednoduchá generativní smyčka, ne nahraný soundtrack
- Staff nechodí po mapě skladu — jen čísla a automatické ticky
- Částečnou expedici palety umí jen ruční klik; shipper v1 posílá plnou paletu
- Na desktopu je vycentrovaný portrait sloupec, ne landscape layout

## Soubory

- `skladik.html` — celá hra (jeden soubor, offline / `file://`)
- `index.html` — přesměrování na hru
- `game.json` — metadata katalogu
- `screenshot.png` — náhled záložky Manual
