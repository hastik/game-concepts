# Game Concepts

Katalog jednoduchých herních prototypů v čistém JavaScriptu. Každá hra je samostatný HTML soubor s vloženými CSS a JS.

🎮 **Živý katalog:** https://hastik.github.io/game-concepts/

## Struktura

```
game-concepts/
├── index.html              # Přesměrování na games/
├── .nojekyll              # Pro GitHub Pages
├── games/
│   ├── index.html         # Hlavní katalog her
│   ├── games.json         # Metadata všech her
│   └── <slug>/
│       ├── <slug>.html    # Hlavní herní soubor
│       ├── index.html     # Přesměrování na hlavní soubor
│       ├── game.json      # Metadata hry
│       ├── screenshot.png # Náhled (volitelný)
│       └── README.md      # Popis hry
```

## Přidání nové hry

1. **Vytvoř složku pro hru:**
   ```bash
   mkdir -p games/<slug>
   ```

2. **Vytvoř hlavní herní soubor:**
   - `games/<slug>/<slug>.html` – self-contained HTML+CSS+JS
   - Měl by být kompletní a spustitelný samostatně

3. **Přidej metadata:**
   - Vytvoř `games/<slug>/game.json`:
   ```json
   {
     "slug": "nazev-hry",
     "title": "Název hry",
     "description": "Popis hry v češtině",
     "file": "nazev-hry.html",
     "thumbnail": "screenshot.png",
     "tags": ["tag1", "tag2"],
     "status": "prototyp",
     "created": "YYYY-MM-DD",
     "controls": "Popis ovládání"
   }
   ```

4. **Aktualizuj katalog:**
   - Přidej záznam do `games/games.json`
   - Přidej stejný záznam do pole `GAMES` v `games/index.html` (viz komentář v souboru)

5. **Volitelně:**
   - Přidej `screenshot.png` pro náhled
   - Vytvoř `README.md` s podrobnostmi
   - Vytvoř `index.html` s přesměrováním na hlavní soubor

6. **Commitni a pushni:**
   ```bash
   git add games/<slug>/
   git add games/games.json games/index.html
   git commit -m "Přidána hra: <název>"
   git push
   ```

## Existující hry

- **Cozy Cottage** (`cozy-cottage/`) – Relaxační pixel-art hra v útulné chaloupce

## GitHub Pages

Stránky jsou publikovány z větve `main` na https://hastik.github.io/game-concepts/

Pro aktivaci GitHub Pages:
```bash
gh api -X POST repos/hastik/game-concepts/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

## Licence

Prototypy jsou určeny pro experimentování a učení.
