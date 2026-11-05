window.RS = window.RS || {};
RS.loot = RS.loot || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function updateLootHud() {
  for (const kind of RS.LOOT_KINDS) {
    const elCount = document.getElementById(`loot-${kind}`);
    if (elCount) elCount.textContent = String(state.loot[kind] || 0);
  }
}

function spawnCreditDrop(x, y, kind) {
  const a = RS.enemies.rand(0, Math.PI * 2);
  const sp = RS.enemies.rand(40, 110);
  state.creditDrops.push({
    x, y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp,
    kind,
    phase: RS.enemies.rand(0, Math.PI * 2),
    age: 0,
    collected: false,
  });
}

function collectCreditDrop(d) {
  if (d.collected) return;
  d.collected = true;
  if (!state.loot[d.kind]) state.loot[d.kind] = 0;
  state.loot[d.kind] += 1;
  if (state.waveStats) {
    if (!state.waveStats.lootGained[d.kind]) state.waveStats.lootGained[d.kind] = 0;
    state.waveStats.lootGained[d.kind] += 1;
  }
  updateLootHud();
  RS.combat.burst(d.x, d.y, RS.enemies.kindBurstColor(d.kind), 8);
}

function updateCreditDrops(dt) {
  const aw = RS.camera.aimWorld();
  const pickR = RS.LOOT_PICKUP_RADIUS;
  const vacuum = state.lootVacuum;
  for (const d of state.creditDrops) {
    if (d.collected) continue;
    d.age += dt;
    d.phase += dt * 3.2;
    d.vx *= Math.pow(0.12, dt); // settle quickly
    d.vy *= Math.pow(0.12, dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const dx = aw.x - d.x;
    const dy = aw.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (vacuum) {
      // Strong pull from anywhere so end-of-wave loot is auto-collected
      if (dist > 0.5) {
        d.x += (dx / dist) * RS.LOOT_VACUUM_PULL * dt;
        d.y += (dy / dist) * RS.LOOT_VACUUM_PULL * dt;
      }
      if (dist <= pickR * 1.6) collectCreditDrop(d);
    } else if (dist < pickR * 2.2 && dist > 1) {
      const pull = 220 * (1 - dist / (pickR * 2.2));
      d.x += (dx / dist) * pull * dt;
      d.y += (dy / dist) * pull * dt;
      if (dist <= pickR) collectCreditDrop(d);
    } else if (dist <= pickR) {
      collectCreditDrop(d);
    }
  }
  state.creditDrops = state.creditDrops.filter((d) => !d.collected);
}

function drawCreditDrops() {
  for (const d of state.creditDrops) {
    const col = RS.enemies.kindBurstColor(d.kind);
    const bob = Math.sin(d.phase) * 3;
    const pulse = 0.75 + Math.sin(d.phase * 1.4) * 0.25;
    const r = 7 + pulse * 2;
    ctx.save();
    ctx.translate(d.x, d.y + bob);
    ctx.shadowColor = col;
    RS.perf.applyBlur(ctx, 12);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

  RS.loot.updateLootHud = updateLootHud;
  RS.loot.spawnCreditDrop = spawnCreditDrop;
  RS.loot.collectCreditDrop = collectCreditDrop;
  RS.loot.updateCreditDrops = updateCreditDrops;
  RS.loot.drawCreditDrops = drawCreditDrops;

  RS.loot.tick = function tick(dt) {
    RS.loot.updateCreditDrops(dt);
  };

})();
