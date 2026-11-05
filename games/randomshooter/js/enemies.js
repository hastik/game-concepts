window.RS = window.RS || {};
RS.enemies = RS.enemies || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function rand(a, b) { return a + Math.random() * (b - a); }

function pickEdge() {
  const side = Math.floor(Math.random() * 4);
  const margin = 40;
  const aw = state.arenaW;
  const ah = state.arenaH;
  if (side === 0) return { x: rand(margin, aw - margin), y: -margin, vx: rand(-40, 40), vy: rand(80, 180) };
  if (side === 1) return { x: aw + margin, y: rand(margin, ah - margin), vx: rand(-180, -80), vy: rand(-40, 40) };
  if (side === 2) return { x: rand(margin, aw - margin), y: ah + margin, vx: rand(-40, 40), vy: rand(-180, -80) };
  return { x: -margin, y: rand(margin, ah - margin), vx: rand(80, 180), vy: rand(-40, 40) };
}

function pickOnScreen(pad = 100) {
  const x = rand(pad, Math.max(pad + 1, state.arenaW - pad));
  const y = rand(pad, Math.max(pad + 1, state.arenaH - pad));
  return { x, y, vx: rand(-28, 28), vy: rand(-22, 22) };
}

function targetHitRadius(t) {
  if (t.kind === "mothership" && t.sizeW && t.sizeH) {
    return Math.hypot(t.sizeW, t.sizeH) * 0.42;
  }
  return t.size * 0.55;
}

function isGuided(tOrKind) {
  const kind = typeof tOrKind === "string" ? tOrKind : (tOrKind && tOrKind.kind);
  const def = RS.ENEMY_DEFS[kind];
  return !!(def && def.guided);
}

function isCloakerKind(tOrKind) {
  const kind = typeof tOrKind === "string" ? tOrKind : (tOrKind && tOrKind.kind);
  return kind === "cloaker" || kind === "guidedCloaker";
}

/** Visible when Debug is on, or while shockwave-stunned. */
function isCloakerRevealed(t) {
  if (!t || !isCloakerKind(t)) return true;
  return !!(state.debugReveal || t.freezeLeft > 0);
}

/** Highest-priority living ally for GuidedCloaker escort. */
function findEscortTarget(self, priority) {
  let best = null;
  let bestPri = Infinity;
  let bestDist = Infinity;
  for (const o of state.targets) {
    if (o.dead || o === self) continue;
    const pri = priority.indexOf(o.kind);
    if (pri < 0) continue;
    const d = Math.hypot(o.x - self.x, o.y - self.y);
    if (pri < bestPri || (pri === bestPri && d < bestDist)) {
      bestPri = pri;
      bestDist = d;
      best = o;
    }
  }
  return best;
}

function targetSizeMul() {
  return state.targetSizePct / 100;
}

function setTargetSizePct(pct) {
  const next = Math.max(10, Math.min(500, Math.round(pct)));
  const prev = state.targetSizePct || 100;
  if (next === prev) return;
  const ratio = next / prev;
  state.targetSizePct = next;
  for (const t of state.targets) {
    t.size *= ratio;
    if (t.sizeW) t.sizeW *= ratio;
    if (t.sizeH) t.sizeH *= ratio;
  }
  const label = document.getElementById("debugSizeValue");
  if (label) label.textContent = `${next}%`;
}

function healerCountForWave(wave) {
  return RS.ENEMY_DEFS.healer.countForWave(wave);
}

function healerSpeedMul(wave) {
  return RS.ENEMY_DEFS.healer.speedMul(wave);
}

function healerHealRate(wave) {
  return RS.ENEMY_DEFS.healer.healRate(wave);
}

function healerBeamRange(wave) {
  return RS.ENEMY_DEFS.healer.beamRange(wave);
}

function tankCountForWave(wave) {
  return RS.ENEMY_DEFS.tank.countForWave(wave);
}

function tankSpeedMul(wave) {
  return RS.ENEMY_DEFS.tank.speedMul(wave);
}

function gainerCountForWave(wave) {
  return RS.ENEMY_DEFS.gainer.countForWave(wave);
}

function gainerSpeedMul(wave) {
  return RS.ENEMY_DEFS.gainer.speedMul(wave);
}

function gainerShieldRange(wave) {
  return RS.ENEMY_DEFS.gainer.shieldRange(wave);
}

