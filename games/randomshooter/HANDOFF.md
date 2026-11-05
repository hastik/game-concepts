# Random Shooter — handoff

## Layout (file://, no bundler)

```
index.html                 # shell + HUD + classic script tags
css/styles.css
js/config/{arena,upgrades,structures,enemies,waves}.js
js/{state,sfx,camera,combat,enemies,waves,structures,loot,shop,save,render,update,input,main}.js
archive/randomshooter9.html  # original monolith
```

Open via `file://` (double-click `index.html`). Namespace: `window.RS`. No ES modules.

## Stack

- Plain HTML / CSS / JS, Tone.js CDN
- Save key still `randomshooter9_save_v1` (`RS.SAVE_VERSION = 1`)

## What works

- Combat: aim, shot, gravity, laser (multi-target / jumps), shockwaves
- Enemies: normal, healer, tank, gainer, mothership
- Arena / zoom, shop upgrades + structures, loot vacuum → hangar, save/load

## Module map

| Area | Namespace |
|------|-----------|
| Config / stats | `RS.config.*` aliases + `RS.UPGRADE_DEFS` / `RS.ENEMY_DEFS` / `RS.WAVE_RULES` / `RS.stats` |
| State / DOM | `RS.state`, `RS.dom` |
| Systems | `RS.sfx`, `RS.camera`, `RS.combat`, `RS.enemies`, `RS.waves`, `RS.structures`, `RS.loot`, `RS.shop`, `RS.save`, `RS.render` |
| Tick | `RS.update(dt)` → combat / enemies / structures / loot / waves.tickEnd |
| Boot | `RS.main`, `RS.input` |

## Still placeholder

- Tech Tree tab — „připravuje se“
- Typed loot — collected, not spent in shop yet
