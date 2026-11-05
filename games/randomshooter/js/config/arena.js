window.RS = window.RS || {};
RS.config = RS.config || {};

RS.ZOOM_MIN = 0.09;
RS.ZOOM_MAX = 3;
RS.ZOOM_STEP = 1.12;
/** Wave 1 arena is sized so fitZoom ≈ this (300% → arena = viewport / 3). */
RS.ARENA_START_FIT_ZOOM = 3;
/** Arena side grows +8% relative to wave-1 size each wave after. */
RS.ARENA_GROWTH_PER_WAVE = 0.08;
/** Enemy locomotion (vx/vy, wobble, healer seek) — not gravity pull. */
RS.ENEMY_MOVE_SCALE = 0.5;
RS.LOOT_DROP_CHANCE = 0.1;
RS.LOOT_PICKUP_RADIUS = 36;
RS.LOOT_VACUUM_PULL = 980;
RS.WAVE_UPGRADE_DELAY = 0.5; // after loot vacuum, before upgrades popup
RS.LOOT_KINDS = ["normal", "healer", "tank", "guidedTank", "gainer", "mothership", "rammer", "sniper", "splitter", "cloaker", "guidedCloaker"];
RS.WAVE_VISUAL_LIFE = 0.55;
RS.BULLET_TIME_SCALE = 0.05; // 20× slower
RS.SAVE_VERSION = 1;
RS.SAVE_KEY = "randomshooter9_save_v1";

/** Player objective marker (Tools → Add target). */
RS.DEFENSE_TARGET = {
  size: 58,
  /** Max HP scales with current wave. */
  maxHp: (wave) => 36 + Math.max(1, wave || 1) * 10,
  /** HP lost per second while an enemy overlaps the target. */
  contactDps: 5,
  color: "#ffe066",
};

/** Aim pad that doubles grav / laser while the crosshair is over it. */
RS.AMPLIFIER = {
  size: 64,
  mul: 2,
  color: "#5dff9a",
};

RS.config.arena = {
  ZOOM_MIN: RS.ZOOM_MIN,
  ZOOM_MAX: RS.ZOOM_MAX,
  ZOOM_STEP: RS.ZOOM_STEP,
  ARENA_START_FIT_ZOOM: RS.ARENA_START_FIT_ZOOM,
  ARENA_GROWTH_PER_WAVE: RS.ARENA_GROWTH_PER_WAVE,
  ENEMY_MOVE_SCALE: RS.ENEMY_MOVE_SCALE,
  LOOT_DROP_CHANCE: RS.LOOT_DROP_CHANCE,
  LOOT_PICKUP_RADIUS: RS.LOOT_PICKUP_RADIUS,
  LOOT_VACUUM_PULL: RS.LOOT_VACUUM_PULL,
  WAVE_UPGRADE_DELAY: RS.WAVE_UPGRADE_DELAY,
  LOOT_KINDS: RS.LOOT_KINDS,
  WAVE_VISUAL_LIFE: RS.WAVE_VISUAL_LIFE,
  BULLET_TIME_SCALE: RS.BULLET_TIME_SCALE,
  SAVE_VERSION: RS.SAVE_VERSION,
  SAVE_KEY: RS.SAVE_KEY,
};
