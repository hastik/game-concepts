window.RS = window.RS || {};

RS.update = function update(dt) {
  const state = RS.state;
  state.time += dt;
  RS.perf.tickRetarget(dt);
  RS.camera.updateAim(dt);
  // Aim pads (before combat SFX / enemy forces)
  {
    const aw = RS.camera.aimWorld();
    const defT = state.defenseTarget;
    state.gravityRepel = !!(
      defT &&
      Math.hypot(defT.x - aw.x, defT.y - aw.y) <= defT.size * 0.5
    );
    const amp = state.amplifier;
    state.ampActive = !!(
      amp &&
      Math.hypot(amp.x - aw.x, amp.y - aw.y) <= amp.size * 0.5
    );
  }
  RS.combat.tick(dt);
  RS.enemies.tick(dt);
  RS.structures.tick(dt);
  RS.tools.tick(dt);
  RS.loot.tick(dt);
  RS.waves.tickEnd(dt);
};