function mothershipCountForWave(wave) {
  return RS.ENEMY_DEFS.mothership.countForWave(wave);
}

function mothershipSpawnInterval(wave) {
  return RS.ENEMY_DEFS.mothership.spawnInterval(wave);
}

function spawnTarget(extraHp = 0, kind = "normal", at = null) {
  const w = state.wave;
  const mul = targetSizeMul();
  const def = RS.ENEMY_DEFS[kind] || RS.ENEMY_DEFS.normal;
  if (!RS.ENEMY_DEFS[kind]) kind = "normal";

  let size = 0;
  let sizeW = 0;
  let sizeH = 0;
  let p;

  if (kind === "mothership") {
    sizeW = rand(def.sizeWMin, def.sizeWMax) * mul;
    sizeH = rand(def.sizeHMin, def.sizeHMax) * mul;
    size = Math.max(sizeW, sizeH);
    p = at || pickOnScreen(Math.max(sizeW, sizeH) * 0.7 + 40);
  } else {
    size = rand(def.sizeMin, def.sizeMax) * mul;
    p = at || pickEdge();
  }

  const baseHp = def.hp(w, extraHp);
  const spdMul = def.speedMul(w);
  let vx = p.vx;
  let vy = p.vy;
  // Edge spawns scale with wave; explicit `at` / mothership keep raw velocity
  if (!at && kind !== "mothership") {
    const spd = (1 + w * 0.04) * spdMul;
    vx *= spd;
    vy *= spd;
  }
  const t = {
    x: p.x, y: p.y,
    vx, vy,
    size, sizeW, sizeH,
    hp: baseHp, maxHp: baseHp,
    rot: kind === "mothership" ? rand(-0.12, 0.12)
      : isGuided(kind) ? Math.atan2(vy, vx)
      : rand(0, Math.PI * 2),
    spin: kind === "mothership" || isGuided(kind) ? rand(-0.15, 0.15) : rand(-1.2, 1.2),
    guided: isGuided(kind),
    wobble: rand(0, Math.PI * 2),
    freezeLeft: 0,
    dead: false,
    kind,
    healPulse: rand(0, Math.PI * 2),
    shieldPulse: rand(0, Math.PI * 2),
    shielded: false,
    shieldFlash: 0,
    spawnTimer: 0,
    spawnInterval: mothershipSpawnInterval(w),
    shotCd: kind === "sniper" ? rand(0.4, 1.2) : 0,
    cloakAlpha: 1,
    cloakInner: isCloakerKind(kind) ? def.cloakInner(w) : 0,
    cloakOuter: isCloakerKind(kind) ? def.cloakOuter(w) : 0,
  };
  state.targets.push(t);
  return t;
}

/**
 * Opacity for each enemy under cloakers.
 * Inside innerR → 0; between inner–outer → 0.01…0.99; cloaker itself always 1.
 */
function refreshCloakState() {
  const cloakers = [];
  for (const c of state.targets) {
    // Shockwave stun temporarily disables cloaking
    if (!c.dead && isCloakerKind(c) && !(c.freezeLeft > 0)) cloakers.push(c);
  }
  for (const t of state.targets) {
    if (t.dead) continue;
    if (isCloakerKind(t)) {
      t.cloakAlpha = 1;
      continue;
    }
    let best = 1;
    for (const c of cloakers) {
      const cDef = RS.ENEMY_DEFS[c.kind] || RS.ENEMY_DEFS.cloaker;
      const ri = c.cloakInner || cDef.cloakInner(state.wave);
      const ro = c.cloakOuter || cDef.cloakOuter(state.wave);
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d <= ri) {
        best = 0;
        break;
      }
      if (d < ro && ro > ri) {
        // At x (inner): 99% transparent → alpha 0.01
        // At y (outer): 1% transparent → alpha 0.99
        const u = (d - ri) / (ro - ri);
        const alpha = 0.01 + u * 0.98;
        if (alpha < best) best = alpha;
      }
    }
    t.cloakAlpha = best;
  }
}

/** Spawn wave-scaled rammers after a Target is placed mid-wave. */
function spawnRammersForTarget() {
  if (!state.defenseTarget || !state.running) return;
  const n = RS.ENEMY_DEFS.rammer.countForWave(Math.max(1, state.wave || 1));
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      if (!state.running || !state.defenseTarget) return;
      spawnTarget(0, "rammer");
    }, i * 220);
  }
}

