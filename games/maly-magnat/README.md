# Malý magnát

Útulná budovatelská ekonomika v pixel-artu. Postav farmy, mlýn a pekárnu, rozvážej zboží do obchodu a sleduj, jak ti z vajec a chleba roste malé impérium.

## Ovládání

- **Levé tlačítko** — výběr budovy / stavba
- **Tažení** — kreslení silnic nebo demolice
- **Pravé tlačítko / Esc** — zrušit nástroj
- **Kolečko myši** — zoom 1× / 2× / 3×
- **Tažení po prázdné mapě / WASD / šipky** — posun kamery
- **Space** — pauza
- **+ / −** — rychlost času (pauza, 1×, 2×, 4×)
- **R** silnice, **X** demolice, **T** trasy aut, **F** finance
- **1–5** — kategorie stavební lišty
- **M** — ztlumit zvuk
- **Dotyk:** tap = stavba/výběr, tah = posun (u silnice kreslení), pinch = zoom, dlouhý stisk = info o budově

## Co je ve hře

- Mapa 48×32, sezóny, město s 3 sloty pro obchody
- Řetězce: pšenice → mouka → chléb; vejce; mléko (odemčení milníkem)
- Auto-doprava v dosahu 4 dlaždic, silnice + náklaďáky s trasami
- Poptávka, ceny, spokojenost, finance, milníky
- Autosave do `localStorage`, WebAudio hudba/SFX
- Obtížnost Snadná / Normální / Těžká

## Zvolené defaulty (otevřené otázky z art.md)

1. **Zoom výchozí:** 2× na desktopu (1× na úzkém mobilu)
2. **Stíny budov:** ano — jednoduchý eliptický stín pod footprintem
3. **Město:** pevný layout 8×8, další domy se přistaví při růstu populace
4. **path_\* vs road_\*:** pěšiny jen dekorace; auta jezdí jen po `road_*`
5. **Zimní sníh na střechách:** ne — jen `snow_overlay` na terénu
6. **Ikonky ve stavební liště:** textové tlačítka s názvem a cenou (sprity budov na mapě)
7. **Font:** systémový monospace

## Známá omezení (MVP)

- Editor tras je zjednodušený (klikáním přidáváš zastávky; produkt u skladu výchozí pšenice)
- Generativní hudba je minimalistická pentatonika
- Žádný pinch-zoom gesture feedback mimo změnu zoomu
- Konfety / prach jsou krátké sprite efekty bez fyziky
- AI konkurenti, úvěry, více měst, vlaky — mimo rozsah v1 (viz design.md roadmap)
- Bankrot nabízí načtení posledního save, ne speciální kvartální slot UI

## Soubory

- `maly-magnat.html` — celá hra (jeden soubor, offline / file://)
- `index.html` — přesměrování na hru
- `game.json` — metadata katalogu
- `screenshot.png` — náhled
