window.RS = window.RS || {};
RS.save = RS.save || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function clearSave() {
  try { localStorage.removeItem(RS.SAVE_KEY); } catch (_) { /* ignore */ }
}

function buildSavePayload() {
  return {
    version: RS.SAVE_VERSION,
    wave: state.wave,
    credits: state.credits,
    kills: state.kills,
    score: state.score,
    loot: { ...RS.waves.emptyLoot(), ...(state.loot || {}) },
    upgrades: { ...state.upgrades },
    waveUpgrades: !!state.waveUpgrades,
    waveUpgradePending: !!state.waveUpgradePending,
    gravFuel: state.gravFuel,
    laserFuel: state.laserFuel,
    targetSizePct: state.targetSizePct,
    structures: state.structures.map((s) => ({
      kind: s.kind,
      x: s.x,
      y: s.y,
      size: s.size,
      range: s.range,
    })),
    savedAt: Date.now(),
  };
}

function validateSavePayload(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Save je prázdný nebo poškozený.");
  }
  if (data.version !== RS.SAVE_VERSION) {
    throw new Error(
      `Nekompatibilní verze save (uloženo: ${data.version ?? "?"}, aktuální: ${RS.SAVE_VERSION}). Save byl smazán.`
    );
  }
  if (typeof data.wave !== "number" || !Number.isFinite(data.wave) || data.wave < 0) {
    throw new Error("Neplatné číslo vlny. Save byl smazán.");
  }
  if (typeof data.credits !== "number" || typeof data.kills !== "number") {
    throw new Error("Neplatná herní data. Save byl smazán.");
  }
  if (!data.upgrades || typeof data.upgrades !== "object") {
    throw new Error("Chybí upgrady. Save byl smazán.");
  }
  for (const key of Object.keys(RS.UPGRADE_DEFS)) {
    const def = RS.UPGRADE_DEFS[key];
    let lv = data.upgrades[key];
    // New upgrades missing from older saves → default start level
    if (lv === undefined || lv === null) {
      data.upgrades[key] = def.startLevel;
      continue;
    }
    if (typeof lv !== "number" || !Number.isFinite(lv) || lv < 0 || lv > def.max) {
      throw new Error(`Neplatný upgrade „${key}“. Save byl smazán.`);
    }
  }
  return data;
}

function saveGame() {
  try {
    if (!state.running) {
      RS.shop.showMsgPopup("Save", "Nejdřív spusť hru, teprve potom ukládej.");
      return;
    }
    const payload = buildSavePayload();
    localStorage.setItem(RS.SAVE_KEY, JSON.stringify(payload));
    RS.waves.showBanner("Uloženo");
    RS.sfx.buy();
  } catch (err) {
    RS.shop.showMsgPopup("Save selhal", err && err.message ? err.message : "Nepodařilo se zapsat do localStorage.");
  }
}

function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(RS.SAVE_KEY);
  } catch (err) {
    RS.shop.showMsgPopup("Load selhal", "Nelze číst localStorage.");
    return;
  }
  if (!raw) {
    RS.shop.showMsgPopup("Load", "Žádný uložený save.");
    return;
  }

  let data;
  try {
    data = validateSavePayload(JSON.parse(raw));
  } catch (err) {
    clearSave();
    RS.shop.showMsgPopup("Load selhal", err && err.message ? err.message : "Neplatný save. Byl smazán.");
    return;
  }

  try {
    applySavePayload(data);
    RS.waves.showBanner(`Načteno · Vlna ${Math.max(1, state.wave)}`);
    RS.sfx.boot();
  } catch (err) {
    clearSave();
    RS.shop.showMsgPopup("Load selhal", (err && err.message ? err.message : "Chyba při načtení") + " Save byl smazán.");
  }
}

