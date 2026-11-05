window.RS = window.RS || {};
RS.input = RS.input || {};

(function () {
  const state = RS.state;

function onPointer(e) {
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;
  if (
    state.running &&
    !RS.shop.uiBlocksGameplay(e.target) &&
    !RS.shop.isShopOpen() &&
    !state.placingStructure &&
    !state.placingDefenseTarget &&
    !state.placingAmplifier
  ) {
    RS.combat.syncButtons(e.buttons);
  }
}

  RS.input.onPointer = onPointer;

  RS.input.bind = function bind() {
    const el = RS.dom.el;

    window.addEventListener("resize", RS.camera.resize);
    window.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
      const factor = e.deltaY < 0 ? RS.ZOOM_STEP : 1 / RS.ZOOM_STEP;
      RS.camera.zoomAt(state.mouse.x, state.mouse.y, factor);
    }, { passive: false });
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
    window.addEventListener("pointerdown", (e) => {
      if (e.button === 1) e.preventDefault();
      if (!state.running || RS.shop.isShopOpen() || RS.shop.isMsgPopupOpen()) return;
      if (RS.shop.uiBlocksGameplay(e.target)) return;
      onPointer(e);
      if (state.placingStructure) {
        if (e.button === 0) {
          e.preventDefault();
          const mw = RS.structures.mouseWorld();
          RS.structures.placeStructureAt(mw.x, mw.y);
        }
        return;
      }
      if (state.placingDefenseTarget) {
        if (e.button === 0) {
          e.preventDefault();
          const mw = RS.structures.mouseWorld();
          RS.tools.placeTargetAt(mw.x, mw.y);
        }
        return;
      }
      if (state.placingAmplifier) {
        if (e.button === 0) {
          e.preventDefault();
          const mw = RS.structures.mouseWorld();
          RS.tools.placeAmplifierAt(mw.x, mw.y);
        }
        return;
      }
      RS.combat.syncButtons(e.buttons);
    });
    window.addEventListener("pointerup", (e) => {
      if (!state.running) return;
      RS.combat.syncButtons(e.buttons);
    });
    window.addEventListener("pointercancel", RS.combat.clearButtons);
    window.addEventListener("pointerleave", RS.combat.clearButtons);
    window.addEventListener("blur", RS.combat.clearButtons);

  };
})();
