window.RS = window.RS || {};
RS.structures = RS.structures || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function setPlaceBanner(show) {
  const b = document.getElementById("place-banner");
  if (b) b.classList.toggle("show", !!show);
}

function beginPlaceStructure(key) {
  const def = RS.STRUCTURE_DEFS[key];
  if (!def) return;
  if (state.placingStructure || state.placingDefenseTarget || state.placingAmplifier) {
    RS.sfx.deny();
    return;
  }
  if (state.credits < def.cost) { RS.sfx.deny(); return; }
  state.credits -= def.cost;
  state.placingStructure = key;
  state.reopenStructuresAfterPlace = true;
  state.skipWaveStartOnShopClose = true;
  RS.combat.clearButtons();
  RS.shop.setShopOpen(false);
  setPlaceBanner(true);
  RS.waves.showBanner(def.name);
  RS.shop.updateShopUI();
  RS.sfx.buy();
}

function cancelPlaceStructure(refund) {
  if (!state.placingStructure) return;
  const key = state.placingStructure;
  const def = RS.STRUCTURE_DEFS[key];
  if (refund && def) state.credits += def.cost;
  state.placingStructure = null;
  setPlaceBanner(false);
  RS.shop.updateShopUI();
  if (state.reopenStructuresAfterPlace) {
    state.reopenStructuresAfterPlace = false;
    RS.shop.setShopOpen(true, { tab: "structures" });
  }
}

function mouseWorld() {
  return RS.camera.screenToWorld(state.mouse.x, state.mouse.y);
}

function placeStructureAt(wx, wy) {
  const key = state.placingStructure;
  const def = RS.STRUCTURE_DEFS[key];
  if (!key || !def) return;
  const pad = def.size * 0.55;
  const x = Math.max(pad, Math.min(state.arenaW - pad, wx));
  const y = Math.max(pad, Math.min(state.arenaH - pad, wy));
  state.structures.push({
    id: `${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: key,
    x, y,
    size: def.size,
    range: def.range,
    pulse: RS.enemies.rand(0, Math.PI * 2),
    birth: 0.35,
  });
  RS.combat.burst(x, y, def.color, 22);
  RS.sfx.wave();
  state.placingStructure = null;
  setPlaceBanner(false);
  RS.waves.showBanner("Postaveno");
  RS.shop.updateShopUI();
  if (state.reopenStructuresAfterPlace) {
    state.reopenStructuresAfterPlace = false;
    RS.shop.setShopOpen(true, { tab: "structures" });
  }
}

  RS.structures.setPlaceBanner = setPlaceBanner;
  RS.structures.beginPlaceStructure = beginPlaceStructure;
  RS.structures.cancelPlaceStructure = cancelPlaceStructure;
  RS.structures.mouseWorld = mouseWorld;
  RS.structures.placeStructureAt = placeStructureAt;

  RS.structures.tick = function tick(dt) {
    const state = RS.state;
    state.structureBeams = [];
    let structKilled = false;
    const retarget = RS.perf.shouldRetarget();
    for (const s of state.structures) {
      s.pulse = (s.pulse || 0) + dt * 3.2;
      if (s.birth > 0) s.birth = Math.max(0, s.birth - dt);
      if (s.kind !== "laserTurret") continue;
      const def = RS.STRUCTURE_DEFS.laserTurret;
      let best = s._target || null;
      if (best && (best.dead || Math.hypot(best.x - s.x, best.y - s.y) > s.range)) {
        best = null;
        s._target = null;
      }
      if (retarget || !best) {
        best = null;
        let bestDist = Infinity;
        for (const t of state.targets) {
          if (t.dead) continue;
          const d = Math.hypot(t.x - s.x, t.y - s.y);
          if (d <= s.range && d < bestDist) {
            bestDist = d;
            best = t;
          }
        }
        s._target = best;
      }
      if (!best) continue;
      state.structureBeams.push({
        x1: s.x, y1: s.y,
        x2: best.x, y2: best.y,
        pulse: s.pulse,
      });
      const hit = RS.combat.applyDamage(best, def.dps * dt, null);
      if (hit) {
        if (best.dead) {
          structKilled = true;
          s._target = null;
        } else if (Math.random() < dt * 10) {
          RS.combat.burst(best.x, best.y, "rgba(255,43,214,0.7)", 2);
        }
      }
    }
    if (structKilled) RS.shop.updateHudStats();
  };

})();
