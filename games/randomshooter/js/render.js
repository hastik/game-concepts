window.RS = window.RS || {};
RS.render = RS.render || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

  let bgGrad = null;
  let bgGradKey = "";

  RS.render.invalidateBgCache = function invalidateBgCache() {
    bgGrad = null;
    bgGradKey = "";
  };

function drawBackground() {
  const key = `${state.w}x${state.h}`;
  if (!bgGrad || bgGradKey !== key) {
    bgGrad = ctx.createRadialGradient(
      state.w * 0.5, state.h * 0.45, 0,
      state.w * 0.5, state.h * 0.45, Math.max(state.w, state.h) * 0.7
    );
    bgGrad.addColorStop(0, "#0a1a30");
    bgGrad.addColorStop(0.55, "#060e1c");
    bgGrad.addColorStop(1, "#03060e");
    bgGradKey = key;
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, state.w, state.h);

  const z = state.zoom;
  for (const s of state.stars) {
    if (!s._fill) s._fill = `rgba(160,220,255,${s.a})`;
    const px = ((s.x * state.w - state.cam.x * 0.2 * z) % state.w + state.w) % state.w;
    const py = ((s.y * state.h - state.cam.y * 0.2 * z) % state.h + state.h) % state.h;
    ctx.fillStyle = s._fill;
    ctx.fillRect(px, py, s.s, s.s);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(0,180,220,0.06)";
  ctx.lineWidth = 1;
  const step = 56;
  const left = state.cam.x;
  const top = state.cam.y;
  const right = state.cam.x + state.w / z;
  const bottom = state.cam.y + state.h / z;
  const x0 = Math.floor(left / step) * step;
  const y0 = Math.floor(top / step) * step;
  ctx.beginPath();
  for (let x = x0; x <= right; x += step) {
    const sx = (x - state.cam.x) * z;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, state.h);
  }
  for (let y = y0; y <= bottom; y += step) {
    const sy = (y - state.cam.y) * z;
    ctx.moveTo(0, sy);
    ctx.lineTo(state.w, sy);
  }
  ctx.stroke();

  // faint HUD rings (screen-fixed)
  ctx.strokeStyle = "rgba(0,229,255,0.05)";
  ctx.beginPath();
  ctx.arc(state.w * 0.5, state.h * 0.48, Math.min(state.w, state.h) * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(state.w * 0.5, state.h * 0.48, Math.min(state.w, state.h) * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function guidedTipLen(hx) {
  return hx * 0.42;
}

/** Square hull, or pointed front (+X) when guided. */
function enemyHullPath(ctx, hx, hy, guided) {
  if (!guided) {
    ctx.rect(-hx, -hy, hx * 2, hy * 2);
    return;
  }
  // Front edge → tip (same silhouette as the reference sketch)
  const tip = guidedTipLen(hx);
  ctx.moveTo(-hx, -hy);
  ctx.lineTo(hx, -hy);
  ctx.lineTo(hx + tip, 0);
  ctx.lineTo(hx, hy);
  ctx.lineTo(-hx, hy);
  ctx.closePath();
}

function drawTarget(t) {
  const isCloaker = !!(RS.enemies.isCloakerKind && RS.enemies.isCloakerKind(t));
  if (isCloaker && RS.enemies.isCloakerRevealed && !RS.enemies.isCloakerRevealed(t)) {
    return; // hidden unless Debug / shockwave stun
  }
  const cloakA = t.cloakAlpha != null ? t.cloakAlpha : 1;
  if (cloakA <= 0.004) return; // fully cloaked — skip body (beams drawn separately)

  const style = RS.enemies.kindStyle(t.kind);
  const isShip = t.kind === "mothership";
  const guided = !!(t.guided || (RS.enemies.isGuided && RS.enemies.isGuided(t)));
  ctx.save();
  if (cloakA < 0.999) ctx.globalAlpha = cloakA;
  ctx.translate(t.x, t.y);
  ctx.rotate(t.rot);
  const bw = isShip ? (t.sizeW || t.size) : t.size;
  const bh = isShip ? (t.sizeH || t.size * 0.5) : t.size;
  const ratio = Math.max(0, Math.min(1, t.hp / t.maxHp));
  const hx = bw / 2;
  const hy = bh / 2;

  // Empty shell
  ctx.shadowColor = style.glow;
  RS.perf.applyBlur(ctx, isShip ? 18 : 14);
  ctx.fillStyle = style.empty;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = isShip || t.kind === "tank" || t.kind === "guidedTank" ? 3 : 2.2;
  ctx.beginPath();
  enemyHullPath(ctx, hx, hy, guided && !isShip);
  ctx.fill();
  ctx.stroke();

  // HP fill from bottom (100% = full body, including guided tip)
  if (ratio > 0.001) {
    const useGuided = guided && !isShip;
    const tip = useGuided ? guidedTipLen(hx) : 0;
    const fh = bh * ratio;
    ctx.save();
    ctx.beginPath();
    enemyHullPath(ctx, hx, hy, useGuided);
    ctx.clip();
    // Rising bar must cover the nose (+X tip), not only the square body
    ctx.beginPath();
    ctx.rect(-hx, hy - fh, bw + tip, fh);
    ctx.clip();
    RS.perf.applyBlur(ctx, 8);
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    enemyHullPath(ctx, hx, hy, useGuided);
    ctx.fill();
    ctx.restore();
  }

  // Kind mark
  RS.perf.applyBlur(ctx, 6);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = t.kind === "tank" || t.kind === "guidedTank" || isShip ? 2.8 : 2.2;
  ctx.beginPath();
  const m = Math.min(bw, bh) * 0.22;
  if (t.kind === "healer") {
    ctx.moveTo(-m, 0); ctx.lineTo(m, 0);
    ctx.moveTo(0, -m); ctx.lineTo(0, m);
  } else if (t.kind === "tank" || t.kind === "guidedTank") {
    const b = t.size * 0.18;
    ctx.strokeRect(-b, -b, b * 2, b * 2);
  } else if (t.kind === "gainer") {
    ctx.moveTo(0, -m);
    ctx.lineTo(m, 0);
    ctx.lineTo(0, m);
    ctx.lineTo(-m, 0);
    ctx.closePath();
  } else if (t.kind === "rammer") {
    // Spike / čipka pointing forward (+X in local rot space)
    const tip = m * 1.35;
    ctx.moveTo(tip, 0);
    ctx.lineTo(-m * 0.55, -m * 0.85);
    ctx.lineTo(-m * 0.2, 0);
    ctx.lineTo(-m * 0.55, m * 0.85);
    ctx.closePath();
  } else if (t.kind === "sniper") {
    ctx.moveTo(-m * 0.2, 0); ctx.lineTo(m * 1.15, 0);
    ctx.moveTo(m * 0.55, -m * 0.45); ctx.lineTo(m * 1.15, 0); ctx.lineTo(m * 0.55, m * 0.45);
    ctx.moveTo(-m * 0.7, -m * 0.35); ctx.lineTo(-m * 0.7, m * 0.35);
  } else if (t.kind === "splitter") {
    const s = m * 0.55;
    ctx.strokeRect(-s * 1.6, -s * 1.6, s, s);
    ctx.strokeRect(s * 0.6, -s * 1.6, s, s);
    ctx.strokeRect(-s * 0.5, s * 0.6, s, s);
  } else if (isCloaker) {
    ctx.beginPath();
    ctx.arc(0, 0, m * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, m * 1.15, 0, Math.PI * 2);
  } else if (isShip) {
    // Hangar / bay marks
    const bay = bh * 0.28;
    ctx.moveTo(-bw * 0.28, -bay); ctx.lineTo(-bw * 0.28, bay);
    ctx.moveTo(0, -bay); ctx.lineTo(0, bay);
    ctx.moveTo(bw * 0.28, -bay); ctx.lineTo(bw * 0.28, bay);
  } else {
    ctx.moveTo(-m, -m); ctx.lineTo(m, m);
    ctx.moveTo(m, -m); ctx.lineTo(-m, m);
  }
  ctx.stroke();
  // Mothership launch timer (fills left → right until next spawn)
  if (isShip) {
    const interval = t.spawnInterval || RS.enemies.mothershipSpawnInterval(state.wave);
    const prog = Math.max(0, Math.min(1, (t.spawnTimer || 0) / interval));
    const barH = Math.max(3, bh * 0.1);
    const barY = hy - barH - 4;
    const barW = bw * 0.72;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(10, 4, 24, 0.55)";
    ctx.fillRect(-barW / 2, barY, barW, barH);
    ctx.fillStyle = `rgba(201, 160, 255, ${0.45 + prog * 0.5})`;
    ctx.shadowColor = "#c9a0ff";
    RS.perf.applyBlur(ctx, 6);
    ctx.fillRect(-barW / 2, barY, barW * prog, barH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(201, 160, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-barW / 2, barY, barW, barH);
  }

  ctx.shadowBlur = 0;
  if (t.freezeLeft > 0) {
    ctx.fillStyle = "rgba(180, 230, 255, 0.22)";
    ctx.beginPath();
    enemyHullPath(ctx, hx, hy, guided && !isShip);
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 240, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    enemyHullPath(ctx, Math.max(2, hx - 2), Math.max(2, hy - 2), guided && !isShip);
    ctx.stroke();
  }

  // Shield rim around perimeter (flashes bright when a hit is blocked)
  if (t.shielded) {
    const flash = Math.min(1, (t.shieldFlash || 0) / 0.18);
    const pulse = 0.55 + Math.sin((t.shieldPulse || state.time * 4) * 2) * 0.25;
    const a = (0.55 + 0.45 * flash) * pulse;
    const useGuided = guided && !isShip;
    ctx.strokeStyle = `rgba(77, 201, 255, ${a})`;
    ctx.lineWidth = 2 + flash * 3.5;
    ctx.shadowColor = "#4dc9ff";
    RS.perf.applyBlur(ctx, 10 + flash * 18);
    const pad = 3 + flash * 4;
    ctx.beginPath();
    enemyHullPath(ctx, hx + pad, hy + pad, useGuided);
    ctx.stroke();
    if (flash > 0.05) {
      ctx.fillStyle = `rgba(77, 201, 255, ${0.12 * flash})`;
      ctx.beginPath();
      enemyHullPath(ctx, hx + pad, hy + pad, useGuided);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // Cloaker field rings — only while Debug is on
  if (isCloaker && state.debugReveal) {
    const cDef = RS.ENEMY_DEFS[t.kind] || RS.ENEMY_DEFS.cloaker;
    const ri = t.cloakInner || cDef.cloakInner(state.wave);
    const ro = t.cloakOuter || cDef.cloakOuter(state.wave);
    const disabled = t.freezeLeft > 0;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = disabled ? "rgba(184,196,255,0.18)" : "rgba(184,196,255,0.6)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash(disabled ? [2, 8] : [5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, ri, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = disabled ? "rgba(184,196,255,0.1)" : "rgba(184,196,255,0.3)";
    ctx.setLineDash(disabled ? [1, 10] : [2, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, ro, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawShieldBeams() {
  if (!state.shieldBeams.length) return;
  const always = !!state.debugReveal;
  ctx.save();
  for (const b of state.shieldBeams) {
    // Visible only in Debug, or briefly on links involved in the blocked hit
    const flashAmt = b.hitFlash || 0;
    if (!always && flashAmt <= 0.001) continue;
    const flash = Math.min(1, flashAmt / 0.18);
    const flicker = 0.65 + Math.sin(b.pulse * 2.8) * 0.35;
    const boost = 1 + flash * 2.2;
    // Outside debug, lean on flash so the beam reads as a hit reaction
    const baseA = always ? 0.18 + 0.35 * flash : 0.35 + 0.45 * flash;
    ctx.shadowColor = "#4dc9ff";
    RS.perf.applyBlur(ctx, 8 + flash * 16);
    ctx.strokeStyle = `rgba(77,201,255,${baseA * flicker})`;
    ctx.lineWidth = (4 + flash * 6) * boost * 0.55;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(180,235,255,${(0.85 + 0.15 * flash) * flicker})`;
    ctx.lineWidth = 1.15 + flash * 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    const u = (Math.sin(b.pulse * 1.6) * 0.5 + 0.5);
    const sx = b.x1 + (b.x2 - b.x1) * u;
    const sy = b.y1 + (b.y2 - b.y1) * u;
    ctx.fillStyle = `rgba(77,201,255,${(0.8 + 0.2 * flash) * flicker})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2 + flicker * 0.8 + flash * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHealBeams() {
  if (!state.healBeams.length) return;
  ctx.save();
  for (const b of state.healBeams) {
    const flicker = 0.7 + Math.sin(b.pulse * 2.2) * 0.3;
    const s = b.strength != null ? b.strength : 1;
    ctx.shadowColor = "#3dff8a";
    RS.perf.applyBlur(ctx, 12);
    ctx.strokeStyle = `rgba(61,255,138,${0.22 * flicker * s})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(180,255,210,${0.9 * flicker * s})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    // traveling spark along the beam
    const u = (Math.sin(b.pulse * 1.4) * 0.5 + 0.5);
    const sx = b.x1 + (b.x2 - b.x1) * u;
    const sy = b.y1 + (b.y2 - b.y1) * u;
    ctx.fillStyle = `rgba(61,255,138,${0.85 * flicker})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5 + flicker, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(61,255,138,${0.55 * flicker})`;
    ctx.beginPath();
    ctx.arc(b.x2, b.y2, 5 + Math.sin(b.pulse) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShockwaves() {
  for (const w of state.shockwaves) {
    const a = Math.max(0, w.life / w.maxLife);
    ctx.save();
    ctx.shadowColor = "#ffe066";
    RS.perf.applyBlur(ctx, 20);
    ctx.strokeStyle = `rgba(255,224,102,${0.85 * a})`;
    ctx.lineWidth = 3 + (1 - a) * 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${0.35 * a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0, w.r - 12), 0, Math.PI * 2);
    ctx.stroke();

    const grad = ctx.createRadialGradient(w.x, w.y, Math.max(0, w.r * 0.7), w.x, w.y, w.r);
    grad.addColorStop(0, "rgba(255,224,102,0)");
    grad.addColorStop(1, `rgba(255,224,102,${0.12 * a})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const w of state.laserWaves) {
    const a = Math.max(0, w.life / w.maxLife);
    ctx.save();
    ctx.shadowColor = "#ff2bd6";
    RS.perf.applyBlur(ctx, 24);
    ctx.strokeStyle = `rgba(255,43,214,${0.9 * a})`;
    ctx.lineWidth = 3 + (1 - a) * 5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,180,230,${0.45 * a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0, w.r - 14), 0, Math.PI * 2);
    ctx.stroke();

    // quadratic falloff hint — brighter core
    const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, Math.max(1, w.r));
    grad.addColorStop(0, `rgba(255,43,214,${0.28 * a})`);
    grad.addColorStop(0.45, `rgba(255,43,214,${0.1 * a})`);
    grad.addColorStop(1, "rgba(255,43,214,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

}

function drawFreezeTint() {
  const anyFrozen = state.targets.some((t) => !t.dead && t.freezeLeft > 0);
  if (!anyFrozen) return;
  const pulse = 0.04 + Math.sin(state.time * 6) * 0.015;
  ctx.fillStyle = `rgba(160, 220, 255, ${pulse})`;
  ctx.fillRect(0, 0, state.w, state.h);
}

function drawArenaBounds() {
  if (state.arenaW <= 0 || state.arenaH <= 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(0,229,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(0, 0, state.arenaW, state.arenaH);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,229,255,0.12)";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, state.arenaW, state.arenaH);
  ctx.restore();
}

function drawGravityField() {
  if (!state.gravityHold && !state.gravityOn) return;
  const aw = RS.camera.aimWorld();
  const x = aw.x;
  const y = aw.y;
  const r = RS.stats.gravRadius();
  const active = state.gravityOn;
  const repel = !!state.gravityRepel;
  const pulse = active ? 1 + Math.sin(state.gravPulse) * 0.03 : 1;
  const col = repel ? "255,224,102" : "0,229,255";
  const glow = repel ? "#ffe066" : "#00e5ff";

  ctx.save();
  if (active) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
    grad.addColorStop(0, `rgba(${col},0.18)`);
    grad.addColorStop(0.5, `rgba(${col},0.05)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = active ? `rgba(${col},0.75)` : `rgba(${col},0.25)`;
  ctx.lineWidth = active ? 2 : 1;
  ctx.shadowColor = glow;
  RS.perf.applyBlur(ctx, active ? 12 : 0);
  ctx.setLineDash(active ? [] : [6, 6]);
  ctx.beginPath();
  ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (active) {
    // Pull: CW + dashes flow inward · Repel: CCW + dashes flow outward
    const spin = state.gravPulse * 0.35 * (repel ? -1 : 1);
    const dashLen = 0.09;
    const gap = 0.14;
    const period = dashLen + gap;
    // Positive phase advance = travel toward outer radius
    const phase =
      (((repel ? 1 : -1) * state.gravPulse * 0.18) % period + period) % period;
    const r0 = r * 0.28;
    const r1 = r * 0.92;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + spin;
      const cos = Math.cos(a);
      const sin = Math.sin(a);

      // Faint full spoke
      ctx.strokeStyle = `rgba(${col},0.18)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cos * r0, y + sin * r0);
      ctx.lineTo(x + cos * r1, y + sin * r1);
      ctx.stroke();

      // Moving dashes along the ray
      for (let t = -phase; t < 1; t += period) {
        const t0 = Math.max(0, t);
        const t1 = Math.min(1, t + dashLen);
        if (t1 <= t0) continue;
        const ra = r0 + (r1 - r0) * t0;
        const rb = r0 + (r1 - r0) * t1;
        const mid = (t0 + t1) * 0.5;
        // Brighter toward travel direction tip
        const tip = repel ? mid : 1 - mid;
        const alpha = 0.3 + 0.55 * tip;
        ctx.strokeStyle = `rgba(${col},${alpha})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x + cos * ra, y + sin * ra);
        ctx.lineTo(x + cos * rb, y + sin * rb);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawLasers() {
  if (!state.laserOn || state.laserBeams.length === 0) return;
  const flicker = 0.75 + Math.sin(state.laserPulse * 2.5) * 0.25;
  ctx.save();
  for (const b of state.laserBeams) {
    const s = b.str != null ? b.str : 1;
    const piercing = !!b.piercing;
    ctx.shadowColor = "#ff2bd6";
    RS.perf.applyBlur(ctx, piercing ? 8 + 6 * s : 8 + 8 * s);
    ctx.strokeStyle = `rgba(255,43,214,${(piercing ? 0.32 : 0.28) * flicker * s})`;
    ctx.lineWidth = piercing ? 3.5 + 3 * s : 3 + 5 * s;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,180,230,${0.95 * flicker * (0.35 + 0.65 * s)})`;
    ctx.lineWidth = piercing ? 1 + s : 0.8 + 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,43,214,${0.7 * flicker * s})`;
    ctx.beginPath();
    ctx.arc(b.x2, b.y2, (2.2 + 2.8 * s) + Math.sin(state.laserPulse + b.x2) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Mint intercept lasers — dashed, angular tip (vs solid magenta offense laser). */
function drawAutoLasers() {
  const beamsOn = RS.stats.autoLaserBeams() > 0;
  if (!beamsOn && (!state.autoLaserRays || state.autoLaserRays.length === 0)) return;
  const aw = RS.camera.aimWorld();
  const pulse = 0.7 + Math.sin(state.time * 9) * 0.3;
  ctx.save();

  // Soft engagement ring — short ticks (screen-stable via zoom)
  if (beamsOn) {
    const r = RS.stats.autoLaserRadius();
    const z = Math.max(0.05, state.zoom || 1);
    const tickPx = 2.2;
    const gapPx = 5.5;
    const circ = Math.PI * 2 * r;
    const period = (tickPx + gapPx) / z;
    const tickLen = tickPx / z;
    const n = Math.max(24, Math.floor(circ / period));
    ctx.strokeStyle = `rgba(0,255,200,${0.28 + 0.14 * pulse})`;
    ctx.lineWidth = Math.max(0.6, 1.35 / z);
    ctx.lineCap = "butt";
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + tickLen / r;
      ctx.beginPath();
      ctx.arc(aw.x, aw.y, r, a0, a1);
      ctx.stroke();
    }
  }

  const rays = state.autoLaserRays || [];
  for (const b of rays) {
    const dx = b.x2 - b.x1;
    const dy = b.y2 - b.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;

    ctx.shadowColor = "#00ffc8";
    RS.perf.applyBlur(ctx, 10);
    ctx.strokeStyle = `rgba(0,255,200,${0.35 * pulse})`;
    ctx.lineWidth = 3.2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -state.time * 40;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(200,255,240,${0.9 * pulse})`;
    ctx.lineWidth = 1.15;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angular chevron tip at projectile
    const tip = 7;
    ctx.fillStyle = `rgba(0,255,200,${0.85 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(b.x2 + ux * 2, b.y2 + uy * 2);
    ctx.lineTo(b.x2 - ux * tip + px * tip * 0.7, b.y2 - uy * tip + py * tip * 0.7);
    ctx.lineTo(b.x2 - ux * tip - px * tip * 0.7, b.y2 - uy * tip - py * tip * 0.7);
    ctx.closePath();
    ctx.fill();

    // Origin node on aim
    ctx.beginPath();
    ctx.fillStyle = `rgba(180,255,240,${0.75 * pulse})`;
    ctx.arc(b.x1, b.y1, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawStructures() {
  for (const s of state.structures) {
    const def = RS.STRUCTURE_DEFS[s.kind];
    if (!def) continue;
    const birth = s.birth > 0 ? 1 - s.birth / 0.35 : 1;
    const pulse = 1 + Math.sin(s.pulse || 0) * 0.04;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * birth;
    ctx.translate(s.x, s.y);

    // Range ring
    ctx.strokeStyle = s.kind === "antigravitron"
      ? "rgba(255,224,102,0.22)"
      : "rgba(255,43,214,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, s.range * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.kind === "antigravitron") {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s.range * 0.55);
      grad.addColorStop(0, "rgba(255,224,102,0.16)");
      grad.addColorStop(1, "rgba(255,224,102,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, s.range * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // Push ticks outward
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + (s.pulse || 0) * 0.25;
        ctx.strokeStyle = "rgba(255,224,102,0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s.size * 0.45, Math.sin(a) * s.size * 0.45);
        ctx.lineTo(Math.cos(a) * s.size * 0.85, Math.sin(a) * s.size * 0.85);
        ctx.stroke();
      }
      ctx.shadowColor = "#ffe066";
      RS.perf.applyBlur(ctx, 12);
      ctx.fillStyle = "rgba(40, 30, 0, 0.9)";
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, s.size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Laser turret body
      ctx.shadowColor = "#ff2bd6";
      RS.perf.applyBlur(ctx, 12);
      ctx.fillStyle = "rgba(40, 0, 35, 0.9)";
      ctx.strokeStyle = "#ff2bd6";
      ctx.lineWidth = 2.2;
      const hs = s.size * 0.5;
      ctx.fillRect(-hs * 0.7, -hs * 0.7, hs * 1.4, hs * 1.4);
      ctx.strokeRect(-hs * 0.7, -hs * 0.7, hs * 1.4, hs * 1.4);
      ctx.beginPath();
      ctx.moveTo(0, -hs * 0.15);
      ctx.lineTo(0, -hs * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Turret beams
  if (state.structureBeams.length) {
    const flicker = 0.7 + Math.sin(state.time * 8) * 0.3;
    ctx.save();
    for (const b of state.structureBeams) {
      ctx.shadowColor = "#ff2bd6";
      RS.perf.applyBlur(ctx, 10);
      ctx.strokeStyle = `rgba(255,43,214,${0.35 * flicker})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,180,230,${0.9 * flicker})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawStructureGhost() {
  if (!state.placingStructure) return;
  const def = RS.STRUCTURE_DEFS[state.placingStructure];
  if (!def) return;
  const mw = RS.structures.mouseWorld();
  const pad = def.size * 0.55;
  const x = Math.max(pad, Math.min(state.arenaW - pad, mw.x));
  const y = Math.max(pad, Math.min(state.arenaH - pad, mw.y));
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.45 + Math.sin(state.time * 6) * 0.12;
  ctx.strokeStyle = def.color;
  ctx.fillStyle = def.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, def.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = def.color;
  RS.perf.applyBlur(ctx, 14);
  if (state.placingStructure === "antigravitron") {
    ctx.beginPath();
    ctx.arc(0, 0, def.size * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const hs = def.size * 0.5;
    ctx.strokeRect(-hs * 0.7, -hs * 0.7, hs * 1.4, hs * 1.4);
  }
  ctx.restore();
}

function drawCursorGhost() {
  const dx = state.mouse.x - state.aim.x;
  const dy = state.mouse.y - state.aim.y;
  if (Math.hypot(dx, dy) < 4) return;
  ctx.save();
  ctx.strokeStyle = "rgba(0,229,255,0.28)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(state.aim.x, state.aim.y);
  ctx.lineTo(state.mouse.x, state.mouse.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(state.mouse.x, state.mouse.y, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair() {
  const x = state.aim.x;
  const y = state.aim.y;
  const z = state.zoom;
  const r = RS.stats.shotRadius() * z;
  const ready = state.cooldown <= 0.02;
  const rot = state.time * 0.8;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#00e5ff";
  RS.perf.applyBlur(ctx, 10);

  // outer segmented ring
  ctx.rotate(rot);
  ctx.strokeStyle = ready ? "rgba(0,229,255,0.7)" : "rgba(90,120,150,0.4)";
  ctx.lineWidth = 2 * z;
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10 * z, a0, a0 + Math.PI * 0.35);
    ctx.stroke();
  }
  ctx.rotate(-rot);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = ready ? "rgba(0,229,255,0.45)" : "rgba(90,120,150,0.3)";
  ctx.lineWidth = 1.5 * z;
  ctx.stroke();

  // cross ticks
  ctx.strokeStyle = ready ? "#00e5ff" : "#5a7a9a";
  ctx.lineWidth = 2 * z;
  const gap = 5 * z;
  ctx.beginPath();
  ctx.moveTo(-r - 2 * z, 0); ctx.lineTo(-gap, 0);
  ctx.moveTo(gap, 0); ctx.lineTo(r + 2 * z, 0);
  ctx.moveTo(0, -r - 2 * z); ctx.lineTo(0, -gap);
  ctx.moveTo(0, gap); ctx.lineTo(0, r + 2 * z);
  ctx.stroke();

  // core
  RS.perf.applyBlur(ctx, 14);
  ctx.fillStyle = "#e8ffff";
  ctx.beginPath();
  ctx.arc(0, 0, 3.2 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#00e5ff";
  ctx.beginPath();
  ctx.arc(0, 0, 1.6 * z, 0, Math.PI * 2);
  ctx.fill();

  if (state.cooldown > 0) {
    const t = 1 - state.cooldown / RS.stats.fireInterval();
    RS.perf.applyBlur(ctx, 8);
    ctx.strokeStyle = "rgba(0,229,255,0.9)";
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.arc(0, 0, r + 16 * z, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
  }
  ctx.restore();
}

function radarBlipColor(kind) {
  if (kind === "healer") return "#3dff8a";
  if (kind === "tank" || kind === "guidedTank") return "#ff9a3d";
  if (kind === "gainer") return "#4dc9ff";
  if (kind === "mothership") return "#c9a0ff";
  if (kind === "rammer") return "#ff4d6d";
  if (kind === "sniper") return "#ffe566";
  if (kind === "splitter") return "#ff8c42";
  if (kind === "cloaker" || kind === "guidedCloaker") return "#b8c4ff";
  return "#ff2bd6";
}

function drawEnemyProjectiles() {
  const shots = state.enemyProjectiles;
  if (!shots || shots.length === 0) return;
  ctx.save();
  for (const p of shots) {
    const r = p.r || 5;
    ctx.shadowColor = "#ffe566";
    RS.perf.applyBlur(ctx, 8);
    ctx.fillStyle = "rgba(255,229,102,0.95)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,220,0.9)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRadar() {
  const c = radarCtx;
  const size = el.radar.width;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const radius = size * 0.5 - 1.5;
  const pad = 14;
  const aw = Math.max(1, state.arenaW);
  const ah = Math.max(1, state.arenaH);
  const scale = Math.min((size - pad * 2) / aw, (size - pad * 2) / ah);
  const ox = (size - aw * scale) * 0.5;
  const oy = (size - ah * scale) * 0.5;

  c.clearRect(0, 0, size, size);

  c.save();
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.clip();

  c.fillStyle = "rgba(4, 14, 28, 0.95)";
  c.fillRect(0, 0, size, size);

  // Arena outline (may be rectangular inside the circle)
  c.strokeStyle = "rgba(0,229,255,0.28)";
  c.lineWidth = 1;
  c.strokeRect(ox, oy, aw * scale, ah * scale);

  // Crosshair grid through center
  c.strokeStyle = "rgba(0,180,220,0.14)";
  c.beginPath();
  c.moveTo(cx, cy - radius); c.lineTo(cx, cy + radius);
  c.moveTo(cx - radius, cy); c.lineTo(cx + radius, cy);
  c.stroke();

  // Concentric rings
  c.strokeStyle = "rgba(0,229,255,0.18)";
  for (let i = 1; i <= 3; i++) {
    c.beginPath();
    c.arc(cx, cy, radius * (i / 3), 0, Math.PI * 2);
    c.stroke();
  }

  // Sweep
  const sweep = (state.time * 1.35) % (Math.PI * 2);
  c.save();
  c.translate(cx, cy);
  c.rotate(sweep);
  const grad = c.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, "rgba(0,229,255,0.25)");
  grad.addColorStop(1, "rgba(0,229,255,0)");
  c.fillStyle = grad;
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, radius, -0.55, 0.05);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(0,229,255,0.65)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(radius, 0);
  c.stroke();
  c.restore();

  // Enemies (fully cloaked stay off radar; partial fade)
  for (const t of state.targets) {
    if (t.dead) continue;
    if (RS.enemies.isCloakerKind && RS.enemies.isCloakerKind(t)
      && RS.enemies.isCloakerRevealed && !RS.enemies.isCloakerRevealed(t)) {
      continue;
    }
    const cloakA = t.cloakAlpha != null ? t.cloakAlpha : 1;
    if (cloakA <= 0.004) continue;
    const px = ox + t.x * scale;
    const py = oy + t.y * scale;
    const col = radarBlipColor(t.kind);
    const r = t.kind === "mothership" ? 3.2
      : (t.kind === "tank" || t.kind === "guidedTank") ? 2.6
      : (t.kind === "cloaker" || t.kind === "guidedCloaker") ? 2.8
      : 2;
    c.globalAlpha = cloakA < 0.999 ? cloakA : 1;
    c.fillStyle = col;
    c.shadowColor = col;
    RS.perf.applyBlur(c, 6);
    c.beginPath();
    c.arc(px, py, r, 0, Math.PI * 2);
    c.fill();
    if (t.freezeLeft > 0) {
      c.shadowBlur = 0;
      c.strokeStyle = "rgba(200,240,255,0.9)";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(px, py, r + 2, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  // Defense target
  if (state.defenseTarget) {
    const d = state.defenseTarget;
    const px = ox + d.x * scale;
    const py = oy + d.y * scale;
    c.shadowBlur = 0;
    c.strokeStyle = "#ffe066";
    c.fillStyle = "rgba(255,210,74,0.55)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(px, py, 3.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.shadowBlur = 0;

  // Aim (world)
  if (state.running) {
    const awAim = RS.camera.aimWorld();
    const ax = ox + awAim.x * scale;
    const ay = oy + awAim.y * scale;
    c.strokeStyle = "#00e5ff";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(ax - 4, ay); c.lineTo(ax + 4, ay);
    c.moveTo(ax, ay - 4); c.lineTo(ax, ay + 4);
    c.stroke();
    c.fillStyle = "rgba(0,229,255,0.9)";
    c.beginPath();
    c.arc(ax, ay, 1.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // Outer rim (outside clip)
  c.strokeStyle = "rgba(0,229,255,0.7)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.stroke();
}

function draw() {
  RS.camera.setScreenTransform();
  ctx.clearRect(0, 0, state.w, state.h);
  drawBackground();

  RS.camera.setWorldTransform();
  drawArenaBounds();
  if (state.running) drawGravityField();
  if (state.running) drawShockwaves();

  for (const f of state.flashes) {
    const a = f.life / f.max;
    const expand = f.r * (1.1 + (1 - a) * 0.35);
    if (f.kind === "headshot" || f.kind === "headshotCore") {
      const isCore = f.kind === "headshotCore";
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.shadowColor = "#ffd24a";
      RS.perf.applyBlur(ctx, isCore ? 28 : 36);
      ctx.beginPath();
      ctx.fillStyle = isCore
        ? `rgba(255,255,255,${0.55 * a})`
        : `rgba(255,210,74,${0.28 * a})`;
      ctx.arc(0, 0, expand, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,246,200,${(isCore ? 0.95 : 0.75) * a})`;
      ctx.lineWidth = isCore ? 3.5 : 5;
      ctx.arc(0, 0, expand * (isCore ? 0.92 : 1), 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair slash marks
      if (!isCore) {
        const arm = expand * 0.55;
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-arm, -arm);
        ctx.lineTo(arm, arm);
        ctx.moveTo(arm, -arm);
        ctx.lineTo(-arm, arm);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      continue;
    }
    ctx.beginPath();
    ctx.fillStyle = f.hit
      ? `rgba(0,229,255,${0.16 * a})`
      : `rgba(255,43,214,${0.1 * a})`;
    ctx.arc(f.x, f.y, expand, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const t of state.targets) drawTarget(t);
  if (state.running) drawEnemyProjectiles();
  drawStructures();
  if (RS.tools && RS.tools.draw) RS.tools.draw(ctx);
  if (state.running) drawShieldBeams();
  if (state.running) drawHealBeams();
  if (state.running) drawLasers();
  if (state.running) drawAutoLasers();
  drawStructureGhost();
  if (RS.tools && RS.tools.drawGhost) RS.tools.drawGhost(ctx);
  RS.loot.drawCreditDrops();

  for (const p of state.particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    RS.perf.applyBlur(ctx, 6);
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  RS.camera.setScreenTransform();
  drawFreezeTint();
  if (state.running) {
    drawCursorGhost();
    drawCrosshair();
  }
  drawRadar();
}

  RS.render.drawBackground = drawBackground;
  RS.render.drawTarget = drawTarget;
  RS.render.drawShieldBeams = drawShieldBeams;
  RS.render.drawHealBeams = drawHealBeams;
  RS.render.drawShockwaves = drawShockwaves;
  RS.render.drawFreezeTint = drawFreezeTint;
  RS.render.drawArenaBounds = drawArenaBounds;
  RS.render.drawGravityField = drawGravityField;
  RS.render.drawLasers = drawLasers;
  RS.render.drawStructures = drawStructures;
  RS.render.drawStructureGhost = drawStructureGhost;
  RS.render.drawCursorGhost = drawCursorGhost;
  RS.render.drawCrosshair = drawCrosshair;
  RS.render.radarBlipColor = radarBlipColor;
  RS.render.drawRadar = drawRadar;
  RS.render.draw = draw;

})();
