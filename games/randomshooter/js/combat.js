window.RS = window.RS || {};
RS.combat = RS.combat || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function activateBulletTime(duration = RS.WAVE_VISUAL_LIFE) {
  if (!state.bulletTimeEffect) return;
  state.bulletTimeLeft = Math.max(state.bulletTimeLeft, duration);
}

function triggerShockwave() {
  if (state.waveCooldown > 0) return;
  const aw = RS.camera.aimWorld();
  const maxR = Math.hypot(state.arenaW, state.arenaH) * 0.75;
  state.shockwaves.push({
    x: aw.x,
    y: aw.y,
    r: 0,
    maxR,
    life: RS.WAVE_VISUAL_LIFE,
    maxLife: RS.WAVE_VISUAL_LIFE,
    hit: new Set(),
    kind: "freeze",
  });
  state.waveCooldown = RS.stats.waveCooldownMax();
  activateBulletTime(RS.WAVE_VISUAL_LIFE);
  burst(aw.x, aw.y, "#ffe066", 24);
  RS.sfx.shockwave();
  RS.waves.showBanner("Rázová vlna");
}

function triggerLaserWave() {
  if (state.laserWaveCooldown > 0) return;
  const aw = RS.camera.aimWorld();
  const maxR = Math.hypot(state.arenaW, state.arenaH) * 0.75;

  state.laserWaves.push({
    x: aw.x,
    y: aw.y,
    r: 0,
    maxR,
    life: RS.WAVE_VISUAL_LIFE,
    maxLife: RS.WAVE_VISUAL_LIFE,
    hit: new Set(),
    kind: "laser",
    base: RS.stats.laserWaveBaseDamage(),
  });
  state.laserWaveCooldown = RS.stats.laserWaveCooldownMax();
  activateBulletTime(RS.WAVE_VISUAL_LIFE);
  burst(aw.x, aw.y, "#ff2bd6", 28);
  RS.sfx.laserWave();
  RS.waves.showBanner("Laserová vlna");
}

function applyWaveFront(w) {
  let killed = false;
  for (const t of state.targets) {
    if (t.dead || w.hit.has(t)) continue;
    const d = Math.hypot(t.x - w.x, t.y - w.y);
    const reach = w.r + RS.enemies.targetHitRadius(t);
    if (d > reach) continue;
    w.hit.add(t);

    if (w.kind === "freeze") {
      // Gainer / Cloaker always take shockwave (cloak off + reveal + paralyze)
      const pierceShield =
        t.kind === "gainer" ||
        (RS.enemies.isCloakerKind && RS.enemies.isCloakerKind(t));
      if (t.shielded && !pierceShield) {
        triggerShieldBlock(t);
        continue;
      }
      t.freezeLeft = Math.max(t.freezeLeft || 0, RS.stats.freezeDuration());
      burst(t.x, t.y, "#ffe066", 8);
      if (RS.enemies.isCloakerKind && RS.enemies.isCloakerKind(t)) {
        // Drop cloak field immediately this frame
        RS.enemies.refreshCloakState();
      }
    } else if (w.kind === "laser") {
      const u = Math.max(0, 1 - d / w.maxR);
      const falloff = u * u;
      const dmg = w.base * falloff * RS.stats.laserDamageMul(t);
      if (dmg >= 0.05) {
        if (applyDamage(t, dmg, `rgba(255,43,214,${0.4 + 0.55 * falloff})`)) {
          if (t.dead) killed = true;
          else burst(t.x, t.y, "rgba(255,100,220,0.9)", Math.max(2, Math.round(4 + 10 * falloff)));
        }
      }
    }
  }
  if (killed) RS.shop.updateHudStats();
}

function checkCombos(buttons) {
  const lr = (buttons & 3) === 3; // LMB+RMB
  if (lr && !state.bothButtonsPrev) triggerShockwave();
  state.bothButtonsPrev = lr;

  const rm = (buttons & 6) === 6; // RMB+MMB
  if (rm && !state.gravLaserPrev) triggerLaserWave();
  state.gravLaserPrev = rm;
}

function updateResBar(wrap, fill, fuel, active) {
  const pct = Math.max(0, Math.min(1, fuel));
  fill.style.transform = `scaleX(${pct})`;
  wrap.classList.toggle("active", active);
  wrap.classList.toggle("empty", pct <= 0.001);
}

function updateResourceBars() {
  updateResBar(el.gravWrap, el.gravFill, state.gravFuel, state.gravityOn);
  updateResBar(el.laserWrap, el.laserFill, state.laserFuel, state.laserOn);
}

