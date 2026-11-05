# Malý magnát

Útulná budovatelská ekonomika v pixel-artu. Postav farmy, mlýn a pekárnu, rozvážej zboží do obchodu a sleduj, jak ti z vajec a chleba roste malé impérium.

## Ovládání

- **Levé tlačítko** — výběr budovy / stavba
- **Tažení** — kreslení silnic nebo demolice
- **Pravé tlačítko / Esc** — zrušit nástroj
- **Kolečko myši** — zoom 1× / 2× / 3× ke kurzoru (výchozí 2×)
- **Pinch dvěma prsty** — zoom ke středu gesta (stejný rozsah 1×–3×)
- **Tažení po prázdné mapě / WASD / šipky** — posun kamery
- **Space** — pauza
- **+ / −** — rychlost času (pauza, 1×, 2×, 4×)
- **R** silnice, **X** demolice, **T** trasy aut, **F** finance
- **1–5** — kategorie stavební lišty
- **M** — ztlumit zvuk
- **Dotyk:** tap = stavba/výběr, tah = posun (u silnice kreslení), pinch = zoom, dlouhý stisk = info o budově

## Co je ve hře

- Mapa 48×32, sezóny, město s 3 sloty pro obchody
- Řetězce: pšenice → mouka → chléb; vejce; mléko (kravín od roku 2)
- Auto-doprava v dosahu 4 dlaždic, silnice + náklaďáky s trasami
- Poptávka, ceny, spokojenost, finance, milníky
- Autosave do `localStorage`, WebAudio hudba/SFX
- Obtížnost Snadná / Normální / Těžká

## Zvolené defaulty (otevřené otázky z art.md)

1. **Zoom výchozí:** 2× všude (desktop i mobil), rozsah 1×–3× po celých krocích; kolečko i pinch ke kurzoru / středu gesta
2. **Stíny budov:** ano — jemná poloprůhledná elipsa pod footprintem, barva `outline` z palety
3. **Město:** 6 domů náhodně, ale deterministicky ze seedu nové hry (uložen v savu); další domy se přistaví při růstu populace stejným seedem. Starý save bez seedu použije pevný fallback
4. **path_\* vs road_\*:** pěšiny jen dekorace; auta jezdí jen po `road_*`
5. **Zimní sníh na střechách:** ano — zimní sprity `<id>_winter` / `<id>_winter_N` přes `MalyMagnatSprites.getBuilding` (žádné tónování); terénní `snow_overlay` ve vrstvě 7
6. **Ikonky ve stavební liště:** skutečné 24×24 `build24_<id>` přes `buildIcon(id)`, kreslené celým číslem ×2 (nebo ×3 na širokém plátně) → 48/72 px; kravín ztlumený a zamčený do roku 2; pořadí podle `BUILD_BAR`
7. **Font:** bitmapový 5×7 pro HUD, čísla, ceny v liště a plovoucí texty; monospace zůstává u delších textů (nápověda, panely)

## Changelog

### 1.1.0

- Výchozí zoom 2× i na mobilu; pinch zoomuje ke středu gesta
- Domy ve městě se rozmístí ze seedu (uložen v savu, fallback pro staré save)
- V zimě sníh na střechách ze zimních spritů (`getBuilding`, bez tónování)
- Stavební lišta se skutečnými ikonami 24×24 (`build24_*`, ×2/×3); kravín zamčený do roku 2
- Bitmapový font 5×7 pro HUD a čísla
- Stíny ověřeny a sjednoceny na barvu palety `outline`

### 1.0.0

- První hratelná verze

## Známá omezení (MVP)

- Editor tras je zjednodušený (klikáním přidáváš zastávky; produkt u skladu výchozí pšenice)
- Generativní hudba je minimalistická pentatonika
- Bitmapový 5×7 font je hutný u některých českých diakritik (ý, ř)
- Konfety / prach jsou krátké sprite efekty bez fyziky
- AI konkurenti, úvěry, více měst, vlaky — mimo rozsah v1 (viz design.md roadmap)
- Bankrot nabízí načtení posledního save, ne speciální kvartální slot UI

## Soubory

- `maly-magnat.html` — celá hra (jeden soubor, offline / file://)
- `index.html` — přesměrování na hru
- `game.json` — metadata katalogu
- `screenshot.png` — náhled
