window.RS = window.RS || {};
RS.camera = RS.camera || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

function updateAim(dt) {
  const dx = state.mouse.x - state.aim.x;
  const dy = state.mouse.y - state.aim.y;
  const dist = Math.hypot(dx, dy);
  // Screen step scales with zoom → constant catch-up speed in world space
  const snap = 0.5 * state.zoom;
  if (dist < snap) {
    state.aim.x = state.mouse.x;
    state.aim.y = state.mouse.y;
    return;
  }
  const step = RS.stats.aimSpeed() * state.zoom * dt;
  if (dist <= step) {
    state.aim.x = state.mouse.x;
    state.aim.y = state.mouse.y;
  } else {
    state.aim.x += (dx / dist) * step;
    state.aim.y += (dy / dist) * step;
  }
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - state.cam.x) * state.zoom,
    y: (wy - state.cam.y) * state.zoom,
  };
}

function screenToWorld(sx, sy) {
  return {
    x: sx / state.zoom + state.cam.x,
    y: sy / state.zoom + state.cam.y,
  };
}

function aimWorld() {
  return screenToWorld(state.aim.x, state.aim.y);
}

function updateZoomHud() {
  if (el.zoomValue) el.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

function arenaScaleForWave(wave) {
  const base = 1 / RS.ARENA_START_FIT_ZOOM;
  return base * (1 + Math.max(0, wave - 1) * RS.ARENA_GROWTH_PER_WAVE);
}

function fitCameraToArena() {
  const aw = state.arenaW;
  const ah = state.arenaH;
  if (aw <= 0 || ah <= 0 || state.w <= 0 || state.h <= 0) return;
  const fitZoom = Math.min(state.w / aw, state.h / ah);
  state.fitZoom = fitZoom;
  if (!state.zoomManual) {
    state.zoom = fitZoom;
    state.cam.x = (aw - state.w / fitZoom) * 0.5;
    state.cam.y = (ah - state.h / fitZoom) * 0.5;
  }
  updateZoomHud();
}

function syncArenaToWave() {
  const s = arenaScaleForWave(Math.max(1, state.wave || 1));
  state.arenaW = state.w * s;
  state.arenaH = state.h * s;
  state.zoomManual = false;
  fitCameraToArena();
}

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  const next = Math.max(RS.ZOOM_MIN, Math.min(RS.ZOOM_MAX, state.zoom * factor));
  if (Math.abs(next - state.zoom) < 1e-6) return;
  state.zoomManual = true;
  state.zoom = next;
  state.cam.x = before.x - sx / state.zoom;
  state.cam.y = before.y - sy / state.zoom;
  updateZoomHud();
}

function setZoomPct(pct) {
  const target = Math.max(RS.ZOOM_MIN * 100, Math.min(RS.ZOOM_MAX * 100, Math.round(pct)));
  const factor = (target / 100) / state.zoom;
  zoomAt(state.w * 0.5, state.h * 0.5, factor);
}

function resetView() {
  state.zoomManual = false;
  syncArenaToWave();
}

function setScreenTransform() {
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function setWorldTransform() {
  const z = state.zoom;
  ctx.setTransform(
    state.dpr * z, 0, 0, state.dpr * z,
    -state.cam.x * state.dpr * z,
    -state.cam.y * state.dpr * z
  );
}

function initStars() {
  state.stars = [];
  for (let i = 0; i < 80; i++) {
    state.stars.push({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() * 1.6 + 0.3,
      a: Math.random() * 0.5 + 0.15,
    });
  }
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  if (!state.stars.length) initStars();
  if (RS.render && RS.render.invalidateBgCache) RS.render.invalidateBgCache();
  // Keep arena aspect matched to viewport; re-fit camera
  if (state.w > 0 && state.h > 0) {
    const wave = state.wave < 1 ? 1 : Math.max(1, state.wave);
    const s = arenaScaleForWave(wave);
    state.arenaW = state.w * s;
    state.arenaH = state.h * s;
    state.zoomManual = false;
    fitCameraToArena();
  }
}

  RS.camera.updateAim = updateAim;
  RS.camera.worldToScreen = worldToScreen;
  RS.camera.screenToWorld = screenToWorld;
  RS.camera.aimWorld = aimWorld;
  RS.camera.updateZoomHud = updateZoomHud;
  RS.camera.arenaScaleForWave = arenaScaleForWave;
  RS.camera.fitCameraToArena = fitCameraToArena;
  RS.camera.syncArenaToWave = syncArenaToWave;
  RS.camera.zoomAt = zoomAt;
  RS.camera.setZoomPct = setZoomPct;
  RS.camera.resetView = resetView;
  RS.camera.setScreenTransform = setScreenTransform;
  RS.camera.setWorldTransform = setWorldTransform;
  RS.camera.initStars = initStars;
  RS.camera.resize = resize;

})();
