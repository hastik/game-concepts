window.RS = window.RS || {};
RS.tools = RS.tools || {};

(function () {
  const state = RS.state;

  function anyPlacing() {
    return !!(state.placingStructure || state.placingDefenseTarget || state.placingAmplifier);
  }

  function setPlaceBanner(show, text) {
    const b = document.getElementById("place-banner");
    if (!b) return;
    if (text) b.textContent = text;
    b.classList.toggle("show", !!show);
    if (!show) {
      b.textContent = "Umísti strukturu · LMB potvrdit · Esc zrušit";
    }
  }

  function beginAddTarget() {
    if (!state.running) {
      RS.sfx.deny();
      RS.shop.showMsgPopup("Add target", "Nejdřív spusť hru (Inicializovat).");
      return;
    }
    if (anyPlacing()) {
      RS.sfx.deny();
      return;
    }
    state.placingDefenseTarget = true;
    RS.combat.clearButtons();
    setPlaceBanner(true, "Umísti Target · LMB potvrdit · Esc zrušit");
    RS.waves.showBanner("Add target");
    RS.sfx.buy();
  }

  function cancelAddTarget() {
    if (!state.placingDefenseTarget) return;
    state.placingDefenseTarget = false;
    setPlaceBanner(false);
  }

  function placeTargetAt(wx, wy) {
    if (!state.placingDefenseTarget) return;
    const def = RS.DEFENSE_TARGET;
    const pad = def.size * 0.55;
    const x = Math.max(pad, Math.min(state.arenaW - pad, wx));
    const y = Math.max(pad, Math.min(state.arenaH - pad, wy));
    const maxHp = def.maxHp(Math.max(1, state.wave || 1));
    state.defenseTarget = {
      x, y,
      size: def.size,
      hp: maxHp,
      maxHp,
      pulse: 0,
      hitFlash: 0,
    };
    state.placingDefenseTarget = false;
    setPlaceBanner(false);
    RS.combat.burst(x, y, def.color, 18);
    RS.sfx.wave();
    RS.waves.showBanner("Target online");
    RS.enemies.spawnRammersForTarget();
  }

  function destroyDefenseTarget() {
    const t = state.defenseTarget;
    if (!t) return;
    const x = t.x;
    const y = t.y;
    state.defenseTarget = null;
    state.enemyProjectiles = [];

    // Cancel pending spawns and wipe enemies — wave ends
    state.waveGen += 1;
    state.targets = [];
    state.betweenWaves = 0;
    state.debugLevel = false;
    state.waveHadTargets = false;
    state.waveRetryPending = true;

    RS.combat.burst(x, y, "#ff4466", 36);
    RS.combat.burst(x, y, "#ffe066", 18);
    RS.sfx.deny();
    RS.waves.showBanner("Target zničen");

    if (state.waveUpgrades && state.wave >= 1) {
      state.lootVacuum = true;
      state.waveUpgradeDelay = 0;
      state.waveUpgradePending = false;
    } else {
      RS.waves.finalizeWaveResults();
      state.betweenWaves = 1.4;
    }
  }

  function beginAddAmplifier() {
    if (!state.running) {
      RS.sfx.deny();
      RS.shop.showMsgPopup("Add Amplifier", "Nejdřív spusť hru (Inicializovat).");
      return;
    }
    if (anyPlacing()) {
      RS.sfx.deny();
      return;
    }
    state.placingAmplifier = true;
    RS.combat.clearButtons();
    setPlaceBanner(true, "Umísti Amplifier · LMB potvrdit · Esc zrušit");
    RS.waves.showBanner("Add Amplifier");
    RS.sfx.buy();
  }

  function cancelAddAmplifier() {
    if (!state.placingAmplifier) return;
    state.placingAmplifier = false;
    setPlaceBanner(false);
  }

  function placeAmplifierAt(wx, wy) {
    if (!state.placingAmplifier) return;
    const def = RS.AMPLIFIER;
    const pad = def.size * 0.55;
    const x = Math.max(pad, Math.min(state.arenaW - pad, wx));
    const y = Math.max(pad, Math.min(state.arenaH - pad, wy));
    state.amplifier = {
      x, y,
      size: def.size,
      pulse: 0,
    };
    state.placingAmplifier = false;
    setPlaceBanner(false);
    RS.combat.burst(x, y, def.color, 18);
    RS.sfx.wave();
    RS.waves.showBanner("Amplifier online");
  }

  function tick(dt) {
    const obj = state.defenseTarget;
    if (obj) {
      obj.pulse = (obj.pulse || 0) + dt * 2.4;
      if (obj.hitFlash > 0) obj.hitFlash = Math.max(0, obj.hitFlash - dt);

      const dps = RS.DEFENSE_TARGET.contactDps;
      const objR = obj.size * 0.5;
      let touching = false;
      for (const e of state.targets) {
        if (e.dead) continue;
        // Rammers explode on contact in enemies.tick — skip soft DPS
        if (e.kind === "rammer") continue;
        const er = RS.enemies.targetHitRadius(e);
        const d = Math.hypot(e.x - obj.x, e.y - obj.y);
        if (d < objR + er) {
          touching = true;
          obj.hp -= dps * dt;
        }
      }
      if (touching) obj.hitFlash = Math.max(obj.hitFlash, 0.12);

      if (obj.hp <= 0) {
        obj.hp = 0;
        destroyDefenseTarget();
      }
    }

    const amp = state.amplifier;
    if (amp) {
      amp.pulse = (amp.pulse || 0) + dt * (state.ampActive ? 4.2 : 2.2);
    }
  }

  function drawDefenseTarget(ctx) {
    const obj = state.defenseTarget;
    if (!obj) return;
    const def = RS.DEFENSE_TARGET;
    const flash = obj.hitFlash > 0 ? 1 : 0;
    const pulse = 0.85 + Math.sin(obj.pulse) * 0.15;
    const ratio = Math.max(0, obj.hp / obj.maxHp);

    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.shadowColor = flash ? "#ff4466" : def.color;
    RS.perf.applyBlur(ctx, 14 + flash * 10);

    // Outer ring
    ctx.beginPath();
    ctx.strokeStyle = flash ? "#ff6688" : def.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = pulse;
    ctx.arc(0, 0, obj.size * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Diamond core
    const s = obj.size * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fillStyle = flash ? "rgba(255,68,102,0.45)" : "rgba(255,210,74,0.35)";
    ctx.fill();
    ctx.strokeStyle = "#fff6c8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // HP bar
    const bw = obj.size * 0.9;
    const bh = 5;
    const by = obj.size * 0.55 + 6;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-bw / 2, by, bw, bh);
    ctx.fillStyle = ratio > 0.35 ? def.color : "#ff4466";
    ctx.fillRect(-bw / 2, by, bw * ratio, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, by, bw, bh);

    ctx.restore();
  }

  function drawAmplifier(ctx) {
    const amp = state.amplifier;
    if (!amp) return;
    const def = RS.AMPLIFIER;
    const active = !!state.ampActive;
    const pulse = 0.82 + Math.sin(amp.pulse) * (active ? 0.18 : 0.12);
    const r = amp.size * 0.5;

    ctx.save();
    ctx.translate(amp.x, amp.y);
    ctx.shadowColor = def.color;
    RS.perf.applyBlur(ctx, active ? 18 : 10);

    // Soft fill when active
    if (active) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(93,255,154,0.28)");
      g.addColorStop(1, "rgba(93,255,154,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner hex
    const hr = r * 0.55;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + amp.pulse * 0.15;
      const px = Math.cos(a) * hr;
      const py = Math.sin(a) * hr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = active ? "rgba(93,255,154,0.35)" : "rgba(93,255,154,0.15)";
    ctx.fill();
    ctx.strokeStyle = "#e8ffe8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = active ? "#ffffff" : "rgba(232,255,232,0.85)";
    ctx.font = `bold ${Math.round(r * 0.42)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×" + (def.mul || 2), 0, 1);

    ctx.restore();
  }

  function draw(ctx) {
    drawDefenseTarget(ctx);
    drawAmplifier(ctx);
  }

  function drawGhost(ctx) {
    if (state.placingDefenseTarget) {
      const mw = RS.camera.screenToWorld(state.mouse.x, state.mouse.y);
      const def = RS.DEFENSE_TARGET;
      ctx.save();
      ctx.translate(mw.x, mw.y);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, def.size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      const s = def.size * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (!state.placingAmplifier) return;
    const mw = RS.camera.screenToWorld(state.mouse.x, state.mouse.y);
    const def = RS.AMPLIFIER;
    const r = def.size * 0.5;
    ctx.save();
    ctx.translate(mw.x, mw.y);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    const hr = r * 0.55;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * hr;
      const py = Math.sin(a) * hr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font = `bold ${Math.round(r * 0.42)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×" + (def.mul || 2), 0, 1);
    ctx.restore();
  }

  RS.tools.beginAddTarget = beginAddTarget;
  RS.tools.cancelAddTarget = cancelAddTarget;
  RS.tools.placeTargetAt = placeTargetAt;
  RS.tools.destroyDefenseTarget = destroyDefenseTarget;
  RS.tools.beginAddAmplifier = beginAddAmplifier;
  RS.tools.cancelAddAmplifier = cancelAddAmplifier;
  RS.tools.placeAmplifierAt = placeAmplifierAt;
  RS.tools.tick = tick;
  RS.tools.draw = draw;
  RS.tools.drawGhost = drawGhost;
  RS.tools.setPlaceBanner = setPlaceBanner;
})();
