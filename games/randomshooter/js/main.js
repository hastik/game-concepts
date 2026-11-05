window.RS = window.RS || {};
RS.main = RS.main || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;

function startGame() {
  RS.sfx.unlock();
  RS.sfx.stopAllLoops();
  state.running = true;
  state.score = 0;
  state.kills = 0;
  state.credits = 0;
  state.wave = 0;
  state.waveGen += 1;
  state.debugLevel = false;
  state.waveUpgradePending = false;
  state.lootVacuum = false;
  state.waveUpgradeDelay = 0;
  state.waveUpgrades = !!(el.waveUpgradesToggle && el.waveUpgradesToggle.checked);
  state.targets = [];
  state.structures = [];
  state.structureBeams = [];
  state.placingStructure = null;
  state.placingDefenseTarget = false;
  state.defenseTarget = null;
  state.placingAmplifier = false;
  state.amplifier = null;
  state.ampActive = false;
  state.waveRetryPending = false;
  state.reopenStructuresAfterPlace = false;
  state.skipWaveStartOnShopClose = false;
  RS.structures.setPlaceBanner(false);
  state.particles = [];
  state.creditDrops = [];
  state.loot = RS.waves.emptyLoot();
  state.flashes = [];
  state.laserBeams = [];
  state.healBeams = [];
  state.shieldBeams = [];
  state.shockwaves = [];
  state.laserWaves = [];
  state.enemyProjectiles = [];
  state.upgrades = {
    aimSpeed: 1,
    power: 1, reload: 1, width: 1, pierce: 0, headshotChance: 0,
    gravRadius: 1, gravPull: 1, gravRegen: 1,
    laserPower: 1, laserTargets: 1, laserJumps: 0,
    freezeTime: 1,
    autoLaserBeams: 0, autoLaserPower: 1, autoLaserRadius: 1,
  };
  state.autoLaserRays = [];
  state.cooldown = 0;
  state.gravFuel = 1;
  state.laserFuel = 1;
  state.waveCooldown = 0;
  state.laserWaveCooldown = 0;
  RS.combat.clearButtons();
  state.gravityOn = false;
  state.laserOn = false;
  state.aim.x = state.mouse.x;
  state.aim.y = state.mouse.y;
  RS.shop.setShopOpen(false);
  // Prevent RS.shop.setShopOpen(false) from starting a wave via pending flag (already cleared)
  RS.camera.syncArenaToWave();
  state.betweenWaves = 0.6;
  el.overlay.classList.add("hidden");
  RS.loot.updateLootHud();
  RS.shop.updateShopUI();
  RS.sfx.boot();
  RS.waves.showBanner("Připrav se");
}

  let last = performance.now();
  let fpsFrames = 0;
  let fpsAcc = 0;
  const fpsEl = document.getElementById("debugFpsValue");

  function loop(now) {
    const realDt = Math.min(0.033, (now - last) / 1000);
    last = now;

    fpsFrames += 1;
    fpsAcc += realDt;
    if (fpsAcc >= 0.25 && fpsEl) {
      const fps = Math.round(fpsFrames / fpsAcc);
      fpsEl.textContent = String(fps);
      fpsFrames = 0;
      fpsAcc = 0;
    }

    let gameDt = realDt;
    if (state.bulletTimeLeft > 0) {
      gameDt = realDt * RS.BULLET_TIME_SCALE;
    }

    const shopOpen = RS.shop.isShopOpen() || RS.shop.isMsgPopupOpen();
    const hasWaveFx =
      state.shockwaves.length > 0 || state.laserWaves.length > 0;
    if (!shopOpen || hasWaveFx) {
      RS.combat.updateWaveVisuals(gameDt);
    }
    if (state.running && !shopOpen) RS.update(gameDt);

    if (state.bulletTimeLeft > 0) {
      state.bulletTimeLeft = Math.max(0, state.bulletTimeLeft - gameDt);
    }

    RS.render.draw();
    requestAnimationFrame(loop);
  }

  function readWaveInput() {
    const waveInput = document.getElementById("debugWaveInput");
    return Math.max(1, Math.floor(Number(waveInput.value)) || 1);
  }

  RS.main.startGame = startGame;
  RS.main.loop = loop;
  RS.main.readWaveInput = readWaveInput;

  function boot() {
    RS.shop.buildShopUI();
    RS.input.bind();

    // Shop open/close + tabs (wired after buildShopUI)
    if (el.upgradesBtn) {
      el.upgradesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.shop.toggleShop();
      });
    }
    if (el.shopClose) {
      el.shopClose.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.shop.setShopOpen(false);
      });
    }
    if (el.shopBackdrop) {
      el.shopBackdrop.addEventListener("click", (e) => {
        if (e.target === el.shopBackdrop) RS.shop.setShopOpen(false);
      });
    }
    document.querySelectorAll(".shop-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.shop.setShopTab(tab.dataset.tab);
      });
    });

    el.startBtn.addEventListener("click", startGame);

    el.shop.addEventListener("mousedown", (e) => e.stopPropagation());
    el.shop.addEventListener("mouseup", (e) => e.stopPropagation());
    el.shop.addEventListener("click", (e) => e.stopPropagation());

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (state.placingStructure) {
          e.preventDefault();
          RS.structures.cancelPlaceStructure(true);
          return;
        }
        if (state.placingDefenseTarget) {
          e.preventDefault();
          RS.tools.cancelAddTarget();
          return;
        }
        if (state.placingAmplifier) {
          e.preventDefault();
          RS.tools.cancelAddAmplifier();
          return;
        }
        if (RS.shop.isShopOpen()) RS.shop.setShopOpen(false);
        if (RS.shop.isMsgPopupOpen()) RS.shop.hideMsgPopup();
      }
    });

    const toolsMenu = document.getElementById("tools-menu");
    if (toolsMenu) {
      toolsMenu.addEventListener("mousedown", (e) => e.stopPropagation());
      toolsMenu.addEventListener("mouseup", (e) => e.stopPropagation());
      toolsMenu.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    const btnAddTarget = document.getElementById("btn-add-target");
    if (btnAddTarget) {
      btnAddTarget.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.tools.beginAddTarget();
      });
    }
    const btnAddAmplifier = document.getElementById("btn-add-amplifier");
    if (btnAddAmplifier) {
      btnAddAmplifier.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.tools.beginAddAmplifier();
      });
    }

    const btnLaserMode = document.getElementById("btn-laser-mode");
    function syncLaserModeBtn() {
      if (!btnLaserMode) return;
      const mode = state.laserMode === "laser" ? "laser" : "beam";
      state.laserMode = mode;
      btnLaserMode.textContent = mode === "laser" ? "LaserMode: Laser" : "LaserMode: Beam";
      btnLaserMode.classList.toggle("mode-laser", mode === "laser");
    }
    syncLaserModeBtn();
    if (btnLaserMode) {
      btnLaserMode.addEventListener("mousedown", (e) => e.stopPropagation());
      btnLaserMode.addEventListener("pointerdown", (e) => e.stopPropagation());
      btnLaserMode.addEventListener("click", (e) => {
        e.stopPropagation();
        state.laserMode = state.laserMode === "laser" ? "beam" : "laser";
        syncLaserModeBtn();
        RS.waves.showBanner(state.laserMode === "laser" ? "Laser mode" : "Beam mode");
      });
    }

    if (el.btnSave) {
      el.btnSave.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.save.saveGame();
      });
    }
    if (el.btnLoad) {
      el.btnLoad.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.save.loadGame();
      });
    }
    if (el.msgPopupOk) {
      el.msgPopupOk.addEventListener("click", (e) => {
        e.stopPropagation();
        RS.shop.hideMsgPopup();
      });
    }
    if (el.msgPopup) {
      el.msgPopup.addEventListener("click", (e) => {
        if (e.target === el.msgPopup) RS.shop.hideMsgPopup();
      });
    }

    if (el.waveUpgradesToggle && el.waveUpgradesLabel) {
      const syncWaveUpgradesToggle = () => {
        el.waveUpgradesLabel.classList.toggle("on", el.waveUpgradesToggle.checked);
        state.waveUpgrades = el.waveUpgradesToggle.checked;
      };
      el.waveUpgradesToggle.addEventListener("change", syncWaveUpgradesToggle);
      syncWaveUpgradesToggle();
    }

    const debugBar = document.getElementById("debug-bar");
    debugBar.addEventListener("mousedown", (e) => e.stopPropagation());
    debugBar.addEventListener("mouseup", (e) => e.stopPropagation());
    debugBar.addEventListener("pointerdown", (e) => e.stopPropagation());

    document.getElementById("debugCredits").addEventListener("click", (e) => {
      e.stopPropagation();
      state.credits += 1000;
      RS.shop.updateShopUI();
    });

    document.getElementById("debugMaxUpgrades").addEventListener("click", (e) => {
      e.stopPropagation();
      for (const key of Object.keys(RS.UPGRADE_DEFS)) {
        state.upgrades[key] = RS.UPGRADE_DEFS[key].max;
      }
      RS.shop.updateShopUI();
    });

    document.getElementById("debugLevel").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.enemies.startDebugLevel();
    });

    const waveInput = document.getElementById("debugWaveInput");
    document.getElementById("debugWaveGo").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.waves.jumpToWave(readWaveInput());
    });
    document.getElementById("debugWavePrev").addEventListener("click", (e) => {
      e.stopPropagation();
      const n = Math.max(1, (state.wave || 1) - 1);
      waveInput.value = String(n);
      RS.waves.jumpToWave(n);
    });
    document.getElementById("debugWaveNext").addEventListener("click", (e) => {
      e.stopPropagation();
      const n = Math.max(1, (state.wave || 0) + 1);
      waveInput.value = String(n);
      RS.waves.jumpToWave(n);
    });
    waveInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        RS.waves.jumpToWave(readWaveInput());
      }
    });
    waveInput.addEventListener("click", (e) => e.stopPropagation());

    document.getElementById("debugSizePrev").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.enemies.setTargetSizePct(state.targetSizePct - 10);
    });
    document.getElementById("debugSizeNext").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.enemies.setTargetSizePct(state.targetSizePct + 10);
    });

    document.getElementById("debugZoomPrev").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.camera.setZoomPct(Math.round(state.zoom * 100) - 10);
    });
    document.getElementById("debugZoomNext").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.camera.setZoomPct(Math.round(state.zoom * 100) + 10);
    });

    const blurEl = document.getElementById("debugBlurValue");
    const aiMsEl = document.getElementById("debugAiMsValue");
    function syncPerfHud() {
      if (blurEl) blurEl.textContent = RS.perf.formatBlur(state.perf.blurMul);
      if (aiMsEl) aiMsEl.textContent = String(state.perf.aiRetargetMs);
    }
    syncPerfHud();
    document.getElementById("debugBlurPrev").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.perf.setBlurMul(state.perf.blurMul - 0.25);
      syncPerfHud();
    });
    document.getElementById("debugBlurNext").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.perf.setBlurMul(state.perf.blurMul + 0.25);
      syncPerfHud();
    });
    document.getElementById("debugAiMsPrev").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.perf.setAiRetargetMs(state.perf.aiRetargetMs - 25);
      syncPerfHud();
    });
    document.getElementById("debugAiMsNext").addEventListener("click", (e) => {
      e.stopPropagation();
      RS.perf.setAiRetargetMs(state.perf.aiRetargetMs + 25);
      syncPerfHud();
    });

    const debugRevealToggle = document.getElementById("debugReveal");
    const debugRevealLabel = document.getElementById("debugRevealLabel");
    if (debugRevealToggle) {
      debugRevealToggle.addEventListener("change", () => {
        state.debugReveal = !!debugRevealToggle.checked;
        if (debugRevealLabel) debugRevealLabel.classList.toggle("on", state.debugReveal);
      });
      debugRevealToggle.addEventListener("click", (e) => e.stopPropagation());
    }

    const bulletTimeToggle = document.getElementById("debugBulletTime");
    const bulletTimeLabel = document.getElementById("debugBulletTimeLabel");
    bulletTimeToggle.addEventListener("change", () => {
      state.bulletTimeEffect = bulletTimeToggle.checked;
      bulletTimeLabel.classList.toggle("on", state.bulletTimeEffect);
      if (!state.bulletTimeEffect) state.bulletTimeLeft = 0;
    });
    bulletTimeToggle.addEventListener("click", (e) => e.stopPropagation());

    const muteToggle = document.getElementById("debugMute");
    const muteLabel = document.getElementById("debugMuteLabel");
    muteToggle.addEventListener("change", () => {
      muteLabel.classList.toggle("on", muteToggle.checked);
      if (muteToggle.checked) {
        RS.sfx.setMuted(true);
      } else {
        RS.sfx.unlock().then(() => RS.sfx.setMuted(false));
      }
    });
    muteToggle.addEventListener("click", (e) => e.stopPropagation());

    RS.camera.resize();
    RS.shop.updateShopUI();
    RS.loot.updateLootHud();
    RS.camera.updateZoomHud();
    state.mouse.x = state.w / 2;
    state.mouse.y = state.h / 2;
    state.aim.x = state.w / 2;
    state.aim.y = state.h / 2;
    requestAnimationFrame(loop);
  }

  boot();
})();