function fireSniperShot(sniper, defT) {
  const def = RS.ENEMY_DEFS.sniper;
  const w = state.wave;
  const dx = defT.x - sniper.x;
  const dy = defT.y - sniper.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = def.projectileSpeed(w);
  const php = 2 + Math.floor(w * 0.35);
  state.enemyProjectiles.push({
    x: sniper.x,
    y: sniper.y,
    vx: (dx / d) * spd,
    vy: (dy / d) * spd,
    r: 5,
    dmg: def.projectileDamage(w),
    hp: php,
    maxHp: php,
    life: 3.5,
  });
  RS.combat.burst(sniper.x, sniper.y, "#ffe566", 4);
  RS.sfx.shoot(false);
}

function launchFromMothership(m) {
  const ang = rand(0, Math.PI * 2);
  const dist = Math.max(m.sizeW || m.size, m.sizeH || m.size) * 0.55 + 16;
  const x = m.x + Math.cos(ang) * dist;
  const y = m.y + Math.sin(ang) * dist;
  const base = 80 + state.wave * 6;
  const child = spawnTarget(0, "normal", {
    x, y,
    vx: Math.cos(ang) * base + m.vx * 0.3,
    vy: Math.sin(ang) * base + m.vy * 0.3,
  });
  RS.combat.burst(x, y, "#c9a0ff", 6);
  return child;
}

function kindBurstColor(kind) {
  const def = RS.ENEMY_DEFS[kind] || RS.ENEMY_DEFS.normal;
  return def.burstColor;
}

function kindScoreBonus(kind) {
  const def = RS.ENEMY_DEFS[kind] || RS.ENEMY_DEFS.normal;
  return def.kindScoreBonus || 0;
}

function killTarget(t) {
  if (t.dead) return;
  t.dead = true;
  const kind = t.kind || "normal";
  // Splitter: without shockwave stun → burst into normals
  const doSplit = kind === "splitter" && !(t.freezeLeft > 0) && !t._noSplit;
  const pts = 10 + state.wave * 2 + Math.floor(t.maxHp) + kindScoreBonus(kind);
  const shopCred = Math.max(3, Math.floor(pts * 0.45));
  state.score += pts;
  state.kills += 1;
  state.credits += shopCred;
  if (state.waveStats) {
    state.waveStats.killCount += 1;
    state.waveStats.scoreGained += pts;
    state.waveStats.creditsGained += shopCred;
    if (!state.waveStats.killsByKind[kind]) state.waveStats.killsByKind[kind] = 0;
    state.waveStats.killsByKind[kind] += 1;
  }
  RS.combat.burst(t.x, t.y, kindBurstColor(kind), doSplit ? 28 : 18);
  if (Math.random() < RS.LOOT_DROP_CHANCE) {
    RS.loot.spawnCreditDrop(t.x, t.y, kind);
  }
  RS.sfx.kill(kind);

  if (doSplit) {
    const n = RS.ENEMY_DEFS.splitter.splitCount(state.wave);
    const base = 90 + state.wave * 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const dist = t.size * 0.35 + 10;
      spawnTarget(0, "normal", {
        x: t.x + Math.cos(a) * dist,
        y: t.y + Math.sin(a) * dist,
        vx: Math.cos(a) * base,
        vy: Math.sin(a) * base,
      });
    }
  }
}

/** Rammer kamikaze into defense Target (HP check / destroy happens after tick). */
function ramIntoTarget(rammer, defT) {
  if (!rammer || rammer.dead || !defT) return;
  const dmg = RS.ENEMY_DEFS.rammer.impactDamage(state.wave);
  defT.hp -= dmg;
  defT.hitFlash = Math.max(defT.hitFlash || 0, 0.35);
  RS.combat.burst(rammer.x, rammer.y, "#ff4d6d", 22);
  RS.combat.burst(defT.x, defT.y, "#ffe066", 10);
  RS.sfx.deny();
  rammer._noSplit = true;
  killTarget(rammer);
}