function syncButtons(buttons) {
  checkCombos(buttons);
  state.shooting = !!(buttons & 1);
  state.gravityHold = !!(buttons & 2);
  state.laserHold = !!(buttons & 4);
  // Immediate RMB/MMB audio edge (don't wait for next frame)
  if (state.running) {
    RS.sfx.syncLoops(
      state.gravityHold,
      state.laserHold,
      state.gravityHold && state.gravFuel > 0,
      state.laserHold && state.laserFuel > 0,
      state.gravityRepel
    );
  }
}

function clearButtons() {
  state.shooting = false;
  state.gravityHold = false;
  state.laserHold = false;
  state.bothButtonsPrev = false;
  state.gravLaserPrev = false;
}

const particlePool = [];
let particleWrite = 0;

function allocParticle() {
  return particlePool.pop() || {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0.7, size: 2, color: "#fff",
  };
}

function freeParticle(p) {
  particlePool.push(p);
}

function burst(x, y, color, n = 10) {
  const cap = (state.perf && state.perf.particleCap) || 180;
  for (let i = 0; i < n; i++) {
    const a = RS.enemies.rand(0, Math.PI * 2);
    const sp = RS.enemies.rand(40, 220);
    let p;
    if (state.particles.length < cap) {
      p = allocParticle();
      state.particles.push(p);
    } else {
      p = state.particles[particleWrite % state.particles.length];
      particleWrite += 1;
    }
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
    p.life = RS.enemies.rand(0.3, 0.7);
    p.max = 0.7;
    p.size = RS.enemies.rand(2, 5);
    p.color = color;
  }
}