function applySavePayload(data) {
  RS.sfx.unlock();
  RS.sfx.stopAllLoops();
  state.running = true;
  state.debugLevel = false;
  state.waveUpgradePending = false;
  state.lootVacuum = false;
  state.waveUpgradeDelay = 0;
  state.waveGen += 1;
  state.targets = [];
  state.particles = [];
  state.creditDrops = [];
  state.flashes = [];
  state.laserBeams = [];
  state.healBeams = [];
  state.shieldBeams = [];
  state.structureBeams = [];
  state.shockwaves = [];
  state.laserWaves = [];
  state.enemyProjectiles = [];
  state.autoLaserRays = [];
  state.placingStructure = null;
  state.placingDefenseTarget = false;
  state.defenseTarget = null;
  state.placingAmplifier = false;
  state.amplifier = null;
  state.ampActive = false;
  state.waveRetryPending = false;
  state.reopenStructuresAfterPlace = false;
  RS.structures.setPlaceBanner(false);
  RS.combat.clearButtons();
  state.gravityOn = false;
  state.laserOn = false;
  state.shooting = false;

  state.structures = Array.isArray(data.structures)
    ? data.structures
        .filter((s) => s && RS.STRUCTURE_DEFS[s.kind])
        .map((s) => ({
          id: `load_${s.kind}_${Math.random().toString(36).slice(2, 7)}`,
          kind: s.kind,
          x: s.x,
          y: s.y,
          size: s.size || RS.STRUCTURE_DEFS[s.kind].size,
          range: s.range || RS.STRUCTURE_DEFS[s.kind].range,
          pulse: RS.enemies.rand(0, Math.PI * 2),
          birth: 0,
        }))
    : [];

  state.wave = Math.floor(data.wave);
  state.credits = data.credits;
  state.kills = data.kills;
  state.score = typeof data.score === "number" ? data.score : data.kills;
  state.loot = { ...RS.waves.emptyLoot(), ...(data.loot || {}) };
  state.upgrades = { ...state.upgrades, ...data.upgrades };
  state.waveUpgrades = !!data.waveUpgrades;
  if (el.waveUpgradesToggle) {
    el.waveUpgradesToggle.checked = state.waveUpgrades;
    if (el.waveUpgradesLabel) {
      el.waveUpgradesLabel.classList.toggle("on", state.waveUpgrades);
    }
  }
  state.gravFuel = typeof data.gravFuel === "number" ? data.gravFuel : 1;
  state.laserFuel = typeof data.laserFuel === "number" ? data.laserFuel : 1;
  if (typeof data.targetSizePct === "number") {
    state.targetSizePct = data.targetSizePct;
    const label = document.getElementById("debugSizeValue");
    if (label) label.textContent = `${Math.round(state.targetSizePct)}%`;
  }

  state.cooldown = 0;
  state.waveCooldown = 0;
  state.laserWaveCooldown = 0;
  state.betweenWaves = 0;
  state.waveHadTargets = false;
  state.aim.x = state.mouse.x;
  state.aim.y = state.mouse.y;

  el.overlay.classList.add("hidden");
  RS.shop.hideMsgPopup();
  RS.shop.setShopOpen(false);
  RS.camera.syncArenaToWave();
  RS.loot.updateLootHud();
  RS.shop.updateShopUI();

  if (data.waveUpgradePending && state.wave >= 1) {
    state.waveUpgradePending = true;
    RS.waves.showBanner("Upgrades");
    RS.shop.setShopOpen(true);
  } else if (state.wave < 1) {
    state.betweenWaves = 0.6;
  } else {
    // Resume the saved wave (startWave increments, so step back one)
    state.wave = Math.max(0, state.wave - 1);
    state.betweenWaves = 0.45;
  }
}

  RS.save.clearSave = clearSave;
  RS.save.buildSavePayload = buildSavePayload;
  RS.save.validateSavePayload = validateSavePayload;
  RS.save.saveGame = saveGame;
  RS.save.loadGame = loadGame;
  RS.save.applySavePayload = applySavePayload;

})();
