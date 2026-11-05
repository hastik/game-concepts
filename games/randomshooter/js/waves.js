window.RS = window.RS || {};
RS.waves = RS.waves || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function showBanner(text) {
  el.banner.textContent = text;
  el.banner.classList.add("show");
  state.bannerT = 1.6;
}

function emptyLoot() {
  return {
    normal: 0, healer: 0, tank: 0, guidedTank: 0, gainer: 0, mothership: 0,
    rammer: 0, sniper: 0, splitter: 0, cloaker: 0, guidedCloaker: 0,
  };
}

function createWaveStats() {
  return {
    wave: state.wave,
    startedAt: state.time,
    endedAt: null,
    killsByKind: emptyLoot(),
    killCount: 0,
    scoreGained: 0,
    creditsGained: 0,
    lootGained: emptyLoot(),
  };
}

function resetWaveStats() {
  state.waveStats = createWaveStats();
}

function finalizeWaveResults() {
  const ws = state.waveStats || createWaveStats();
  ws.endedAt = state.time;
  ws.wave = state.wave;
  state.lastWaveResults = {
    wave: ws.wave,
    duration: Math.max(0, (ws.endedAt ?? state.time) - ws.startedAt),
    killsByKind: { ...ws.killsByKind },
    killCount: ws.killCount,
    scoreGained: ws.scoreGained,
    creditsGained: ws.creditsGained,
    lootGained: { ...ws.lootGained },
  };
  return state.lastWaveResults;
}

function formatSeconds(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 10) return `${sec.toFixed(2)} s`;
  return `${sec.toFixed(1)} s`;
}

function startWave() {
  const retry = !!state.waveRetryPending;
  if (retry) {
    state.waveRetryPending = false;
    // Keep current wave number (replay after defense target loss)
  } else {
    state.wave += 1;
  }
  state.betweenWaves = 0;
  state.lootVacuum = false;
  state.waveUpgradeDelay = 0;
  state.waveHadTargets = false; // ignore empty map until first spawn arrives
  resetWaveStats();
  RS.camera.syncArenaToWave();
  const gen = ++state.waveGen;
  const w = state.wave;
  let tOffset = 0;
  for (const group of RS.WAVE_RULES.groups) {
    const count = group.count(w);
    const spacing = group.spacing(w);
    for (let i = 0; i < count; i++) {
      const off = tOffset + i * spacing;
      const extraHp = group.extraHp ? group.extraHp(i) : 0;
      const kind = group.kind;
      setTimeout(() => {
        if (!state.running || state.waveGen !== gen) return;
        RS.enemies.spawnTarget(extraHp, kind);
      }, off);
    }
    tOffset += count * spacing;
  }
  RS.sfx.wave();
  showBanner(retry ? `Vlna ${state.wave} — znovu` : `Vlna ${state.wave}`);
  RS.shop.updateShopUI();
}

function jumpToWave(n) {
  const target = Math.max(1, Math.floor(Number(n)) || 1);
  if (!state.running) {
    RS.main.startGame();
  }
  state.debugLevel = false;
  state.waveUpgradePending = false;
  state.waveRetryPending = false;
  state.lootVacuum = false;
  state.waveUpgradeDelay = 0;
  state.targets = [];
  state.particles = [];
  state.creditDrops = [];
  state.defenseTarget = null;
  state.placingDefenseTarget = false;
  state.placingAmplifier = false;
  state.ampActive = false;
  state.betweenWaves = 0;
  state.waveGen += 1;
  state.wave = target - 1;
  RS.shop.setShopOpen(false);
  startWave();
}

  RS.waves.showBanner = showBanner;
  RS.waves.emptyLoot = emptyLoot;
  RS.waves.createWaveStats = createWaveStats;
  RS.waves.resetWaveStats = resetWaveStats;
  RS.waves.finalizeWaveResults = finalizeWaveResults;
  RS.waves.formatSeconds = formatSeconds;
  RS.waves.startWave = startWave;
  RS.waves.jumpToWave = jumpToWave;

  RS.waves.tickEnd = function tickEnd(dt) {
    const state = RS.state;
    if (state.targets.length > 0) state.waveHadTargets = true;

    if (
      state.running &&
      !state.debugLevel &&
      !state.waveUpgradePending &&
      !state.lootVacuum &&
      state.waveUpgradeDelay <= 0 &&
      state.waveHadTargets &&
      state.targets.length === 0 &&
      state.betweenWaves <= 0
    ) {
      state.waveHadTargets = false;
      if (state.waveUpgrades && state.wave >= 1) {
        state.lootVacuum = true;
        state.waveUpgradeDelay = 0;
      } else {
        RS.waves.finalizeWaveResults();
        state.betweenWaves = 1.4;
      }
    }

    if (state.lootVacuum) {
      if (state.creditDrops.length === 0) {
        state.lootVacuum = false;
        state.waveUpgradeDelay = RS.WAVE_UPGRADE_DELAY;
      }
    }

    if (state.waveUpgradeDelay > 0) {
      state.waveUpgradeDelay -= dt;
      if (state.waveUpgradeDelay <= 0) {
        state.waveUpgradeDelay = 0;
        RS.waves.finalizeWaveResults();
        state.waveUpgradePending = true;
        RS.waves.showBanner("Upgrades");
        RS.shop.setShopOpen(true, { tab: "results" });
      }
    }

    if (
      !state.debugLevel &&
      !state.waveUpgradePending &&
      !state.lootVacuum &&
      state.waveUpgradeDelay <= 0 &&
      state.betweenWaves > 0
    ) {
      state.betweenWaves -= dt;
      if (state.betweenWaves <= 0) RS.waves.startWave();
    }
  };

})();