function tickParticles(dt) {
  const arr = state.particles;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life -= dt;
    if (p.life <= 0) {
      const last = arr.pop();
      if (i < arr.length) arr[i] = last;
      freeParticle(p);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}

/** Target whose body covers the exact aim center (not shot-radius width). */
function targetUnderAimCenter(ax, ay) {
  let best = null;
  let bestDist = Infinity;
  for (const t of state.targets) {
    if (t.dead) continue;
    const dist = Math.hypot(t.x - ax, t.y - ay);
    if (dist <= RS.enemies.targetHitRadius(t) && dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best;
}

/** Big gold/white punch so a headshot reads clearly vs a normal kill. */
function triggerHeadshotFx(x, y, size) {
  const s = Math.max(48, size * 1.15);
  burst(x, y, "#ffd24a", 42);
  burst(x, y, "#ffffff", 28);
  burst(x, y, "#ff8c2b", 22);
  // Extra large sparks
  const cap = (state.perf && state.perf.particleCap) || 180;
  for (let i = 0; i < 12; i++) {
    if (state.particles.length >= cap) break;
    const a = RS.enemies.rand(0, Math.PI * 2);
    const sp = RS.enemies.rand(160, 420);
    const p = allocParticle();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
    p.life = RS.enemies.rand(0.45, 0.85);
    p.max = 0.85;
    p.size = RS.enemies.rand(5, 11);
    p.color = i % 2 === 0 ? "#ffe066" : "#fff6c8";
    state.particles.push(p);
  }
  state.flashes.push({
    x, y, r: s * 2.2,
    life: 0.55, max: 0.55,
    hit: true,
    kind: "headshot",
  });
  state.flashes.push({
    x, y, r: s * 0.85,
    life: 0.32, max: 0.32,
    hit: true,
    kind: "headshotCore",
  });
  if (RS.sfx.headshot) RS.sfx.headshot();
}

function fire() {
  const r = RS.stats.shotRadius();
  const dmg = RS.stats.damage();
  const maxHits = RS.stats.pierceCount();
  const aw = RS.camera.aimWorld();
  const ax = aw.x;
  const ay = aw.y;

  // Headshot: object exactly under crosshair center → chance for instant kill
  const hsChance = RS.stats.headshotChance();
  const centerTarget = hsChance > 0 ? targetUnderAimCenter(ax, ay) : null;
  let headshot = false;
  if (centerTarget && Math.random() < hsChance) {
    const hx = centerTarget.x;
    const hy = centerTarget.y;
    const hSize = Math.max(centerTarget.sizeW || 0, centerTarget.sizeH || 0, centerTarget.size || 40);
    const hpBefore = centerTarget.hp;
    headshot = applyDamage(centerTarget, hpBefore, null);
    if (headshot) triggerHeadshotFx(hx, hy, hSize);
  }

  const hits = state.targets
    .filter((t) => !t.dead)
    .map((t) => {
      const dist = Math.hypot(t.x - ax, t.y - ay);
      return { t, dist, hit: dist <= r + RS.enemies.targetHitRadius(t) };
    })
    .filter((h) => h.hit)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, maxHits);

  state.flashes.push({
    x: ax, y: ay, r,
    life: 0.18, max: 0.18, hit: hits.length > 0 || headshot,
  });

  RS.sfx.shoot(hits.length > 0 || headshot);
  for (const { t } of hits) applyDamage(t, dmg, "rgba(0,229,255,0.9)");
  RS.shop.updateHudStats();
}

/** Fully cloaked / hidden Cloakers cannot be locked / hit by laser. */
function isLaserTargetable(t) {
  if (!t || t.dead) return false;
  if (RS.enemies.isCloakerKind && RS.enemies.isCloakerKind(t)) {
    if (RS.enemies.isCloakerRevealed && !RS.enemies.isCloakerRevealed(t)) return false;
  }
  const a = t.cloakAlpha;
  return !(a != null && a <= 0.004);
}

function nearestTarget(x, y, exclude) {
  let best = null;
  let bestDist = Infinity;
  for (const t of state.targets) {
    if (!isLaserTargetable(t) || (exclude && exclude.has(t))) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

function laserHopStrength(hop) {
  return Math.pow(0.5, hop);
}

let laserCache = {
  primaries: [],
  ax: 0,
  ay: 0,
  targetCount: -1,
  primaryCount: -1,
  jumps: -1,
};

function invalidateLaserCache() {
  laserCache.targetCount = -1;
  laserCache.primaries = [];
}

function pickLaserPrimaries(ax, ay, primaryCount) {
  return state.targets
    .filter((t) => isLaserTargetable(t))
    .map((t) => ({ t, dist: Math.hypot(t.x - ax, t.y - ay) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, primaryCount)
    .map((x) => x.t);
}

function buildLaserChains() {
  const primaryCount = RS.stats.laserTargetCount();
  const jumps = RS.stats.laserJumps();
  const beams = [];
  const hits = [];
  const aw = RS.camera.aimWorld();
  const ax = aw.x;
  const ay = aw.y;
  const aliveCount = state.targets.length;
  const useCache = !!(state.perf && state.perf.laserChainCache);
  const aimMoved = Math.hypot(ax - laserCache.ax, ay - laserCache.ay) > 12;
  let primaries = laserCache.primaries;

  const cacheOk =
    useCache &&
    !aimMoved &&
    laserCache.targetCount === aliveCount &&
    laserCache.primaryCount === primaryCount &&
    laserCache.jumps === jumps &&
    primaries.length > 0 &&
    primaries.every((t) => t && isLaserTargetable(t));

  if (!cacheOk) {
    primaries = pickLaserPrimaries(ax, ay, primaryCount);
    laserCache.primaries = primaries;
    laserCache.ax = ax;
    laserCache.ay = ay;
    laserCache.targetCount = aliveCount;
    laserCache.primaryCount = primaryCount;
    laserCache.jumps = jumps;
  }

  for (const primary of primaries) {
    if (!primary || primary.dead) continue;
    const chainSeen = new Set([primary]);
    let fromX = ax;
    let fromY = ay;
    let current = primary;

    // hop 0 — main beam from aim to this primary target
    {
      const str = laserHopStrength(0);
      beams.push({ x1: fromX, y1: fromY, x2: current.x, y2: current.y, hop: 0, str });
      hits.push({ t: current, hop: 0, str });
      fromX = current.x;
      fromY = current.y;
    }

    // further jumps from this primary (may share targets with other chains)
    for (let hop = 1; hop <= jumps; hop++) {
      const next = nearestTarget(fromX, fromY, chainSeen);
      if (!next) break;
      chainSeen.add(next);
      const str = laserHopStrength(hop);
      beams.push({ x1: fromX, y1: fromY, x2: next.x, y2: next.y, hop, str });
      hits.push({ t: next, hop, str });
      fromX = next.x;
      fromY = next.y;
    }
  }
  return { beams, hits };
}

/** First hit of ray (ox,oy)+t*(dx,dy) with circle; dx,dy unit. Returns t or null. */
function rayCircleHitT(ox, oy, dx, dy, cx, cy, r) {
  const fx = cx - ox;
  const fy = cy - oy;
  const t = fx * dx + fy * dy;
  if (t < 0) return null;
  const px = ox + dx * t;
  const py = oy + dy * t;
  if (Math.hypot(cx - px, cy - py) > r) return null;
  return t;
}

/** Exit point of a ray from (ox,oy) along unit (dx,dy) with the arena AABB. */
function arenaExitPoint(ox, oy, dx, dy) {
  let tMin = Infinity;
  if (dx > 1e-8) tMin = Math.min(tMin, (state.arenaW - ox) / dx);
  if (dx < -1e-8) tMin = Math.min(tMin, (0 - ox) / dx);
  if (dy > 1e-8) tMin = Math.min(tMin, (state.arenaH - oy) / dy);
  if (dy < -1e-8) tMin = Math.min(tMin, (0 - oy) / dy);
  if (!Number.isFinite(tMin) || tMin < 0) {
    tMin = Math.hypot(state.arenaW, state.arenaH);
  }
  return { x: ox + dx * tMin, y: oy + dy * tMin, t: tMin };
}

/**
 * Laser mode: rays from aim through nearest primaries to arena edge.
 * Pierce count = 1 + Jumps (same hop falloff as beam).
 */
function buildPiercingLasers() {
  const primaryCount = RS.stats.laserTargetCount();
  const pierce = 1 + RS.stats.laserJumps();
  const beams = [];
  const hits = [];
  const aw = RS.camera.aimWorld();
  const ax = aw.x;
  const ay = aw.y;
  const primaries = pickLaserPrimaries(ax, ay, primaryCount);

  for (const primary of primaries) {
    if (!primary || primary.dead) continue;
    let dx = primary.x - ax;
    let dy = primary.y - ay;
    let len = Math.hypot(dx, dy);
    if (len < 1e-3) {
      dx = 1;
      dy = 0;
      len = 1;
    } else {
      dx /= len;
      dy /= len;
    }
    const edge = arenaExitPoint(ax, ay, dx, dy);
    const along = [];
    for (const t of state.targets) {
      if (!isLaserTargetable(t)) continue;
      const ht = rayCircleHitT(ax, ay, dx, dy, t.x, t.y, RS.enemies.targetHitRadius(t));
      if (ht == null || ht > edge.t + 0.5) continue;
      along.push({ t, dist: ht });
    }
    along.sort((a, b) => a.dist - b.dist);
    const struck = along.slice(0, pierce);

    // Segmented ray: aim → hit0 → hit1 → … → edge; str halves each hop (same as Beam)
    let fromX = ax;
    let fromY = ay;
    for (let hop = 0; hop < struck.length; hop++) {
      const str = laserHopStrength(hop);
      const tgt = struck[hop].t;
      beams.push({
        x1: fromX, y1: fromY,
        x2: tgt.x, y2: tgt.y,
        hop, str,
        piercing: true,
      });
      hits.push({ t: tgt, hop, str });
      fromX = tgt.x;
      fromY = tgt.y;
    }
    // Tail past the last pierced target → arena edge (str halved once per target passed)
    {
      const tailStr = laserHopStrength(struck.length);
      beams.push({
        x1: fromX, y1: fromY,
        x2: edge.x, y2: edge.y,
        hop: struck.length,
        str: tailStr,
        piercing: true,
      });
    }
  }
  return { beams, hits };
}

function buildLasers() {
  if (state.laserMode === "laser") return buildPiercingLasers();
  return buildLaserChains();
}

function refreshShields(dt) {
  for (const t of state.targets) {
    if (t.dead) continue;
    if (t.shieldFlash > 0) t.shieldFlash = Math.max(0, t.shieldFlash - dt);
  }

  const retarget = RS.perf.shouldRetarget();
  if (!retarget) {
    // Keep last shield graph; refresh endpoints + re-apply shielded flags.
    for (const t of state.targets) {
      if (!t.dead) t.shielded = false;
    }
    for (const g of state.targets) {
      if (g.dead || g.kind !== "gainer" || g.freezeLeft > 0) continue;
      g.shieldPulse = (g.shieldPulse || 0) + dt * (3.5 + state.wave * 0.1);
      g.shielded = true;
    }
    const nextBeams = [];
    for (const b of state.shieldBeams) {
      const g = b.from;
      const o = b.to;
      if (!g || !o || g.dead || o.dead || g.kind !== "gainer" || g.freezeLeft > 0) continue;
      o.shielded = true;
      b.x1 = g.x;
      b.y1 = g.y;
      b.x2 = o.x;
      b.y2 = o.y;
      b.pulse = g.shieldPulse;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      nextBeams.push(b);
    }
    state.shieldBeams = nextBeams;
    return;
  }

  const prevBeams = state.shieldBeams;
  state.shieldBeams = [];
  for (const t of state.targets) {
    if (t.dead) continue;
    t.shielded = false;
  }
  const range = RS.enemies.gainerShieldRange(state.wave);
  for (const g of state.targets) {
    if (g.dead || g.kind !== "gainer" || g.freezeLeft > 0) continue;
    g.shieldPulse = (g.shieldPulse || 0) + dt * (3.5 + state.wave * 0.1);
    for (const o of state.targets) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - g.x, o.y - g.y);
      if (d > range) continue;
      o.shielded = true;
      if (o === g) continue;
      let hitFlash = 0;
      for (const pb of prevBeams) {
        if (pb.from === g && pb.to === o && pb.hitFlash > 0) {
          hitFlash = Math.max(0, pb.hitFlash - dt);
          break;
        }
      }
      state.shieldBeams.push({
        x1: g.x, y1: g.y,
        x2: o.x, y2: o.y,
        pulse: g.shieldPulse,
        from: g,
        to: o,
        hitFlash,
      });
    }
  }
}

function applyDamage(t, amount, sparkColor) {
  if (!t || t.dead) return false;
  if (t.shielded) {
    triggerShieldBlock(t);
    return false;
  }
  t.hp -= amount;
  if (sparkColor) burst(t.x, t.y, sparkColor, 4);
  if (t.hp <= 0) {
    RS.enemies.killTarget(t);
    invalidateLaserCache();
  }
  return true;
}

function triggerShieldBlock(t) {
  if (!t || t.dead) return;
  const spark = (t.shieldFlash || 0) < 0.1;
  t.shieldFlash = Math.max(t.shieldFlash || 0, 0.32);
  // Flash only the link to the protected unit that was hit (not all of a gainer's links)
  if (t.kind !== "gainer") {
    for (const b of state.shieldBeams) {
      if (b.to === t) {
        b.hitFlash = Math.max(b.hitFlash || 0, 0.32);
      }
    }
  }
  const range = RS.enemies.gainerShieldRange(state.wave);
  for (const g of state.targets) {
    if (g.dead || g.kind !== "gainer" || g.freezeLeft > 0) continue;
    if (Math.hypot(g.x - t.x, g.y - t.y) <= range) {
      g.shieldFlash = Math.max(g.shieldFlash || 0, 0.32);
    }
  }
  // Avoid particle spam while laser is held on a shielded target
  if (spark) burst(t.x, t.y, "rgba(77,201,255,0.95)", 5);
}

/**
 * Intercept enemy projectiles near the crosshair with mint defense lasers.
 * Beams = max simultaneous locks; Radius = N × shotRadius; Power = DPS.
 */
function tickAutoLaser(dt) {
  const state = RS.state;
  state.autoLaserRays = [];
  const beamCount = RS.stats.autoLaserBeams();
  if (beamCount <= 0 || !state.running) return;

  const aw = RS.camera.aimWorld();
  const radius = RS.stats.autoLaserRadius();
  const dps = RS.stats.autoLaserDps();
  const shots = state.enemyProjectiles || [];
  const candidates = [];
  for (const p of shots) {
    if (p.life <= 0) continue;
    if (p.hp != null && p.hp <= 0) continue;
    const d = Math.hypot(p.x - aw.x, p.y - aw.y);
    if (d <= radius + (p.r || 5)) candidates.push({ p, d });
  }
  candidates.sort((a, b) => a.d - b.d);

  const locked = candidates.slice(0, beamCount);
  for (const { p } of locked) {
    state.autoLaserRays.push({
      x1: aw.x,
      y1: aw.y,
      x2: p.x,
      y2: p.y,
    });
    if (p.hp == null) p.hp = p.maxHp != null ? p.maxHp : 2;
    p.hp -= dps * dt;
    if (p.hp <= 0) {
      p.hp = 0;
      p.life = 0;
      burst(p.x, p.y, "rgba(0,255,200,0.95)", 10);
      burst(p.x, p.y, "rgba(180,255,240,0.8)", 4);
      RS.sfx.shoot(true);
    } else if (Math.random() < dt * 10) {
      burst(p.x, p.y, "rgba(0,255,200,0.7)", 1);
    }
  }
}

function updateWaveVisuals(dt) {
  for (const w of state.shockwaves) {
    w.life -= dt;
    const t = 1 - w.life / w.maxLife;
    w.r = w.maxR * Math.min(1, t * 1.15);
    applyWaveFront(w);
  }
  state.shockwaves = state.shockwaves.filter((w) => w.life > 0);

  for (const w of state.laserWaves) {
    w.life -= dt;
    const t = 1 - w.life / w.maxLife;
    w.r = w.maxR * Math.min(1, t * 1.15);
    applyWaveFront(w);
  }
  state.laserWaves = state.laserWaves.filter((w) => w.life > 0);
}

  RS.combat.activateBulletTime = activateBulletTime;
  RS.combat.triggerShockwave = triggerShockwave;
  RS.combat.triggerLaserWave = triggerLaserWave;
  RS.combat.applyWaveFront = applyWaveFront;
  RS.combat.checkCombos = checkCombos;
  RS.combat.updateResBar = updateResBar;
  RS.combat.updateResourceBars = updateResourceBars;
  RS.combat.syncButtons = syncButtons;
  RS.combat.clearButtons = clearButtons;
  RS.combat.burst = burst;
  RS.combat.triggerHeadshotFx = triggerHeadshotFx;
  RS.combat.fire = fire;
  RS.combat.nearestTarget = nearestTarget;
  RS.combat.laserHopStrength = laserHopStrength;
  RS.combat.buildLaserChains = buildLaserChains;
  RS.combat.buildPiercingLasers = buildPiercingLasers;
  RS.combat.buildLasers = buildLasers;
  RS.combat.refreshShields = refreshShields;
  RS.combat.applyDamage = applyDamage;
  RS.combat.triggerShieldBlock = triggerShieldBlock;
  RS.combat.updateWaveVisuals = updateWaveVisuals;
  RS.combat.tickAutoLaser = tickAutoLaser;

  RS.combat.tick = function tick(dt) {
    const state = RS.state;
    const el = RS.dom.el;
    if (state.bannerT > 0) {
      state.bannerT -= dt;
      if (state.bannerT <= 0) el.banner.classList.remove("show");
    }
    if (state.waveCooldown > 0) state.waveCooldown -= dt;
    if (state.laserWaveCooldown > 0) state.laserWaveCooldown -= dt;
    if (state.cooldown > 0) state.cooldown -= dt;
    if (state.shooting && state.cooldown <= 0) {
      RS.combat.fire();
      state.cooldown = RS.stats.fireInterval();
    }
    RS.combat.refreshShields(dt);

    state.gravityOn = state.gravityHold && state.gravFuel > 0;
    if (state.gravityOn) {
      state.gravFuel = Math.max(0, state.gravFuel - RS.stats.gravDrainRate() * dt);
      state.gravPulse += dt * 4;
      if (state.gravFuel <= 0) state.gravityOn = false;
    } else {
      state.gravFuel = Math.min(1, state.gravFuel + RS.stats.gravRegenRate() * dt);
      state.gravPulse = 0;
    }

    state.laserOn = state.laserHold && state.laserFuel > 0;
    state.laserBeams = [];
    let laserKilled = false;
    if (state.laserOn) {
      state.laserFuel = Math.max(0, state.laserFuel - RS.stats.laserDrainRate() * dt);
      state.laserPulse += dt * 6;
      if (state.laserFuel <= 0) {
        state.laserOn = false;
      } else {
        const { beams, hits } = RS.combat.buildLasers();
        state.laserBeams = beams;
        const dps = RS.stats.laserDps();
        for (const { t, str } of hits) {
          const hit = RS.combat.applyDamage(t, dps * str * RS.stats.laserDamageMul(t) * dt, null);
          if (!hit) continue;
          if (t.dead) laserKilled = true;
          else if (Math.random() < dt * 14 * str) {
            RS.combat.burst(t.x, t.y, `rgba(255,43,214,${0.55 + 0.4 * str})`, Math.max(1, Math.round(2 * str)));
          }
        }
      }
    } else {
      state.laserFuel = Math.min(1, state.laserFuel + RS.stats.laserRegenRate() * dt);
      state.laserPulse = 0;
    }

    RS.sfx.syncLoops(
      state.gravityHold,
      state.laserHold,
      state.gravityOn,
      state.laserOn,
      state.gravityRepel
    );
    RS.combat.updateResourceBars();
    if (laserKilled) RS.shop.updateHudStats();

    tickParticles(dt);
    for (const f of state.flashes) f.life -= dt;
    state.flashes = state.flashes.filter((f) => f.life > 0);
  };

})();