function findHealPatient(healer, range) {
  let best = null;
  let bestScore = -Infinity;
  for (const o of state.targets) {
    if (o.dead || o === healer) continue;
    const missing = o.maxHp - o.hp;
    if (missing < 0.08) continue;
    const d = Math.hypot(o.x - healer.x, o.y - healer.y);
    if (d > range) continue;
    // Prefer more missing HP and closer targets
    const score = missing * 2.2 - d * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function startDebugLevel() {
  RS.sfx.unlock();
  if (!state.running) {
    RS.main.startGame();
  }
  state.debugLevel = true;
  state.waveUpgradePending = false;
  state.waveRetryPending = false;
  state.lootVacuum = false;
  state.waveUpgradeDelay = 0;
  state.betweenWaves = 0;
  state.waveGen += 1;
  state.wave = Math.max(3, state.wave || 3);
  state.targets = [];
  state.particles = [];
  state.creditDrops = [];
  state.enemyProjectiles = [];
  state.autoLaserRays = [];
  state.placingDefenseTarget = false;
  state.placingAmplifier = false;
  state.ampActive = false;
  state.flashes = [];
  state.laserBeams = [];
  state.healBeams = [];
  state.shieldBeams = [];
  state.shockwaves = [];
  state.laserWaves = [];
  RS.combat.clearButtons();
  state.gravityOn = false;
  state.laserOn = false;
  RS.shop.setShopOpen(false);
  RS.camera.syncArenaToWave();
  el.overlay.classList.add("hidden");

  const cx = state.arenaW * 0.5;
  const cy = state.arenaH * 0.5;
  const def = RS.DEFENSE_TARGET;
  const maxHp = def.maxHp(Math.max(1, state.wave || 1));
  state.defenseTarget = {
    x: cx, y: cy,
    size: def.size,
    hp: maxHp,
    maxHp,
    pulse: 0,
    hitFlash: 0,
  };

  const kinds = [
    "normal", "healer", "tank", "guidedTank", "gainer",
    "mothership", "rammer", "sniper", "splitter", "cloaker", "guidedCloaker",
  ];
  const radius = Math.min(state.arenaW, state.arenaH) * 0.28;
  for (let i = 0; i < kinds.length; i++) {
    const a = -Math.PI / 2 + (i / kinds.length) * Math.PI * 2;
    const guided = isGuided(kinds[i]);
    spawnTarget(0, kinds[i], {
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius,
      vx: guided ? Math.cos(a + Math.PI) * 40 : 0,
      vy: guided ? Math.sin(a + Math.PI) * 40 : 0,
    });
  }

  RS.waves.showBanner("Debug Level");
  RS.shop.updateShopUI();
  RS.sfx.wave();
}

function kindStyle(kind) {
  if (kind === "healer") {
    return {
      glow: "#3dff8a",
      stroke: "#3dff8a",
      empty: "rgba(0, 28, 16, 0.18)",
      fill: "rgba(61, 255, 138, 0.2)",
    };
  }
  if (kind === "tank" || kind === "guidedTank") {
    return {
      glow: "#ff9a3d",
      stroke: "#ff9a3d",
      empty: "rgba(40, 18, 0, 0.18)",
      fill: "rgba(255, 154, 61, 0.22)",
    };
  }
  if (kind === "gainer") {
    return {
      glow: "#4dc9ff",
      stroke: "#4dc9ff",
      empty: "rgba(0, 24, 40, 0.18)",
      fill: "rgba(77, 201, 255, 0.2)",
    };
  }
  if (kind === "mothership") {
    return {
      glow: "#c9a0ff",
      stroke: "#c9a0ff",
      empty: "rgba(28, 12, 48, 0.22)",
      fill: "rgba(201, 160, 255, 0.22)",
    };
  }
  if (kind === "rammer") {
    return {
      glow: "#ff4d6d",
      stroke: "#ff4d6d",
      empty: "rgba(48, 8, 16, 0.2)",
      fill: "rgba(255, 77, 109, 0.22)",
    };
  }
  if (kind === "sniper") {
    return {
      glow: "#ffe566",
      stroke: "#ffe566",
      empty: "rgba(40, 32, 0, 0.2)",
      fill: "rgba(255, 229, 102, 0.22)",
    };
  }
  if (kind === "splitter") {
    return {
      glow: "#ff8c42",
      stroke: "#ff8c42",
      empty: "rgba(40, 16, 0, 0.2)",
      fill: "rgba(255, 140, 66, 0.22)",
    };
  }
  if (kind === "cloaker" || kind === "guidedCloaker") {
    return {
      glow: "#b8c4ff",
      stroke: "#b8c4ff",
      empty: "rgba(20, 24, 48, 0.22)",
      fill: "rgba(184, 196, 255, 0.22)",
    };
  }
  return {
    glow: "#ff2bd6",
    stroke: "#ff2bd6",
    empty: "rgba(36, 0, 30, 0.18)",
    fill: "rgba(255, 43, 214, 0.18)",
  };
}

  RS.enemies.rand = rand;
  RS.enemies.pickEdge = pickEdge;
  RS.enemies.pickOnScreen = pickOnScreen;
  RS.enemies.targetHitRadius = targetHitRadius;
  RS.enemies.isGuided = isGuided;
  RS.enemies.isCloakerKind = isCloakerKind;
  RS.enemies.isCloakerRevealed = isCloakerRevealed;
  RS.enemies.findEscortTarget = findEscortTarget;
  RS.enemies.refreshCloakState = refreshCloakState;
  RS.enemies.targetSizeMul = targetSizeMul;
  RS.enemies.setTargetSizePct = setTargetSizePct;
  RS.enemies.healerCountForWave = healerCountForWave;
  RS.enemies.healerSpeedMul = healerSpeedMul;
  RS.enemies.healerHealRate = healerHealRate;
  RS.enemies.healerBeamRange = healerBeamRange;
  RS.enemies.tankCountForWave = tankCountForWave;
  RS.enemies.tankSpeedMul = tankSpeedMul;
  RS.enemies.gainerCountForWave = gainerCountForWave;
  RS.enemies.gainerSpeedMul = gainerSpeedMul;
  RS.enemies.gainerShieldRange = gainerShieldRange;
  RS.enemies.mothershipCountForWave = mothershipCountForWave;
  RS.enemies.mothershipSpawnInterval = mothershipSpawnInterval;
  RS.enemies.spawnTarget = spawnTarget;
  RS.enemies.spawnRammersForTarget = spawnRammersForTarget;
  RS.enemies.launchFromMothership = launchFromMothership;
  RS.enemies.kindBurstColor = kindBurstColor;
  RS.enemies.kindScoreBonus = kindScoreBonus;
  RS.enemies.killTarget = killTarget;
  RS.enemies.ramIntoTarget = ramIntoTarget;
  RS.enemies.findHealPatient = findHealPatient;
  RS.enemies.startDebugLevel = startDebugLevel;
  RS.enemies.kindStyle = kindStyle;

  RS.enemies.tick = function tick(dt) {
    const state = RS.state;
    const gR = RS.stats.gravRadius();
    const gPull = RS.stats.gravPullStrength();
    const aw = RS.camera.aimWorld();
    const aimX = aw.x;
    const aimY = aw.y;
    state.healBeams = [];
    const healRange = RS.enemies.healerBeamRange(state.wave);
    const healRate = RS.enemies.healerHealRate(state.wave);

    function applyGravityPull(t) {
      let px = 0, py = 0;
      if (!state.gravityOn) return { px, py };
      const dx = aimX - t.x;
      const dy = aimY - t.y;
      const dist = Math.hypot(dx, dy);
      if (dist < gR && dist > 1) {
        const falloff = 1 - dist / gR;
        const force = gPull * (0.35 + falloff * 0.65);
        const ux = dx / dist; // unit toward aim
        const uy = dy / dist;
        if (state.gravityRepel) {
          // Push away + lasting outward velocity so they coast past the rim
          px = -ux * force;
          py = -uy * force;
          const kick = force * 1.35;
          t.vx += -ux * kick * dt;
          t.vy += -uy * kick * dt;
          // Soft speed cap (avoid infinite accelerate while held in the zone)
          const spd = Math.hypot(t.vx, t.vy);
          const maxSpd = 220 + gPull * 0.85;
          if (spd > maxSpd) {
            t.vx = (t.vx / spd) * maxSpd;
            t.vy = (t.vy / spd) * maxSpd;
          }
        } else {
          px = ux * force;
          py = uy * force;
          t.vx *= 1 - Math.min(0.85, 2.2 * dt);
          t.vy *= 1 - Math.min(0.85, 2.2 * dt);
        }
      }
      return { px, py };
    }

    function applyStructureForces(t) {
      let px = 0, py = 0;
      for (const s of state.structures) {
        if (s.kind !== "antigravitron") continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < s.range && dist > 1) {
          const falloff = 1 - dist / s.range;
          const force = (RS.STRUCTURE_DEFS.antigravitron.push) * (0.35 + falloff * 0.65);
          px += (dx / dist) * force;
          py += (dy / dist) * force;
          t.vx *= 1 - Math.min(0.7, 1.6 * dt);
          t.vy *= 1 - Math.min(0.7, 1.6 * dt);
        }
      }
      return { px, py };
    }

    function clampTargetPos(t) {
      const aw = state.arenaW;
      const ah = state.arenaH;
      if (t.kind === "mothership") {
        const hw = (t.sizeW || t.size) * 0.5;
        const hh = (t.sizeH || t.size) * 0.5;
        const pad = 12;
        if (t.x < hw + pad) { t.x = hw + pad; t.vx = Math.abs(t.vx); }
        if (t.x > aw - hw - pad) { t.x = aw - hw - pad; t.vx = -Math.abs(t.vx); }
        if (t.y < hh + pad) { t.y = hh + pad; t.vy = Math.abs(t.vy); }
        if (t.y > ah - hh - pad) { t.y = ah - hh - pad; t.vy = -Math.abs(t.vy); }
      } else {
        const m = 80;
        if (t.x < -m) t.x = aw + m * 0.5;
        if (t.x > aw + m) t.x = -m * 0.5;
        if (t.y < -m) t.y = ah + m * 0.5;
        if (t.y > ah + m) t.y = -m * 0.5;
      }
    }

    for (const t of state.targets) {
      if (t.dead) continue;

      if (t.freezeLeft > 0) {
        t.freezeLeft = Math.max(0, t.freezeLeft - dt);
        const g = applyGravityPull(t);
        const a = applyStructureForces(t);
        t.x += (g.px + a.px) * dt;
        t.y += (g.py + a.py) * dt;
        clampTargetPos(t);
        continue;
      }

      t.wobble += dt * 2.2;
      let { px, py } = applyGravityPull(t);
      const sf = applyStructureForces(t);
      px += sf.px;
      py += sf.py;

      if (t.kind === "healer") {
        t.healPulse = (t.healPulse || 0) + dt * (4 + state.wave * 0.15);
        let patient = t._healTarget || null;
        if (RS.perf.shouldRetarget()) {
          patient = RS.enemies.findHealPatient(t, healRange);
          t._healTarget = patient;
        } else if (patient) {
          if (
            patient.dead ||
            patient.maxHp - patient.hp < 0.08 ||
            Math.hypot(patient.x - t.x, patient.y - t.y) > healRange
          ) {
            patient = null;
            t._healTarget = null;
          }
        }
        if (patient) {
          const pdx = patient.x - t.x;
          const pdy = patient.y - t.y;
          const pd = Math.hypot(pdx, pdy) || 1;
          const pull = (70 + state.wave * 5) * RS.ENEMY_MOVE_SCALE;
          px += (pdx / pd) * pull;
          py += (pdy / pd) * pull;
          const before = patient.hp;
          patient.hp = Math.min(patient.maxHp, patient.hp + healRate * dt);
          const healed = patient.hp - before;
          state.healBeams.push({
            x1: t.x, y1: t.y,
            x2: patient.x, y2: patient.y,
            pulse: t.healPulse,
            strength: Math.min(1, 0.45 + healed * 2),
          });
          if (healed > 0) {
            RS.sfx.heal();
            if (Math.random() < dt * 10) {
              RS.combat.burst(patient.x, patient.y, "rgba(61,255,138,0.85)", 2);
            }
          }
        }
      }

      if (t.kind === "mothership" && !state.debugLevel) {
        t.spawnInterval = RS.enemies.mothershipSpawnInterval(state.wave);
        t.spawnTimer = (t.spawnTimer || 0) + dt;
        if (t.spawnTimer >= t.spawnInterval) {
          t.spawnTimer -= t.spawnInterval;
          RS.enemies.launchFromMothership(t);
        }
      }

      const defT = state.defenseTarget;

      // Guided units: escort allies OR seek defense Target
      if (isGuided(t)) {
        const defG = RS.ENEMY_DEFS[t.kind] || {};
        let aimX = null;
        let aimY = null;
        if (defG.escortPriority) {
          let ally = t._escortTarget || null;
          if (RS.perf.shouldRetarget()) {
            ally = findEscortTarget(t, defG.escortPriority);
            t._escortTarget = ally;
          } else if (ally && (ally.dead || defG.escortPriority.indexOf(ally.kind) < 0)) {
            ally = findEscortTarget(t, defG.escortPriority);
            t._escortTarget = ally;
          }
          if (ally) {
            aimX = ally.x;
            aimY = ally.y;
          }
        } else if (defT) {
          aimX = defT.x;
          aimY = defT.y;
        }
        if (aimX != null) {
          const dx = aimX - t.x;
          const dy = aimY - t.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = defG.chaseSpeed ? defG.chaseSpeed(state.wave) : 120;
          const turn = defG.turnRate != null ? defG.turnRate : 3;
          const holdR = defG.escortPriority
            ? Math.max(28, (t.cloakInner || 100) * 0.4)
            : 0;
          if (holdR > 0 && dist < holdR) {
            // Hang near escort — soft brake
            t.vx *= 1 - Math.min(0.9, 2.8 * dt);
            t.vy *= 1 - Math.min(0.9, 2.8 * dt);
            t.rot = Math.atan2(dy, dx);
          } else {
            const tx = (dx / dist) * spd;
            const ty = (dy / dist) * spd;
            t.vx += (tx - t.vx) * Math.min(1, turn * dt);
            t.vy += (ty - t.vy) * Math.min(1, turn * dt);
            t.rot = Math.atan2(t.vy, t.vx);
          }
        }
      }

      // Sniper: fire when near Target
      if (t.kind === "sniper") {
        t.shotCd = (t.shotCd || 0) - dt;
        if (defT) {
          const sDef = RS.ENEMY_DEFS.sniper;
          const d = Math.hypot(defT.x - t.x, defT.y - t.y);
          if (d <= sDef.fireRange(state.wave) && t.shotCd <= 0) {
            t.shotCd = sDef.fireCooldown(state.wave);
            fireSniperShot(t, defT);
          }
        }
      }

      const wobbleAmp = t.kind === "mothership" ? 6
        : t.kind === "tank" || t.kind === "guidedTank" ? 12
        : t.kind === "healer" ? 18
        : t.kind === "gainer" ? 22
        : t.kind === "rammer" ? 4
        : t.kind === "sniper" ? 16
        : t.kind === "splitter" ? 24
        : t.kind === "cloaker" || t.kind === "guidedCloaker" ? 14
        : 28;
      const moveX = (t.vx + Math.sin(t.wobble) * wobbleAmp) * RS.ENEMY_MOVE_SCALE;
      const moveY = (t.vy + Math.cos(t.wobble * 0.9) * (wobbleAmp * 0.8)) * RS.ENEMY_MOVE_SCALE;
      t.x += (moveX + px) * dt;
      t.y += (moveY + py) * dt;
      if (!isGuided(t)) t.rot += t.spin * dt;
      clampTargetPos(t);

      if (t.kind === "rammer" && defT && !t.dead) {
        const hitR = defT.size * 0.5 + RS.enemies.targetHitRadius(t) * 0.65;
        if (Math.hypot(defT.x - t.x, defT.y - t.y) < hitR) {
          RS.enemies.ramIntoTarget(t, defT);
        }
      }
    }

    // Sniper projectiles: move → autolaser intercept → Target hit
    {
      const defT = state.defenseTarget;
      const shots = state.enemyProjectiles || [];
      for (const p of shots) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      RS.combat.tickAutoLaser(dt);
      for (const p of shots) {
        if (p.life <= 0 || (p.hp != null && p.hp <= 0)) continue;
        if (!defT || defT.hp <= 0) continue;
        const d = Math.hypot(p.x - defT.x, p.y - defT.y);
        if (d < defT.size * 0.5 + (p.r || 5)) {
          p.life = 0;
          defT.hp -= p.dmg || 4;
          defT.hitFlash = Math.max(defT.hitFlash || 0, 0.22);
          RS.combat.burst(p.x, p.y, "#ffe566", 8);
        }
      }
      state.enemyProjectiles = shots.filter(
        (p) => p.life > 0 && (p.hp == null || p.hp > 0)
      );
    }

    state.targets = state.targets.filter((t) => !t.dead);
    refreshCloakState();

    const obj = state.defenseTarget;
    if (obj && obj.hp <= 0) {
      obj.hp = 0;
      RS.tools.destroyDefenseTarget();
    }
  };

})();
